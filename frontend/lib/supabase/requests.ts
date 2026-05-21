import { createClient } from "./client";
import type { RequestStatus } from "@/components/dashboard/requests/StatusBadge";

function normalizeStatus(raw: string | null | undefined): RequestStatus {
    if (!raw) return "pending";
    const s = raw.toLowerCase().replace(/[\s_]+/g, "-");
    if (s === "in-progress") return "in-progress";
    if (s === "done") return "done";
    if (s === "denied") return "denied";
    return "pending";
}
import type { Request } from "@/components/dashboard/requests/RequestHistory";

interface TicketRow {
    id: number;
    ticket_type: string;
    customer_id: string | null;
    name: string;
    email: string;
    department: string | null;
    assign_to: string | null;
    project: string | null;
    subject: string;
    message: string | null;
    status: string;
    attachments: { name: string; size: string; path: string }[] | null;
    created_at: string;
    updated_at: string;
}

function rowToRequest(row: TicketRow): Request {
    return {
        id: String(row.id),
        name: row.name,
        email: row.email,
        subject: row.subject,
        department: row.department ?? "",
        assignedTo: row.assign_to ?? "",
        project: row.project ?? "",
        message: row.message ?? "",
        attachments: (row.attachments ?? []).map((a) => ({
            id: a.path,
            name: a.name,
            size: a.size,
        })),
        status: normalizeStatus(row.status),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

export async function fetchRequests(projectId?: number): Promise<Request[]> {
    const supabase = createClient();
    let query = supabase
        .from("tickets")
        .select("*")
        .eq("ticket_type", "request")
        .order("created_at", { ascending: false });

    if (projectId) {
        query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error fetching requests:", error.message);
        return [];
    }

    return (data as TicketRow[]).map(rowToRequest);
}

async function uploadFiles(
    requestId: string,
    files: File[]
): Promise<{ name: string; size: string; path: string }[]> {
    const supabase = createClient();
    const results: { name: string; size: string; path: string }[] = [];

    for (const file of files) {
        const path = `${requestId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
            .from("ticket-attachments")
            .upload(path, file);

        if (error) {
            console.error("Error uploading file:", file.name, error.message);
            continue;
        }

        results.push({
            name: file.name,
            size: formatFileSize(file.size),
            path,
        });
    }

    return results;
}

export async function createRequest(payload: {
    projectId?: number;
    name: string;
    email: string;
    department?: string;
    assignTo?: string;
    project?: string;
    subject: string;
    message?: string;
    files?: File[];
}): Promise<Request | null> {
    const supabase = createClient();

    const { data: inserted, error: insertError } = await supabase
        .from("tickets")
        .insert({
            ticket_type: "request" as const,
            project_id: payload.projectId ?? null,
            name: payload.name,
            email: payload.email,
            department: payload.department ?? null,
            assign_to: payload.assignTo ?? null,
            project: payload.project ?? null,
            subject: payload.subject,
            message: payload.message ?? "",
            status: "pending",
        })
        .select()
        .single();

    if (insertError) {
        console.error("Error creating request:", insertError.message);
        return null;
    }

    const row = inserted as TicketRow;

    if (payload.files && payload.files.length > 0) {
        const attachmentMeta = await uploadFiles(String(row.id), payload.files);

        if (attachmentMeta.length > 0) {
            const { error: updateError } = await supabase
                .from("tickets")
                .update({ attachments: attachmentMeta })
                .eq("id", row.id);

            if (updateError) {
                console.error("Error saving attachment metadata:", updateError.message);
            } else {
                row.attachments = attachmentMeta;
            }
        }
    }

    return rowToRequest(row);
}

export async function updateRequestStatus(
    requestId: string,
    status: string
): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
        .from("tickets")
        .update({ status })
        .eq("id", requestId);

    if (error) {
        console.error("Error updating request status:", error.message);
        return false;
    }
    return true;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
