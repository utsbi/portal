"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  MessageSquare,
  DollarSign,
  Repeat,
  Calendar,
  ClipboardList,
  FolderOpen,
  FileText,
  MailQuestion,
  ChevronUp,
  User,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import gsap from "gsap";
import { createClient } from "@/lib/supabase/client";
import { useClient } from "@/lib/client/client-context";
import { useSidebar } from "@/lib/sidebar/sidebar-context";
import { useChat } from "@/lib/chat/chat-context";

interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
}

// Navigation paths (relative to /{url_slug}/dashboard)
const mainItems: NavItem[] = [
  { title: "Explore", path: "", icon: Compass },
  { title: "Messages", path: "/messages", icon: MessageSquare },
  { title: "Calendar", path: "/calendar", icon: Calendar },
  { title: "Finances", path: "/finances", icon: DollarSign },
  { title: "Lifecycle", path: "/lifecycle", icon: Repeat },
];

const documentItems: NavItem[] = [
  { title: "Questionnaire", path: "/questionnaire", icon: ClipboardList },
  { title: "Files", path: "/files", icon: FolderOpen },
  { title: "Reports", path: "/reports", icon: FileText },
  { title: "Requests", path: "/requests", icon: MailQuestion },
];

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  baseUrl: string;
  isCollapsed: boolean;
}

function NavLink({ item, isActive, baseUrl, isCollapsed }: NavLinkProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const fullUrl = `${baseUrl}${item.path}`;

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

interface AppSidebarProps {
  urlSlug: string;
}

export function AppSidebar({ urlSlug }: AppSidebarProps) {
  const { state, open } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { client } = useClient();
  const { cancelRequest, clearChat } = useChat();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isCollapsed = state === "collapsed";

  // Base URL for all dashboard routes
  const baseUrl = `/${urlSlug}/dashboard`;

  // Get user display info from client context
  const userName = client?.name || "Loading...";
  const userEmail = client?.email || "";
  const userInitials = client?.initials || "...";

  const isActive = (path: string) => {
    const fullPath = `${baseUrl}${path}`;
    if (path === "") {
      // Explore is active on both /dashboard and /dashboard/explore
      return pathname === baseUrl || pathname.startsWith(`${baseUrl}/explore`);
    }
    return pathname.startsWith(fullPath);
  };

  const isOnDashboardRoot = pathname === baseUrl;

  const handleLogoClick = () => {
    if (isOnDashboardRoot) {
      return;
    }

    // Clear any active chat session
    cancelRequest();
    clearChat();

    // Navigate back to dashboard root
    router.push(baseUrl);
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

  return (
    <aside
      className={`relative flex flex-col h-screen bg-sbi-dark border-r border-sbi-dark-border/30 transition-all duration-300 ease-out ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Architectural corner accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-sbi-green/20" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-sbi-dark-border/30" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-sbi-dark-border/30" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-sbi-green/20" />

      {/* Header */}
      <div className="h-16 flex items-center border-b border-sbi-dark-border/30 px-3">
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
                Client Portal
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
        {/* Main Navigation */}
        <div className="space-y-1">
          {mainItems.map((item) => (
            <NavLink
              key={item.title}
              item={item}
              isActive={isActive(item.path)}
              baseUrl={baseUrl}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 mx-3 h-px bg-linear-to-r from-transparent via-sbi-dark-border/50 to-transparent" />

        {/* Documents Section */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 mb-2">
              <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted font-light">
                Documents
              </span>
            </div>
          )}
          {documentItems.map((item) => (
            <NavLink
              key={item.title}
              item={item}
              isActive={isActive(item.path)}
              baseUrl={baseUrl}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      </nav>

      {/* User Profile Footer */}
      <div
        ref={userMenuRef}
        className="relative border-t border-sbi-dark-border/30"
      >
        {/* User Menu Popup */}
        {isUserMenuOpen && (
          <div className={`absolute bottom-full mb-1 bg-sbi-dark border border-sbi-dark-border/50 rounded-lg overflow-hidden shadow-2xl shadow-black/50 z-50 ${
            isCollapsed ? "left-full ml-2 bottom-0 w-56" : "left-0 right-0 mx-2"
          }`}>
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
                  <p className="text-xs text-sbi-muted truncate">{userEmail}</p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200"
              >
                <User className="size-4" strokeWidth={1.5} />
                <span className="text-sm font-light">Account</span>
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200"
              >
                <Bell className="size-4" strokeWidth={1.5} />
                <span className="text-sm font-light">Notifications</span>
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200"
              >
                <Settings className="size-4" strokeWidth={1.5} />
                <span className="text-sm font-light">Settings</span>
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200"
              >
                <HelpCircle className="size-4" strokeWidth={1.5} />
                <span className="text-sm font-light">Help</span>
              </button>
            </div>

            {/* Logout */}
            <div className="border-t border-sbi-dark-border/30 py-1">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sbi-muted hover:text-white hover:bg-sbi-green/5 transition-colors duration-200"
              >
                <LogOut className="size-4" strokeWidth={1.5} />
                <span className="text-sm font-light">Log out</span>
              </button>
            </div>
          </div>
        )}

        {/* User button */}
        <button
          type="button"
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
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
  );
}