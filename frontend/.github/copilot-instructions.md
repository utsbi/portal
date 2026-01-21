# SBI Portal Frontend - Copilot Instructions

## Architecture Overview

**Next.js 15 App Router** application for the Sustainable Building Initiative (SBI) portal, deployed on **Vercel**.

### Route Structure
- `app/(static)/` - Legacy public pages (being replaced by v2)
- `app/(dashboard)/` - Protected authenticated routes, guarded by Supabase middleware
- `app/v2/` - **Active redesign** using `components/v2/` and `urbanist` font — this will replace `(static)/`

### Database (Supabase)
Tables: `members` (team data, linked to `auth.users`), `legal_documents` (with vector embeddings)

## Key Conventions

### Styling & UI
- **Mantine UI** primary component library (`@mantine/core`, `@mantine/form`, `@mantine/hooks`)
- **Tailwind CSS v4** for utilities (via `@import "tailwindcss"` in `globals.css`)
- **Biome** for linting/formatting: **tabs** for indentation, **double quotes** for strings
- Fonts in `utils/fonts.ts` — apply via `className` on layout wrappers
- Dark/light theme via `next-themes` + Mantine's `ColorSchemeScript`

### Supabase Auth Pattern
- **Client-side**: `createClient()` from `utils/supabase/client.ts`
- **Server-side**: `createClient()` from `utils/supabase/server.ts` (async, uses cookies)
- **Middleware**: `utils/supabase/middleware.ts` handles session refresh + route protection
- Protected routes: `/dashboard/:path*`, `/auth/:path*`
- Server Actions colocated as `actions.ts` in route folders

### Animation
- Use **`motion/react`** (Motion library), NOT `framer-motion`
- Pattern: define `variants` objects, apply via `initial`, `animate`, `whileHover`
- Example: `components/v2/nav-link.tsx` for staggered letter animations

### 3D & Media
- **React Three Fiber** for interactive 3D (`components/R3FViewer.tsx`)
- **Google Model Viewer** for simple embeds (`components/ModelViewer.jsx`)
- Assets: `public/models/` for 3D, `assets/images/` organized by category

## Commands

```bash
bun install        # Install dependencies (prefer bun)
bun dev            # Dev server with Turbopack
bun build          # Production build
bun lint           # Run linting
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## File Patterns
- **Layouts**: Each route group has its own `layout.tsx`
- **Path alias**: Use `@/` for imports from project root
- **Components**: General in `components/`, v2 redesign in `components/v2/`

## Adding New Routes (Recommended Pattern)
1. Create folder under appropriate route group (`app/v2/` for new pages)
2. Add `page.tsx` as default export
3. Use layout fonts via wrapper: `<div className={urbanist.className}>...</div>`
4. For protected routes, add path to `middleware.ts` matcher
