"""Create participant, assignment, response, event, and hint records."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001_study"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    document = sa.JSON().with_variant(JSONB(), "postgresql")
    op.create_table("assignment_state", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("counts", document, nullable=False))
    op.bulk_insert(sa.table("assignment_state", sa.column("id", sa.Integer()), sa.column("counts", document)), [{"id": 1, "counts": {"ai": 0, "control": 0, "referrers": {}}}])
    op.create_table("participants",
        sa.Column("id", sa.String(36), primary_key=True), sa.Column("token_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("gender", sa.String(10), nullable=False), sa.Column("age", sa.String(3), nullable=False),
        sa.Column("school_level", sa.String(30), nullable=False), sa.Column("degree", sa.String(200), nullable=False),
        sa.Column("referrer", sa.String(10), nullable=False), sa.Column("condition", sa.String(10), nullable=False),
        sa.Column("lesson_version", sa.String(40), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pretest_completed_at", sa.DateTime(timezone=True)), sa.Column("transfer_completed_at", sa.DateTime(timezone=True)), sa.Column("survey_completed_at", sa.DateTime(timezone=True)),
        sa.Column("snapshot", document, nullable=False), sa.Column("revision", sa.Integer(), nullable=False))
    op.create_index("ix_participants_referrer", "participants", ["referrer"])
    for name, columns in [
        ("study_events", [sa.Column("client_id", sa.String(36), nullable=False), sa.Column("type", sa.String(80), nullable=False), sa.Column("activity_id", sa.String(80)), sa.Column("question_id", sa.String(80)), sa.Column("occurred_at", sa.String(40)), sa.Column("received_at", sa.DateTime(timezone=True), nullable=False), sa.Column("elapsed_ms", sa.Integer()), sa.Column("server_elapsed_ms", sa.Integer()), sa.Column("details", document, nullable=False)]),
        ("activity_submissions", [sa.Column("activity_id", sa.String(80), nullable=False), sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False), sa.Column("elapsed_ms", sa.Integer()), sa.Column("payload", document, nullable=False)]),
        ("sync_batches", [sa.Column("revision", sa.Integer(), nullable=False)]),
        ("hint_turns", [sa.Column("question_id", sa.String(80), nullable=False), sa.Column("activity_id", sa.String(80), nullable=False), sa.Column("status", sa.String(12), nullable=False), sa.Column("message", sa.Text(), nullable=False), sa.Column("reply", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("elapsed_ms", sa.Integer()), sa.Column("context", document, nullable=False), sa.Column("model", sa.String(128))]),
    ]:
        op.create_table(name, sa.Column("id", sa.String(36), primary_key=True), sa.Column("participant_id", sa.String(36), sa.ForeignKey("participants.id"), nullable=False), *columns)
        op.create_index(f"ix_{name}_participant_id", name, ["participant_id"])
    with op.batch_alter_table("study_events") as batch:
        batch.create_unique_constraint("uq_study_events_participant_client", ["participant_id", "client_id"])


def downgrade():
    raise RuntimeError("Automatic deletion of collected study records is disabled.")
