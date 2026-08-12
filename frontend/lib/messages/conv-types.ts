/**
 * Shared types for the conversation cache + IndexedDB persistence layer.
 *
 * Lives in a leaf module to break the import cycle between conv-cache.ts
 * (which uses persistSnapshot from conv-storage.ts) and conv-storage.ts
 * (which previously imported these types from conv-cache.ts). Turbopack's
 * module graph builder spun catastrophically on the cycle (multi-GB RAM
 * during /dashboard/messages compile); moving the types here is purely
 * structural and has no runtime effect.
 */

export interface CachedAttachment {
  /** db row id once persisted; negative number for in-flight (local) attachments */
  id: number;
  path: string | null;
  name: string;
  mimeType: string | null;
  meta: {
    width?: number;
    height?: number;
    mimeType?: string;
    sizeBytes?: number;
  } | null;
  signedUrl: string | null;
  localPreviewUrl?: string | null;
  pendingFile?: File | null;
  uploadFailed?: boolean;
}

export interface CachedMessage {
  id: number;
  text: string | null;
  senderRole: "client" | "director" | "president" | "member";
  senderProfileId?: number | null;
  createdAt: string;
  editedAt?: string | null;
  replyToId?: number | null;
  attachments: CachedAttachment[];
  status: "sending" | "sent" | "failed";
  isPinned?: boolean;
  pinnedAt?: string | null;
  unfurl?: {
    url: string;
    title?: string | null;
    description?: string | null;
    image_url?: string | null;
    site_name?: string | null;
  } | null;
}

export interface ConvSnapshot {
  messages: CachedMessage[];
  lastRead: number; // epoch ms
  cachedAt: number; // epoch ms; for TTL-based freshness checks
  newDividerBeforeId: number | null;
}

export interface PersistedSnapshot {
  convId: string;
  messages: CachedMessage[];
  lastRead: number;
  cachedAt: number;
  newDividerBeforeId: number | null;
}
