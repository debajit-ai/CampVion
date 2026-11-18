import logging
from app.db.seed_engine import seed_campus_database
from app.db.seed_users import seed_demo_users

logger = logging.getLogger("campvion.seed")


def seed_db(profile: str = "small", reset: bool = False):
    """
    Standard entrypoint for seeding CampVion campus data and demo user accounts.
    """
    seed_campus_database(profile=profile, reset=reset)
    seed_demo_users(verbose=True)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_db()
