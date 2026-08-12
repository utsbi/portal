"use client";

import gsap from "gsap";
import {
  Bell,
  BookOpen,
  Calendar,
  ChevronUp,
  ClipboardList,
  Compass,
  DollarSign,
  FileEdit,
  FileText,
  FolderOpen,
  HelpCircle,
  LogOut,
  type LucideIcon,
  MailQuestion,
  MessageSquare,
  MessageSquarePlus,
  MessagesSquare,
  Repeat,
  Search,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatHistoryNav } from "@/components/dashboard/explore/ui/ChatHistoryNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChat } from "@/lib/chat/chat-context";
import { useProject } from "@/lib/project/project-context";
import { useSidebar } from "@/lib/sidebar/sidebar-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  roles?: Array<"client" | "director" | "member">; // if undefined, shown to all
}

// Nav is grouped by SCOPE, not by content type:
//   - General: cross-project surfaces that consolidate everything in one place
//     and do NOT change when you switch the active project.
//   - Project: surfaces scoped to the active project — switching the project
//     (via the header switcher) changes what these show.
const generalItems: NavItem[] = [
  { title: "Explore", path: "", icon: Compass },
  { title: "Messages", path: "/messages", icon: MessageSquare },
  {
    title: "Questionnaire",
    path: "/questionnaire",
    icon: ClipboardList,
    roles: ["client"],
  },
  {
    title: "Form Builder",
    path: "/questionnaire/builder",
    icon: FileEdit,
    roles: ["director"],
  },
  { title: "Documentation", path: "/docs", icon: BookOpen },
];

const projectItems: NavItem[] = [
  { title: "Lifecycle", path: "/lifecycle", icon: Repeat },
  { title: "Calendar", path: "/calendar", icon: Calendar },
  { title: "Finances", path: "/finances", icon: DollarSign },
  { title: "Files", path: "/files", icon: FolderOpen },
  { title: "Reports", path: "/reports", icon: FileText },
  { title: "Requests", path: "/requests", icon: MailQuestion },
];

