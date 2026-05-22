"use client";

import { type ReactNode } from "react";
import { CmdKProvider } from "@/components/dashboard/messages/cmdk/CommandPalette";

interface CmdKShellProps {
  children: ReactNode;
  basePath: string;
}

/**
 * Thin client wrapper that mounts the Cmd+K provider around the
 * messages master–detail shell. Lives here so layout.tsx stays a Server Component.
 */
export function CmdKShell({ children, basePath }: CmdKShellProps) {
  return <CmdKProvider basePath={basePath}>{children}</CmdKProvider>;
}
