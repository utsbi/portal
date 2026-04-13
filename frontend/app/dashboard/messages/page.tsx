import { Messages } from "@/components/dashboard/messages";
import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";
import { MessagesEmptyState } from "@/components/dashboard/messages/MessagesEmptyState";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";
import { resolveActor } from "@/lib/project/resolve-actor";

export default async function MessagesPage() {
  const actor = await resolveActor();
  if (!actor) return null;

  const isDirector = actor.profile.role === "director";
  const profileId = actor.profile.id;

  return (
    <CreateConversationModalProvider>
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-96 shrink-0 overflow-y-auto border-r border">
          {isDirector ? (
            <DirectorMessages profileId={profileId} />
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
