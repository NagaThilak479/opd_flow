from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .models import Patient
from .seed import seed_database
from .routes import queue, doctor, prediction, auth
from .schemas import HealthCheck

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema and seed demo data on startup
    Base.metadata.create_all(bind=engine)
    seed_database(force_reset=False)
    yield

app = FastAPI(
    title="OPD Flow API",
    description="Real-Time OPD Queue Management & Waiting-Time Prediction System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(queue.router)
app.include_router(doctor.router)
app.include_router(prediction.router)

@app.get("/", tags=["Root"])
def read_root():
    return {
        "service": "OPD Flow API",
        "description": "Know your place. Know your wait.",
        "docs_url": "/docs",
        "status": "online"
    }

@app.get("/api/health", response_model=HealthCheck, tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    active_tokens_count = db.query(Patient).filter(
        Patient.status.in_(["WAITING", "IN_CONSULTATION"])
    ).count()
    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": "sqlite_connected",
        "active_tokens": active_tokens_count
    }
