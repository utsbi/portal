CREATE OR REPLACE FUNCTION public.chat_begin_turn(
  _session_id bigint, _query text, _attachments jsonb, _model_preference text,
  _history_len int, _regenerate boolean
)
RETURNS TABLE (user_message_id bigint, assistant_message_id bigint, active_leaf_id bigint)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  _meta jsonb; _leaf_id bigint; _user_parent bigint; _asst_parent bigint;
  _leaf_role text; _leaf_parent bigint; _new_user_id bigint; _new_asst_id bigint;
BEGIN
  SELECT metadata INTO _meta FROM public.client_chat_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session % not found or not owned', _session_id USING ERRCODE = 'no_data_found';
  END IF;
  _leaf_id := NULLIF(_meta ->> 'active_leaf_id', '')::bigint;
  IF _leaf_id IS NULL THEN
    SELECT id INTO _leaf_id FROM public.client_chat_messages WHERE session_id = _session_id ORDER BY id DESC LIMIT 1;
  END IF;
  IF _regenerate THEN
    IF _leaf_id IS NOT NULL THEN
      SELECT role, parent_id INTO _leaf_role, _leaf_parent FROM public.client_chat_messages WHERE id = _leaf_id AND session_id = _session_id;
      _asst_parent := CASE WHEN _leaf_role = 'assistant' THEN _leaf_parent ELSE _leaf_id END;
    END IF;
  ELSE
    IF _leaf_id IS NOT NULL AND _history_len > 0 THEN
      WITH RECURSIVE active_path AS (
        SELECT id, parent_id, 1 AS depth FROM public.client_chat_messages WHERE id = _leaf_id AND session_id = _session_id
        UNION ALL
        SELECT m.id, m.parent_id, ap.depth + 1 FROM public.client_chat_messages m JOIN active_path ap ON m.id = ap.parent_id WHERE ap.depth < 500
      ),
      ranked AS (SELECT id, row_number() OVER (ORDER BY depth DESC) AS rn, count(*) OVER () AS path_len FROM active_path)
      SELECT id INTO _user_parent FROM ranked WHERE rn = LEAST(_history_len, (SELECT path_len FROM ranked LIMIT 1));
    END IF;
    INSERT INTO public.client_chat_messages (session_id, role, content, attachments, model_preference, parent_id)
    VALUES (_session_id, 'user', _query, _attachments, _model_preference, _user_parent) RETURNING id INTO _new_user_id;
    _asst_parent := _new_user_id;
  END IF;
  INSERT INTO public.client_chat_messages (session_id, role, content, sources, model_preference, parent_id)
  VALUES (_session_id, 'assistant', '', NULL, _model_preference, _asst_parent) RETURNING id INTO _new_asst_id;
  UPDATE public.client_chat_sessions
  SET metadata = COALESCE(_meta, '{}'::jsonb) || jsonb_build_object('active_leaf_id', _new_asst_id), updated_at = now()
  WHERE id = _session_id;
  user_message_id := _new_user_id; assistant_message_id := _new_asst_id; active_leaf_id := _new_asst_id;
  RETURN NEXT;
END; $$;

REVOKE EXECUTE ON FUNCTION public.chat_begin_turn(bigint, text, jsonb, text, int, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_begin_turn(bigint, text, jsonb, text, int, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.chat_begin_turn(bigint, text, jsonb, text, int, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_begin_turn(bigint, text, jsonb, text, int, boolean) TO service_role;
