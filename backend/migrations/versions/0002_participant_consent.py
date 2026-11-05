"""Record explicit consent without attributing consent to existing participants."""
from alembic import op
import sqlalchemy as sa

revision = "0002_participant_consent"
down_revision = "0001_study"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("participants", sa.Column("consented_at", sa.DateTime(timezone=True)))
    op.add_column("participants", sa.Column("consent_version", sa.String(40)))
    op.add_column("participants", sa.Column("consent_text", sa.Text()))


def downgrade():
    raise RuntimeError("Automatic deletion of collected consent records is disabled.")
