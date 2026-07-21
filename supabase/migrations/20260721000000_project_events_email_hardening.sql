-- Bound user-controlled calendar content before it reaches storage or
-- transactional email, and stamp the first RSVP as well as later changes.

ALTER TABLE public.project_events
  DROP CONSTRAINT IF EXISTS project_events_title_bounded,
  DROP CONSTRAINT IF EXISTS project_events_description_bounded,
  DROP CONSTRAINT IF EXISTS project_events_location_bounded;

ALTER TABLE public.project_events
  ADD CONSTRAINT project_events_title_bounded
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  ADD CONSTRAINT project_events_description_bounded
    CHECK (description IS NULL OR char_length(description) <= 10000),
  ADD CONSTRAINT project_events_location_bounded
    CHECK (location IS NULL OR char_length(location) <= 500);

CREATE OR REPLACE FUNCTION public.stamp_event_attendee_responded_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.response <> 'needsAction' THEN
      NEW.responded_at := now();
    END IF;
  ELSIF NEW.response IS DISTINCT FROM OLD.response THEN
    IF NEW.response <> 'needsAction' THEN
      NEW.responded_at := now();
    ELSE
      NEW.responded_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_event_attendee_responded_at
  ON public.project_event_attendees;
CREATE TRIGGER trg_stamp_event_attendee_responded_at
  BEFORE INSERT OR UPDATE ON public.project_event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.stamp_event_attendee_responded_at();
