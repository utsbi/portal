import type { ReactNode } from "react";
import { Messages } from "@/components/dashboard/messages";
import { ActorProvider } from "@/components/dashboard/messages/ActorContext";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";
import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";
import { MemberMessages } from "@/components/dashboard/messages/MemberMessages";
import { resolveActor } from "@/lib/project/resolve-actor";
import { CmdKShell } from "./CmdKShell";
import { DetailPane } from "./DetailPane";
import { MessagesPanes } from "./MessagesPanes";

const BASE_PATH = "/dashboard/messages";

/**
 * Master–detail shell. The conversation list lives HERE, mounted once, so
 * navigating between the index and any conversation (or between
 * conversations) only swaps the detail pane via {children}. Previously each
 * route rendered its own sidebar, so every click remounted the list and
 * re-ran all its Supabase fetches — the "full refresh" feel.
 */
export default async function MessagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const actor = await resolveActor();
  if (!actor) return null;

  const role = actor.profile.role;
  const profileId = actor.profile.id;
  const isMember = role === "member";

  const shell = (
    <ActorProvider actor={{ role, profileId }}>
      <CmdKShell basePath={BASE_PATH}>
        {/* MessagesPanes handles the responsive master–detail switching:
            single-column below md (list ⇄ thread driven by the URL param),
            side-by-side two-pane layout from md up. */}
        <MessagesPanes
          list={
            role === "director" ? (
              <DirectorMessages profileId={profileId} />
            ) : isMember ? (
              <MemberMessages profileId={profileId} />
            ) : (
              <Messages />
            )
          }
          detail={
            <>
              {/* DetailPane mounts ONCE here. It reads conversationId from
                  useParams() so URL changes flow through state instead of via
                  route remounting — eliminates the route-transition flash. */}
              <DetailPane />
              {/* Page renders null but stays in the tree so Next.js's route
                  matching + params unwrap still runs. */}
              <span className="hidden">{children}</span>
            </>
          }
        />
      </CmdKShell>
    </ActorProvider>
  );

  // Every role can now start conversations (gated by the matrix), so the create
  // modal provider wraps all of them.
  return (
    <CreateConversationModalProvider>{shell}</CreateConversationModalProvider>
  );
}
