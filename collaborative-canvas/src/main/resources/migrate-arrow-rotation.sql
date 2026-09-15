-- One-time migration: convert existing SE-only arrows to the tail + length + rotation model.
-- Old arrows stored the tip offset in (width, height) with rotation = 0.
-- New arrows store the tip along +x by `width`, with the direction in `rotation` (degrees).
UPDATE canvas_objects
SET rotation = degrees(atan2(height, width)),
    width    = sqrt(width * width + height * height),
    height   = 0
WHERE type = 'ARROW'
  AND rotation = 0
  AND height <> 0;
