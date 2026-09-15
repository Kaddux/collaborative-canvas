-- Add the font_size column if an existing database predates it (Hibernate ddl-auto may
-- skip adding a NOT NULL column to a populated table), then backfill sensible defaults.
ALTER TABLE canvas_objects ADD COLUMN IF NOT EXISTS font_size double precision;
UPDATE canvas_objects SET font_size = 14 WHERE font_size IS NULL AND type = 'STICKY_NOTE';
UPDATE canvas_objects SET font_size = 16 WHERE font_size IS NULL;
