"""
FastAPI entry point.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api import health, simulations, breach

app = FastAPI(
    title="CyberFlares — Dam Break Inundation Framework",
    description="NTRO SIH 26161 · SPH + Delft3D + GEE",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(breach.router)
app.include_router(simulations.router)


@app.get("/")
def root():
    return {"service": "cyberflares-backend", "docs": "/docs"}
