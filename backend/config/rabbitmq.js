/**
 * config/rabbitmq.js
 *
 * Singleton RabbitMQ channel using amqplib.
 *
 * Why singleton?
 *   Creating a new connection per request is expensive.  A single long-lived
 *   TCP connection with a channel pool is the recommended pattern for Node.js.
 *
 * Durability:
 *   - The queue is declared with { durable: true } so it survives broker restarts.
 *   - Messages are published with { persistent: true } (deliveryMode: 2) so they
 *     are written to disk before the broker acks the publish.
 *
 * Reconnection:
 *   On connection error / close we attempt an exponential-backoff reconnect
 *   (max 5 attempts) before giving up and crashing the process.  In production
 *   a process manager (PM2 / k8s) will restart the app.
 */

const amqplib = require('amqplib')

const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'problem_generation'
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost'

let connection = null
let channel = null
let retryCount = 0
const MAX_RETRIES = 5

async function connect() {
  try {
    connection = await amqplib.connect(RABBITMQ_URL)

    connection.on('error', (err) => {
      console.error('[RabbitMQ] Connection error:', err.message)
    })
    connection.on('close', () => {
      console.warn('[RabbitMQ] Connection closed. Reconnecting...')
      channel = null
      connection = null
      scheduleReconnect()
    })

    channel = await connection.createChannel()

    // Declare queue (idempotent — safe to call every startup)
    await channel.assertQueue(QUEUE_NAME, {
      durable: true,       // survives broker restart
      arguments: {
        // Dead-letter exchange: failed/nacked messages go here so they are not lost
        'x-dead-letter-exchange': 'problem_generation_dlx',
      },
    })

    // Also declare the dead-letter queue so messages landing there are kept
    await channel.assertExchange('problem_generation_dlx', 'direct', { durable: true })
    await channel.assertQueue('problem_generation_dead', { durable: true })
    await channel.bindQueue('problem_generation_dead', 'problem_generation_dlx', '')

    retryCount = 0
    console.log('[RabbitMQ] Connected and channel ready.')
  } catch (err) {
    console.error('[RabbitMQ] Connect failed:', err.message)
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (retryCount >= MAX_RETRIES) {
    console.error('[RabbitMQ] Max retries reached. Problem creation will be unavailable until RabbitMQ is reachable.')
    // Do NOT exit — the rest of the server (auth, profile, etc.) stays healthy.
    // When a publish is attempted, getChannel() throws and the controller refunds coins gracefully.
    return
  }
  const delay = Math.min(1000 * 2 ** retryCount, 30000) // exponential, max 30s
  retryCount++
  console.log(`[RabbitMQ] Retrying in ${delay / 1000}s (attempt ${retryCount}/${MAX_RETRIES})…`)
  setTimeout(connect, delay)
}

/**
 * getChannel() — returns the active channel, or throws if not ready.
 * Controllers call this before publishing.
 */
function getChannel() {
  if (!channel) throw new Error('RabbitMQ channel not ready. Please retry in a moment.')
  return channel
}

/**
 * publishProblemRequest(payload)
 *
 * Serialises the payload to JSON and publishes to the problem-generation queue.
 * Returns true on success.
 *
 * persistent: true  → broker writes to disk before acking (survives crash)
 */
function publishProblemRequest(payload) {
  const ch = getChannel()
  return ch.sendToQueue(
    QUEUE_NAME,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  )
}

module.exports = { connect, getChannel, publishProblemRequest, QUEUE_NAME }