// Settings is accessed from the user profile menu, not the nav

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  baseUrl: string;
  isCollapsed: boolean;
  /** Optional click override (e.g. Explore always starts a fresh chat). */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function NavLink({
  item,
  isActive,
  baseUrl,
  isCollapsed,
  onClick,
}: NavLinkProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const fullUrl = item.path.startsWith("/docs")
    ? item.path
    : `${baseUrl}${item.path}`;

  useEffect(() => {
    if (!indicatorRef.current) return;

    if (isActive) {
      gsap.to(indicatorRef.current, {
        scaleY: 1,
        opacity: 1,
        duration: 0.3,
        ease: "power2.out",
      });
    } else {
      gsap.to(indicatorRef.current, {
        scaleY: 0,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
      });
    }
  }, [isActive]);

  return (
    <Link
      href={fullUrl}
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 transition-all duration-300 ${
        isCollapsed ? "justify-center" : ""
      } ${isActive ? "text-white" : "text-sbi-muted hover:text-white"}`}
    >
      {/* Active indicator line */}
      <div
        ref={indicatorRef}
        className={`absolute ${isCollapsed ? "left-0.5" : "left-0"} top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sbi-green origin-center scale-y-0 opacity-0 rounded-full`}
      />

      {/* Icon */}
      <div
        className={`relative transition-all duration-300 ${isActive ? "text-sbi-green" : "group-hover:text-sbi-green"}`}
      >
        <item.icon className="size-[18px]" strokeWidth={1.5} />
        {isActive && (
          <div className="absolute inset-0 blur-md bg-sbi-green/40 rounded-full" />
        )}
      </div>

      {/* Label */}
      {!isCollapsed && (
        <span
          className={`text-sm font-light tracking-wide transition-colors duration-300 ${
            isActive ? "text-white" : ""
          }`}
        >
          {item.title}
        </span>
      )}

      {/* Hover glow */}
      <div className="absolute inset-0 bg-sbi-green/0 group-hover:bg-sbi-green/5 transition-colors duration-300 rounded-lg -z-10" />
    </Link>
  );
}

export function AppSidebar() {
  const { state, open, setOpen } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useProject();
  const { newSession } = useChat();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);

  // On mobile the sidebar is an off-canvas overlay that always shows its full
  // (expanded) content; `open` only drives whether it's slid in or parked off
  // the left edge. The collapsed icon-rail is a desktop-only affordance.
  const isCollapsed = !isMobile && state === "collapsed";

  // Base URL for all dashboard routes
  const baseUrl = "/dashboard";

  // Get user display info from project context
  const userName = user?.name || "Loading...";
  const userEmail = user?.email || "";
  const userInitials = user?.initials || "...";

  const isActive = (path: string) => {
    if (path.startsWith("/docs")) {
      return pathname.startsWith("/docs");
    }
    const fullPath = `${baseUrl}${path}`;
    if (path === "") {
      // Explore is active on both /dashboard and /dashboard/explore
      return pathname === baseUrl || pathname.startsWith(`${baseUrl}/explore`);
    }
    return pathname.startsWith(fullPath);
  };

  // The Explore and Chats routes get a contextual chat-history list in the
  // sidebar, and the sidebar auto-expands there to surface it.
  const isExplore =
    pathname === baseUrl || pathname.startsWith(`${baseUrl}/explore`);
  const isChats = pathname.startsWith(`${baseUrl}/chats`);
  const isChatSurface = isExplore || isChats;
  const showChatHistory = isChatSurface && !isCollapsed;

  // Auto-expand when NAVIGATING into a chat surface (so the history is visible),
  // but remember a manual collapse for the rest of the session and stop
  // auto-expanding once the user opts out. The pre-chat open state is restored
  // when leaving. wasExploreRef is seeded with the current route so a fresh
  // load / refresh does NOT count as "entering" — the persisted cookie already
  // set the correct initial state, and re-expanding here would cause a shift.
  const userCollapsedOnExploreRef = useRef(false);
  const wasExploreRef = useRef(isChatSurface);
  const preExploreOpenRef = useRef(open);
  const lastOpenRef = useRef(open);

  useEffect(() => {
    // Desktop only: auto-expand on chat surfaces and restore the prior state on
    // leave. On mobile the sidebar is a trigger-driven slide-over (dismissed on
    // navigation below), so it must never auto-open over the content.
    if (isMobile) {
      wasExploreRef.current = isChatSurface;
      return;
    }
    const was = wasExploreRef.current;
    if (isChatSurface && !was) {
      preExploreOpenRef.current = open;
      if (!userCollapsedOnExploreRef.current) setOpen(true);
    } else if (!isChatSurface && was) {
      setOpen(preExploreOpenRef.current);
    }
    wasExploreRef.current = isChatSurface;
  }, [isChatSurface, open, setOpen, isMobile]);

  // Treat a collapse performed while on a chat surface as an explicit opt-out.
  useEffect(() => {
    const prev = lastOpenRef.current;
    lastOpenRef.current = open;
    if (isChatSurface && prev && !open)
      userCollapsedOnExploreRef.current = true;
  }, [open, isChatSurface]);

  // When the collapsed rail's search icon expands the sidebar, focus the history
  // search box once ChatHistoryNav mounts. A ref (not state) so it survives the
  // expand->mount gap and never steals focus on a plain auto-expand.
  const pendingSearchFocusRef = useRef(false);

  // Collapsed-rail chat actions (Explore only). New chat / search expand-and-focus
  // mutate state + URL directly, matching the in-surface navigation pattern.
  const handleCollapsedNewChat = () => {
    newSession();
    window.history.replaceState(null, "", "/dashboard/explore/new");
  };

  // Explore nav = ALWAYS a fresh chat. Plain left-clicks reset the session and
  // land on the new-chat route; modified clicks (new tab, etc.) keep native
  // link behavior. Inside the Explore surface, use replaceState like the New
  // chat button so useParams stays stable and the portal's hydrate effect
  // doesn't re-fire; from any other page, a real navigation mounts the portal
  // on /explore/new (isNewRoute), which shows the welcome state.
  const handleExploreNav = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    newSession();
    if (pathname === baseUrl || pathname.startsWith(`${baseUrl}/explore`)) {
      window.history.replaceState(null, "", "/dashboard/explore/new");
    } else {
      router.push("/dashboard/explore/new");
    }
  };

  const handleCollapsedSearch = () => {
    pendingSearchFocusRef.current = true;
    userCollapsedOnExploreRef.current = false; // explicit expand re-enables auto-expand
    setOpen(true);
  };

  const handleLogoClick = () => {
    // Logo = return to Explore as a FRESH chat, matching the New chat / Explore
    // nav affordance (handleExploreNav). newSession() clears the in-memory
    // thread; the assistant row was persisted incrementally by the API route,
    // so the prior conversation is still reachable from history — nothing is
    // lost. Inside the Explore surface use replaceState so useParams stays
    // stable and the portal's hydrate effect doesn't re-fire; from any other
    // page a real navigation mounts the welcome state on /explore/new.
    newSession();
    if (pathname === baseUrl || pathname.startsWith(`${baseUrl}/explore`)) {
      window.history.replaceState(null, "", "/dashboard/explore/new");
    } else {
      router.push("/dashboard/explore/new");
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escape closes the account menu and returns focus to its trigger.
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsUserMenuOpen(false);
      userMenuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isUserMenuOpen]);

  // On mobile the sidebar is a slide-over: Escape and route changes dismiss it.
  useEffect(() => {
    if (!isMobile || !open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, open, setOpen]);

  // Close the mobile overlay after navigating to another route. Keyed on
  // pathname alone on purpose: it should fire on navigation, not when the
  // viewport crosses the mobile breakpoint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional pathname-only trigger
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [pathname]);

  // The persisted open state is a desktop affordance. On mobile the sidebar is a
  // slide-over, so a remembered "open" must not leave it covering content on load
  // — close it whenever the viewport is (or becomes) mobile.
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [isMobile, setOpen]);

  const userRole = user?.role;
  const filterByRole = (items: NavItem[]) =>
    items.filter(
      (item) => !item.roles || (userRole && item.roles.includes(userRole)),
    );

  return (
    <>
      {/* Mobile-only dimmed backdrop. Tap to dismiss the slide-over. Lives below
          the aside (z) but above content; absent on md+ where the rail is inline. */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      <aside
        // Off-canvas slide-over on mobile (fixed + translate, never animating
        // layout width); inline collapsing rail on md+.
        className={cn(
          "relative flex flex-col h-screen bg-sbi-dark border-r border-sbi-dark-border/30 transition-all duration-300 ease-out",
          // Mobile: fixed full-height overlay at a comfortable width, slid in/out.
          "fixed inset-y-0 left-0 z-50 w-60 max-w-[85vw]",
          open ? "translate-x-0" : "-translate-x-full",
          // md+: back to an inline rail in normal flow; collapse toggles width.
          // Keep the rail above the adjacent content when its account menu
          // opens to the right. `z-auto` created a stacking context below the
          // main pane, so the menu was mounted but visually hidden when the
          // rail was collapsed.
          "md:static md:z-40 md:max-w-none md:translate-x-0",
          isCollapsed ? "md:w-16" : "md:w-60",
        )}
      >
        {/* Architectural corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-sbi-green/20" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-sbi-dark-border/30" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-sbi-dark-border/30" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-sbi-green/20" />

        {/* Header */}
        <div
          className={cn(
            "h-16 flex items-center border-b border-sbi-dark-border/30",
            // Collapsed rail: center the logo so it lines up with the centered
            // nav icons below it (expanded: left-aligned with the brand text).
            isCollapsed ? "justify-center px-0" : "px-3",
          )}
        >
          <button
            type="button"
            onClick={handleLogoClick}
            className="group flex items-center gap-3 transition-all duration-300 cursor-pointer"
          >
            {/* Logo */}
            <div className="relative flex items-center justify-center size-8">
              {/* Rotating border */}
              <div className="absolute inset-0 border border-sbi-dark-border/50 group-hover:border-sbi-green/40 transition-colors duration-500 rotate-45" />
              {/* Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-label="SBI"
                className="size-4 text-sbi-green"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v20" />
                <path d="m4.93 4.93 14.14 14.14" />
              </svg>
            </div>

            {/* Brand text */}
            {!isCollapsed && (
              <div className="flex flex-col text-left">
                <span className="text-sm font-light tracking-[0.25em] text-white uppercase">
                  SBI
                </span>
                <span className="text-[9px] tracking-widest text-sbi-muted uppercase">
                  {user?.role === "director"
                    ? "Director Portal"
                    : user?.role === "member"
                      ? "Member Portal"
                      : "Client Portal"}
                </span>
              </div>
            )}
          </button>
        </div>

        {/* The active project lives in the top bar (ProjectSwitcher) so it stays
            visible regardless of the sidebar's collapsed state. */}

        {/* Navigation. On Explore the chat-history list is the primary surface:
          it takes the available vertical space (with its own scroll) and the nav
          is allowed to shrink behind its own scrollbar when the viewport is
          short, so more than a sliver of recent chats stays visible. Elsewhere
          the nav itself scrolls. */}
        <div className="flex-1 flex flex-col min-h-0">
          <nav
            className={cn(
              "overflow-y-auto overflow-x-hidden py-4 px-2",
              showChatHistory ? "shrink min-h-0" : "flex-1",
            )}
          >
            {/* General (cross-project) Navigation */}
            <div className="space-y-1">
              {filterByRole(generalItems).map((item) => (
                <NavLink
                  key={item.title}
                  item={item}
                  isActive={isActive(item.path)}
                  baseUrl={baseUrl}
                  isCollapsed={isCollapsed}
                  onClick={
                    item.title === "Explore" ? handleExploreNav : undefined
                  }
                />
              ))}
            </div>

            {/* Divider */}
            <div className="my-4 mx-3 h-px bg-linear-to-r from-transparent via-sbi-dark-border/50 to-transparent" />

            {/* Project Section — scoped to the active project (header switcher) */}
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 mb-2">
                  <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted font-light">
                    Project
                  </span>
                </div>
              )}
              {filterByRole(projectItems).map((item) => (
                <NavLink
                  key={item.title}
                  item={item}
                  isActive={isActive(item.path)}
                  baseUrl={baseUrl}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>

            {/* Collapsed chat rail (Explore + Chats): the essential chat actions
              stay reachable on the icon rail. Search expands the sidebar and
              focuses the history search box. */}
            {isChatSurface && isCollapsed && (
              <>
                <div className="my-4 mx-3 h-px bg-linear-to-r from-transparent via-sbi-dark-border/50 to-transparent" />
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={handleCollapsedNewChat}
                    title="New chat"
                    aria-label="New chat"
                    className="group relative w-full flex items-center justify-center px-3 py-2.5 text-sbi-muted hover:text-white transition-colors duration-300"
                  >
                    <MessageSquarePlus
                      className="size-[18px] group-hover:text-sbi-green transition-colors duration-300"
                      strokeWidth={1.5}
                    />
                    <span className="absolute inset-0 bg-sbi-green/0 group-hover:bg-sbi-green/5 transition-colors duration-300 rounded-lg -z-10" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapsedSearch}
                    title="Search chats"
                    aria-label="Search chats"
                    className="group relative w-full flex items-center justify-center px-3 py-2.5 text-sbi-muted hover:text-white transition-colors duration-300"
                  >
                    <Search
                      className="size-[18px] group-hover:text-sbi-green transition-colors duration-300"
                      strokeWidth={1.5}
                    />
                    <span className="absolute inset-0 bg-sbi-green/0 group-hover:bg-sbi-green/5 transition-colors duration-300 rounded-lg -z-10" />
                  </button>
                  <Link
                    href="/dashboard/chats"
                    title="All chats"
                    aria-label="All chats"
                    className="group relative w-full flex items-center justify-center px-3 py-2.5 text-sbi-muted hover:text-white transition-colors duration-300"
                  >
                    <MessagesSquare
                      className="size-[18px] group-hover:text-sbi-green transition-colors duration-300"
                      strokeWidth={1.5}
                    />
                    <span className="absolute inset-0 bg-sbi-green/0 group-hover:bg-sbi-green/5 transition-colors duration-300 rounded-lg -z-10" />
                  </Link>
                </div>
              </>
            )}
          </nav>

          {/* Contextual chat history (Explore + Chats). flex-1 claims the
            remaining height; the min-height guarantees the recent list a
            meaningful share on short viewports (nav above shrinks + scrolls). */}
          {showChatHistory && (
            <div className="flex-1 min-h-[55%] flex flex-col border-t border-sbi-dark-border/30">
              <ChatHistoryNav focusSearchRef={pendingSearchFocusRef} />
            </div>
          )}
        </div>

        {/* User Profile Footer */}
        <div
          ref={userMenuRef}
          className="relative border-t border-sbi-dark-border/30"
        >
          {/* User Menu Popup */}
          {isUserMenuOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              className={`absolute bottom-full mb-1 bg-sbi-dark border border-sbi-dark-border/50 rounded-lg overflow-hidden shadow-2xl shadow-black/50 z-50 ${
                isCollapsed
                  ? "left-full ml-2 bottom-0 w-56"
                  : "left-0 right-0 mx-2"
              }`}
            >
              {/* User info header */}
              <div className="px-3 py-3 border-b border-sbi-dark-border/30">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center size-9">
                    <div className="absolute inset-0 border border-sbi-dark-border/50 rounded-lg" />
                    <span className="text-xs font-light text-sbi-green tracking-wider">
                      {userInitials}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light text-white truncate">
                      {userName}
                    </p>
                    <p className="text-xs text-sbi-muted truncate">
                      {userEmail}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    router.push("/dashboard/settings?section=profile");
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200 cursor-pointer"
                >
                  <User className="size-4" strokeWidth={1.5} />
                  <span className="text-sm font-light">Account</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    router.push("/dashboard/settings?section=notifications");
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200 cursor-pointer"
                >
                  <Bell className="size-4" strokeWidth={1.5} />
                  <span className="text-sm font-light">Notifications</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    router.push("/dashboard/settings");
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200 cursor-pointer"
                >
                  <Settings className="size-4" strokeWidth={1.5} />
                  <span className="text-sm font-light">Settings</span>
                </button>
                <a
                  href="mailto:support@utsbi.org?subject=Portal%20support"
                  role="menuitem"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200 cursor-pointer"
                >
                  <HelpCircle className="size-4" strokeWidth={1.5} />
                  <span className="text-sm font-light">Help</span>
                </a>
              </div>

              {/* Logout */}
              <div className="border-t border-sbi-dark-border/30 py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200 cursor-pointer"
                >
                  <LogOut className="size-4" strokeWidth={1.5} />
                  <span className="text-sm font-light">Log out</span>
                </button>
              </div>
            </div>
          )}

          {/* User button */}
          <button
            ref={userMenuButtonRef}
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            className={`w-full flex items-center gap-3 p-3 transition-all duration-300 hover:bg-sbi-green/5 ${
              isCollapsed ? "justify-center" : ""
            } ${isUserMenuOpen ? "bg-sbi-green/5" : ""}`}
          >
            {/* Avatar */}
            <div className="relative flex items-center justify-center size-9 shrink-0">
              <div
                className={`absolute inset-0 border transition-colors duration-300 rounded-lg ${
                  isUserMenuOpen
                    ? "border-sbi-green/40"
                    : "border-sbi-dark-border/50 hover:border-sbi-green/30"
                }`}
              />
              <span className="text-xs font-light text-sbi-green tracking-wider">
                {userInitials}
              </span>
            </div>

            {/* User info */}
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-light text-white truncate">
                    {userName}
                  </p>
                  <p className="text-[11px] text-sbi-muted truncate">
                    {userEmail}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronUp
                  className={`size-4 text-sbi-muted transition-transform duration-300 ${
                    isUserMenuOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.5}
                />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
