"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  Modal,
  TextField,
} from "@/components/dashboard/common/ui";
import { toastError } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Conversation } from "./ConversationList";

/**
 * Start a conversation with one or more people, gated by the role matrix:
 *   director -> directors, members, clients
 *   member   -> members, directors
 *   client   -> directors
 *
 * The picker only offers people the caller may message. Internal recipients
 * (directors/members) are project-independent; a client recipient pins the
 * conversation to that client's project. Selecting >1 recipient makes a group.
 * Creation goes through the create_conversation RPC, which re-enforces the
 * matrix and the project rules server-side and dedupes existing threads.
 */

type Role = "director" | "member" | "client";

interface Candidate {
  profileId: number;
  name: string;
  role: Role;
  /** For client candidates: the project the conversation would be scoped to. */
  projectId?: number;
  projectName?: string;
}

interface CreateConversationModalProps {
  opened: boolean;
  onClose: () => void;
  onConversationCreated?: (conversation: Conversation) => void;
}

const ROLE_LABEL: Record<Role, string> = {
  director: "Directors",
  member: "Members",
  client: "Clients",
};

function nowLabel(): string {
  return new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CreateConversationModal({
  opened,
  onClose,
  onConversationCreated,
}: CreateConversationModalProps) {
  const router = useRouter();
  const { user, activeProject } = useProject();
  const myProfileId = user?.id ?? null;
  const myRole = (user?.role ?? null) as Role | null;

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Load the people this caller is allowed to message. The matrix + project
  // rules (and the directory read) live in the list_messageable_profiles RPC,
  // so the picker doesn't need broad profiles/project_members read access.
  useEffect(() => {
    if (!opened || myProfileId === null) return;
    setSearch("");
    setSelected(new Set());

    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("list_messageable_profiles");
      const rows = (data ?? []) as {
        profile_id: number;
        name: string | null;
        role: Role;
        project_id: number | null;
        project_name: string | null;
      }[];
      const seen = new Set<number>();
      const next: Candidate[] = [];
      for (const r of rows) {
        if (seen.has(r.profile_id)) continue;
        seen.add(r.profile_id);
        next.push({
          profileId: r.profile_id,
          name: r.name ?? `Person ${r.profile_id}`,
          role: r.role,
          projectId: r.project_id ?? undefined,
          projectName: r.project_name ?? undefined,
        });
      }
      next.sort((a, b) => a.name.localeCompare(b.name));
      setCandidates(next);
      setLoading(false);
    };

    void load();
  }, [opened, myProfileId]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? candidates.filter((c) => c.name.toLowerCase().includes(q))
      : candidates;
    // Group by role in a stable order.
    const order: Role[] = ["director", "member", "client"];
    return order
      .map((role) => ({
        role,
        items: base.filter((c) => c.role === role),
      }))
      .filter((g) => g.items.length > 0);
  }, [candidates, search]);

  const selectedCandidates = useMemo(
    () => candidates.filter((c) => selected.has(c.profileId)),
    [candidates, selected],
  );

  // Project derivation: client caller -> active project; otherwise a selected
  // client pins the project; internal-only -> no project.
  const derivedProject = useMemo(() => {
    if (myRole === "client") {
      return activeProject?.projectId ?? null;
    }
    const client = selectedCandidates.find((c) => c.role === "client");
    return client?.projectId ?? null;
  }, [myRole, activeProject?.projectId, selectedCandidates]);

  // A director can multi-select clients, but the conversation pins to ONE project
  // (every client participant must belong to it). Clients from different projects
  // would make the create RPC reject the others, so block it up front with a
  // clear message rather than surfacing a confusing server error.
  const multipleClientProjects = useMemo(
    () =>
      new Set(
        selectedCandidates
          .filter((c) => c.role === "client")
          .map((c) => c.projectId),
      ).size > 1,
    [selectedCandidates],
  );

  const hasClient =
    myRole === "client" || selectedCandidates.some((c) => c.role === "client");
  const projectMissing = hasClient && derivedProject === null;
  const canSubmit =
    selected.size > 0 &&
    !projectMissing &&
    !multipleClientProjects &&
    !submitting &&
    !loading;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_conversation", {
        _participant_profile_ids: Array.from(selected),
        _project_id: derivedProject,
      });
      if (error || data == null) {
        toastError(
          error?.message ?? "The conversation could not be created.",
          "Could not start conversation",
        );
        return;
      }
      const conversationId = data as number;

      const names = selectedCandidates.map((c) => c.name);
      const name =
        names.length <= 2
          ? names.join(", ")
          : `${names[0]}, ${names[1]} +${names.length - 2}`;

      onConversationCreated?.({
        id: String(conversationId),
        name,
        lastMessage: "",
        timestamp: nowLabel(),
        unread: false,
        lastActivity: Date.now(),
      });
      router.push(`/dashboard/messages/${conversationId}`);
      onClose();
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Unexpected error.",
        "Could not start conversation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New conversation" size="sm">
      <div className="flex flex-col gap-4">
        <TextField
          label="To"
          value={search}
          onChange={setSearch}
          placeholder="Search people by name"
          autoFocus
        />

        {selectedCandidates.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedCandidates.map((c) => (
              <button
                key={c.profileId}
                type="button"
                onClick={() => toggle(c.profileId)}
                className="flex items-center gap-1.5 rounded-full border border-sbi-green/30 bg-sbi-green/5 px-2.5 py-1 text-xs text-white transition-colors hover:border-sbi-green/50"
              >
                {c.name}
                <span className="text-sbi-muted-dark">×</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="max-h-56 divide-y divide-sbi-dark-border/40 overflow-y-auto rounded-md border border-sbi-dark-border/50 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-3 py-2.5">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-sbi-dark-card/80" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="px-3 py-3 text-xs text-sbi-muted">
              {candidates.length === 0
                ? "There is no one you can start a conversation with yet."
                : "No people match that search."}
            </p>
          ) : (
            visible.map((group) => (
              <div key={group.role}>
                <p className="bg-sbi-dark/40 px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-sbi-muted-dark">
                  {ROLE_LABEL[group.role]}
                </p>
                {group.items.map((c) => {
                  const isSelected = selected.has(c.profileId);
                  return (
                    <button
                      key={c.profileId}
                      type="button"
                      onClick={() => toggle(c.profileId)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-sbi-dark-card text-white"
                          : "text-sbi-muted hover:bg-sbi-dark-card/50 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "border-sbi-green bg-sbi-green/20 text-sbi-green"
                            : "border-sbi-dark-border",
                        )}
                      >
                        {isSelected ? (
                          <Check className="size-3" strokeWidth={2.5} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      {c.role === "client" && c.projectName ? (
                        <span className="shrink-0 text-[0.7rem] uppercase tracking-[0.15em] text-sbi-muted-dark">
                          {c.projectName}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {multipleClientProjects ? (
          <p className="text-xs leading-relaxed text-amber-400/90">
            Clients from different projects can't share a conversation. Keep the
            selected clients to a single project.
          </p>
        ) : hasClient ? (
          <p className="text-xs leading-relaxed text-sbi-muted">
            {projectMissing
              ? "Select an active project to message a client."
              : "This conversation includes a client and is scoped to their project."}
          </p>
        ) : selected.size > 1 ? (
          <p className="text-xs leading-relaxed text-sbi-muted">
            This will be a group conversation.
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={handleCreate}
            disabled={!canSubmit}
          >
            {submitting ? "Opening" : "Start conversation"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
