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
  ├── (static)/          # Public pages (no auth required)
  │   ├── about/
  │   ├── contact/
  │   ├── outreach/
  │   └── projects/
  ├── dashboard/         # Protected pages (auth required)
  ├── login/             # Authentication
  └── layout.tsx         # Root layout
components/              # Reusable React components
utils/
  └── supabase/          # Supabase client configuration
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```
