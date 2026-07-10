/**
 * RFC 4122 v4 UUID.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS or
 * localhost), so phones hitting the dev server over `http://<lan-ip>:3000`
 * throw `crypto.randomUUID is not a function`. `crypto.getRandomValues()` has
 * no such restriction — it's available in all contexts in every modern
 * browser (and in Node 19+), so we build the v4 UUID from those bytes. Falls
 * back to `Math.random` only if `getRandomValues` is somehow missing.
 */
export function uuid(): string {
  const g = globalThis as {
    crypto?: {
      getRandomValues?: <T extends ArrayBufferView>(arr: T) => T;
      randomUUID?: () => string;
    };
  };

  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }

  if (g.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    g.crypto.getRandomValues(bytes);
    // Per RFC 4122 §4.4: set version (4) in byte 6 high nibble,
    // variant (10) in byte 8 high two bits.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex: string[] = new Array(16);
    for (let i = 0; i < 16; i++) {
      hex[i] = (bytes[i] ?? 0).toString(16).padStart(2, "0");
    }
    return (
      `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-` +
      `${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-` +
      `${hex.slice(10, 16).join("")}`
    );
  }

  // Last-resort non-cryptographic fallback. Should never hit in practice —
  // every browser since 2014 and Node 19+ ship getRandomValues.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
