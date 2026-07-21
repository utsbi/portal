"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { SIDEBAR_COOKIE } from "./cookie";

interface SidebarContextType {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

interface SidebarProviderProps {
  children: ReactNode;
  defaultOpen?: boolean;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
}: SidebarProviderProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggleSidebar = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  // Mirror the current state into a long-lived cookie so the next server render
  // (DashboardLayout) seeds defaultOpen from it instead of a hardcoded value.
  useEffect(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: simple synchronous write; the async CookieStore API lacks Safari support
    document.cookie = `${SIDEBAR_COOKIE}=${open}; path=/; max-age=31536000; samesite=lax`;
  }, [open]);

  return (
    <SidebarContext.Provider
      value={{
        state: open ? "expanded" : "collapsed",
        open,
        setOpen,
        toggleSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
