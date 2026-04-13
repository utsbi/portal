import { Messages } from "@/components/dashboard/messages";
import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";
import { MessagesEmptyState } from "@/components/dashboard/messages/MessagesEmptyState";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";
import { resolveActor } from "@/lib/project/resolve-actor";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const actor = await resolveActor();
  if (!actor) return null;

  const isDirector = actor.profile.role === "director";

  // For directors, we need their member ID for conversation queries
  let directorMemberId: number | undefined;
  if (isDirector) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("member_id")
      .eq("id", actor.profile.id)
      .single();
    directorMemberId = profile?.member_id ?? undefined;
  }

  return (
    <CreateConversationModalProvider>
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-96 shrink-0 overflow-y-auto border-r border">
          {isDirector && directorMemberId ? (
            <DirectorMessages directorId={directorMemberId} />
          ) : (
            <Messages />
          )}
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <MessagesEmptyState />
        </div>
      </div>
    </CreateConversationModalProvider>
  );
}
