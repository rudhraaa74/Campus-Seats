-- ─────────────────────────────────────────────────────────────
-- 01_extensions.sql
-- Required PostgreSQL extensions for SeatSync
-- ─────────────────────────────────────────────────────────────

-- btree_gist allows indexing standard scalar data types (such as INT, UUID)
-- alongside range types in GiST indexes. This is strictly required for the
-- show venue-clash constraint (BR2):
--   EXCLUDE USING gist (venue_id WITH =, tstzrange(...) WITH &&)
CREATE EXTENSION IF NOT EXISTS btree_gist;
