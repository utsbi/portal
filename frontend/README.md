# SBI Portal - Frontend

A Next.js application for the Sustainable Building Initiative, featuring project showcases, team management, and authenticated dashboards.

## Prerequisites

- [Bun](https://bun.sh) (recommended runtime)
- Node.js 18+ (alternative)

## Getting Started

Install dependencies and start the development server:

```bash
bun install
bun dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
app/
  ├── (static)/          # Public pages
  │   ├── about/
  │   ├── contact/
  │   ├── outreach/
  │   ├── projects/
  │   └── login/         # Authentication
  ├── dashboard/         # Protected pages
  └── layout.tsx         # Root layout
components/              # Reusable React components
lib/
  └── supabase/          # Supabase client configuration
```

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS, Mantine UI
- **3D Rendering:** React Three Fiber
- **Authentication:** Supabase Auth
- **Language:** TypeScript

## Available Scripts

```bash
bun dev          # Start development server
bun build        # Build for production
bun start        # Start production server
bun lint         # Run linter
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
N8N_CONTACT_WEBHOOK_URL=
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```
