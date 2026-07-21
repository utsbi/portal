// Plain (non-"use client") module so both the server layout and the client
// provider can import the same cookie name. Importing this value from a
// "use client" module into a Server Component does NOT yield the real string at
// runtime (it becomes a client reference), which silently broke the SSR read.
export const SIDEBAR_COOKIE = "sidebar_open";
