"use client";

import gsap from "gsap";
import { motion } from "motion/react";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/chat/chat-context";
import { cn } from "@/lib/utils";
import { AmbientGrid } from "./ui/AmbientGrid";
import { ChatMessages } from "./ui/ChatMessages";
import { FloatingNodes } from "./ui/FloatingNodes";
import { KnowledgeSourcesPanel } from "./ui/KnowledgeSourcesPanel";
import { PortalHero } from "./ui/PortalHero";
import { PortalInput } from "./ui/PortalInput";
import { SourcesPanel } from "./ui/SourcesPanel";
import { SuggestionChips } from "./ui/SuggestionChips";

/**
 * The single Explore surface for both the new-chat welcome and an active thread.
 * It is mounted at /dashboard/explore/[[...chatId]] and reads the chat id from
 * the route via useParams (not async params), so switching ids re-renders without
 * remounting — which would otherwise wipe an in-flight stream.
 *
 * Hydration:
 *   - path is a uuid        -> load that conversation (unless it's already open)
 *   - path is new/undefined -> reset to a fresh chat
 * When the backend assigns a session for the first message, its uuid is written
 * into the URL with history.replaceState (no navigation, no remount), mirroring
 * Vercel's ai-chatbot.
 */
export function ExplorePortal() {
  const params = useParams<{ chatId?: string[] }>();
  const chatId = Array.isArray(params.chatId)
    ? params.chatId[0]
    : params.chatId;
  // Derive "new route" from the pathname, NOT useParams: the New-chat / chat-
  // select actions use history.replaceState (to avoid a remount), which updates
  // the pathname but leaves useParams' route segments stale. So after "New chat"
  // (replaceState -> /explore/new) useParams.chatId would still be the previous
  // uuid; pathname is correct, so the welcome screen shows instead of a stuck
  // history skeleton.
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const {
    messages,
    sessionPublicId,
    sessionTitle,
    loadSession,
    newSession,
    clearChat,
    cancelRequest,
    isLoading,
    loadFailed,
  } = useChat();

  const isNewRoute =
    !pathname ||
    pathname === "/dashboard/explore" ||
    pathname === "/dashboard/explore/new" ||
    pathname === "/dashboard";
  // A revisited/loaded thread that ended up empty (failed load, or no messages
  // while nothing is in flight) gets a small explicit state instead of the
  // new-chat welcome hero or a blank scroll region.
  const showEmptyState =
    messages.length === 0 && !isNewRoute && !isLoading && loadFailed;
  // The centered welcome hero is ONLY for a genuinely new chat. On a uuid route
  // we keep the thread layout (composer pinned at the bottom) even before
  // loadSession() resolves, so reloading an existing chat doesn't flash the
  // centered composer and animate it down once messages arrive.
  const showWelcome = messages.length === 0 && isNewRoute;
  // True from the first render of a uuid route until its history arrives (a real
  // session always has ≥1 message, so this never sticks on a successful load).
  // Drives the skeleton for both the title and the messages so a reload shows a
  // loading state immediately — no blank frame, no "Untitled" flash.
  const loadingHistory = !isNewRoute && !loadFailed && messages.length === 0;
  // Announce the active conversation / generating state to screen readers.
  const liveAnnouncement = loadFailed
    ? "Could not load this conversation."
    : isLoading
      ? `Generating a response in ${sessionTitle || "this conversation"}.`
      : showWelcome
        ? "New conversation."
        : `Viewing conversation: ${sessionTitle || "Untitled"}.`;

  // Mirror the open session id into a ref so the hydrate effect always compares
  // against the *current* value, not a stale closure (the effect deliberately
  // depends only on chatId).
  const openSessionRef = useRef<string | null>(sessionPublicId);
  useEffect(() => {
    openSessionRef.current = sessionPublicId;
  }, [sessionPublicId]);

  // Hydrate from the path. Re-runs only when the URL's chatId changes; the ref
  // guard prevents reloading the conversation that's already open (e.g. right
  // after a new session writes its uuid into the URL).
  useEffect(() => {
    if (!isNewRoute && chatId) {
      if (chatId !== openSessionRef.current) {
        void loadSession(chatId).then((ok) => {
          // Unknown / inaccessible conversation -> drop to a fresh chat.
          if (!ok) {
            newSession();
            window.history.replaceState(null, "", "/dashboard/explore/new");
          }
        });
      }
    } else if (openSessionRef.current !== null) {
      newSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Once a session exists, reflect its uuid in the URL WITHOUT a Next navigation.
  // router.push/replace here would re-run the route and remount this surface
  // (wiping the in-flight stream); history.replaceState just updates the address
  // bar. This is the pattern Vercel's ai-chatbot uses for new chat ids.
  useEffect(() => {
    if (sessionPublicId && sessionPublicId !== chatId) {
      window.history.replaceState(
        null,
        "",
        `/dashboard/explore/${sessionPublicId}`,
      );
    }
  }, [sessionPublicId, chatId]);

  // Entrance-animation gate.
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Cancel + reset only when leaving the explore area entirely. Intra-explore
  // navigation keeps this component mounted, so this never fires on new<->uuid.
  useEffect(() => {
    const handleBeforeUnload = () => {
      cancelRequest();
      clearChat();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [clearChat, cancelRequest]);

  useEffect(() => {
    const timer = setTimeout(() => {
      mountedRef.current = true;
    }, 50);
    return () => {
      clearTimeout(timer);
      if (mountedRef.current) {
        cancelRequest();
        clearChat();
      }
    };
  }, [cancelRequest, clearChat]);

  // GSAP entrance for the welcome view. Re-runs whenever the welcome view is
  // (re)shown; a no-op for the thread view (its selectors won't match).
  useEffect(() => {
    if (!containerRef.current || !isReady || !showWelcome) return;

    const ctx = gsap.context(() => {
      const heroElements =
        containerRef.current?.querySelectorAll(".hero-content");
      const ambientElements =
        containerRef.current?.querySelectorAll(".ambient-element");
      const chips = containerRef.current?.querySelectorAll(".suggestion-chip");

      // The composer's entrance/position is owned by framer-motion (layout), not GSAP.
      if (!heroElements || !ambientElements || !chips) return;

      gsap.set(heroElements, { opacity: 0, y: 40 });
      gsap.set(ambientElements, { opacity: 0 });
      gsap.set(chips, { opacity: 0, y: 15, scale: 0.95 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(heroElements, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 }, 0)
        .to(ambientElements, { opacity: 1, duration: 2, stagger: 0.2 }, 0)
        .to(
          chips,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            visibility: "visible",
            duration: 0.6,
            stagger: 0.05,
          },
          0.4,
        );
    }, containerRef);

    return () => ctx.revert();
  }, [isReady, showWelcome]);

  return (
    <div
      ref={containerRef}
      // overflow-clip (not -hidden): clips the ambient bleed without making this
      // a scroll container. overflow-hidden IS programmatically scrollable, so
      // ChatMessages' scrollIntoView could nudge it (its content is a hair taller
      // than the box), pushing the title bar up under the header and opening a
      // matching gap below the composer. clip can't be scrolled.
      className="relative z-10 h-full min-h-0 w-full overflow-clip"
    >
      <FloatingNodes />
      <AmbientGrid />

      {/* Sources for the latest answer (hover-to-peek / lock-to-dock, right edge).
          Hides itself entirely when the latest answer cites no documents. */}
      <SourcesPanel />

      {/* Ambient accents — faded in by GSAP on the welcome screen, static otherwise */}
      {showWelcome ? (
        <>
          <div className="ambient-element absolute top-8 left-8 w-24 h-24 border-l border-t border-sbi-dark-border/40 opacity-0" />
          <div className="ambient-element absolute bottom-8 right-8 w-24 h-24 border-r border-b border-sbi-dark-border/40 opacity-0" />
          <div className="ambient-element absolute top-1/4 -left-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl opacity-0" />
          <div className="ambient-element absolute bottom-1/4 -right-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl opacity-0" />
          <div className="ambient-element absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-sbi-dark-border/30 to-transparent opacity-0" />
        </>
      ) : (
        <>
          <div className="absolute top-8 left-8 w-24 h-24 border-l border-t border-sbi-dark-border/40" />
          <div className="absolute bottom-8 right-8 w-24 h-24 border-r border-b border-sbi-dark-border/40" />
          <div className="absolute top-1/4 -left-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-sbi-green/2 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-sbi-dark-border/30 to-transparent" />
        </>
      )}

      {/*
        One flex column. The composer is a SINGLE persistent element (never
        remounts), so its text + focus survive the welcome->thread switch, and
        framer-motion `layout` smoothly animates it from centered (welcome) to
        the bottom (thread). Mirrors claude.ai.
      */}
      <div
        className={cn(
          "relative z-10 flex flex-col h-full",
          showWelcome && "justify-center",
        )}
      >
        {/* SR-only live region: announces the active conversation and generating
            state so screen-reader users aren't left guessing which thread they're
            in or whether a response is in flight. */}
        <p aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </p>

        {/* Conversation title — in-flow bar at the top of the chat column
            (kept in normal flow so the container's overflow-hidden can never
            clip it). Shows "Untitled" until the backend auto-titles the chat. */}
        {!showWelcome && (
          <div className="shrink-0 flex justify-center px-4 pt-3 pb-1 pointer-events-none">
            <div className="min-w-[8rem] max-w-md rounded-full bg-sbi-dark/70 backdrop-blur-sm border border-sbi-dark-border/50 px-4 py-1.5">
              {loadingHistory && !sessionTitle ? (
                <span className="mx-auto block h-3.5 w-28 animate-pulse rounded bg-sbi-dark-border/40" />
              ) : (
                <span className="block text-xs font-medium text-white/80 text-center truncate">
                  {sessionTitle || "Untitled"}
                </span>
              )}
            </div>
          </div>
        )}

        {showWelcome ? (
          // Welcome: the hero sits directly above the composer; the column's
          // justify-center (above) vertically centers the hero + composer as a
          // group, and the persistent composer animates from this centered spot
          // to the bottom on the first message (framer-motion `layout`).
          <div className="shrink-0 w-full max-w-3xl mx-auto px-4 mb-2">
            <PortalHero />
          </div>
        ) : showEmptyState ? (
          <div className="flex-1 min-h-0 overflow-y-auto dashboard-scrollbar flex items-center justify-center">
            <div className="w-full max-w-md mx-auto px-4 text-center">
              <p className="text-sm font-medium text-white/80">
                This conversation couldn't be loaded
              </p>
              <p className="mt-2 text-xs text-sbi-muted-dark font-light leading-relaxed">
                It may have been deleted or is no longer available. Start a new
                message below to keep going.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto dashboard-scrollbar">
            <div className="w-full max-w-3xl mx-auto px-4 pt-3">
              {loadingHistory ? (
                <ChatHistorySkeleton />
              ) : (
                <ChatMessages />
              )}
            </div>
          </div>
        )}

        <motion.div
          layout
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 w-full max-w-3xl mx-auto px-4 pt-2 pb-4"
        >
          <PortalInput animated={false} />
          {showWelcome ? (
            <>
              <div className="mt-4">
                <SuggestionChips disableAutoAnimation />
              </div>
              <KnowledgeSourcesPanel className="mt-4" />
            </>
          ) : (
            <p className="text-center text-xs text-sbi-muted-dark mt-3 font-light">
              AI can make mistakes, so double check responses
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Placeholder shown while loadSession() hydrates an existing conversation, so a
 * reloaded chat reads as "loading history" instead of flashing an empty thread.
 */
function ChatHistorySkeleton() {
  return (
    <div className="space-y-6 py-2" aria-hidden="true">
      <div className="flex justify-end">
        <div className="h-9 w-40 rounded-2xl bg-sbi-dark-border/30 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-3/4 rounded bg-sbi-dark-border/30 animate-pulse" />
        <div className="h-3.5 w-5/6 rounded bg-sbi-dark-border/30 animate-pulse" />
        <div className="h-3.5 w-2/3 rounded bg-sbi-dark-border/30 animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="h-9 w-28 rounded-2xl bg-sbi-dark-border/30 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-sbi-dark-border/30 animate-pulse" />
        <div className="h-3.5 w-1/2 rounded bg-sbi-dark-border/30 animate-pulse" />
      </div>
    </div>
  );
}
