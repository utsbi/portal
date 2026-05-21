import type { ReactNode } from "react";
import { Messages } from "@/components/dashboard/messages";
import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";
import { MemberMessages } from "@/components/dashboard/messages/MemberMessages";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";
import { ActorProvider } from "@/components/dashboard/messages/ActorContext";
import { resolveActor } from "@/lib/project/resolve-actor";
import { CmdKShell } from "./CmdKShell";
import { DetailPane } from "./DetailPane";

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
  // Members are read-only: no create provider, no composer downstream.
  const isMember = role === "member";
  const projectIds = actor.projects.map((p) => p.projectId);

  const shell = (
    <ActorProvider actor={{ role, profileId }}>
      <CmdKShell basePath={BASE_PATH}>
        <div className="flex flex-1 min-h-0 h-full">
          <div className="w-96 shrink-0 overflow-hidden border-r border-sbi-dark-border/40">
            {role === "director" ? (
              <DirectorMessages profileId={profileId} />
            ) : isMember ? (
              <MemberMessages projectIds={projectIds} />
            ) : (
              <Messages />
            )}
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* DetailPane mounts ONCE here. It reads conversationId from
                useParams() so URL changes flow through state instead of via
                route remounting — eliminates the route-transition flash. */}
            <DetailPane />
            {/* Page renders null but stays in the tree so Next.js's route
                matching + params unwrap still runs. */}
            <span className="hidden">{children}</span>
          </div>
        </div>
      </CmdKShell>
    </ActorProvider>
  );

  if (isMember) {
    return shell;
  }

  return (
    <CreateConversationModalProvider>{shell}</CreateConversationModalProvider>
  );
}
