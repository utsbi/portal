"use client";

import gsap from "gsap";
import { motion } from "motion/react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/chat/chat-context";
import { cn } from "@/lib/utils";
import { AmbientGrid } from "./ui/AmbientGrid";
import { ChatMessages } from "./ui/ChatMessages";
import { FloatingNodes } from "./ui/FloatingNodes";
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
  } = useChat();

  const isNewRoute = !chatId || chatId === "new";
  const showWelcome = messages.length === 0;

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
      className="relative h-[calc(100vh-4rem)] w-full overflow-hidden"
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

      {/* Conversation title — always shows which chat you're in ("Untitled"
          until the backend auto-titles it after the first response). */}
      {!showWelcome && (
        <div className="absolute top-0 inset-x-0 z-20 flex justify-center px-4 pt-3 pointer-events-none">
          <div className="max-w-md rounded-full bg-sbi-dark/70 backdrop-blur-sm border border-sbi-dark-border/50 px-4 py-1.5">
            <span className="block text-xs font-medium text-white/80 truncate">
              {sessionTitle || "Untitled"}
            </span>
          </div>
        </div>
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
        {showWelcome ? (
          <div className="shrink-0 w-full max-w-3xl mx-auto px-4 mb-2">
            <PortalHero />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto dashboard-scrollbar">
            <div className="w-full max-w-3xl mx-auto px-4 pt-14">
              <ChatMessages />
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
            <div className="mt-4">
              <SuggestionChips disableAutoAnimation />
            </div>
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
