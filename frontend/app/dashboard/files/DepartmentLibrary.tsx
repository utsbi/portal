"use client";

import {
  ArrowDownToLine,
  ChevronRight,
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Info,
  Plus,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  EmptyState,
  Modal,
  Panel,
  TextField,
} from "@/components/dashboard/common/ui";
import { isStaffRole } from "@/lib/auth/roles";
import type { UserProfile } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { BUCKET, isFolder, isSentinel, type StorageEntry } from "./storage";

const supabase = createClient();
const focusStyle =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sbi-green focus-visible:ring-offset-2 focus-visible:ring-offset-sbi-dark";
const inputStyle = cn(
  "h-10 rounded-md border border-sbi-dark-border bg-sbi-dark px-3 text-sm text-white",
  focusStyle,
);

interface DepartmentSpace {
  id: number;
  name: string;
  rootPrefix: string;
  canEdit: boolean;
  canManage: boolean;
}

interface RelatedProject {
  id: number;
  name: string;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext ?? ""))
    return FileImage;
  if (["xlsx", "xls", "csv"].includes(ext ?? "")) return FileSpreadsheet;
  if (["js", "ts", "tsx", "json", "md", "yml", "yaml"].includes(ext ?? ""))
    return FileCode2;
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext ?? "")) return FileText;
  return File;
}

function joinPath(...parts: string[]) {
  return parts.filter(Boolean).join("/");
}

