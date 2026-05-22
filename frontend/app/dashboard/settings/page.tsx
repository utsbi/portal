"use client";

import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import {
  assignMemberToProject,
  createAccount,
  deleteAccount,
  listAccounts,
  listProjectMembers,
  listProjects,
  listUnassignedMembers,
  removeMemberFromProject,
} from "./actions";

interface Account {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string | null;
  created_at: string;
}

interface Project {
  id: number;
  url_slug: string;
  company_name: string;
}

interface ProjectMember {
  id: number;
  role: string;
  profile_id: number;
  profiles: { id: number; name: string; email: string; role: string };
}

interface UnassignedMember {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string | null;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
}

type ConnectionStatus = "loading" | "not_connected" | "no_calendar" | "ready";

const OAUTH_ERROR_REASONS: Record<string, string> = {
  no_refresh_token:
    "Google didn't return a refresh token. Remove the SBI Portal from your Google permissions, then try connecting again.",
  exchange_failed: "Couldn't exchange the Google authorization code.",
  not_director: "Only directors can connect Google Calendar.",
  unauthenticated: "Please sign in and try again.",
  missing_code: "The Google callback didn't include an authorization code.",
  save_failed: "We couldn't save the connection. Please try again.",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const { user, isLoading } = useProject();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "member" as "client" | "director" | "member",
    companyName: "",
    department: "",
  });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Calendar state
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("loading");
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const [connectedEmail, setConnectedEmail] = useState<string>("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarSuccess, setCalendarSuccess] = useState("");
  const [disconnectBusy, setDisconnectBusy] = useState(false);

  // Team state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<
    UnassignedMember[]
  >([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  useEffect(() => {
    if (!isLoading && user?.role !== "director") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  const loadCalendars = useCallback(async () => {
    setConnectionStatus("loading");
    setCalendarError("");
    try {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      let savedCalendarId: string | null = null;
      let savedLastSynced: string | null = null;

      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("config, email")
          .eq("uid", authUser.id)
          .single();
        const googleConfig = (profile?.config as Record<string, unknown> | null)
          ?.google as Record<string, unknown> | undefined;
        savedCalendarId =
          (googleConfig?.calendar_id as string | undefined) ?? null;
        savedLastSynced =
          (googleConfig?.last_synced_at as string | undefined) ?? null;
        setConnectedEmail(
          (profile?.email as string | undefined) ?? authUser.email ?? "",
        );
        setLastSyncedAt(savedLastSynced);
        if (savedCalendarId) setSelectedCalendarId(savedCalendarId);
      }

      const res = await fetch("/api/contact/calendar/client-events/list");
      const data: {
        calendars?: GoogleCalendar[];
        connected?: boolean;
        error?: string;
      } = await res.json().catch(() => ({}));

      if (data.connected === false) {
        setConnectionStatus("not_connected");
        setCalendars([]);
        return;
      }

      if (!res.ok) {
        // We DO have a refresh token (otherwise list would return connected:false),
        // but Google rejected the request — almost always an insufficient-scope
        // error after a scope change. If we have a saved calendar_id, events
        // might still work; otherwise the user has to reconnect to mint a fresh
        // token with the current scope.
        setCalendars([]);
        if (savedCalendarId) {
          setConnectionStatus("ready");
        } else {
          setConnectionStatus("not_connected");
        }
        setCalendarError(
          "Couldn't load your calendars. Your Google connection might be using an older scope — try Connect again to refresh permissions.",
        );
        return;
      }

      const list = data.calendars ?? [];
      setCalendars(list);

      if (list.length === 0) {
        setConnectionStatus("not_connected");
      } else if (savedCalendarId) {
        setConnectionStatus("ready");
      } else {
        setConnectionStatus("no_calendar");
      }
    } catch {
      setConnectionStatus("not_connected");
    }
  }, []);

  // Process ?google=connected | error callback flags.
  useEffect(() => {
    const status = searchParams.get("google");
    if (!status) return;

    if (status === "connected") {
      setCalendarSuccess(
        "Google connected. Pick a calendar below if you haven't yet.",
      );
      setTimeout(() => setCalendarSuccess(""), 6000);
    } else if (status === "error") {
      const reason = searchParams.get("reason") ?? "";
      setCalendarError(
        OAUTH_ERROR_REASONS[reason] ??
          "Couldn't connect Google Calendar. Please try again.",
      );
    }
    // Clean the URL so reloads don't reapply.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("google");
    params.delete("reason");
    const next = params.toString();
    router.replace(next ? `?${next}` : "?", { scroll: false });
  }, [searchParams, router]);

  const handleSelectCalendar = async (calendarId: string) => {
    setCalendarSaving(true);
    setCalendarError("");
    setCalendarSuccess("");
    try {
      const res = await fetch("/api/contact/calendar/client-events/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSelectedCalendarId(calendarId);
        setConnectionStatus("ready");
        setCalendarSuccess("Calendar saved.");
        setTimeout(() => setCalendarSuccess(""), 3000);
      } else {
        setCalendarError(data.error || "Couldn't save the selected calendar.");
      }
    } catch {
      setCalendarError("Couldn't reach the calendar service.");
    } finally {
      setCalendarSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        "Disconnect Google Calendar? Clients won't see events until you reconnect.",
      )
    ) {
      return;
    }
    setDisconnectBusy(true);
    setCalendarError("");
    setCalendarSuccess("");
    try {
      const res = await fetch("/api/contact/auth/google/disconnect", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setSelectedCalendarId("");
        setCalendars([]);
        setLastSyncedAt(null);
        setConnectionStatus("not_connected");
        setCalendarSuccess("Disconnected.");
        setTimeout(() => setCalendarSuccess(""), 3000);
      } else {
        setCalendarError(data.error || "Couldn't disconnect.");
      }
    } catch {
      setCalendarError("Couldn't reach the disconnect endpoint.");
    } finally {
      setDisconnectBusy(false);
    }
  };

  const loadAccounts = useCallback(async () => {
    const result = await listAccounts();
    if (result.accounts) setAccounts(result.accounts);
  }, []);

  const loadProjects = useCallback(async () => {
    const result = await listProjects();
    if (result.projects) {
      setProjects(result.projects);
      if (result.projects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(result.projects[0].id);
      }
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (user?.role === "director") {
      loadAccounts();
      loadProjects();
      loadCalendars();
    }
  }, [user, loadAccounts, loadProjects, loadCalendars]);

  const loadProjectMembers = useCallback(async (projectId: number) => {
    const [membersResult, unassignedResult] = await Promise.all([
      listProjectMembers(projectId),
      listUnassignedMembers(projectId),
    ]);
    if (membersResult.members)
      setProjectMembers(membersResult.members as ProjectMember[]);
    if (unassignedResult.members)
      setUnassignedMembers(unassignedResult.members);
  }, []);

  useEffect(() => {
    if (selectedProjectId) loadProjectMembers(selectedProjectId);
  }, [selectedProjectId, loadProjectMembers]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");

    const result = await createAccount(createForm);
    if (result.error) {
      setCreateError(result.error);
    } else {
      setShowCreateForm(false);
      setCreateForm({
        email: "",
        password: "",
        name: "",
        role: "member",
        companyName: "",
        department: "",
      });
      loadAccounts();
    }
    setCreateLoading(false);
  };

  const handleDeleteAccount = async (profileId: number) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    const result = await deleteAccount(profileId);
    if (!result.error) loadAccounts();
  };

  const handleAssignMember = async (profileId: number) => {
    if (!selectedProjectId) return;
    const result = await assignMemberToProject(profileId, selectedProjectId);
    if (!result.error) {
      loadProjectMembers(selectedProjectId);
      setShowAssignDropdown(false);
    }
  };

  const handleRemoveMember = async (membershipId: number) => {
    if (!selectedProjectId) return;
    const result = await removeMemberFromProject(membershipId);
    if (!result.error) loadProjectMembers(selectedProjectId);
  };

  if (isLoading || user?.role !== "director") return null;

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "director":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "client":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "member":
        return "bg-sbi-green/10 text-sbi-green border-sbi-green/30";
      case "owner":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default:
        return "bg-white/10 text-white/70 border-white/20";
    }
  };

  const selectedCalendar = calendars.find((c) => c.id === selectedCalendarId);

  return (
    <div className="h-[calc(100vh-4rem)] bg-sbi-dark flex flex-col p-6 md:p-8 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto">
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white mb-2">
          Settings
        </h1>
        <p className="text-sbi-muted text-sm mb-8">
          Manage your portal configuration
        </p>

        <div className="grid gap-6">
          {/* Google Calendar */}
          <section className="bg-sbi-dark-card/40 border border-sbi-dark-border/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-1">
              <Calendar className="size-5 text-sbi-green" />
              <h2 className="text-lg font-light text-white">Google Calendar</h2>
            </div>

            {connectionStatus === "loading" ? (
              <div className="mt-5 flex items-center gap-2 text-sbi-muted text-sm">
                <Loader2 className="size-4 animate-spin" />
                Checking your connection...
              </div>
            ) : null}

            {connectionStatus === "not_connected" ? (
              <NotConnectedPanel />
            ) : null}

            {connectionStatus === "no_calendar" ? (
              <NoCalendarPanel
                email={connectedEmail}
                calendars={calendars}
                selectedCalendarId={selectedCalendarId}
                onSelect={handleSelectCalendar}
                saving={calendarSaving}
              />
            ) : null}

            {connectionStatus === "ready" ? (
              <ReadyPanel
                email={connectedEmail}
                calendar={selectedCalendar}
                lastSyncedAt={lastSyncedAt}
                onChangeCalendar={() => setConnectionStatus("no_calendar")}
                onDisconnect={handleDisconnect}
                disconnectBusy={disconnectBusy}
              />
            ) : null}

            {calendarSuccess ? (
              <div className="mt-4 flex items-center gap-2 text-sbi-green text-sm">
                <Check className="size-4" />
                {calendarSuccess}
              </div>
            ) : null}
            {calendarError ? (
              <div className="mt-4 flex items-start gap-2 text-red-400 text-sm">
                <AlertCircle className="size-4 shrink-0 mt-px" />
                <span>{calendarError}</span>
              </div>
            ) : null}
          </section>

          {/* Team Management — unchanged */}
          <section className="bg-sbi-dark-card/40 border border-sbi-dark-border/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="size-5 text-sbi-green" />
              <h2 className="text-lg font-light text-white">Team Management</h2>
            </div>
            <p className="text-sbi-muted text-sm mb-4">
              Assign members to projects. Directors are auto-assigned to all
              projects.
            </p>

            <div className="mb-4">
              <label className="text-xs tracking-widest uppercase text-sbi-muted mb-2 block">
                Project
              </label>
              <div className="relative">
                <select
                  value={selectedProjectId ?? ""}
                  onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 appearance-none cursor-pointer focus:outline-none focus:border-sbi-green/50"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-sbi-muted pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {projectMembers.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between px-3 py-2 bg-sbi-dark/50 border border-sbi-dark-border/20 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white">
                      {pm.profiles.name}
                    </span>
                    <span className="text-xs text-sbi-muted">
                      {pm.profiles.email}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${roleBadgeColor(pm.role)}`}
                    >
                      {pm.role}
                    </span>
                  </div>
                  {pm.role === "member" && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(pm.id)}
                      className="text-red-400/50 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {projectMembers.length === 0 && (
                <p className="text-sbi-muted/50 text-sm">
                  No members assigned yet.
                </p>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-sbi-green/10 text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark transition-all duration-300 rounded cursor-pointer"
              >
                <UserPlus className="size-4" />
                Assign Member
              </button>
              {showAssignDropdown && (
                <div className="absolute top-full mt-1 left-0 w-80 bg-sbi-dark border border-sbi-dark-border/50 rounded-lg shadow-2xl shadow-black/50 z-50 max-h-60 overflow-y-auto">
                  {unassignedMembers.length === 0 ? (
                    <p className="px-4 py-3 text-sbi-muted/50 text-sm">
                      No unassigned members available.
                    </p>
                  ) : (
                    unassignedMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleAssignMember(m.id)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <span className="text-sm text-white">{m.name}</span>
                        <span className="text-xs text-sbi-muted ml-2">
                          {m.email}
                        </span>
                        {m.department && (
                          <span className="text-xs text-sbi-muted/50 ml-2">
                            ({m.department})
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Account Management — unchanged */}
          <section className="bg-sbi-dark-card/40 border border-sbi-dark-border/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-sbi-green" />
                <h2 className="text-lg font-light text-white">
                  Account Management
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-sbi-green/10 text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark transition-all duration-300 rounded cursor-pointer"
              >
                <Plus className="size-4" />
                Create Account
              </button>
            </div>

            {showCreateForm && (
              <form
                onSubmit={handleCreateAccount}
                className="mb-6 p-4 bg-sbi-dark/50 border border-sbi-dark-border/20 rounded-lg space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, email: e.target.value }))
                      }
                      className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={createForm.password}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          password: e.target.value,
                        }))
                      }
                      className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">
                      Role
                    </label>
                    <select
                      value={createForm.role}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          role: e.target.value as
                            | "client"
                            | "director"
                            | "member",
                        }))
                      }
                      className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 appearance-none cursor-pointer focus:outline-none focus:border-sbi-green/50"
                    >
                      <option value="member">Member</option>
                      <option value="client">Client</option>
                      <option value="director">Director</option>
                    </select>
                  </div>
                  {createForm.role === "client" && (
                    <div className="col-span-2">
                      <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">
                        Company Name
                      </label>
                      <input
                        type="text"
                        required
                        value={createForm.companyName}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            companyName: e.target.value,
                          }))
                        }
                        className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                      />
                    </div>
                  )}
                  {createForm.role === "member" && (
                    <div className="col-span-2">
                      <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">
                        Department
                      </label>
                      <input
                        type="text"
                        value={createForm.department}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            department: e.target.value,
                          }))
                        }
                        className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                        placeholder="e.g. Engineering, Business, Tech"
                      />
                    </div>
                  )}
                </div>
                {createError && (
                  <p className="text-red-400 text-sm">{createError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-4 py-2 text-sm bg-sbi-green text-sbi-dark rounded hover:bg-sbi-green/80 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {createLoading ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-sm text-sbi-muted hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between px-3 py-2 bg-sbi-dark/50 border border-sbi-dark-border/20 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white">{account.name}</span>
                    <span className="text-xs text-sbi-muted">
                      {account.email}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${roleBadgeColor(account.role)}`}
                    >
                      {account.role}
                    </span>
                    {account.department && (
                      <span className="text-xs text-sbi-muted/50">
                        ({account.department})
                      </span>
                    )}
                  </div>
                  {account.id !== user?.id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(account.id)}
                      className="text-red-400/50 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google Calendar sub-panels
// ---------------------------------------------------------------------------

function NotConnectedPanel() {
  return (
    <div className="mt-4">
      <p className="text-sbi-muted text-sm mb-4 max-w-prose">
        Clients on your projects will see events from your Google Calendar where
        they're invited as an attendee. We only access the{" "}
        <span className="text-white">one calendar</span> you pick.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <div className="rounded-md border border-sbi-dark-border/40 bg-sbi-dark/40 p-3">
          <div className="text-[10px] tracking-[0.15em] uppercase text-sbi-muted-dark mb-1.5">
            What we do
          </div>
          <ul className="text-xs text-sbi-muted leading-relaxed list-disc list-outside ml-4 space-y-0.5">
            <li>Read events from one calendar you choose</li>
            <li>Filter to events where the client is an attendee</li>
            <li>Show them on the client's calendar page</li>
            <li>Save the client's RSVP back to your calendar</li>
          </ul>
        </div>
        <div className="rounded-md border border-sbi-dark-border/40 bg-sbi-dark/40 p-3">
          <div className="text-[10px] tracking-[0.15em] uppercase text-sbi-muted-dark mb-1.5">
            What we don't do
          </div>
          <ul className="text-xs text-sbi-muted leading-relaxed list-disc list-outside ml-4 space-y-0.5">
            <li>Create new events or delete existing ones</li>
            <li>Touch any calendar besides the one you select</li>
            <li>Read events without the client invited</li>
            <li>Access Gmail or any other Google data</li>
          </ul>
        </div>
      </div>

      <a
        href="/api/contact/auth/google"
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-sbi-green/10 text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark transition-all duration-300 rounded"
      >
        Connect Google Calendar
      </a>

      <p className="text-xs text-sbi-muted-dark mt-4">
        First-time setup for self-hosters?{" "}
        <a
          href="/docs/google-calendar-setup"
          className="text-sbi-green hover:underline inline-flex items-center gap-1"
          target="_blank"
          rel="noreferrer"
        >
          Setup guide
          <ExternalLink className="size-3" />
        </a>
      </p>
    </div>
  );
}

interface NoCalendarPanelProps {
  email: string;
  calendars: GoogleCalendar[];
  selectedCalendarId: string;
  onSelect: (id: string) => void;
  saving: boolean;
}

function NoCalendarPanel({
  email,
  calendars,
  selectedCalendarId,
  onSelect,
  saving,
}: NoCalendarPanelProps) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="size-1.5 rounded-full bg-sbi-green" />
        <span className="text-sm text-white">
          Connected
          {email ? (
            <>
              {" "}
              as <span className="text-sbi-green">{email}</span>
            </>
          ) : null}
        </span>
      </div>
      <p className="text-sbi-muted text-sm mb-4">
        Pick which calendar the portal should read from. We'll only show events
        where your client is invited.
      </p>

      <div className="space-y-1.5">
        {calendars.map((cal) => {
          const active = cal.id === selectedCalendarId;
          return (
            <button
              key={cal.id}
              type="button"
              onClick={() => onSelect(cal.id)}
              disabled={saving}
              className={[
                "w-full text-left px-3 py-2.5 rounded border transition-colors flex items-center justify-between gap-3 disabled:opacity-50",
                active
                  ? "border-sbi-green/40 bg-sbi-green/[0.06]"
                  : "border-sbi-dark-border/40 bg-sbi-dark/40 hover:border-sbi-dark-border",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{cal.summary}</div>
                <div className="text-[11px] text-sbi-muted truncate">
                  {cal.primary ? "Primary calendar" : cal.accessRole}
                </div>
              </div>
              {active ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-sbi-green">
                  <Check className="size-3.5" />
                  Selected
                </span>
              ) : (
                <span className="text-[11px] text-sbi-muted-dark">Select</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-sbi-muted-dark mt-4">
        Most directors pick a dedicated "Client meetings" calendar so studio
        standups don't leak through.
      </p>
    </div>
  );
}

interface ReadyPanelProps {
  email: string;
  calendar: GoogleCalendar | undefined;
  lastSyncedAt: string | null;
  onChangeCalendar: () => void;
  onDisconnect: () => void;
  disconnectBusy: boolean;
}

function ReadyPanel({
  email,
  calendar,
  lastSyncedAt,
  onChangeCalendar,
  onDisconnect,
  disconnectBusy,
}: ReadyPanelProps) {
  const lastSyncLabel = formatRelative(lastSyncedAt);

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="size-1.5 rounded-full bg-sbi-green" />
            <span className="text-sm text-white">
              Connected · reading from{" "}
              <span className="text-white">
                {calendar?.summary ?? "selected calendar"}
              </span>
            </span>
          </div>
          <div className="text-xs text-sbi-muted ml-3.5">
            {email}
            {lastSyncLabel ? <> · last refreshed {lastSyncLabel}</> : null}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onChangeCalendar}
            className="px-3 py-1.5 text-xs text-sbi-muted border border-sbi-dark-border/60 rounded hover:text-white hover:border-white/30 transition-colors"
          >
            Change calendar
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={disconnectBusy}
            className="px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {disconnectBusy ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return null;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
