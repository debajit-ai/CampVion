import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.api.router import api_router
from app.db.database import engine, Base, SessionLocal
from app.db.migrations import run_migrations
from app.db.seed_engine import seed_campus_database
from app.db.seed_users import seed_demo_users
from app.db import models
from app.services import student_service, leave_service
import app.tools  # Ensure all tools are registered in ToolRegistry

# Initialize logging
setup_logging()

# Run safe database migrations
run_migrations()

# Ensure base demo data and default institutional accounts exist (idempotent)
db_init = SessionLocal()
try:
    if db_init.query(models.Student).count() == 0 or db_init.query(models.CampusPolicy).count() == 0:
        seed_campus_database(profile="small", reset=False)

    seed_demo_users(db=db_init, verbose=False)

    # Ensure all registered student users have authentic linked Student records (not hijacked S001)
    for student_acc in db_init.query(models.UserAccount).filter(models.UserAccount.role == "student").all():
        student_service.ensure_student_for_user(db_init, student_acc)

    # Idempotently seed sample pending non-leave requests (library_room, hostel_allocation, certificate)
    leave_service.seed_sample_multi_type_requests(db_init)
finally:
    db_init.close()

app = FastAPI(
    title=settings.APP_NAME,
    description="CampVion — Intelligent Campus Operations & Agentic Multi-Step Workflow Engine",
    version=settings.APP_VERSION
)

# CORS configuration supporting HttpOnly session cookies across local (IPv4/IPv6) and deployed cloud origins (Vercel / Render)
_frontend_url = os.getenv("FRONTEND_URL", settings.FRONTEND_URL or "").strip()
_base_origins = {
    settings.FRONTEND_BASE_URL.rstrip("/"),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
}
if _frontend_url and _frontend_url != "*":
    _base_origins.add(_frontend_url.rstrip("/"))
_allowed_origins = sorted(_base_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-CSRF-Token"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health"
    }
