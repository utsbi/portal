import { Messages } from "@/components/dashboard/messages";
import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";
import { MessagesEmptyState } from "@/components/dashboard/messages/MessagesEmptyState";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ url_slug: string }>;
}

export default async function MessagesPage({ params }: PageProps) {
  const { url_slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Dashboard layout should already handle redirect, but bail out defensively.
    return null;
  }

  // Check if this user is a member (e.g. director) for this url_slug
  const { data: member } = await supabase
    .from("members")
    .select("id, role, url_slug")
    .eq("uid", user.id)
    .eq("url_slug", url_slug)
    .single();

  const isDirector = member?.role === "director";

  return (
    <CreateConversationModalProvider>
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-96 shrink-0 overflow-y-auto border-r border">
          {isDirector ? (
            <DirectorMessages urlSlug={url_slug} directorId={member!.id} />
          ) : (
            <Messages urlSlug={url_slug} />
          )}
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <MessagesEmptyState />
        </div>
      </div>
    </CreateConversationModalProvider>
  );
}
