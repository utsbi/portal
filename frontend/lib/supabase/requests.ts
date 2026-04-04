import { createClient } from "./client";
import type { RequestStatus } from "@/components/dashboard/requests/StatusBadge";

// Normalise whatever the DB stores → a valid RequestStatus slug
function normalizeStatus(raw: string | null | undefined): RequestStatus {
    if (!raw) return "pending";
    const s = raw.toLowerCase().replace(/[\s_]+/g, "-");
    if (s === "in-progress") return "in-progress";
    if (s === "done") return "done";
    if (s === "denied") return "denied";
    return "pending"; // safe fallback
}
import type { Request } from "@/components/dashboard/requests/RequestHistory";

// Row shape coming from Supabase (snake_case)
// Note: id is bigint in the DB so it comes back as a number
interface RequestRow {
    id: number;
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

// Map DB row → frontend Request interface
function rowToRequest(row: RequestRow): Request {
    return {
        id: String(row.id), // bigint → string for the frontend
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

// Fetch all requests (optionally filtered by customer_id)
export async function fetchRequests(customerId?: string): Promise<Request[]> {
    const supabase = createClient();
    let query = supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

    if (customerId) {
        query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error fetching requests:", error.message);
        return [];
    }

    return (data as RequestRow[]).map(rowToRequest);
}

// Upload files to Supabase Storage and return their metadata
async function uploadFiles(
    requestId: string,
    files: File[]
): Promise<{ name: string; size: string; path: string }[]> {
    const supabase = createClient();
    const results: { name: string; size: string; path: string }[] = [];

    for (const file of files) {
        const path = `${requestId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
            .from("request-attachments")
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

// Create a new request row, upload attachments, and save their paths to DB
export async function createRequest(payload: {
    customerId?: string;
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

    // 1. Insert the request row first (get the ID)
    // updated_at is NOT NULL with no DB default, so we send it explicitly.
    // attachments is nullable, omit from insert to avoid jsonb type issues.
    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
        .from("requests")
        .insert({
            customer_id: payload.customerId ?? null,
            name: payload.name,
            email: payload.email,
            department: payload.department ?? null,
            assign_to: payload.assignTo ?? null,
            project: payload.project ?? null,
            subject: payload.subject,
            message: payload.message ?? null,
            status: "pending",
            updated_at: now,
        })
        .select()
        .single();

    if (insertError) {
        console.error("Error creating request:", insertError.message);
        return null;
    }

    const row = inserted as RequestRow;

    // 2. Upload files if any
    if (payload.files && payload.files.length > 0) {
        const attachmentMeta = await uploadFiles(String(row.id), payload.files);

        if (attachmentMeta.length > 0) {
            // 3. Update the row with the attachment metadata
            const { error: updateError } = await supabase
                .from("requests")
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

// Update the status of a request (updated_at is auto-set by the DB trigger)
export async function updateRequestStatus(
    requestId: string,
    status: string
): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
        .from("requests")
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
