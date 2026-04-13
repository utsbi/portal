"use client";

import { Calendar, Users, Shield } from "lucide-react";
import { useProject } from "@/lib/project/project-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SettingsPage() {
  const { user, isLoading } = useProject();
  const router = useRouter();

  // Only directors can access settings
  useEffect(() => {
    if (!isLoading && user?.role !== "director") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading || user?.role !== "director") return null;

  return (
    <div className="h-[calc(100vh-4rem)] bg-sbi-dark flex flex-col p-6 md:p-8 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto">
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white mb-2">
          Settings
        </h1>
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
              Assign members to projects and manage team access.
            </p>
            <div className="text-sbi-muted/50 text-sm italic">
              Coming soon — member assignment and role management
            </div>
          </section>

          {/* Account Management */}
          <section className="bg-sbi-dark-card/40 border border-sbi-dark-border/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="size-5 text-sbi-green" />
              <h2 className="text-lg font-light text-white">Account Management</h2>
            </div>
            <p className="text-sbi-muted text-sm mb-4">
              Create and manage user accounts for clients and members.
            </p>
            <div className="text-sbi-muted/50 text-sm italic">
              Coming soon — invite users, set passwords, manage roles
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
