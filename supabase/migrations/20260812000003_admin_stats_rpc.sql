-- One service-role-only snapshot RPC for the internal admin dashboard.
-- Keeping aggregation in Postgres avoids downloading every usage event to the
-- browser/server action as the portal grows.

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'storage', 'pg_temp'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'profiles', jsonb_build_object(
      'total', (SELECT count(*) FROM public.profiles),
      'portal_accounts', (SELECT count(*) FROM public.profiles WHERE uid IS NOT NULL),
      'by_role', COALESCE((
        SELECT jsonb_object_agg(role::text, role_count)
        FROM (
          SELECT role, count(*) AS role_count
          FROM public.profiles
          WHERE uid IS NOT NULL
          GROUP BY role
        ) profile_counts
      ), '{}'::jsonb),
      'member_profiles_without_account', (
        SELECT count(*)
        FROM public.profiles
        WHERE role = 'member'::extensions.profile_role AND uid IS NULL
      )
    ),
    'projects', jsonb_build_object(
      'total', (SELECT count(*) FROM public.projects),
      'default_project_id', (SELECT id FROM public.projects WHERE is_default LIMIT 1),
      'memberships', (SELECT count(*) FROM public.project_members)
    ),
    'activity', jsonb_build_object(
      'chat_sessions', (SELECT count(*) FROM public.client_chat_sessions),
      'chat_messages', (SELECT count(*) FROM public.client_chat_messages),
      'messages', (SELECT count(*) FROM public.messages),
      'files', (SELECT count(*) FROM public.client_files),
      'knowledge_documents', (SELECT count(*) FROM public.client_knowledge)
    ),
    'ai_usage', jsonb_build_object(
      'requests', (SELECT count(*) FROM public.ai_usage_events),
      'prompt_tokens', COALESCE((SELECT sum(prompt_tokens) FROM public.ai_usage_events), 0),
      'completion_tokens', COALESCE((SELECT sum(completion_tokens) FROM public.ai_usage_events), 0),
      'reasoning_tokens', COALESCE((SELECT sum(reasoning_tokens) FROM public.ai_usage_events), 0),
      'total_tokens', COALESCE((SELECT sum(total_tokens) FROM public.ai_usage_events), 0),
      'estimated_cost_usd', COALESCE((SELECT sum(estimated_cost_usd) FROM public.ai_usage_events), 0)
    ),
    'ai_usage_by_user', COALESCE((
      SELECT jsonb_agg(user_usage ORDER BY (user_usage->>'total_tokens')::bigint DESC)
      FROM (
        SELECT jsonb_build_object(
          'profile_id', p.id,
          'name', p.name,
          'email', p.email,
          'role', p.role::text,
          'requests', count(e.id),
          'prompt_tokens', COALESCE(sum(e.prompt_tokens), 0),
          'completion_tokens', COALESCE(sum(e.completion_tokens), 0),
          'reasoning_tokens', COALESCE(sum(e.reasoning_tokens), 0),
          'total_tokens', COALESCE(sum(e.total_tokens), 0),
          'estimated_cost_usd', COALESCE(sum(e.estimated_cost_usd), 0),
          'last_used_at', max(e.created_at)
        ) AS user_usage
        FROM public.profiles p
        LEFT JOIN public.ai_usage_events e ON e.uid = p.uid
        WHERE p.uid IS NOT NULL
        GROUP BY p.id, p.name, p.email, p.role
        HAVING count(e.id) > 0
      ) grouped_usage
    ), '[]'::jsonb),
    'storage', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'bucket_id', bucket_id,
        'objects', object_count,
        'bytes', bytes_used
      ) ORDER BY bucket_id)
      FROM (
        SELECT
          bucket_id,
          count(*) AS object_count,
          COALESCE(sum(
            CASE
              WHEN metadata->>'size' ~ '^[0-9]+$'
              THEN (metadata->>'size')::bigint
              ELSE 0
            END
          ), 0) AS bytes_used
        FROM storage.objects
        GROUP BY bucket_id
      ) storage_usage
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO service_role;
