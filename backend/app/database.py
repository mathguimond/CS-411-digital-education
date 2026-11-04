from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from flask import current_app
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, event, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.pool import StaticPool


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


DOCUMENT = JSON().with_variant(JSONB(), "postgresql")


class AssignmentState(Base):
    __tablename__ = "assignment_state"
    id: Mapped[int] = mapped_column(primary_key=True)
    counts: Mapped[dict] = mapped_column(DOCUMENT, nullable=False)


class Participant(Base):
    __tablename__ = "participants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    gender: Mapped[str] = mapped_column(String(10), nullable=False)
    age: Mapped[str] = mapped_column(String(3), nullable=False)
    school_level: Mapped[str] = mapped_column(String(30), nullable=False)
    degree: Mapped[str] = mapped_column(String(200), nullable=False)
    referrer: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    condition: Mapped[str] = mapped_column(String(10), nullable=False)
    lesson_version: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    pretest_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    transfer_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    survey_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    snapshot: Mapped[dict] = mapped_column(DOCUMENT, default=dict, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class StudyEvent(Base):
    __tablename__ = "study_events"
    __table_args__ = (UniqueConstraint("participant_id", "client_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.id"), index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False)
    type: Mapped[str] = mapped_column(String(80), nullable=False)
    activity_id: Mapped[str | None] = mapped_column(String(80))
    question_id: Mapped[str | None] = mapped_column(String(80))
    occurred_at: Mapped[str | None] = mapped_column(String(40))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    elapsed_ms: Mapped[int | None] = mapped_column(Integer)

    server_elapsed_ms: Mapped[int | None] = mapped_column(Integer)
    details: Mapped[dict] = mapped_column(DOCUMENT, nullable=False)


class ActivitySubmission(Base):
    __tablename__ = "activity_submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.id"), index=True)
    activity_id: Mapped[str] = mapped_column(String(80), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    elapsed_ms: Mapped[int | None] = mapped_column(Integer)
    payload: Mapped[dict] = mapped_column(DOCUMENT, nullable=False)


class SyncBatch(Base):
    __tablename__ = "sync_batches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.id"), index=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)


class HintTurn(Base):
    __tablename__ = "hint_turns"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.id"), index=True)
    question_id: Mapped[str] = mapped_column(String(80), nullable=False)
    activity_id: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    reply: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    elapsed_ms: Mapped[int | None] = mapped_column(Integer)
    context: Mapped[dict] = mapped_column(DOCUMENT, default=dict, nullable=False)
    model: Mapped[str | None] = mapped_column(String(128))


def database_url(value):
    if value.startswith(("postgres://", "postgresql://")):
        value = "postgresql+psycopg://" + value.split("://", 1)[1]
    if value.startswith("postgresql+psycopg://") and "sslmode=" not in value:
        value += ("&" if "?" in value else "?") + "sslmode=require"
    return value


def upgrade_schema(engine):
    from alembic import command
    from alembic.config import Config
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def init_database(app):
    url = database_url(app.config["DATABASE_URL"])
    options = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False, "timeout": 15}
        if url in {"sqlite://", "sqlite:///:memory:"}:
            options["poolclass"] = StaticPool
    else:
        options.update(pool_size=2, max_overflow=1, pool_recycle=300, connect_args={"connect_timeout": 10})
    options.setdefault("connect_args", {}).update(app.config.get("DATABASE_CONNECT_ARGS", {}))
    engine = create_engine(url, **options)
    if engine.dialect.name == "sqlite":
        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _record):
            connection.execute("PRAGMA foreign_keys=ON")
    app.extensions["study_database"] = engine
    if app.config.get("DATABASE_AUTO_INIT") and app.testing:
        Base.metadata.create_all(engine)
        with Session(engine) as db, db.begin():
            if db.get(AssignmentState, 1) is None:
                db.add(AssignmentState(id=1, counts={"ai": 0, "control": 0, "referrers": {}}))
    elif app.config.get("DATABASE_AUTO_INIT"):
        upgrade_schema(engine)

    @app.cli.command("db-upgrade")
    def upgrade():
        """Apply the versioned study schema before deploying the web process."""
        upgrade_schema(engine)


@contextmanager
def transaction(write=False):
    engine = current_app.extensions["study_database"]
    with Session(engine, expire_on_commit=False) as db, db.begin():
        if write and engine.dialect.name == "sqlite":
            db.execute(text("BEGIN IMMEDIATE"))
        yield db
