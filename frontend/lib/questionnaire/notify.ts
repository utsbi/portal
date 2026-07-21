import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Best-effort Discord notification when a questionnaire is submitted. No-ops if
// DISCORD_FORM_WEBHOOK_URL is unset, and never throws — a notification failure
// must never fail the submission itself.
// ---------------------------------------------------------------------------

// Sanitize user-controlled text before embedding it in a Discord message.
// Neutralizes markdown control chars, @everyone/@here and <@...> mentions, and
// link/codeblock injection, then length-limits the result.
function sanitizeForDiscord(value: string, maxLength = 256): string {
  return (
    value
      // Defang mentions: @everyone / @here / <@123> / <@&123> / <#123>.
      .replace(/@(everyone|here)/gi, "@​$1")
      .replace(/<(@[!&]?|#)(\d+)>/g, "<​$1$2>")
      // Escape Discord markdown / formatting control characters.
      .replace(/([\\*_~`|>[\]()#-])/g, "\\$1")
      // Collapse newlines so a submitter can't inject extra embed lines.
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, maxLength)
  );
}

interface NotifyInput {
  formId: number;
  via: "portal" | "public";
  submitterName?: string | null;
  submitterEmail?: string | null;
  /** Auth uid for internal submissions; resolves a profile name. */
  userId?: string | null;
}

export async function notifyFormSubmission(input: NotifyInput): Promise<void> {
  const url = process.env.DISCORD_FORM_WEBHOOK_URL;
  if (!url) return;

  try {
    const supabase = createAdminClient();

    const { data: form } = await supabase
      .from("custom_form_schemas")
      .select("title")
      .eq("id", input.formId)
      .maybeSingle();
    const title = form?.title ?? `Form #${input.formId}`;

    let submitter = input.submitterName?.trim() || "";
    if (!submitter && input.userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("uid", input.userId)
        .maybeSingle();
      submitter = profile?.name ?? "";
    }
    if (!submitter) submitter = input.submitterEmail?.trim() || "Anonymous";

    // Sanitize user-controlled fields before embedding (markdown / mention /
    // link injection). `title` and the resolved profile name are not
    // submitter-controlled, but sanitizing the combined value is harmless.
    const lines = [`From: ${sanitizeForDiscord(submitter)}`];
    if (input.submitterEmail) {
      lines.push(`Email: ${sanitizeForDiscord(input.submitterEmail)}`);
    }
    lines.push(`Via: ${input.via === "public" ? "public link" : "portal"}`);

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "New questionnaire submission",
            description: `**${title}**\n${lines.join("\n")}`,
            color: 0x22c55e,
          },
        ],
      }),
    });
  } catch (err) {
    console.error("Discord submission notification failed", err);
  }
}
