import { NextResponse } from "next/server";
import { scheduleEmailTask } from "@/lib/email/schedule";
import { sendMessageNotifications } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Queue recipient email for a message the current user just sent.
 *
 * Messages are inserted from the browser to preserve realtime behavior. This
 * server boundary verifies message ownership before using the service client
 * to resolve other conversation participants and their notification settings.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId: rawMessageId } = await params;
  const messageId = Number(rawMessageId);
  if (!Number.isSafeInteger(messageId) || messageId <= 0) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_profile_id, content")
    .eq("id", messageId)
    .eq("sender_uid", user.id)
    .maybeSingle();
  if (messageError) {
    console.error("message notification lookup failed:", messageError);
    return NextResponse.json(
      { error: "Couldn't queue notification" },
      { status: 500 },
    );
  }
  if (!message?.conversation_id || !message.sender_profile_id) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const supabaseAdmin = createAdminClient();
  const [
    { data: sender, error: senderError },
    { data: participants, error: participantsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", message.sender_profile_id)
      .maybeSingle(),
    supabaseAdmin
      .from("conversation_participants")
      .select("profile_id")
      .eq("conversation_id", message.conversation_id),
  ]);
  if (senderError || participantsError) {
    console.error(
      "message notification recipient lookup failed:",
      senderError ?? participantsError,
    );
    return NextResponse.json(
      { error: "Couldn't queue notification" },
      { status: 500 },
    );
  }

  const recipientProfileIds = (participants ?? []).map((row) => row.profile_id);
  if (recipientProfileIds.length === 0) return NextResponse.json({ ok: true });

  scheduleEmailTask("message notification delivery", () =>
    sendMessageNotifications({
      messageId: message.id,
      conversationId: message.conversation_id,
      senderProfileId: message.sender_profile_id,
      senderName: sender?.name ?? "A portal member",
      content: message.content,
      recipientProfileIds,
    }),
  );

  return NextResponse.json({ ok: true });
}
