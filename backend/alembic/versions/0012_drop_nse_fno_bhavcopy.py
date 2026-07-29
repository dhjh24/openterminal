"""Drop India-only NSE F&O bhavcopy table (Phase 5 US migration)."""

from __future__ import annotations

from alembic import op

revision = "0012_drop_nse_fno_bhavcopy"
down_revision = "0011_saved_views"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute("DROP TABLE IF EXISTS nse_fno_bhavcopy")
    else:
        op.execute("DROP TABLE IF EXISTS nse_fno_bhavcopy CASCADE")


def downgrade() -> None:
    # Forward-only removal of India-only storage.
    pass
