import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const subjectLabels: Record<string, string> = {
  general: "General Inquiry",
  project: "Project Inquiry",
  membership: "Membership",
  partnership: "Partnership",
};

// The endpoint is public, so the React UI's constraints can't be trusted —
// these are the server-side backstop.
const FIELD_LIMITS = { name: 100, email: 254, message: 5000 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (
      name.length > FIELD_LIMITS.name ||
      email.length > FIELD_LIMITS.email ||
      message.length > FIELD_LIMITS.message
    ) {
      return NextResponse.json(
        { error: "One or more fields exceed the allowed length" },
        { status: 400 },
      );
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 },
      );
    }

    if (!Object.hasOwn(subjectLabels, subject)) {
      return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
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
      name,
      email,
      subject,
      message,
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
        const subjectLabel = subjectLabels[subject];
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
                  { name: "Name", value: name, inline: true },
                  { name: "Email", value: email, inline: true },
                  { name: "Subject", value: subjectLabel, inline: true },
                  { name: "IP", value: ipAddress ?? "unknown", inline: true },
                  // Embed field values are capped at 1024 characters.
                  { name: "Message", value: message.slice(0, 1024) },
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
