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

export async function GET(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json(
            { error: "Missing Supabase environment variables" },
            { status: 500 },
        );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");

    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseKey, {
            db: { schema: "public" },
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
        });

        let query = supabase
            .from("tickets")
            .select("*, projects:project_id(company_name)")
            .eq("ticket_type", "report")
            .order("created_at", { ascending: false });

        if (projectId) {
            query = query.eq("project_id", Number(projectId));
        }

        const { data, error } = await query;

        if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const reports: ReportItem[] = (data || []).map((item: any) => ({
            id: item.id,
            numid: String(item.numid || item.id).padStart(4, "0"),
            title: item.title || item.subject || "Untitled Report",
            subject: item.subject,
            name: item.name,
            email: item.email,
            department: item.department || "General",
            director: item.director || item.assign_to || "Unassigned",
            assign_to: item.assign_to,
            project: item.projects?.company_name ?? item.project ?? null,
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

export async function POST(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json(
            { error: "Missing Supabase environment variables" },
            { status: 500 },
        );
    }

    try {
        const body = await request.json();

        if (!body.title || !body.message) {
            return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseKey, {
            db: { schema: "public" },
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll() { /* server side read-only */ },
            },
        });

        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr || !authData.user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("name, role, department")
            .eq("id", authData.user.id)
            .single();

        if (profileErr || !profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 403 });
        }

        if (profile.role !== "director") {
            return NextResponse.json({ error: "Only directors can submit reports" }, { status: 403 });
        }

        const department = typeof body.department === "string" && body.department.length > 0
            ? body.department
            : profile.department ?? "General";

        const newRecord = {
            ticket_type: "report" as const,
            title: body.title,
            subject: body.title,
            department,
            director: profile.name,
            assign_to: profile.name,
            message: body.message,
            status: "pending" as const,
            customer_id: body.customer_id ?? null,
            project_id: body.project_id ? Number(body.project_id) : null,
            attachments: Array.isArray(body.attachments) ? body.attachments : null,
        };

        const { data, error } = await supabase
            .from("tickets")
            .insert([newRecord])
            .select()
            .single();

        if (error) {
            console.error("Supabase insert error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const report: ReportItem = {
            id: data.id,
            numid: String(data.numid || data.id).padStart(4, "0"),
            title: data.title || data.subject || "Untitled Report",
            subject: data.subject,
            name: data.name,
            email: data.email,
            department: data.department || "General",
            director: data.director || data.assign_to || "Unassigned",
            assign_to: data.assign_to,
            project: data.project,
            status: normalizeStatus(data.status),
            message: data.message,
            date: data.created_at
                ? new Date(data.created_at).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            customer_id: data.customer_id,
            attachments: data.attachments,
            created_at: data.created_at,
            updated_at: data.updated_at,
        };

        return NextResponse.json(report, { status: 201 });
    } catch (error) {
        console.error("Unexpected POST error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
