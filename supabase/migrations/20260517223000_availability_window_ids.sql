-- Backfill stable per-window ids onto calendars.availability so the
-- appointments editor can use them as React keys. The data shape goes
-- from `{ mon: [{ start, end }, ...] }` to
-- `{ mon: [{ id, start, end }, ...] }`. New writes already stamp the id
-- application-side (src/functions/appointments.functions.ts), so this
-- migration only fixes rows persisted before that change shipped.
--
-- Safe to re-run: rows whose windows already carry `id` are skipped.

UPDATE calendars c
SET availability = (
  SELECT jsonb_object_agg(
    day_key,
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN win ? 'id' THEN win
            ELSE win || jsonb_build_object('id', gen_random_uuid()::text)
          END
        )
        FROM jsonb_array_elements(windows) AS win
      ),
      '[]'::jsonb
    )
  )
  FROM jsonb_each(c.availability) AS entries(day_key, windows)
)
WHERE c.availability IS NOT NULL
  AND c.availability <> '{}'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(c.availability) AS e(d, ws),
         jsonb_array_elements(ws) AS w
    WHERE NOT (w ? 'id')
  );
