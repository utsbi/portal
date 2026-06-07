# AGENTS.md - SBI Portal Frontend

Next.js 16 App Router codebase for the Sustainable Building Initiative portal.

## Build & Development Commands

```bash
bun install           # Install dependencies (prefer bun over npm/yarn)
bun dev               # Dev server with Turbopack on localhost:3000
bun build             # Production build
bun lint              # Run Biome (biome check)
```

**No test framework configured.** No test commands available.

## Project Structure

```
app/
  (static)/            # Public pages (home, about, contact, projects, outreach, login)
  dashboard/           # Protected routes (Supabase auth required)
  api/                 # API routes
  error/               # Error page
  auth/                # Auth flows (password reset, etc.)
components/
  ui/                  # shadcn/ui primitives (Radix-based)
  dashboard/           # Dashboard-specific components
    common/            # Shared dashboard components (sidebar, status bar)
    explore/           # AI portal components
    [feature]/         # Feature-specific (reports, messages, etc.)
lib/
  supabase/            # Client/server helpers + proxy.ts session refresh utility
proxy.ts               # Next.js 16 proxy (formerly middleware) — refreshes Supabase session
  utils.ts             # Utility functions (cn for className merging)
assets/                # Static assets (fonts, images, logos)
public/models/         # 3D models
```

## Code Style (Biome)

- **Indentation**: Spaces (not tabs)
- **Quotes**: Double quotes for strings
- **Semicolons**: Required
- **Trailing commas**: Include in multiline structures

### Imports

```typescript
// 1. External libraries first
import { motion } from "motion/react";
import Link from "next/link";

// 2. Internal using @/ alias
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
```

### TypeScript

- **Strict mode enabled** - avoid `any`, use proper types
- Use `interface` for component props
- Use type imports: `import type { Metadata } from "next"`
- Non-null assertions (`!`) acceptable for env variables

```typescript
interface ComponentProps {
  name: string;
  href: string;
  optional?: boolean;
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `nav-link.tsx` |
| Components | PascalCase | `NavLink` |
| Hooks | camelCase + use prefix | `useMobile` |
| Utilities | camelCase | `createClient` |

### Component Patterns

```typescript
"use client";  // Client components
"use server";  // Server Actions

// Default exports for pages/layouts
export default function PageComponent() { ... }

// Named exports for utilities/components
export function Button() { ... }
```

## UI Stack

1. **Tailwind CSS v4** - Utility classes (primary styling)
2. **shadcn/ui** - Radix primitives in `components/ui/`
3. **Dashboard primitives** - Shared shell/panels/buttons in `components/dashboard/common/ui.tsx`

### Tailwind + cn()

```typescript
import { cn } from "@/lib/utils";

className={cn(
  "base-classes",
  condition && "conditional-class",
  className
)}
```

### Theme Colors (globals.css)

- `sbi-green` (#22c55e), `sbi-dark` (#050807), `sbi-dark-card`, `sbi-dark-border`, `sbi-muted`

### Fonts

- `font-urbanist` - Primary UI font (applied to body by default)
- `font-jetbrains-mono` - Monospace (code, technical UI)

## Animation

**Use `motion/react`, NOT `framer-motion`:**

```typescript
import { motion, type Variants } from "motion/react";

const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

<motion.div variants={variants} initial="initial" animate="animate" />
```

## Supabase Auth

```typescript
// Client-side
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// Server-side (async)
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
```

### Server Actions

Colocate as `actions.ts` in route folders:

```typescript
"use server";
import { createClient } from "@/lib/supabase/server";

export async function myAction(formData: FormData) {
  const supabase = await createClient();
  // ... action logic
}
```

Routes under `dashboard/` are auto-protected: `proxy.ts` (Next.js 16's renamed middleware) refreshes the Supabase session via `lib/supabase/middleware.ts` on matched routes (`/dashboard/:path*`, `/auth/:path*`, `/login`) and sets security headers.

## Error Handling

- Server Actions: Redirect to `/error` on failure
- Use try/catch with descriptive handling
- Empty catch blocks OK only for non-critical SSR cookie operations

## API Routes

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}
```

## Environment Variables

Copy `.env.example` to `.env.local` for local development. All keys below are required unless noted.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
SUPABASE_SECRET_KEY=
TURNSTILE_SECRET_KEY=
N8N_CONTACT_WEBHOOK_URL=
DISCORD_FORM_WEBHOOK_URL=
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_*` | Client + server | Supabase project URL and anon/publishable key |
| `SUPABASE_SECRET_KEY` | Server only | Service role key for admin APIs, Google OAuth token storage, seed scripts |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Client / server | Cloudflare Turnstile (contact form) |
| `N8N_CONTACT_WEBHOOK_URL` | Server only | n8n webhook for contact form submissions |
| `DISCORD_FORM_WEBHOOK_URL` | Server only | Optional. Discord webhook notified on each questionnaire submission (no-op if unset) |
| `BASIC_AUTH_*` | Server only | HTTP basic auth for protected routes |
| `GOOGLE_*` | Server only | Google Calendar OAuth for dashboard contact/calendar APIs |

## Adding New Features

| Task | Location | Notes |
|------|----------|-------|
| New public page | `app/(static)/your-page/page.tsx` | Add layout.tsx if needed |
| Protected route | `app/dashboard/your-route/` | Auto-protected via `proxy.ts` |
| Dashboard component | `components/dashboard/` | Group by feature |
| shadcn primitive | `components/ui/` | Radix-based |
| API endpoint | `app/api/your-endpoint/route.ts` | Named exports (GET, POST) |
