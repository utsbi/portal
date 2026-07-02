"use client";

import { MessageSquarePlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useChat } from "@/lib/chat/chat-context";

/**
 * Compact new-chat action for the dashboard top bar. Phones only (below md the
 * sidebar — where "New chat" normally lives — is an off-canvas overlay), and
 * Explore chat routes only. Mirrors the sidebar's new-chat behavior: mutate
 * chat state + URL in-surface instead of a Next navigation, which would
 * remount Explore and wipe an in-flight stream.
 */
export function MobileNewChatButton() {
  const pathname = usePathname();
  const { newSession } = useChat();

  if (!pathname.startsWith("/dashboard/explore")) return null;

  const handleNewChat = () => {
    newSession();
    window.history.replaceState(null, "", "/dashboard/explore/new");
  };

  return (
    <button
      type="button"
      onClick={handleNewChat}
      aria-label="New chat"
      title="New chat"
      className="group relative flex size-10 items-center justify-center text-sbi-muted hover:text-white transition-colors duration-300 md:hidden"
    >
      {/* Outer frame — matches the sidebar trigger's header styling */}
      <div className="absolute inset-0 border border-sbi-dark-border/50 group-hover:border-sbi-green/30 transition-colors duration-500" />
      <MessageSquarePlus
        className="size-[18px] group-hover:text-sbi-green transition-colors duration-300"
        strokeWidth={1.5}
      />
    </button>
  );
}
