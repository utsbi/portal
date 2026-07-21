import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation } from "./ConversationList";
import { fetchReadMap } from "./read-state";

/**
 * Participant-based conversation loader shared by every role's inbox.
 *
 * Replaces the old per-role queries that filtered conversations by
 * client_profile_id / director_profile_id (which only ever surfaced
 * director<->client threads). A conversation is now a set of
 * conversation_participants, so a single query — "the conversations I'm a
 * participant of" — covers client, director, member, internal, and group
 * threads uniformly. Display name is derived from the OTHER participants
 * (1:1 -> the peer's name; group -> "A, B +N"), falling back to the project
 * company name, then a neutral label (never a role word or raw id).
 */
export async function loadActorConversations(
  supabase: SupabaseClient,
  myProfileId: number,
): Promise<Conversation[]> {
  // 1. The conversation ids I belong to.
  const { data: myParts, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", myProfileId);
  if (error) throw new Error(error.message);

  const convoIds = [
    ...new Set((myParts ?? []).map((r) => r.conversation_id as number)),
  ];
  if (convoIds.length === 0) return [];

  // 2. Those conversations + 3. all their participants, in parallel. Surface a
  // real query error (RLS denial, network) instead of silently rendering an
  // empty inbox — RLS filtering returns fewer rows with NO error, so a populated
  // `error` is a genuine failure the caller should show.
  const [convoRes, partsRes] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, project_id, created_at")
      .in("id", convoIds),
    supabase
      .from("conversation_participants")
      .select("conversation_id, profile_id")
      .in("conversation_id", convoIds),
  ]);
  if (convoRes.error) throw new Error(convoRes.error.message);
  if (partsRes.error) throw new Error(partsRes.error.message);
  const convos = convoRes.data;
  const parts = partsRes.data;

  // Peer profile ids (everyone but me) and project ids to resolve.
  const peerIds = [
    ...new Set(
      (parts ?? [])
        .map((p) => p.profile_id as number)
        .filter((id) => id !== myProfileId),
    ),
  ];
  const projectIds = [
    ...new Set(
      (convos ?? []).map((c) => c.project_id as number | null).filter(Boolean),
    ),
  ] as number[];

  const [nameMap, projectMap] = await Promise.all([
    resolveNames(supabase, peerIds),
    resolveProjects(supabase, projectIds),
  ]);

  // Group peers per conversation (stable order by profile id).
  const peersByConvo = new Map<number, number[]>();
  for (const p of parts ?? []) {
    const cid = p.conversation_id as number;
    const pid = p.profile_id as number;
    if (pid === myProfileId) continue;
    const arr = peersByConvo.get(cid) ?? [];
    arr.push(pid);
    peersByConvo.set(cid, arr);
  }

  // 4. Latest message per conversation — one set-based RPC (DISTINCT ON) instead
  // of N parallel single-row queries.
  const latestMessageMap = new Map<
    number,
    { content: string; created_at: string }
  >();
  const { data: latestRows, error: latestErr } = await supabase.rpc(
    "latest_conversation_messages",
    { _ids: convoIds },
  );
  if (latestErr) throw new Error(latestErr.message);
  for (const row of (latestRows ?? []) as Array<{
    conversation_id: number;
    content: string | null;
    created_at: string;
  }>) {
    latestMessageMap.set(row.conversation_id, {
      content: row.content ?? "",
      created_at: row.created_at,
    });
  }

  const readMap = await fetchReadMap();

  return (convos ?? []).map((convo) => {
    const cid = convo.id as number;
    const id = String(cid);
    const peers = (peersByConvo.get(cid) ?? [])
      .sort((a, b) => a - b)
      .map((pid) => nameMap.get(pid))
      .filter((n): n is string => Boolean(n));
    const projectName = convo.project_id
      ? projectMap.get(convo.project_id as number)
      : undefined;

    let name: string;
    if (peers.length === 0) {
      name = projectName || `Conversation ${id}`;
    } else if (peers.length <= 2) {
      name = peers.join(", ");
    } else {
      name = `${peers[0]}, ${peers[1]} +${peers.length - 2}`;
    }

    const latest = latestMessageMap.get(cid);
    const activityMs = latest ? new Date(latest.created_at).getTime() : 0;

    return {
      id,
      name,
      projectName: projectName || undefined,
      lastMessage: latest?.content ?? (latest ? "Attachment" : ""),
      timestamp: latest
        ? new Date(latest.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
      unread: activityMs > 0 && activityMs > (readMap[id] ?? 0),
      lastActivity: activityMs,
    };
  });
}

async function resolveNames(
  supabase: SupabaseClient,
  ids: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  // Resolve peer names through a SECURITY DEFINER RPC that returns only (id,
  // name) for co-participants — direct SELECT on profiles is no longer granted to
  // co-participants (it leaked email/eid/discord_id of everyone in a thread).
  const { data, error } = await supabase.rpc("get_conversation_peer_names", {
    _ids: ids,
  });
  if (error) throw new Error(error.message);
  for (const p of (data ?? []) as Array<{ id: number; name: string | null }>) {
    map.set(p.id, p.name ?? "");
  }
  return map;
}

async function resolveProjects(
  supabase: SupabaseClient,
  ids: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("projects")
    .select("id, company_name")
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const p of data ?? []) {
    map.set(p.id as number, (p.company_name as string) ?? "");
  }
  return map;
}
