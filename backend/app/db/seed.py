import logging
from app.db.seed_engine import seed_campus_database

logger = logging.getLogger("campvion.seed")

def seed_db(profile: str = "small", reset: bool = False):
    """
    Standard entrypoint for seeding CampVion campus data.
    Delegates to the modular seed engine with profile support (small, medium, large).
    """
    seed_campus_database(profile=profile, reset=reset)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_db()
