"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface ActorInfo {
  role: "client" | "director" | "member";
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
  return <ActorContext.Provider value={actor}>{children}</ActorContext.Provider>;
}
