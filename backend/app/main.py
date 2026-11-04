from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.api.router import api_router
from app.db.database import engine, Base, SessionLocal
from app.db.migrations import run_migrations
from app.db.seed_engine import seed_campus_database
from app.db import models
from app.core.security import hash_password
import app.tools  # Ensure all tools are registered in ToolRegistry

# Initialize logging
setup_logging()

# Run safe database migrations
run_migrations()

# Ensure base demo data and default institutional accounts exist
db_init = SessionLocal()
try:
    if db_init.query(models.Student).count() == 0 or db_init.query(models.CampusPolicy).count() == 0:
        seed_campus_database(profile="small", reset=False)

    if db_init.query(models.UserAccount).count() == 0:
        db_init.add_all([
            models.UserAccount(
                email="alice@lpu.edu",
                full_name="Alice Sharma",
                password_hash=hash_password("CampVion@2026"),
                role="student",
                student_id="S001",
                is_active=1,
            ),
            models.UserAccount(
                email="admin@campvion.edu",
                full_name="Dr. Rajesh Rao",
                password_hash=hash_password("Admin@CampVion2026"),
                role="administrator",
                student_id="S001",
                is_active=1,
            ),
        ])
        db_init.commit()
finally:
    db_init.close()

app = FastAPI(
    title=settings.APP_NAME,
    description="CampVion — Intelligent Campus Operations & Agentic Multi-Step Workflow Engine",
    version=settings.APP_VERSION
)

# CORS configuration supporting HttpOnly session cookies across local and deployed origins
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health"
    }
