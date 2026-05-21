"use client";

import { Calendar, Users, Shield, Plus, Trash2, UserPlus, Check, Loader2, User, Lock, Bell, Search, Pencil, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/dashboard/common/Modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
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
  updateAccount,
  listProjects,
  listProjectMembers,
  assignMemberToProject,
  removeMemberFromProject,
  listUnassignedMembers,
  assignOwnerToProject,
  listAvailableOwners,
  getMyAccount,
  updateMyProfile,
  updateMyPassword,
  updateMyNotificationPrefs,
} from "./actions";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEPARTMENTS,
  type NotificationPrefs,
} from "./types";

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
  synthetic: boolean;
  role: string;
  profile_id: number;
  created_at: string | null;
  profiles: { id: number; name: string; email: string; role: string };
  assigner: { id: number; name: string } | null;
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
  "w-full h-9 bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded-md px-3 " +
  "focus:outline-none focus:border-sbi-green/50 disabled:opacity-50 placeholder:text-sbi-muted-dark/60";

const labelClass = "text-[11px] tracking-[0.15em] uppercase text-sbi-muted-dark font-light";

function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside, enabled]);
}

function useEscapeKey(onEscape: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onEscape, enabled]);
}

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyAccount().then((res) => {
      if (res.account) {
        setAccount(res.account);
        setName(res.account.name);
        setDepartment(res.account.department ?? "");
      } else {
        setLoadError(res.error || "Couldn't load your profile.");
      }
    });
  }, []);

  if (loadError) {
    return (
      <Panel>
        <p className="text-red-400 text-sm">{loadError}</p>
      </Panel>
    );
  }

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
                <Select value={department || "__none__"} onValueChange={(v) => setDepartment(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="No department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSignOutEverywhere, setShowSignOutEverywhere] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from the current one.");
      return;
    }

    setSaving(true);

    // Verify current password by signing in with it. On success the session
    // is refreshed for the same user; on failure we know it's wrong before
    // touching the auth record.
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) {
      setError("Couldn't read your current session. Please sign in again.");
      setSaving(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPassword,
    });
    if (verifyError) {
      setError("Current password is incorrect.");
      setSaving(false);
      return;
    }

    const result = await updateMyPassword(newPassword);
    if (result.error) {
      setError(result.error);
      toastError(result.error, "Couldn't update password");
    } else {
      setCurrentPassword("");
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
            <label className={labelClass}>Current password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
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
              disabled={saving || !currentPassword || !newPassword || !confirmPassword}
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyAccount().then((res) => {
      if (res.account) {
        setPrefs(res.account.prefs);
        setInitial(res.account.prefs);
      } else {
        setLoadError(res.error || "Couldn't load your preferences.");
      }
    });
  }, []);

  if (loadError) {
    return (
      <Panel>
        <p className="text-red-400 text-sm">{loadError}</p>
      </Panel>
    );
  }

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
      let hadSavedCalendar = false;
      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("config")
          .eq("uid", authUser.id)
          .single();
        const google = (profile?.config as Record<string, unknown>)?.google as Record<string, string> | undefined;
        if (google?.calendar_id) {
          setSelectedCalendarId(google.calendar_id);
          hadSavedCalendar = true;
        }
      }

      const res = await fetch("/api/contact/calendar/client-events/list");
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.calendars) {
        setCalendars(data.calendars);
        return;
      }

      // Distinguish "never connected" from "token expired" — the latter
      // matters because the user may have a saved calendar choice that no
      // longer resolves.
      if (res.status === 401 || res.status === 403) {
        setError(
          hadSavedCalendar
            ? "Your Google Calendar connection has expired. Reconnect to refresh the calendar list."
            : "",
        );
        return;
      }

      if (!res.ok) {
        setError(data?.error || `Couldn't load calendars (${res.status}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the calendar service.");
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
            <Select value={selectedCalendarId} onValueChange={handleSelect} disabled={saving}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a calendar…" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((cal) => (
                  <SelectItem key={cal.id} value={cal.id}>
                    {cal.summary}{cal.primary ? " (Primary)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<UnassignedMember[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [assignQuery, setAssignQuery] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [availableOwners, setAvailableOwners] = useState<{ id: number; name: string; email: string }[]>([]);
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState("");

  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const ownerDropdownRef = useRef<HTMLDivElement>(null);
  const closeAssign = useCallback(() => setShowAssignDropdown(false), []);
  const closeOwner = useCallback(() => setShowOwnerDropdown(false), []);
  useClickOutside(assignDropdownRef, closeAssign, showAssignDropdown);
  useEscapeKey(closeAssign, showAssignDropdown);
  useClickOutside(ownerDropdownRef, closeOwner, showOwnerDropdown);
  useEscapeKey(closeOwner, showOwnerDropdown);

  useEffect(() => {
    if (!showAssignDropdown) setAssignQuery("");
  }, [showAssignDropdown]);

  const filteredUnassigned = useMemo(() => {
    const q = assignQuery.trim().toLowerCase();
    if (!q) return unassignedMembers;
    return unassignedMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.department?.toLowerCase().includes(q) ?? false),
    );
  }, [unassignedMembers, assignQuery]);

  const loadProjects = useCallback(async () => {
    const res = await listProjects();
    if (res.projects) {
      setProjects(res.projects);
      if (res.projects.length > 0) setSelectedProjectId((curr) => curr ?? res.projects[0].id);
    }
    setProjectsLoaded(true);
  }, []);

  const loadProjectMembers = useCallback(async (projectId: number) => {
    const [m, u, o] = await Promise.all([
      listProjectMembers(projectId),
      listUnassignedMembers(projectId),
      listAvailableOwners(projectId),
    ]);
    if (m.members) setProjectMembers(m.members as ProjectMember[]);
    if (u.members) setUnassignedMembers(u.members);
    if (o.clients) setAvailableOwners(o.clients);
    setMembersLoaded(true);
  }, []);

  useEffect(() => {
    if (!showOwnerDropdown) setOwnerQuery("");
  }, [showOwnerDropdown]);

  const filteredOwners = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase();
    if (!q) return availableOwners;
    return availableOwners.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [availableOwners, ownerQuery]);

  const handleAssignOwner = async (profileId: number) => {
    if (!selectedProjectId) return;
    const res = await assignOwnerToProject(profileId, selectedProjectId);
    if (res.error) toastError(res.error, "Couldn't assign owner");
    else {
      loadProjectMembers(selectedProjectId);
      setShowOwnerDropdown(false);
      toastSuccess("Owner assigned to project.");
    }
  };

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    setMembersLoaded(false);
    (async () => {
      const [m, u, o] = await Promise.all([
        listProjectMembers(selectedProjectId),
        listUnassignedMembers(selectedProjectId),
        listAvailableOwners(selectedProjectId),
      ]);
      if (cancelled) return;
      if (m.members) setProjectMembers(m.members as ProjectMember[]);
      if (u.members) setUnassignedMembers(u.members);
      if (o.clients) setAvailableOwners(o.clients);
      setMembersLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

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

  // Inline loading matches the Accounts pattern — header + selector stay
  // visible, only the table area shows the spinner during the first fetch
  // or while switching projects.
  const isLoading = !projectsLoaded || (selectedProjectId !== null && !membersLoaded);

  const memberCount = projectMembers.filter((m) => m.role === "member").length;
  const directorCount = projectMembers.filter((m) => m.role === "director").length;
  const ownerCount = projectMembers.filter((m) => m.role === "owner").length;
  const hasOwner = ownerCount > 0;
  const countLine = projectMembers.length === 0
    ? null
    : [
        ownerCount > 0 ? `${ownerCount} owner` : null,
        `${memberCount} member${memberCount === 1 ? "" : "s"}`,
        `${directorCount} director${directorCount === 1 ? "" : "s"}`,
      ].filter(Boolean).join(" · ");

  return (
    <div className="max-w-3xl space-y-4">
      <Panel>
        <div className="flex items-center justify-between gap-4 mb-5">
          <SectionLabel className="mb-0">Project members</SectionLabel>
          <div className="flex items-center gap-2">
            {!hasOwner && selectedProjectId && !isLoading && (
              <div className="relative" ref={ownerDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                  className={btnGhost}
                >
                  <UserPlus className="size-4" />
                  Assign owner
                </button>
                {showOwnerDropdown && (
                  <div className="absolute top-full mt-2 right-0 w-96 bg-sbi-dark border border-sbi-dark-border/60 rounded-lg shadow-2xl shadow-black/60 z-50 flex flex-col max-h-96">
                      <div className="p-2 border-b border-sbi-dark-border/40">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-sbi-muted-dark" strokeWidth={1.5} />
                          <input
                            type="text"
                            autoFocus
                            value={ownerQuery}
                            onChange={(e) => setOwnerQuery(e.target.value)}
                            placeholder="Search clients"
                            className="w-full h-8 bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded-md pl-9 pr-3 focus:outline-none focus:border-sbi-green/50 placeholder:text-sbi-muted-dark/60"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark">
                        <span>Available clients</span>
                        <span className="tabular-nums">
                          {filteredOwners.length}
                          {ownerQuery && filteredOwners.length !== availableOwners.length
                            ? ` of ${availableOwners.length}`
                            : ""}
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto py-1">
                        {availableOwners.length === 0 ? (
                          <p className="px-3 py-6 text-sbi-muted-dark text-sm text-center">
                            No unassigned clients available.
                          </p>
                        ) : filteredOwners.length === 0 ? (
                          <p className="px-3 py-6 text-sbi-muted-dark text-sm text-center">
                            No matches for <span className="text-sbi-muted">"{ownerQuery}"</span>.
                          </p>
                        ) : (
                          filteredOwners.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleAssignOwner(c.id)}
                              className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer focus:bg-white/5 focus:outline-none"
                            >
                              <div className="text-sm text-white truncate">{c.name}</div>
                              <div className="text-xs text-sbi-muted-dark truncate">{c.email}</div>
                            </button>
                          ))
                        )}
                      </div>
                  </div>
                )}
              </div>
            )}
            <div className="relative" ref={assignDropdownRef}>
            <button
              type="button"
              onClick={() => setShowAssignDropdown(!showAssignDropdown)}
              disabled={!selectedProjectId}
              className={btnPrimary}
            >
              <UserPlus className="size-4" />
              Assign member
            </button>
            {showAssignDropdown && (
              <div className="absolute top-full mt-2 right-0 w-96 bg-sbi-dark border border-sbi-dark-border/60 rounded-lg shadow-2xl shadow-black/60 z-50 flex flex-col max-h-96">
                  <div className="p-2 border-b border-sbi-dark-border/40">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-sbi-muted-dark" strokeWidth={1.5} />
                      <input
                        type="text"
                        autoFocus
                        value={assignQuery}
                        onChange={(e) => setAssignQuery(e.target.value)}
                        placeholder="Search by name, email, or department"
                        className="w-full h-8 bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded-md pl-9 pr-3 focus:outline-none focus:border-sbi-green/50 placeholder:text-sbi-muted-dark/60"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark">
                    <span>Available members</span>
                    <span className="tabular-nums">
                      {filteredUnassigned.length}
                      {assignQuery && filteredUnassigned.length !== unassignedMembers.length
                        ? ` of ${unassignedMembers.length}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    {unassignedMembers.length === 0 ? (
                      <p className="px-3 py-6 text-sbi-muted-dark text-sm text-center">
                        Everyone available is already on this project.
                      </p>
                    ) : filteredUnassigned.length === 0 ? (
                      <p className="px-3 py-6 text-sbi-muted-dark text-sm text-center">
                        No matches for <span className="text-sbi-muted">"{assignQuery}"</span>.
                      </p>
                    ) : (
                      filteredUnassigned.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleAssign(m.id)}
                          className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer focus:bg-white/5 focus:outline-none"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-white truncate">{m.name}</div>
                            {m.department && (
                              <span className="shrink-0 text-[10px] tracking-[0.15em] uppercase text-sbi-muted-dark">
                                {m.department}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-sbi-muted-dark truncate">{m.email}</div>
                        </button>
                      ))
                    )}
                  </div>
              </div>
            )}
          </div>
          </div>
        </div>

        <div className="flex items-end gap-4 mb-5">
          <div className="flex-1 min-w-0 max-w-xs">
            <label className={labelClass}>Project</label>
            <Select
              value={selectedProjectId ? String(selectedProjectId) : undefined}
              onValueChange={(v) => setSelectedProjectId(Number(v))}
              disabled={projects.length === 0}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={projects.length === 0 ? "No projects yet" : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {countLine && (
            <p className="text-xs text-sbi-muted-dark tabular-nums pb-2.5">{countLine}</p>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sbi-muted text-sm py-2">
            <Loader2 className="size-4 animate-spin" /> Loading team…
          </div>
        ) : projectMembers.length === 0 ? (
          <p className="text-sm text-sbi-muted-dark py-3">
            No one's on this project yet. Use <span className="text-sbi-muted">Assign member</span> above.
          </p>
        ) : (
          <div className="border border-sbi-dark-border/30 rounded-md overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1.8fr_96px_32px] gap-3 px-3 py-2 text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark border-b border-sbi-dark-border/30">
              <div>Name</div>
              <div>Email</div>
              <div>Role</div>
              <div />
            </div>
            {projectMembers.map((pm) => {
              const assignedTooltip = pm.assigner
                ? `Added by ${pm.assigner.name}${pm.created_at ? ` on ${new Date(pm.created_at).toLocaleDateString()}` : ""}`
                : undefined;
              return (
              <div
                key={pm.id}
                className="grid grid-cols-[1.2fr_1.8fr_96px_32px] gap-3 items-center px-3 py-2.5 border-b border-sbi-dark-border/15 last:border-b-0 hover:bg-white/[0.015] transition-colors"
              >
                <div className="text-sm text-white truncate">{pm.profiles.name}</div>
                <div className="text-xs text-sbi-muted truncate flex items-center gap-2 min-w-0">
                  <span className="truncate">{pm.profiles.email}</span>
                  {pm.assigner && (
                    <span
                      title={assignedTooltip}
                      className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark/70"
                    >
                      · by {pm.assigner.name.split(" ")[0]}
                    </span>
                  )}
                </div>
                <div>
                  <span className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${roleBadgeColor(pm.role)}`}>
                    {pm.role}
                  </span>
                </div>
                <div className="flex justify-end">
                  {pm.role === "member" && !pm.synthetic ? (
                    <button
                      type="button"
                      onClick={() => setMemberToRemove(pm)}
                      aria-label={`Remove ${pm.profiles.name} from project`}
                      title={`Remove ${pm.profiles.name} from project`}
                      className="text-red-400/50 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-label="Directors can't be removed from a project"
                      title="Directors can't be removed from a project"
                      className="text-red-400/25 cursor-not-allowed"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
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

type AccountFilter = "all" | "director" | "member" | "client";

function AccountsSection({ currentUserId }: { currentUserId: number }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "", password: "", name: "",
    role: "member" as "client" | "director" | "member",
    companyName: "", department: "",
  });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("all");

  const loadAccounts = useCallback(async () => {
    const res = await listAccounts();
    if (res.accounts) setAccounts(res.accounts);
    setAccountsLoaded(true);
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const counts = useMemo(() => {
    const acc = { director: 0, member: 0, client: 0 };
    for (const a of accounts) {
      if (a.role === "director" || a.role === "member" || a.role === "client") acc[a.role]++;
    }
    return acc;
  }, [accounts]);

  const visibleAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => filter === "all" || a.role === filter)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts, filter, query]);

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
      if (res.warning) {
        toastError(res.warning, `Account created for ${createdName}, with a warning`);
      } else {
        toastSuccess(`Account created for ${createdName}.`);
      }
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
        <div className="flex items-center justify-between gap-4 mb-5">
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

        {showCreateForm && (
          <form onSubmit={handleCreate} className="mb-6 p-4 bg-sbi-dark/50 border border-sbi-dark-border/20 rounded-lg space-y-3">
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
                <Select
                  value={createForm.role}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v as "client" | "director" | "member" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Select
                    value={createForm.department || undefined}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, department: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a department…" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

        {!accountsLoaded ? (
          <div className="flex items-center gap-2 text-sbi-muted text-sm py-2">
            <Loader2 className="size-4 animate-spin" /> Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<Shield className="size-6" />}
            title="No accounts yet"
            description="Create the first portal account using Create account above."
            className="py-10"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-sbi-muted-dark" strokeWidth={1.5} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email"
                  className="w-full h-8 bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded-md pl-9 pr-3 focus:outline-none focus:border-sbi-green/50 placeholder:text-sbi-muted-dark/60"
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <FilterChip label="All" count={accounts.length} active={filter === "all"} onClick={() => setFilter("all")} />
                <FilterChip label="Directors" count={counts.director} active={filter === "director"} onClick={() => setFilter("director")} />
                <FilterChip label="Members" count={counts.member} active={filter === "member"} onClick={() => setFilter("member")} />
                <FilterChip label="Clients" count={counts.client} active={filter === "client"} onClick={() => setFilter("client")} />
              </div>
            </div>

            <div className="border border-sbi-dark-border/30 rounded-md overflow-hidden">
              <div className="grid grid-cols-[1.3fr_1.7fr_92px_120px_64px] gap-3 px-3 py-2 text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark border-b border-sbi-dark-border/30">
                <div>Name</div>
                <div>Email</div>
                <div>Role</div>
                <div>Department</div>
                <div />
              </div>
              {visibleAccounts.length === 0 ? (
                <p className="px-3 py-6 text-sm text-sbi-muted-dark text-center">
                  No accounts match this filter.
                </p>
              ) : (
                visibleAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="grid grid-cols-[1.3fr_1.7fr_92px_120px_28px] gap-3 items-center px-3 py-2.5 border-b border-sbi-dark-border/15 last:border-b-0 hover:bg-white/[0.015] transition-colors"
                  >
                    <div className="text-sm text-white truncate">{account.name}</div>
                    <div className="text-xs text-sbi-muted truncate">{account.email}</div>
                    <div>
                      <span className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${roleBadgeColor(account.role)}`}>
                        {account.role}
                      </span>
                    </div>
                    <div className="text-xs text-sbi-muted-dark truncate">
                      {account.department || <span className="text-sbi-muted-dark/40">—</span>}
                    </div>
                    <div className="flex justify-end items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setAccountToEdit(account)}
                        aria-label={`Edit ${account.name}'s account`}
                        title={`Edit ${account.name}'s account`}
                        className="text-sbi-muted-dark/70 hover:text-sbi-green transition-colors cursor-pointer"
                      >
                        <Pencil className="size-4" strokeWidth={1.5} />
                      </button>
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
                        <button
                          type="button"
                          disabled
                          aria-label="Cannot delete your own account"
                          title="Cannot delete your own account"
                          className="text-red-400/25 cursor-not-allowed"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Panel>

      <EditAccountModal
        account={accountToEdit}
        currentUserId={currentUserId}
        onClose={() => setAccountToEdit(null)}
        onSaved={() => { setAccountToEdit(null); loadAccounts(); }}
      />

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

function EditAccountModal({
  account,
  currentUserId,
  onClose,
  onSaved,
}: {
  account: Account | null;
  currentUserId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"client" | "director" | "member">("member");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isSelf = account?.id === currentUserId;
  const roleChanged = account && role !== account.role;

  useEffect(() => {
    if (account) {
      setName(account.name);
      setRole(account.role as "client" | "director" | "member");
      setDepartment(account.department ?? "");
      setError("");
    }
  }, [account]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setSaving(true);
    setError("");
    const result = await updateAccount({
      id: account.id,
      name: name.trim(),
      role,
      department: department.trim() || null,
    });
    if (result.error) {
      setError(result.error);
      toastError(result.error, "Couldn't save account");
    } else {
      toastSuccess(`Saved ${name.trim()}'s account.`);
      onSaved();
    }
    setSaving(false);
  };

  const showDepartment = role === "member" || role === "director";

  return (
    <Modal
      opened={!!account}
      onClose={onClose}
      title={account ? `Edit ${account.name}` : "Edit account"}
      uppercaseTitle={false}
      size="md"
    >
      {account && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
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
            <div className="sm:col-span-2">
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={account.email}
                readOnly
                className={`${inputClass} mt-1 cursor-not-allowed text-sbi-muted`}
              />
              <p className="text-[11px] text-sbi-muted-dark mt-1">
                Email changes require re-verification and aren't supported here.
              </p>
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "client" | "director" | "member")}
                disabled={isSelf}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                </SelectContent>
              </Select>
              {isSelf && (
                <p className="text-[11px] text-sbi-muted-dark mt-1">
                  You can't change your own role here.
                </p>
              )}
              {!isSelf && roleChanged && (
                <p className="text-[11px] text-amber-400/80 mt-1">
                  Changing the role removes any project assignments tied to the old role.
                </p>
              )}
            </div>
            {showDepartment && (
              <div>
                <label className={labelClass}>Department</label>
                <Select
                  value={department || "__none__"}
                  onValueChange={(v) => setDepartment(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="No department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No department</SelectItem>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnGhost}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border transition-colors cursor-pointer ${
        active
          ? "bg-sbi-green/10 text-sbi-green border-sbi-green/40"
          : "bg-transparent text-sbi-muted border-sbi-dark-border/40 hover:text-white hover:border-white/20"
      }`}
    >
      <span>{label}</span>
      <span
        className={`tabular-nums text-[10px] px-1.5 py-px rounded-sm ${
          active ? "bg-sbi-green/15 text-sbi-green" : "bg-sbi-dark-border/40 text-sbi-muted-dark"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
