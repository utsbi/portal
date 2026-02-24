import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";

export interface ReportItem {
    id: string;
    numid: string;
    title: string;
    department: string;
    director: string;
    date: string;
    status: "In Progress" | "Done" | "Denied" | "Pending";
    type: "google_doc" | "form";
    embedUrl: string;
    customer_id?: string;
    name?: string;
    email?: string;
    project?: string;
    subject?: string;
    message?: string;
    updated_at?: string;
    attachments?: any;
    uuid: string;
    assign_to: string;
    created_at: string;
}

export async function GET() {
    try {
        console.log("Initializing Supabase client...");
        console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing");
        console.log("Key:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set" : "Missing");

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            return NextResponse.json({
                error: "Missing Supabase env vars",
                details: "Please restart the server to load .env.local"
            }, { status: 500 });
        }

        const supabase = await createClient();

        // Select all columns from Reports schema, requests table
        const { data, error } = await supabase
            .schema('Reports')
            .from('requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Supabase Query Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Map schema to frontend props
        const formattedData = data.map((item: any, index: number) => {
            // Map status
            let status = "Pending";
            const actualStatus = item.status || item.requests_status || item["requests status"];
            const rawStatus = (actualStatus || "").toLowerCase().trim();
            if (rawStatus === 'done') status = "Done";
            else if (rawStatus === 'pending') status = "Pending";
            else if (rawStatus === 'in-progress' || rawStatus === 'in progress') status = "In Progress";
            else if (rawStatus === 'denied') status = "Denied";
            else if (actualStatus) status = actualStatus; // Fallback

            return {
                id: item.id,
                numid: (index + 1).toString(), // Generate a sequential numid or use part of UUID
                title: item.subject || item.project || "Draft Report",
                department: item.department || "General",
                director: item.assign_to || item.name || "Unassigned",
                date: item.created_at,
                status: status,
                type: "form",
                embedUrl: "",
                customer_id: item.customer_id || "",
                name: item.name || "",
                email: item.email || "",
                project: item.project || "",
                subject: item.subject || "",
                message: item.message || "",
                updated_at: item.updated_at || "",
                attachments: item.attachments || null,
                uuid: item.id,
                assign_to: item.assign_to || item.name || "",
                created_at: item.created_at,
                raw_item: item // debugging
            };
        });

        return NextResponse.json(formattedData);
    } catch (err: any) {
        console.error("API Route Error:", err);
        return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
    }
}
