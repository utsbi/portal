import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeStatus(status: string | null | undefined): "Pending" | "In Progress" | "Done" | "Denied" {
    const s = (status || "").toLowerCase().replace(/[\s_-]+/g, "");
    if (s === "done" || s === "complete" || s === "completed") return "Done";
    if (s === "inprogress" || s === "inprocess" || s === "active") return "In Progress";
    if (s === "denied" || s === "rejected") return "Denied";
    return "Pending";
}

export interface ReportItem {
    id: string;
    uuid: string;
    numid: string;
    title: string;
    subject?: string;
    name?: string;
    email?: string;
    department: string;
    director: string;
    assign_to?: string;
    project?: string;
    status: "Pending" | "In Progress" | "Done" | "Denied";
    message?: string;
    date: string;
    customer_id?: string;
    attachments?: string[] | null;
    created_at?: string;
    updated_at?: string;
}

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
            { error: "Missing Supabase environment variables" },
            { status: 500 },
        );
    }

    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                db: { schema: "Reports" },
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options),
                            );
                        } catch { /* Server Component — safe to ignore */ }
                    },
                },
            },
        );

        const { data, error } = await supabase
            .from("requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const reports: ReportItem[] = (data || []).map((item: any) => ({
            id: item.id,
            uuid: item.uuid || item.id,
            numid: String(item.numid || item.id).padStart(4, "0"),
            title: item.title || item.subject || "Untitled Report",
            subject: item.subject,
            name: item.name,
            email: item.email,
            department: item.department || "General",
            director: item.director || item.assign_to || "Unassigned",
            assign_to: item.assign_to,
            project: item.project,
            status: normalizeStatus(item.status),
            message: item.message,
            date: item.created_at
                ? new Date(item.created_at).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            customer_id: item.customer_id,
            attachments: item.attachments,
            created_at: item.created_at,
            updated_at: item.updated_at,
        }));

        return NextResponse.json(reports);
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
