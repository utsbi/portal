// Empty stub aliased over the `server-only` / `client-only` marker packages in
// the Vitest config. Those packages intentionally throw on import outside the
// React Server/Client boundary, which breaks unit tests that import server
// modules (e.g. lib/crypto/tokens.ts, lib/auth/guards.ts). Aliasing them to this
// no-op lets the modules under test load in the jsdom test environment.
export {};
