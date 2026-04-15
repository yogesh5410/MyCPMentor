"""
ai_service/worker.py

RabbitMQ consumer that drives the AI problem-generation pipeline.

Architecture:
  - Connects to RabbitMQ via aio_pika (async)
  - Listens on the 'problem_generation' queue
  - For each message: runs the 5-stage Gemini pipeline
  - Acks on success, Nacks (no requeue) on exhausted retries → DLQ
  - prefetch_count=1 ensures at most 1 job processes at a time per worker instance
    (prevents overwhelming the free-tier API)

Retry logic:
  - Each AMQP message is processed up to MAX_ATTEMPTS times
  - The attempt count is tracked in MongoDB (not in AMQP headers) for accuracy
  - If attempts >= MAX_ATTEMPTS: nack → dead-letter queue + coins refunded via HTTP call
"""

import asyncio
import json
import logging
import os

import aio_pika
import httpx

import db
from config import RABBITMQ_URL, RABBITMQ_QUEUE
from pipeline import run_pipeline, PipelineError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3

# Node.js backend URL — used to trigger coin refund on failure
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")  # shared secret for internal calls


async def refund_coins_if_needed(request_id: str, user_id: str) -> None:
    """
    Calls the Node.js backend to refund coins on job failure.
    Uses an internal API key to prevent unauthorized access.
    """
    if not INTERNAL_API_KEY:
        logger.warning("[Worker] INTERNAL_API_KEY not set — skipping coin refund call")
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{BACKEND_URL}/api/internal/refund",
                json={"requestId": request_id, "userId": user_id},
                headers={"x-internal-key": INTERNAL_API_KEY},
            )
            if resp.status_code != 200:
                logger.error(f"[Worker] Refund call failed: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        logger.error(f"[Worker] Refund call exception: {e}")


async def process_message(message: aio_pika.IncomingMessage) -> None:
    async with message.process(requeue=False):
        try:
            payload = json.loads(message.body.decode())
        except json.JSONDecodeError:
            logger.error("[Worker] Invalid JSON in message body. Discarding.")
            return  # auto-acked by context manager; malformed messages go to DLQ via nack below

        request_id = payload.get("requestId")
        user_id = payload.get("userId")
        prompt = payload.get("prompt", "")
        requester_role = payload.get("requesterRole", "user")

        if not request_id or not prompt:
            logger.error(f"[Worker] Message missing requestId or prompt: {payload}")
            return

        logger.info(f"[Worker] Processing request {request_id}")

        # Fetch current state to check attempt count
        record = await db.get_request(request_id)
        if not record:
            logger.error(f"[Worker] ProblemRequest {request_id} not found in DB. Discarding.")
            return

        attempts = record.get("attempts", 0)
        if attempts >= MAX_ATTEMPTS:
            logger.warning(
                f"[Worker] Request {request_id} exceeded {MAX_ATTEMPTS} attempts. Sending to DLQ."
            )
            await db.mark_failed(request_id, f"Exceeded {MAX_ATTEMPTS} attempts", "worker")
            await refund_coins_if_needed(request_id, user_id)
            # Nack without requeue → message goes to dead-letter queue
            await message.nack(requeue=False)
            return

        await db.set_processing(request_id)

        try:
            result = await run_pipeline(request_id, prompt, db)

            # Review gate: if review failed, mark as failed (but don't refund — problem was generated)
            review = result.get("review", {})
            if not review.get("passed"):
                logger.warning(
                    f"[Worker] Request {request_id} failed LLM review: {review.get('notes', '')[:200]}"
                )
                await db.mark_failed(
                    request_id,
                    f"LLM review failed: {review.get('notes', '')[:500]}",
                    "review",
                )
                # Still refund coins — user shouldn't pay for a bad generation
                await refund_coins_if_needed(request_id, user_id)
                return

            # Create Problem doc in MongoDB
            problem_id = await db.create_problem(
                request_id=request_id,
                requester_id=user_id,
                requester_role=requester_role,
                result=result,
            )
            await db.mark_completed(request_id, problem_id)
            logger.info(f"[Worker] ✓ Request {request_id} → Problem {problem_id}")

        except PipelineError as e:
            logger.error(f"[Worker] PipelineError at stage '{e.stage}': {e}")
            await db.mark_failed(request_id, str(e), e.stage)

            # If still under max attempts, re-publish to queue so it can be retried
            if attempts + 1 < MAX_ATTEMPTS:
                logger.info(f"[Worker] Will retry request {request_id} (attempt {attempts + 1}/{MAX_ATTEMPTS})")
                # Nack with requeue=True (default) is NOT used because it could cause a tight loop.
                # Instead, re-publish the message after a short delay.
                await asyncio.sleep(5)
                current_app = _get_channel()
                if current_app:
                    await current_app.default_exchange.publish(
                        aio_pika.Message(
                            body=message.body,
                            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                        ),
                        routing_key=RABBITMQ_QUEUE,
                    )
            else:
                await refund_coins_if_needed(request_id, user_id)

        except Exception as e:
            logger.exception(f"[Worker] Unexpected error for request {request_id}: {e}")
            await db.mark_failed(request_id, f"Unexpected error: {str(e)[:500]}", "unknown")
            await refund_coins_if_needed(request_id, user_id)


# ── Channel reference for internal re-publish ─────────────────────────────────
_channel_ref = None


def _get_channel():
    return _channel_ref


# ── Main consumer loop ────────────────────────────────────────────────────────

async def main():
    global _channel_ref

    logger.info("[Worker] Connecting to RabbitMQ...")
    connection = await aio_pika.connect_robust(
        RABBITMQ_URL,
        reconnect_interval=5,
    )

    async with connection:
        channel = await connection.channel()
        _channel_ref = channel

        # Only process 1 message at a time (free-tier API rate limit protection)
        await channel.set_qos(prefetch_count=1)

        queue = await channel.declare_queue(
            RABBITMQ_QUEUE,
            durable=True,
            arguments={"x-dead-letter-exchange": "problem_generation_dlx"},
        )

        logger.info(f"[Worker] Listening on queue '{RABBITMQ_QUEUE}'...")
        await queue.consume(process_message)

        # Keep running
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
