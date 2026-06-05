import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const subjectLabels: Record<string, string> = {
  general: "General Inquiry",
  project: "Project Inquiry",
  membership: "Membership",
  partnership: "Partnership",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.email || !body.message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify Turnstile token
    if (!body.turnstileToken) {
      return NextResponse.json(
        { error: "Captcha verification required" },
        { status: 400 },
      );
    }

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecret) {
      console.error("TURNSTILE_SECRET_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const turnstileResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: body.turnstileToken,
        }),
      },
    );

    const turnstileData = await turnstileResponse.json();

    if (!turnstileData.success) {
      return NextResponse.json(
        { error: "Captcha verification failed" },
        { status: 400 },
      );
    }

    const { turnstileToken, ...formData } = body;

    // Persist the submission. The `website_forms` RLS policy allows anonymous
    // inserts, so the publishable-key client is sufficient (no service role).
    // Prefer Cloudflare's `cf-connecting-ip` (real client IP) and fall back to
    // the first hop of `x-forwarded-for`.
    const ipAddress =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      null;

    const supabase = await createClient();
    const { error: insertError } = await supabase.from("website_forms").insert({
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
      ip_address: ipAddress,
    });

    if (insertError) {
      console.error("Failed to save contact submission:", insertError);
      return NextResponse.json(
        { error: "Failed to submit form" },
        { status: 500 },
      );
    }

    // Notify Discord. Best-effort: the submission is already saved, so a
    // webhook hiccup must not fail the user's request.
    const discordWebhookUrl = process.env.DISCORD_CONTACT_WEBHOOK_URL;
    if (discordWebhookUrl) {
      try {
        const subjectLabel =
          subjectLabels[formData.subject] ?? formData.subject ?? "Unknown";
        const discordResponse = await fetch(discordWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [
              {
                title: "New Contact Form Submission",
                color: 0x22c55e,
                fields: [
                  { name: "Name", value: formData.name, inline: true },
                  { name: "Email", value: formData.email, inline: true },
                  { name: "Subject", value: subjectLabel, inline: true },
                  { name: "IP", value: ipAddress ?? "unknown", inline: true },
                  // Embed field values are capped at 1024 characters.
                  { name: "Message", value: formData.message.slice(0, 1024) },
                ],
                // Renders a localized timestamp in the embed footer.
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });

        if (!discordResponse.ok) {
          console.error(
            `Discord webhook returned ${discordResponse.status} (submission still saved)`,
          );
        }
      } catch (discordError) {
        console.error(
          "Discord notification failed (submission still saved):",
          discordError,
        );
      }
    } else {
      console.warn("DISCORD_CONTACT_WEBHOOK_URL is not configured");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to submit form" },
      { status: 500 },
    );
  }
}
