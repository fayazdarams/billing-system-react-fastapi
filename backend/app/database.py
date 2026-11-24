# app/database.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from app.db_errors import handle_db_error

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set in .env")

engine = create_engine(
    DATABASE_URL,
    connect_args={"connect_timeout": 3},
    pool_pre_ping=True,
    pool_timeout=5,
)

def test_connection():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT current_database()"))
            return result.scalar()
    except SQLAlchemyError as e:
        # No rollback needed here - engine.connect() has no transaction to rollback
        # handle_db_error will walk: InterfaceError / DatabaseError
        # -> OperationalError / etc. -> exact grandchild
        handle_db_error(e)