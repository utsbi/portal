"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Shared modal open state so the create button in the list header and in MessagesEmptyState open the same modal (client or director depending on route). */
interface CreateConversationModalContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CreateConversationModalContext =
  createContext<CreateConversationModalContextValue | null>(null);

export function CreateConversationModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <CreateConversationModalContext.Provider value={{ open, setOpen }}>
      {children}
    </CreateConversationModalContext.Provider>
  );
}

/** Returns null when used outside the provider (e.g. DirectorMessages uses local fallback). */
export function useCreateConversationModal() {
  return useContext(CreateConversationModalContext);
}
