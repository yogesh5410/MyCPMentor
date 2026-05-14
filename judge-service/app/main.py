"""
MyCPMentor – Judge Service
FastAPI application factory.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)

app = FastAPI(
    title="MyCPMentor Judge Service",
    description=(
        "Production-grade secure code execution engine. "
        "Runs user code in isolated Docker containers with hard resource limits."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", include_in_schema=False)
async def root():
    return {"service": "judge-service", "version": "2.0.0", "status": "running"}
