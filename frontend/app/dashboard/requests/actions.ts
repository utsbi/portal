"use server";

import { requireDirector } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/roles";
import { scheduleEmailTask } from "@/lib/email/schedule";
import { sendRequestUpdateNotification } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Attachment metadata — the shape persisted into tickets.attachments[].
// File bytes are uploaded client-side via storage (already RLS-gated); the
// resulting metadata array is passed here so only the DB row write is server-
// side.
// ---------------------------------------------------------------------------
export interface AttachmentMeta {
  name: string;
  size: string;
  path: string;
}

// ---------------------------------------------------------------------------
// Input caps
// ---------------------------------------------------------------------------
const SUBJECT_MAX = 500;
const MESSAGE_MAX = 10_000;
const NAME_MAX = 255;
const EMAIL_MAX = 255;

// ---------------------------------------------------------------------------
// requireProjectMember
//
// Returns the authenticated caller's profile id after confirming they are a
// member (any role) of the given project.  Directors are exempt from the
// per-project membership check — they have global access.
// ---------------------------------------------------------------------------
async function requireProjectMember(projectId: number): Promise<
  | { error: string }
  | {
      error: null;
      supabase: Awaited<ReturnType<typeof createClient>>;
      profileId: number;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("uid", user.id)
    .single();
  if (profileError || !profile) return { error: "Profile not found" };

  // Directors have project-wide access — no membership row required.
  if (isStaffRole(profile.role)) {
    return { error: null, supabase, profileId: profile.id };
  }

  const { data: membership, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("profile_id", profile.id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (memberError || !membership) {
    return { error: "You are not a member of this project" };
  }

  return { error: null, supabase, profileId: profile.id };
}

// ---------------------------------------------------------------------------
// createTicketRequest
//
// Inserts a new tickets row (ticket_type='request') via the server client.
// The caller must be an authenticated member of the target project.
// File uploads are handled client-side before calling this action; the
// resulting attachment metadata is passed in and written in a single UPDATE.
// ---------------------------------------------------------------------------
export async function createTicketRequest(payload: {
  projectId: number;
  name: string;
  email: string;
  department?: string;
  assignTo?: string;
  project?: string;
  subject: string;
  message?: string;
  attachments?: AttachmentMeta[];
}): Promise<
  | { error: string }
  | {
      error: null;
      ticket: {
        id: number;
        attachments: AttachmentMeta[] | null;
        created_at: string;
        updated_at: string;
      };
    }
> {
  const gate = await requireProjectMember(payload.projectId);
  if (gate.error !== null) return { error: gate.error };

  // Input validation
  const subject = payload.subject.trim();
  if (!subject) return { error: "Subject is required" };
  if (subject.length > SUBJECT_MAX) {
    return { error: `Subject must be at most ${SUBJECT_MAX} characters` };
  }
  const name = payload.name.trim();
  if (!name) return { error: "Name is required" };
  if (name.length > NAME_MAX) {
    return { error: `Name must be at most ${NAME_MAX} characters` };
  }
  const email = payload.email.trim();
  if (!email) return { error: "Email is required" };
  if (email.length > EMAIL_MAX) {
    return { error: `Email must be at most ${EMAIL_MAX} characters` };
  }
  const message = payload.message?.trim() ?? "";
  if (message.length > MESSAGE_MAX) {
    return { error: `Message must be at most ${MESSAGE_MAX} characters` };
  }

  const { data: inserted, error: insertError } = await gate.supabase
    .from("tickets")
    .insert({
      ticket_type: "request" as const,
      project_id: payload.projectId,
      name,
      email,
      department: payload.department ?? null,
      assign_to: payload.assignTo ?? null,
      project: payload.project ?? null,
      subject,
      message,
      status: "pending",
    })
    .select("id, attachments, created_at, updated_at")
    .single();

  if (insertError) return { error: insertError.message };

  const row = inserted as {
    id: number;
    attachments: AttachmentMeta[] | null;
    created_at: string;
    updated_at: string;
  };

  // Persist attachment metadata if provided.
  const attachments = payload.attachments ?? [];
  if (attachments.length > 0) {
    const { error: updateError } = await gate.supabase
      .from("tickets")
      .update({ attachments })
      .eq("id", row.id);
    if (!updateError) {
      row.attachments = attachments;
    }
  }

  return { error: null, ticket: row };
}

// ---------------------------------------------------------------------------
// updateTicketRequestStatus
//
// Updates the status of a tickets row.  Restricted to directors only — the UI
// only surfaces this control to director-role users (canEditStatus prop).
// ---------------------------------------------------------------------------
export async function updateTicketRequestStatus(
  requestId: string,
  status: string,
): Promise<{ error: string } | { error: null; success: true }> {
  const gate = await requireDirector();
  if (!gate.ok) return { error: gate.error };

  const requestIdNumber = Number(requestId);
  if (!Number.isSafeInteger(requestIdNumber) || requestIdNumber <= 0) {
    return { error: "Invalid request" };
  }
  const validStatuses = ["pending", "in-progress", "done", "denied"] as const;
  if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
    return { error: "Invalid request status" };
  }
  const nextStatus = status as (typeof validStatuses)[number];

  const { data: ticket, error } = await gate.supabase
    .from("tickets")
    .update({ status: nextStatus })
    .eq("id", requestIdNumber)
    .eq("ticket_type", "request")
    .select("id, uid, subject, status, project_id, updated_at")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!ticket) return { error: "Request not found" };

  // Delivery is best effort and preference-aware. Keep the status mutation
  // successful even when the email provider is temporarily unavailable.
  if (ticket.uid && ticket.status) {
    scheduleEmailTask("request status notification", () =>
      sendRequestUpdateNotification({
        requestId: ticket.id,
        requesterUid: ticket.uid,
        requestSubject: ticket.subject,
        status: ticket.status,
        projectId: ticket.project_id,
        versionAt: ticket.updated_at,
      }),
    );
  }
  return { error: null, success: true };
}