function formatDate(value?: string) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/** Persistent department spaces backed by file_spaces and the Files bucket. */
export default function DepartmentLibrary({
  user,
}: {
  user: Pick<UserProfile, "id" | "role" | "department">;
}) {
  const [spaces, setSpaces] = useState<DepartmentSpace[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState("");
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [relatedProjects, setRelatedProjects] = useState<RelatedProject[]>([]);
  const [availableProjects, setAvailableProjects] = useState<RelatedProject[]>(
    [],
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkProjectId, setLinkProjectId] = useState("");
  const [linking, setLinking] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSpace =
    spaces.find((space) => space.id === selectedSpaceId) ?? null;
  const currentPrefix = selectedSpace
    ? joinPath(selectedSpace.rootPrefix, folderPath)
    : "";
  const visibleEntries = useMemo(() => {
    return entries
      .filter((entry) => !isSentinel(entry))
      .sort((a, b) => {
        if (isFolder(a) !== isFolder(b)) return isFolder(a) ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [entries]);
  const selectedEntry = entries.find(
    (entry) => !isFolder(entry) && entry.name === selectedPath,
  );

  const loadSpaces = useCallback(async () => {
    setIsLoadingSpaces(true);
    setError(null);
    const { data: spaceRows, error: spaceError } = await supabase
      .from("file_spaces")
      .select("id, name, root_prefix, department_id")
      .eq("kind", "department")
      .order("name");

    if (spaceError) {
      setError("Department files are unavailable.");
      setSpaces([]);
      setIsLoadingSpaces(false);
      return;
    }

    const staff = isStaffRole(user.role);
    const nextSpaces = (spaceRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      rootPrefix: row.root_prefix,
      canEdit: staff || user.role === "member",
      canManage: staff,
    }));
    setSpaces(nextSpaces);
    setSelectedSpaceId((current) =>
      current && nextSpaces.some((space) => space.id === current)
        ? current
        : (nextSpaces[0]?.id ?? null),
    );
    setIsLoadingSpaces(false);
  }, [user.role]);

  const loadFiles = useCallback(async () => {
    if (!selectedSpace) {
      setEntries([]);
      return;
    }
    setIsLoadingFiles(true);
    setError(null);
    const allEntries: StorageEntry[] = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error: listError } = await supabase.storage
        .from(BUCKET)
        .list(currentPrefix, {
          limit: pageSize,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (listError) {
        setError(listError.message);
        setEntries([]);
        setIsLoadingFiles(false);
        return;
      }
      allEntries.push(...((data ?? []) as StorageEntry[]));
      if (!data || data.length < pageSize) break;
    }
    setEntries(allEntries);
    setIsLoadingFiles(false);
  }, [currentPrefix, selectedSpace]);

  useEffect(() => {
    void loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const loadProjectContext = useCallback(async () => {
    if (!selectedSpace || !selectedEntry) {
      setRelatedProjects([]);
      setAvailableProjects([]);
      return;
    }
    const storagePath = joinPath(currentPrefix, selectedEntry.name);
    const { data: links } = await supabase
      .from("department_file_project_links")
      .select("project_id")
      .eq("file_space_id", selectedSpace.id)
      .eq("storage_path", storagePath);
    const projectIds = (links ?? []).map((link) => link.project_id);
    const projectQuery = supabase
      .from("projects")
      .select("id, company_name")
      .order("company_name");
    const { data: projects } = selectedSpace.canManage
      ? await projectQuery
      : await projectQuery.in("id", projectIds);
    const normalized = (projects ?? []).map((project) => ({
      id: project.id,
      name: project.company_name,
    }));
    setRelatedProjects(
      normalized.filter((project) => projectIds.includes(project.id)),
    );
    setAvailableProjects(normalized);
  }, [currentPrefix, selectedEntry, selectedSpace]);

  useEffect(() => {
    void loadProjectContext();
  }, [loadProjectContext]);

  async function linkProject() {
    if (!selectedSpace?.canManage || !selectedEntry || !linkProjectId) return;
    setLinking(true);
    const { error: linkError } = await supabase
      .from("department_file_project_links")
      .insert({
        file_space_id: selectedSpace.id,
        storage_path: joinPath(currentPrefix, selectedEntry.name),
        project_id: Number(linkProjectId),
        created_by: user.id,
      });
    setLinking(false);
    if (linkError) {
      setError(linkError.message);
      return;
    }
    setLinkOpen(false);
    setLinkProjectId("");
    await loadProjectContext();
  }

  async function unlinkProject(projectId: number) {
    if (!selectedSpace?.canManage || !selectedEntry) return;
    const { error: unlinkError } = await supabase
      .from("department_file_project_links")
      .delete()
      .eq("file_space_id", selectedSpace.id)
      .eq("storage_path", joinPath(currentPrefix, selectedEntry.name))
      .eq("project_id", projectId);
    if (unlinkError) setError(unlinkError.message);
    else await loadProjectContext();
  }

  function selectSpace(id: number) {
    setSelectedSpaceId(id);
    setFolderPath("");
    setSelectedPath(null);
  }

  function openFolder(name: string) {
    setFolderPath((current) => joinPath(current, name));
    setSelectedPath(null);
  }

  function goToFolder(path: string) {
    setFolderPath(path);
    setSelectedPath(null);
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!selectedSpace?.canEdit) return;
    setUploading(true);
    setError(null);
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(joinPath(currentPrefix, file.name), file, { upsert: false });
      if (uploadError) failures.push(`${file.name}: ${uploadError.message}`);
    }
    setUploading(false);
    await loadFiles();
    if (failures.length > 0) setError(failures.join("; "));
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!selectedSpace?.canManage || !name) return;
    if (name.includes("/") || name === "." || name === "..") {
      setError("Folder names cannot contain slashes.");
      return;
    }
    setCreatingFolder(true);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(
        joinPath(currentPrefix, name, ".emptyFolderPlaceholder"),
        new Blob([""]),
        {
          upsert: false,
        },
      );
    setCreatingFolder(false);
    if (uploadError) setError(uploadError.message);
    else {
      setNewFolderOpen(false);
      setNewFolderName("");
      await loadFiles();
    }
  }

  async function openFile(entry: StorageEntry) {
    if (!selectedSpace) return;
    const url = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(joinPath(currentPrefix, entry.name), 3600);
    if (url.error) {
      setError(url.error.message);
      return;
    }
    setSelectedPath(entry.name);
    setPreviewUrl(url.data.signedUrl);
  }

  async function downloadFile(entry: StorageEntry) {
    if (!selectedSpace) return;
    const { data, error: urlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(joinPath(currentPrefix, entry.name), 3600, {
        download: entry.name,
      });
    if (urlError) {
      setError(urlError.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const breadcrumbs = folderPath
    ? [
        "",
        ...folderPath
          .split("/")
          .map((_, index, all) => all.slice(0, index + 1).join("/")),
      ]
    : [""];

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-6">
        <Panel className="hidden w-64 shrink-0 overflow-y-auto md:block">
          <p className="mb-4 text-xs uppercase tracking-widest text-sbi-muted">
            Departments
          </p>
          <nav aria-label="Department spaces" className="space-y-2">
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                aria-pressed={space.id === selectedSpaceId}
                onClick={() => selectSpace(space.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  space.id === selectedSpaceId
                    ? "bg-sbi-green/10 text-sbi-green"
                    : "text-sbi-muted hover:bg-white/[0.03] hover:text-white",
                  focusStyle,
                )}
              >
                <Folder className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{space.name}</span>
              </button>
            ))}
          </nav>
        </Panel>
        <main
          aria-label="Department files"
          className="dashboard-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto"
        >
          <select
            aria-label="Department space"
            value={selectedSpaceId ?? ""}
            onChange={(event) => selectSpace(Number(event.target.value))}
            className={cn(inputStyle, "mb-4 w-full md:hidden")}
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
          <div className="mb-6 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Department folder breadcrumb"
              className="flex min-h-10 flex-wrap items-center gap-1 text-sm text-sbi-muted"
            >
              {breadcrumbs.map((path, index) => (
                <span key={path || "root"} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight
                      className="size-3 text-sbi-muted/40"
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => goToFolder(path)}
                    className={cn(
                      "hover:text-sbi-green",
                      path === folderPath && "text-white",
                    )}
                  >
                    {path
                      ? path.split("/").at(-1)
                      : (selectedSpace?.name ?? "Home")}
                  </button>
                </span>
              ))}
            </nav>
            {selectedSpace?.canEdit && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    if (event.target.files)
                      void uploadFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5" aria-hidden="true" />
                  {uploading ? "Uploading…" : "Upload"}
                </button>
                {selectedSpace.canManage && (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setNewFolderOpen(true)}
                  >
                    <FolderPlus className="size-3.5" aria-hidden="true" />
                    New Folder
                  </button>
                )}
              </div>
            )}
          </div>
          {error && (
            <p role="alert" className="mb-6 text-sm text-red-400">
              {error}
            </p>
          )}
          {isLoadingSpaces || isLoadingFiles ? (
            <p className="py-12 text-center text-sm text-sbi-muted">
              Loading files…
            </p>
          ) : !error && visibleEntries.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={24} />}
              title={
                spaces.length ? "This folder is empty" : "No department files"
              }
              description={
                spaces.length
                  ? "No files or subfolders have been added here yet."
                  : undefined
              }
            />
          ) : (
            <ul
              aria-label="Department file entries"
              className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]"
            >
              {visibleEntries.map((entry) => {
                const Icon = isFolder(entry) ? Folder : fileIcon(entry.name);
                return (
                  <li
                    key={entry.name}
                    className="group flex min-h-[3.75rem] items-center gap-3 overflow-hidden rounded-lg border border-sbi-dark-border/50 bg-sbi-dark-card/40 px-4 py-3 transition-colors hover:border-sbi-green/40 hover:bg-sbi-dark-card/60"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        isFolder(entry)
                          ? openFolder(entry.name)
                          : void openFile(entry)
                      }
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-3 text-left",
                        focusStyle,
                      )}
                    >
                      <Icon
                        className="size-4 shrink-0 text-sbi-muted"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">
                          {entry.name}
                        </span>
                        {!isFolder(entry) && (
                          <span className="mt-1 block text-xs text-sbi-muted">
                            {formatDate(entry.updated_at)}
                          </span>
                        )}
                      </span>
                    </button>
                    {!isFolder(entry) && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Details for ${entry.name}`}
                          onClick={() => {
                            setSelectedPath(entry.name);
                            setDetailsOpen(true);
                          }}
                          className={cn(
                            "rounded p-1 text-sbi-muted hover:text-white",
                            focusStyle,
                          )}
                        >
                          <Info className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Download ${entry.name}`}
                          onClick={() => void downloadFile(entry)}
                          className={cn(
                            "rounded p-1 text-sbi-muted hover:text-white",
                            focusStyle,
                          )}
                        >
                          <ArrowDownToLine
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>

      <Modal
        opened={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={selectedEntry?.name}
        uppercaseTitle={false}
        size="sm"
      >
        <section aria-label="Department file details">
          <p className="mb-4 text-xs text-sbi-muted">
            {selectedSpace?.name} space
          </p>
          <h3 className="mb-3 text-sm text-white">Related projects</h3>
          {relatedProjects.length ? (
            <ul className="space-y-3">
              {relatedProjects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-3 text-sm text-white"
                >
                  <span className="truncate">{project.name}</span>
                  {selectedSpace?.canManage && (
                    <button
                      type="button"
                      aria-label={`Remove ${project.name} project link`}
                      onClick={() => void unlinkProject(project.id)}
                      className="text-xs text-sbi-muted hover:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-sbi-muted">None</p>
          )}
          {selectedSpace?.canManage && (
            <button
              type="button"
              className={cn(btnGhost, "mt-5")}
              onClick={() => {
                setDetailsOpen(false);
                setLinkOpen(true);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Link
            </button>
          )}
        </section>
      </Modal>

      <Modal
        opened={previewUrl !== null}
        onClose={() => {
          setPreviewUrl(null);
        }}
        title={selectedEntry?.name}
        uppercaseTitle={false}
        size="xl"
        padded={false}
      >
        {previewUrl && selectedEntry && (
          <div className="p-4">
            {selectedEntry.name.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={previewUrl}
                title={selectedEntry.name}
                className="h-[75vh] w-full rounded-md bg-white"
              />
            ) : ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(
                selectedEntry.name.split(".").pop()?.toLowerCase() ?? "",
              ) ? (
              // biome-ignore lint/performance/noImgElement: signed storage URLs are runtime values and this preview is not a Next image source.
              <img
                src={previewUrl}
                alt={selectedEntry.name}
                className="mx-auto max-h-[75vh] w-auto object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <File className="size-10 text-sbi-muted" />
                <p className="text-sm text-white">
                  This file type cannot be previewed in the portal.
                </p>
                <button
                  type="button"
                  onClick={() => void downloadFile(selectedEntry)}
                  className={btnPrimary}
                >
                  <ArrowDownToLine className="size-3.5" />
                  Download file
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        opened={linkOpen}
        onClose={() => !linking && setLinkOpen(false)}
        title="Link file to a project"
        size="md"
      >
        <p className="mb-4 text-sm leading-relaxed text-sbi-muted">
          This adds project context only. Project members will not gain access
          to this department file.
        </p>
        <label className="block text-xs text-sbi-muted" htmlFor="link-project">
          Project
        </label>
        <select
          id="link-project"
          value={linkProjectId}
          onChange={(event) => setLinkProjectId(event.target.value)}
          className={cn(inputStyle, "mt-2 w-full")}
        >
          <option value="">Choose a project…</option>
          {availableProjects
            .filter(
              (project) =>
                !relatedProjects.some((related) => related.id === project.id),
            )
            .map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
        </select>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={btnGhost}
            disabled={linking}
            onClick={() => setLinkOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={linking || !linkProjectId}
            onClick={() => void linkProject()}
          >
            {linking ? "Linking…" : "Link project"}
          </button>
        </div>
      </Modal>

      <Modal
        opened={newFolderOpen}
        onClose={() => !creatingFolder && setNewFolderOpen(false)}
        title="New department folder"
        size="md"
      >
        <TextField
          label="Folder name"
          placeholder="e.g. Active matters"
          value={newFolderName}
          onChange={setNewFolderName}
          disabled={creatingFolder}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") void createFolder();
          }}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className={btnGhost}
            disabled={creatingFolder}
            onClick={() => setNewFolderOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={creatingFolder}
            onClick={() => void createFolder()}
          >
            {creatingFolder ? "Creating…" : "Create folder"}
          </button>
        </div>
      </Modal>
    </>
  );
}
