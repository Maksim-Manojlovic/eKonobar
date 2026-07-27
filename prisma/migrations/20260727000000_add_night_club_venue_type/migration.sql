-- Add NIGHT_CLUB to the VenueType taxonomy.
--
-- Belgrade night clubs and splavovi were already leaking into the codebase as
-- NIGHT_CLUB / NIGHTCLUB (waiter passport picker, landing page art) while the
-- enum had neither value, so the option was selectable but matched no venue.
--
-- AFTER 'BAR' keeps the Postgres enum ordinal order aligned with schema.prisma
-- so later `migrate diff` runs stay quiet. Additive only — no existing row
-- changes, nothing to back-fill.

ALTER TYPE "VenueType" ADD VALUE IF NOT EXISTS 'NIGHT_CLUB' AFTER 'BAR';
