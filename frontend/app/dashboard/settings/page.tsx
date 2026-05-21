"use client";

import { Calendar, Users, Shield, Plus, Trash2, UserPlus, ChevronDown, Check, Loader2, User, Lock, Bell, type LucideIcon } from "lucide-react";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toastSuccess, toastError } from "@/lib/notifications";
import {
  DashboardShell,
  PageHeader,
  SectionLabel,
  Panel,
  EmptyState,
  btnPrimary,
  btnGhost,
} from "@/components/dashboard/common/ui";
import {
  createAccount,
  listAccounts,
  deleteAccount,
  listProjects,
  listProjectMembers,
  assignMemberToProject,
  removeMemberFromProject,
  listUnassignedMembers,
  getMyAccount,
  updateMyProfile,
  updateMyPassword,
  updateMyNotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface MyAccount {
  id: number;
  name: string;
  email: string | null;
  role: "client" | "director" | "member";
  department: string | null;
  prefs: NotificationPrefs;
}

// ---------------------------------------------------------------------------
// Section configuration
// ---------------------------------------------------------------------------

type SectionId = "profile" | "security" | "notifications" | "calendar" | "team" | "accounts";

interface SectionDef {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  group: "personal" | "workspace";
  directorOnly?: boolean;
}

const SECTIONS: SectionDef[] = [
  { id: "profile", label: "Profile", icon: User, group: "personal" },
  { id: "security", label: "Security", icon: Lock, group: "personal" },
  { id: "notifications", label: "Notifications", icon: Bell, group: "personal" },
  { id: "calendar", label: "Calendar", icon: Calendar, group: "workspace", directorOnly: true },
  { id: "team", label: "Team", icon: Users, group: "workspace", directorOnly: true },
  { id: "accounts", label: "Accounts", icon: Shield, group: "workspace", directorOnly: true },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);

function roleBadgeColor(role: string) {
  switch (role) {
    case "director": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "client": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "member": return "bg-sbi-green/10 text-sbi-green border-sbi-green/30";
    case "owner": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    default: return "bg-white/10 text-white/70 border-white/20";
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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

  const isDirector = user?.role === "director";

  const requestedSection = searchParams.get("section");
  const activeSection: SectionId = useMemo(() => {
    const candidate = SECTION_IDS.includes(requestedSection as SectionId)
      ? (requestedSection as SectionId)
      : "profile";
    const def = SECTIONS.find((s) => s.id === candidate);
    if (def?.directorOnly && !isDirector) return "profile";
    return candidate;
  }, [requestedSection, isDirector]);

  const setActiveSection = useCallback(
    (id: SectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("section", id);
      router.replace(`/dashboard/settings?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => isDirector || !s.directorOnly),
    [isDirector],
  );

  if (isLoading || !user) return null;

  return (
    <DashboardShell className="overflow-y-auto">
      <PageHeader
        title="Settings"
        subtitle={isDirector ? "Manage your account and the portal workspace" : "Manage your account"}
      />

      <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8 lg:gap-12 pb-8">
        <SettingsNav
          sections={visibleSections}
          activeSection={activeSection}
          onSelect={setActiveSection}
        />

        <div className="min-w-0">
          {activeSection === "profile" && <ProfileSection />}
          {activeSection === "security" && <SecuritySection />}
          {activeSection === "notifications" && <NotificationsSection />}
          {activeSection === "calendar" && isDirector && <CalendarSection />}
          {activeSection === "team" && isDirector && <TeamSection />}
          {activeSection === "accounts" && isDirector && <AccountsSection currentUserId={user.id} />}
        </div>
      </div>
    </DashboardShell>
  );
}

// ---------------------------------------------------------------------------
// Vertical nav
// ---------------------------------------------------------------------------

function SettingsNav({
  sections,
  activeSection,
  onSelect,
}: {
  sections: SectionDef[];
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  const personal = sections.filter((s) => s.group === "personal");
  const workspace = sections.filter((s) => s.group === "workspace");

  return (
    <nav className="md:sticky md:top-0 self-start space-y-7">
      <NavGroup label="Personal" sections={personal} active={activeSection} onSelect={onSelect} />
      {workspace.length > 0 && (
        <NavGroup label="Workspace" sections={workspace} active={activeSection} onSelect={onSelect} />
      )}
    </nav>
  );
}

function NavGroup({
  label,
  sections,
  active,
  onSelect,
}: {
  label: string;
  sections: SectionDef[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <div>
      <div className="px-3 mb-2 text-[10px] tracking-[0.25em] uppercase text-sbi-muted-dark font-light">
        {label}
      </div>
      <div className="space-y-0.5">
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-light transition-colors cursor-pointer ${
                isActive ? "text-white bg-sbi-green/5" : "text-sbi-muted hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-sbi-green transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <s.icon
                className={`size-4 transition-colors ${
                  isActive ? "text-sbi-green" : "text-sbi-muted-dark group-hover:text-sbi-green/70"
                }`}
                strokeWidth={1.5}
              />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared classes
// ---------------------------------------------------------------------------

const inputClass =
  "w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded-md px-3 py-2 " +
  "focus:outline-none focus:border-sbi-green/50 disabled:opacity-50 placeholder:text-sbi-muted-dark/60";

const labelClass = "text-[11px] tracking-[0.15em] uppercase text-sbi-muted-dark font-light";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0]?.substring(0, 2).toUpperCase() || "??";
}

// ---------------------------------------------------------------------------
// Profile section
// ---------------------------------------------------------------------------

function ProfileSection() {
  const [account, setAccount] = useState<MyAccount | null>(null);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyAccount().then((res) => {
      if (res.account) {
        setAccount(res.account);
        setName(res.account.name);
        setDepartment(res.account.department ?? "");
      }
    });
  }, []);

  if (!account) {
    return (
      <Panel>
        <div className="flex items-center gap-2 text-sbi-muted text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading your profile…
        </div>
      </Panel>
    );
  }

  const isDirty =
    name.trim() !== account.name ||
    (department.trim() || null) !== (account.department || null);
  const showDepartment = account.role === "member" || account.role === "director";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await updateMyProfile({ name, department: department.trim() || null });
    if (result.error) {
      toastError(result.error, "Couldn't save profile");
    } else {
      const next = { ...account, name: name.trim(), department: department.trim() || null };
      setAccount(next);
      toastSuccess("Profile saved.");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Panel>
        <SectionLabel>Profile</SectionLabel>
        <p className="text-sbi-muted text-sm mb-6">
          How you appear inside the portal. Your email is your sign-in and cannot be changed here.
        </p>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr] items-center gap-4">
            <div className="size-16 rounded-lg border border-sbi-dark-border/60 flex items-center justify-center text-base font-light text-sbi-green tracking-wider">
              {initialsOf(account.name)}
            </div>
            <div className="min-w-0">
              <p className="text-white text-base font-light truncate">{account.name}</p>
              <p className="text-sbi-muted text-sm truncate">{account.email}</p>
              <span
                className={`mt-2 inline-block text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${roleBadgeColor(account.role)}`}
              >
                {account.role}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={account.email ?? ""}
                readOnly
                className={`${inputClass} mt-1 cursor-not-allowed text-sbi-muted`}
              />
            </div>
            {showDepartment && (
              <div className="sm:col-span-2">
                <label className={labelClass}>Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Architecture, Business"
                  className={`${inputClass} mt-1`}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={!isDirty || saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security section
// ---------------------------------------------------------------------------

function SecuritySection() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSignOutEverywhere, setShowSignOutEverywhere] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const result = await updateMyPassword(newPassword);
    if (result.error) {
      setError(result.error);
      toastError(result.error, "Couldn't update password");
    } else {
      setNewPassword("");
      setConfirmPassword("");
      toastSuccess("Password updated.");
    }
    setSaving(false);
  };

  const handleSignOutEverywhere = async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/login");
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Panel>
        <SectionLabel>Password</SectionLabel>
        <p className="text-sbi-muted text-sm mb-6">
          Choose a new password at least 8 characters long. You'll stay signed in on this device.
        </p>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={labelClass}>New password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !newPassword || !confirmPassword}
              className={btnPrimary}
            >
              {saving ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel>
        <SectionLabel>Sessions</SectionLabel>
        <p className="text-sbi-muted text-sm mb-6">
          Sign out of every device where this account is currently active.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowSignOutEverywhere(true)}
            className={btnGhost}
          >
            Sign out everywhere
          </button>
        </div>
      </Panel>

      <ConfirmDialog
        opened={showSignOutEverywhere}
        onClose={() => setShowSignOutEverywhere(false)}
        title="Sign out everywhere?"
        description="You'll be signed out on every device including this one. You'll need to sign in again."
        confirmLabel="Sign out everywhere"
        onConfirm={handleSignOutEverywhere}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications section
// ---------------------------------------------------------------------------

const NOTIFICATION_ITEMS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "messages", label: "New messages", description: "Email me when I receive a portal message." },
  { key: "calendar", label: "Calendar events", description: "Email me when an event involving me is created or changes." },
  { key: "requests", label: "Request updates", description: "Email me when a request I'm involved in changes status." },
  { key: "reports", label: "New reports", description: "Email me when a new report is published to my project." },
  { key: "weeklyDigest", label: "Weekly digest", description: "A Monday summary of what changed last week." },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [initial, setInitial] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyAccount().then((res) => {
      if (res.account) {
        setPrefs(res.account.prefs);
        setInitial(res.account.prefs);
      }
    });
  }, []);

  if (!prefs || !initial) {
    return (
      <Panel>
        <div className="flex items-center gap-2 text-sbi-muted text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading your preferences…
        </div>
      </Panel>
    );
  }

  const isDirty = (Object.keys(prefs) as (keyof NotificationPrefs)[]).some(
    (k) => prefs[k] !== initial[k],
  );

  const toggle = (k: keyof NotificationPrefs) => setPrefs({ ...prefs, [k]: !prefs[k] });

  const handleSave = async () => {
    setSaving(true);
    const result = await updateMyNotificationPrefs(prefs);
    if (result.error) {
      toastError(result.error, "Couldn't save preferences");
    } else {
      setInitial(prefs);
      toastSuccess("Preferences saved.");
    }
    setSaving(false);
  };

  const handleReset = () => setPrefs(DEFAULT_NOTIFICATION_PREFS);

  return (
    <div className="max-w-2xl space-y-4">
      <Panel>
        <SectionLabel>Email notifications</SectionLabel>
        <p className="text-sbi-muted text-sm mb-6">
          Choose what reaches your inbox. Anything turned off still appears inside the portal.
        </p>

        <ul className="divide-y divide-sbi-dark-border/30">
          {NOTIFICATION_ITEMS.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm text-white">{item.label}</p>
                <p className="text-xs text-sbi-muted-dark mt-0.5">{item.description}</p>
              </div>
              <Toggle checked={prefs[item.key]} onChange={() => toggle(item.key)} label={item.label} />
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end gap-2 pt-6">
          <button type="button" onClick={handleReset} className={btnGhost}>
            Reset to defaults
          </button>
          <button type="button" onClick={handleSave} disabled={!isDirty || saving} className={btnPrimary}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Panel>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
        checked ? "bg-sbi-green/70" : "bg-sbi-dark-border/60"
      }`}
    >
      <span
        className={`inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[1.125rem]" : "translate-x-[0.1875rem]"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Calendar section (director only)
// ---------------------------------------------------------------------------

function CalendarSection() {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("config")
          .eq("uid", authUser.id)
          .single();
        const google = (profile?.config as Record<string, unknown>)?.google as Record<string, string> | undefined;
        if (google?.calendar_id) setSelectedCalendarId(google.calendar_id);
      }
      const res = await fetch("/api/contact/calendar/client-events/list");
      const data = await res.json();
      if (res.ok && data.calendars) setCalendars(data.calendars);
    } catch {
      // No OAuth token or network error — leave empty.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelect = async (calendarId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/contact/calendar/client-events/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSelectedCalendarId(calendarId);
        toastSuccess("Calendar saved.");
      } else {
        const msg = data.error || "Couldn't save the selected calendar.";
        setError(msg);
        toastError(msg, "Couldn't save calendar");
      }
    } catch {
      const msg = "Couldn't reach the calendar service.";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Panel>
        <SectionLabel>Google Calendar</SectionLabel>
        <p className="text-sbi-muted text-sm mb-5">
          Connect your Google Calendar so clients can see your availability and scheduled events.
        </p>
        <a href="/api/contact/auth/google" className={btnPrimary}>
          {calendars.length > 0 ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </a>

        {loading && (
          <div className="flex items-center gap-2 mt-4 text-sbi-muted text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading calendars…
          </div>
        )}

        {calendars.length > 0 && !loading && (
          <div className="mt-6">
            <label className={labelClass}>Calendar for client events</label>
            <div className="relative mt-1">
              <select
                value={selectedCalendarId}
                onChange={(e) => handleSelect(e.target.value)}
                disabled={saving}
                className={`${inputClass} appearance-none cursor-pointer pr-9`}
              >
                <option value="">Choose a calendar…</option>
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.summary}{cal.primary ? " (Primary)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-sbi-muted pointer-events-none" />
            </div>
            {selectedCalendarId && (
              <div className="flex items-center gap-2 mt-2 text-sbi-green text-sm">
                <Check className="size-4" />
                Using: {calendars.find((c) => c.id === selectedCalendarId)?.summary ?? selectedCalendarId}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team section (director only)
// ---------------------------------------------------------------------------

function TeamSection() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<UnassignedMember[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await listProjects();
    if (res.projects) {
      setProjects(res.projects);
      if (res.projects.length > 0) setSelectedProjectId((curr) => curr ?? res.projects[0].id);
    }
  }, []);

  const loadProjectMembers = useCallback(async (projectId: number) => {
    const [m, u] = await Promise.all([
      listProjectMembers(projectId),
      listUnassignedMembers(projectId),
    ]);
    if (m.members) setProjectMembers(m.members as ProjectMember[]);
    if (u.members) setUnassignedMembers(u.members);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { if (selectedProjectId) loadProjectMembers(selectedProjectId); }, [selectedProjectId, loadProjectMembers]);

  const handleAssign = async (profileId: number) => {
    if (!selectedProjectId) return;
    const res = await assignMemberToProject(profileId, selectedProjectId);
    if (res.error) toastError(res.error, "Couldn't assign member");
    else {
      loadProjectMembers(selectedProjectId);
      setShowAssignDropdown(false);
      toastSuccess("Member assigned to project.");
    }
  };

  const confirmRemove = async () => {
    if (!memberToRemove || !selectedProjectId) return;
    const target = memberToRemove;
    const res = await removeMemberFromProject(target.id);
    if (res.error) toastError(res.error, "Couldn't remove member");
    else {
      toastSuccess(`Removed ${target.profiles.name} from project.`);
      loadProjectMembers(selectedProjectId);
    }
    setMemberToRemove(null);
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Panel>
        <SectionLabel>Project members</SectionLabel>
        <p className="text-sbi-muted text-sm mb-5">
          Assign members to projects. Directors are automatically assigned to every project.
        </p>

        <div className="mb-5">
          <label className={labelClass}>Project</label>
          <div className="relative mt-1">
            <select
              value={selectedProjectId ?? ""}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              className={`${inputClass} appearance-none cursor-pointer pr-9`}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.company_name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-sbi-muted pointer-events-none" />
          </div>
        </div>

        {projectMembers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="No members assigned"
            description="Assign members to this project using the button below."
            className="py-10"
          />
        ) : (
          <div className="space-y-2 mb-5">
            {projectMembers.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center justify-between px-3 py-2 bg-sbi-dark/40 border border-sbi-dark-border/20 rounded-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm text-white truncate">{pm.profiles.name}</span>
                  <span className="text-xs text-sbi-muted truncate">{pm.profiles.email}</span>
                  <span className={`shrink-0 text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${roleBadgeColor(pm.role)}`}>
                    {pm.role}
                  </span>
                </div>
                {pm.role === "member" && (
                  <button
                    type="button"
                    onClick={() => setMemberToRemove(pm)}
                    aria-label={`Remove ${pm.profiles.name} from project`}
                    title={`Remove ${pm.profiles.name} from project`}
                    className="text-red-400/50 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setShowAssignDropdown(!showAssignDropdown)}
            className={btnPrimary}
          >
            <UserPlus className="size-4" />
            Assign member
          </button>
          {showAssignDropdown && (
            <div className="absolute top-full mt-1 left-0 w-80 bg-sbi-dark border border-sbi-dark-border/50 rounded-lg shadow-2xl shadow-black/50 z-50 max-h-60 overflow-y-auto">
              {unassignedMembers.length === 0 ? (
                <p className="px-4 py-3 text-sbi-muted/70 text-sm">No unassigned members available.</p>
              ) : (
                unassignedMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleAssign(m.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <span className="text-sm text-white">{m.name}</span>
                    <span className="text-xs text-sbi-muted ml-2">{m.email}</span>
                    {m.department && <span className="text-xs text-sbi-muted/50 ml-2">({m.department})</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Panel>

      <ConfirmDialog
        opened={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title="Remove member?"
        danger
        description={
          memberToRemove ? (
            <p>
              Remove <span className="text-white font-medium">{memberToRemove.profiles.name}</span>{" "}
              from this project? Their account stays; only the project assignment is removed.
            </p>
          ) : null
        }
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accounts section (director only)
// ---------------------------------------------------------------------------

function AccountsSection({ currentUserId }: { currentUserId: number }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "", password: "", name: "",
    role: "member" as "client" | "director" | "member",
    companyName: "", department: "",
  });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  const loadAccounts = useCallback(async () => {
    const res = await listAccounts();
    if (res.accounts) setAccounts(res.accounts);
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    const res = await createAccount(createForm);
    if (res.error) {
      setCreateError(res.error);
      toastError(res.error, "Couldn't create account");
    } else {
      const createdName = createForm.name;
      setShowCreateForm(false);
      setCreateForm({ email: "", password: "", name: "", role: "member", companyName: "", department: "" });
      loadAccounts();
      toastSuccess(`Account created for ${createdName}.`);
    }
    setCreateLoading(false);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    const target = accountToDelete;
    const res = await deleteAccount(target.id);
    if (res.error) toastError(res.error, "Couldn't delete account");
    else {
      toastSuccess(`Deleted ${target.name}'s account.`);
      loadAccounts();
    }
    setAccountToDelete(null);
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel className="mb-0">Portal accounts</SectionLabel>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className={btnPrimary}
          >
            <Plus className="size-4" />
            Create account
          </button>
        </div>
        <p className="text-sbi-muted text-sm mb-5">
          Create and manage portal accounts for directors, members, and clients.
        </p>

        {showCreateForm && (
          <form onSubmit={handleCreate} className="mt-2 p-4 bg-sbi-dark/50 border border-sbi-dark-border/20 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as "client" | "director" | "member" }))}
                  className={`${inputClass} mt-1 appearance-none cursor-pointer`}
                >
                  <option value="member">Member</option>
                  <option value="client">Client</option>
                  <option value="director">Director</option>
                </select>
              </div>
              {createForm.role === "client" && (
                <div className="col-span-2">
                  <label className={labelClass}>Company name</label>
                  <input
                    type="text"
                    required
                    value={createForm.companyName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, companyName: e.target.value }))}
                    className={`${inputClass} mt-1`}
                  />
                </div>
              )}
              {createForm.role === "member" && (
                <div className="col-span-2">
                  <label className={labelClass}>Department</label>
                  <input
                    type="text"
                    value={createForm.department}
                    onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="e.g. Engineering, Business, Tech"
                    className={`${inputClass} mt-1`}
                  />
                </div>
              )}
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={createLoading} className={btnPrimary}>
                {createLoading ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} className={btnGhost}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Panel>

      <Panel padded={accounts.length > 0}>
        {accounts.length === 0 ? (
          <EmptyState
            icon={<Shield className="size-6" />}
            title="No accounts yet"
            description="Create the first portal account using the button above."
          />
        ) : (
          <div className="divide-y divide-sbi-dark-border/20">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between px-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm text-white truncate">{account.name}</span>
                  <span className="text-xs text-sbi-muted truncate">{account.email}</span>
                  <span className={`shrink-0 text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${roleBadgeColor(account.role)}`}>
                    {account.role}
                  </span>
                  {account.department && <span className="text-xs text-sbi-muted/50 truncate">({account.department})</span>}
                </div>
                {account.id !== currentUserId ? (
                  <button
                    type="button"
                    onClick={() => setAccountToDelete(account)}
                    aria-label={`Delete ${account.name}'s account`}
                    title={`Delete ${account.name}'s account`}
                    className="text-red-400/50 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : (
                  <Trash2
                    className="size-4 text-sbi-muted/30"
                    aria-label="Cannot delete your own account"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <ConfirmDialog
        opened={!!accountToDelete}
        onClose={() => setAccountToDelete(null)}
        title="Delete account?"
        danger
        description={
          accountToDelete ? (
            <>
              <p className="mb-2">
                You're about to permanently delete{" "}
                <span className="text-white font-medium">{accountToDelete.name}</span>{" "}
                ({accountToDelete.email}).
              </p>
              <p>This removes their profile, project memberships, and auth account. This cannot be undone.</p>
            </>
          ) : null
        }
        confirmationText={accountToDelete?.name}
        confirmLabel="Delete account"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
