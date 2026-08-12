"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { PortalRole } from "@/lib/auth/roles";

export interface ActorInfo {
  role: PortalRole;
  profileId: number;
}

const ActorContext = createContext<ActorInfo | null>(null);

export function useActor(): ActorInfo {
  const ctx = useContext(ActorContext);
  if (!ctx) throw new Error("useActor must be used within ActorProvider");
  return ctx;
}

export function ActorProvider({
  actor,
  children,
}: {
  actor: ActorInfo;
  children: ReactNode;
}) {
  return (
    <ActorContext.Provider value={actor}>{children}</ActorContext.Provider>
  );
}
