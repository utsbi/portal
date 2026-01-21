# AGENTS.md - SBI Portal Frontend

Guidelines for AI agents working in this Next.js 16 App Router codebase.

## Build & Development Commands

```bash
bun install           # Install dependencies (prefer bun over npm/yarn)
bun dev               # Dev server with Turbopack on localhost:3000
bun build             # Production build
bun lint              # Run Next.js linting
```

**No test framework is currently configured.** There are no test commands available.

## Project Architecture

### Route Structure

- `app/(static)/` - Legacy public pages (being phased out)
- `app/(dashboard)/` - Protected routes requiring Supabase auth
- `app/v2/` - **Active redesign** using modern components from `components/v2/`

### Key Directories

- `components/` - Shared components (legacy)
- `components/v2/` - New design system components (preferred for new work)
- `components/ui/` - shadcn/ui components (Radix-based primitives)
- `components/dashboard/` - Dashboard-specific components
- `lib/supabase/` - Supabase client/server/middleware utilities
- `lib/utils.ts` - Utility functions (`cn` for className merging)
- `assets/` - Static assets (fonts, images, logos)
- `public/` - Public files (3D models)

## Code Style Guidelines

### Formatting (Biome)

- **Indentation**: Spaces (not tabs)
- **Quotes**: Double quotes for strings
- **Semicolons**: Required
- **Trailing commas**: Include in multiline structures

### Imports

```typescript
// 1. External libraries first
import { motion } from "motion/react";
import Link from "next/link";

// 2. Internal aliases using @/
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
```

Always use the `@/` path alias for internal imports (configured in tsconfig.json).

### TypeScript

- **Strict mode enabled** - avoid `any`, use proper types
- Use `interface` for component props
- Use `type` imports: `import type { Metadata } from "next"`
- Non-null assertions (`!`) acceptable for environment variables

```typescript
interface ComponentProps {
  name: string;
  href: string;
  optional?: boolean;
}
```

### Component Patterns

```typescript
// Client components require directive
"use client";

// Server Actions require directive
"use server";

// Default exports for pages/layouts
export default function PageComponent() { ... }

// Named exports for utilities/components
export function Button() { ... }
export { Button, buttonVariants };
```

### Naming Conventions

- **Files**: kebab-case (`nav-link.tsx`, `app-sidebar.tsx`)
- **Components**: PascalCase (`NavLink`, `AppSidebar`)
- **Hooks**: camelCase with `use` prefix (`useMobile`)
- **Utilities**: camelCase (`createClient`, `cn`)
- **CSS classes**: kebab-case, BEM-like for custom classes

## UI Libraries & Styling

### Primary Stack

1. **Mantine UI** (`@mantine/core`) - Primary component library
2. **Tailwind CSS v4** - Utility classes
3. **shadcn/ui** - Radix-based primitives in `components/ui/`

### Tailwind Usage

```typescript
// Use cn() for conditional classes
import { cn } from "@/lib/utils";

className={cn(
  "base-classes",
  condition && "conditional-class",
  className
)}
```

### Custom Theme Colors (defined in globals.css)

- `sbi-green` - Primary accent (#22c55e)
- `sbi-dark` - Dark background (#050807)
- `sbi-dark-card` - Card backgrounds
- `sbi-dark-border` - Border color
- `sbi-muted` - Muted text

### Fonts

Fonts are loaded via CSS variables in `app/layout.tsx` using `next/font/google`. Use Tailwind utility classes:

```typescript
// Available font utilities (defined in globals.css @theme)
<div className="font-urbanist">...</div>   // Primary UI font
<div className="font-old-standard">...</div>  // Serif accent font
```

The `font-urbanist` class is applied to `<body>` by default.

## Animation

**IMPORTANT**: Use `motion/react`, NOT `framer-motion`:

```typescript
import { motion, type Variants } from "motion/react";

const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

<motion.div variants={variants} initial="initial" animate="animate" />
```

## Supabase Authentication

### Client-side

```typescript
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

### Server-side (async)

```typescript
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

### Protected Routes

Routes under `/dashboard/*` require authentication. Middleware in `lib/supabase/middleware.ts` handles redirects.

## Error Handling

- Server Actions: Redirect to `/error` on failure
- Use try/catch blocks with descriptive error handling
- Empty catch blocks acceptable only for non-critical SSR cookie operations

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Adding New Features

### New Page (v2 design)

1. Create folder in `app/v2/your-page/`
2. Add `page.tsx` with default export
3. Apply font: `<div className="font-urbanist">...</div>`

### New Protected Route

1. Create folder in `app/(dashboard)/your-route/`
2. Route is automatically protected by middleware
3. Access user via `supabase.auth.getUser()`

### New Component

1. Place in `components/v2/` for new design system
2. Use `components/ui/` for shadcn primitives
3. Follow existing patterns for props interfaces

## 3D & Media

- **React Three Fiber**: `components/R3FViewer.tsx` for interactive 3D
- **Google Model Viewer**: `components/ModelViewer.jsx` for embeds
- Models stored in `public/models/`
