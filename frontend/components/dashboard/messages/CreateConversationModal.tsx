"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, TextField, btnPrimary, btnGhost } from "@/components/dashboard/common/ui";
import { createClient } from "@/lib/supabase/client";
import { useProject } from "@/lib/project/project-context";
import { toastError } from "@/lib/notifications";
import type { Conversation } from "./ConversationList";

/**
 * One project-aware create flow for both roles.
 *
 * - Director: pick a client project by name, then the conversation is scoped
 *   to that project and its owner profile.
 * - Client: the conversation is scoped to the active project; pick which
 *   director (resolved by name, no department jargon) to talk to.
 *
 * Before inserting, an existing conversation for (client, director, project)
 * is looked up and opened instead of creating a duplicate (P2 duplicate
 * guard). Supabase tables, columns and the batched name-resolution shape
 * (Conversation) are preserved exactly.
 */

interface ProjectOption {
  id: number;
  companyName: string;
}

interface DirectorOption {
  id: number;
  name: string;
}

interface CreateConversationModalProps {
  opened: boolean;
  onClose: () => void;
  /** "director" picks a client project; "client" picks a director. */
  mode: "director" | "client";
  /** Director's own profile id (required in director mode). */
  profileId?: number;
  onConversationCreated?: (conversation: Conversation) => void;
}

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
  mode,
  profileId,
  onConversationCreated,
}: CreateConversationModalProps) {
  const router = useRouter();
  const { user, activeProject } = useProject();

  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Director mode: list of client projects. Client mode: list of directors.
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [directors, setDirectors] = useState<DirectorOption[]>([]);
  const [selectedDirectorId, setSelectedDirectorId] = useState<number | null>(null);
  // Targets the current user already has a conversation for. Director mode:
  // project ids. Client mode: director profile ids (scoped to the active
  // project). Hidden from the picker so it never just bounces to an
  // existing thread; the duplicate guard still backs this up for races.
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!opened) return;

    setSearch("");
    setSelectedProjectId(null);
    setSelectedDirectorId(null);

    const load = async () => {
      setLoadingOptions(true);
      const supabase = createClient();

      if (mode === "director") {
        const [{ data: projectData }, { data: existing }] = await Promise.all([
          supabase
            .from("projects")
            .select("id, company_name")
            .order("company_name", { ascending: true }),
          profileId
            ? supabase
                .from("conversations")
                .select("project_id")
                .eq("director_profile_id", profileId)
            : Promise.resolve({
                data: [] as { project_id: number | null }[],
              }),
        ]);

        setExcluded(
          new Set(
            (existing ?? [])
              .map((c) => c.project_id as number | null)
              .filter((id): id is number => id !== null),
          ),
        );
        setProjects(
          (projectData ?? []).map((p) => ({
            id: p.id as number,
            companyName: (p.company_name as string) ?? "",
          })),
        );
      } else {
        const clientId = user?.id ?? null;
        const projId = activeProject?.projectId ?? null;

        let existingQuery = supabase
          .from("conversations")
          .select("director_profile_id");
        existingQuery =
          clientId === null
            ? existingQuery.is("client_profile_id", null)
            : existingQuery.eq("client_profile_id", clientId);
        existingQuery =
          projId === null
            ? existingQuery.is("project_id", null)
            : existingQuery.eq("project_id", projId);

        const [{ data: directorData }, { data: existing }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, name")
              .eq("role", "director")
              .order("name", { ascending: true }),
            existingQuery,
          ]);

        setExcluded(
          new Set(
            (existing ?? [])
              .map((c) => c.director_profile_id as number | null)
              .filter((id): id is number => id !== null),
          ),
        );
        setDirectors(
          (directorData ?? []).map((d) => ({
            id: d.id as number,
            name: (d.name as string) ?? "",
          })),
        );
      }

      setLoadingOptions(false);
    };

    load();
  }, [opened, mode, profileId, user?.id, activeProject?.projectId]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = projects.filter((p) => !excluded.has(p.id));
    if (!q) return base;
    return base.filter((p) => p.companyName.toLowerCase().includes(q));
  }, [projects, excluded, search]);

  const filteredDirectors = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = directors.filter((d) => !excluded.has(d.id));
    if (!q) return base;
    return base.filter((d) => d.name.toLowerCase().includes(q));
  }, [directors, excluded, search]);

  // True when nothing is startable at all (every option already has a
  // thread), vs. merely filtered out by the search box.
  const noStartable =
    !loadingOptions &&
    (mode === "director"
      ? projects.length > 0 &&
        projects.every((p) => excluded.has(p.id))
      : directors.length > 0 &&
        directors.every((d) => excluded.has(d.id)));

  const canSubmit =
    mode === "director" ? selectedProjectId !== null : selectedDirectorId !== null;

  const openExistingOrCreate = async (
    clientProfileId: number | null,
    directorProfileId: number,
    projectId: number | null,
    displayName: string,
  ) => {
    const supabase = createClient();

    // P2 duplicate guard: reuse an existing thread for this triple.
    let existingQuery = supabase
      .from("conversations")
      .select("id")
      .eq("director_profile_id", directorProfileId);

    existingQuery =
      clientProfileId === null
        ? existingQuery.is("client_profile_id", null)
        : existingQuery.eq("client_profile_id", clientProfileId);

    existingQuery =
      projectId === null
        ? existingQuery.is("project_id", null)
        : existingQuery.eq("project_id", projectId);

    const { data: existing } = await existingQuery
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      router.push(`/dashboard/messages/${existing.id}`);
      onClose();
      return;
    }

    const { data: conversation, error: convoError } = await supabase
      .from("conversations")
      .insert({
        client_profile_id: clientProfileId,
        director_profile_id: directorProfileId,
        project_id: projectId,
      })
      .select("id")
      .single();

    if (convoError || !conversation) {
      toastError(
        convoError?.message ?? "The conversation could not be created.",
        "Could not start conversation",
      );
      return;
    }

    const conversationId = conversation.id as number;

    onConversationCreated?.({
      id: String(conversationId),
      name: displayName,
      lastMessage: "",
      timestamp: nowLabel(),
      unread: false,
      lastActivity: Date.now(),
    });

    router.push(`/dashboard/messages/${conversationId}`);
    onClose();
  };

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        toastError("Your session has expired. Sign in again.", "Not signed in");
        return;
      }

      if (mode === "director") {
        if (selectedProjectId === null || !profileId) return;

        const project = projects.find((p) => p.id === selectedProjectId);

        // Resolve the project's owner profile (the client side of the thread).
        const { data: ownerMembership } = await supabase
          .from("project_members")
          .select("profile_id")
          .eq("project_id", selectedProjectId)
          .eq("role", "owner")
          .maybeSingle();

        await openExistingOrCreate(
          ownerMembership?.profile_id ?? null,
          profileId,
          selectedProjectId,
          project?.companyName ?? "Conversation",
        );
      } else {
        if (selectedDirectorId === null || !user) return;

        const director = directors.find((d) => d.id === selectedDirectorId);

        await openExistingOrCreate(
          user.id,
          selectedDirectorId,
          activeProject?.projectId ?? null,
          director?.name ?? activeProject?.companyName ?? "Conversation",
        );
      }
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Unexpected error.",
        "Could not start conversation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "director" ? "New conversation" : "Message a director";
  const searchLabel = mode === "director" ? "Project" : "Director";
  const placeholder =
    mode === "director" ? "Search projects by name" : "Search directors by name";

  const rows =
    mode === "director"
      ? filteredProjects.map((p) => ({
          key: p.id,
          label: p.companyName || `Project ${p.id}`,
          selected: selectedProjectId === p.id,
          onSelect: () => setSelectedProjectId(p.id),
        }))
      : filteredDirectors.map((d) => ({
          key: d.id,
          label: d.name || `Director ${d.id}`,
          selected: selectedDirectorId === d.id,
          onSelect: () => setSelectedDirectorId(d.id),
        }));

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        {mode === "client" && activeProject ? (
          <p className="text-xs text-sbi-muted leading-relaxed">
            This conversation will be scoped to{" "}
            <span className="text-white">{activeProject.companyName}</span>.
          </p>
        ) : null}

        <TextField
          label={searchLabel}
          value={search}
          onChange={setSearch}
          placeholder={placeholder}
          autoFocus
        />

        <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-md border border-sbi-dark-border/50 divide-y divide-sbi-dark-border/40">
          {loadingOptions ? (
            <div className="flex flex-col">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-3 py-2.5">
                  <div className="h-3.5 w-40 rounded bg-sbi-dark-card/80 animate-pulse" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="px-3 py-3 text-xs text-sbi-muted">
              {noStartable
                ? mode === "director"
                  ? "You already have a conversation for every project."
                  : "You already have a conversation with every director."
                : mode === "director"
                  ? "No projects match that search."
                  : "No directors match that search."}
            </p>
          ) : (
            rows.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={r.onSelect}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                  r.selected
                    ? "bg-sbi-dark-card text-white"
                    : "text-sbi-muted hover:bg-sbi-dark-card/50 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={handleCreate}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Opening" : "Open conversation"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
