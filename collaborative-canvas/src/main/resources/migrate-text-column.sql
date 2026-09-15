-- Widen canvas_objects.text from varchar(255) to unbounded text.
-- Hibernate ddl-auto=update does not reliably alter an existing varchar column, so apply this
-- once against existing databases. Fresh databases get `text` from the entity mapping.
ALTER TABLE canvas_objects ALTER COLUMN text TYPE text;
