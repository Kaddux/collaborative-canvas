-- Backfill font_size for objects created before the column existed.
-- ddl-auto=update adds the column defaulting to 0; the render layer falls back per type
-- when 0, but backfill so persisted values are explicit.
UPDATE canvas_objects SET font_size = 14 WHERE font_size = 0 AND type = 'STICKY_NOTE';
UPDATE canvas_objects SET font_size = 16 WHERE font_size = 0;
