"use client";

import { Calendar, Users, Shield, Plus, Trash2, UserPlus, ChevronDown } from "lucide-react";
import { useProject } from "@/lib/project/project-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  createAccount,
  listAccounts,
  deleteAccount,
  listProjects,
  listProjectMembers,
  assignMemberToProject,
  removeMemberFromProject,
  listUnassignedMembers,
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

export default function SettingsPage() {
  const { user, isLoading } = useProject();
  const router = useRouter();

  // Account state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", name: "", role: "member" as "client" | "director" | "member", companyName: "", department: "" });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Team state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [unassignedMembers, setUnassignedMembers] = useState<UnassignedMember[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  useEffect(() => {
    if (!isLoading && user?.role !== "director") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

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
    }
  }, [user, loadAccounts, loadProjects]);

  const loadProjectMembers = useCallback(async (projectId: number) => {
    const [membersResult, unassignedResult] = await Promise.all([
      listProjectMembers(projectId),
      listUnassignedMembers(projectId),
    ]);
    if (membersResult.members) setProjectMembers(membersResult.members as ProjectMember[]);
    if (unassignedResult.members) setUnassignedMembers(unassignedResult.members);
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
      setCreateForm({ email: "", password: "", name: "", role: "member", companyName: "", department: "" });
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
      case "director": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "client": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "member": return "bg-sbi-green/10 text-sbi-green border-sbi-green/30";
      case "owner": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default: return "bg-white/10 text-white/70 border-white/20";
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-sbi-dark flex flex-col p-6 md:p-8 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto">
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white mb-2">Settings</h1>
        <p className="text-sbi-muted text-sm mb-8">Manage your portal configuration</p>

        <div className="grid gap-6">
          {/* Google Calendar */}
          <section className="bg-sbi-dark-card/40 border border-sbi-dark-border/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="size-5 text-sbi-green" />
              <h2 className="text-lg font-light text-white">Google Calendar</h2>
            </div>
            <p className="text-sbi-muted text-sm mb-4">
              Connect your Google Calendar so clients can see your availability and scheduled events.
            </p>
            <a
              href="/api/contact/auth/google"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-sbi-green/10 text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark transition-all duration-300 rounded"
            >
              Connect Google Calendar
            </a>
          </section>

          {/* Team Management */}
          <section className="bg-sbi-dark-card/40 border border-sbi-dark-border/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="size-5 text-sbi-green" />
              <h2 className="text-lg font-light text-white">Team Management</h2>
            </div>
            <p className="text-sbi-muted text-sm mb-4">
              Assign members to projects. Directors are auto-assigned to all projects.
            </p>

            {/* Project selector */}
            <div className="mb-4">
              <label className="text-xs tracking-widest uppercase text-sbi-muted mb-2 block">Project</label>
              <div className="relative">
                <select
                  value={selectedProjectId ?? ""}
                  onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 appearance-none cursor-pointer focus:outline-none focus:border-sbi-green/50"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.company_name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-sbi-muted pointer-events-none" />
              </div>
            </div>

            {/* Current members */}
            <div className="space-y-2 mb-4">
              {projectMembers.map((pm) => (
                <div key={pm.id} className="flex items-center justify-between px-3 py-2 bg-sbi-dark/50 border border-sbi-dark-border/20 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white">{pm.profiles.name}</span>
                    <span className="text-xs text-sbi-muted">{pm.profiles.email}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${roleBadgeColor(pm.role)}`}>
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
                <p className="text-sbi-muted/50 text-sm">No members assigned yet.</p>
              )}
            </div>

            {/* Assign member */}
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
                    <p className="px-4 py-3 text-sbi-muted/50 text-sm">No unassigned members available.</p>
                  ) : (
                    unassignedMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleAssignMember(m.id)}
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
          </section>

          {/* Account Management */}
          <section className="bg-sbi-dark-card/40 border border-sbi-dark-border/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-sbi-green" />
                <h2 className="text-lg font-light text-white">Account Management</h2>
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

            {/* Create form */}
            {showCreateForm && (
              <form onSubmit={handleCreateAccount} className="mb-6 p-4 bg-sbi-dark/50 border border-sbi-dark-border/20 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">Name</label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">Email</label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">Password</label>
                    <input
                      type="password"
                      required
                      value={createForm.password}
                      onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">Role</label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm(f => ({ ...f, role: e.target.value as any }))}
                      className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 appearance-none cursor-pointer focus:outline-none focus:border-sbi-green/50"
                    >
                      <option value="member">Member</option>
                      <option value="client">Client</option>
                      <option value="director">Director</option>
                    </select>
                  </div>
                  {createForm.role === "client" && (
                    <div className="col-span-2">
                      <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">Company Name</label>
                      <input
                        type="text"
                        required
                        value={createForm.companyName}
                        onChange={(e) => setCreateForm(f => ({ ...f, companyName: e.target.value }))}
                        className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                      />
                    </div>
                  )}
                  {createForm.role === "member" && (
                    <div className="col-span-2">
                      <label className="text-xs tracking-widest uppercase text-sbi-muted mb-1 block">Department</label>
                      <input
                        type="text"
                        value={createForm.department}
                        onChange={(e) => setCreateForm(f => ({ ...f, department: e.target.value }))}
                        className="w-full bg-sbi-dark border border-sbi-dark-border/50 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-sbi-green/50"
                        placeholder="e.g. Engineering, Business, Tech"
                      />
                    </div>
                  )}
                </div>
                {createError && <p className="text-red-400 text-sm">{createError}</p>}
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

            {/* Account list */}
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between px-3 py-2 bg-sbi-dark/50 border border-sbi-dark-border/20 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white">{account.name}</span>
                    <span className="text-xs text-sbi-muted">{account.email}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${roleBadgeColor(account.role)}`}>
                      {account.role}
                    </span>
                    {account.department && <span className="text-xs text-sbi-muted/50">({account.department})</span>}
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
