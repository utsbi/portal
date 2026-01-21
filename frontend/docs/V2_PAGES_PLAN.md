# V2 Pages Design & Implementation Plan

> Reference document for implementing About, Outreach, Projects, and Contact pages in the v2 design system.

## Table of Contents

1. [Design System Reference](#design-system-reference)
2. [Shared Components](#shared-components)
3. [Page Specifications](#page-specifications)
4. [Data Structures](#data-structures)
5. [File Structure](#file-structure)
6. [Implementation Checklist](#implementation-checklist)

---

## Design System Reference

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `sbi-green` | `#22c55e` | Primary accent, CTAs, highlights |
| `sbi-dark` | `#050807` | Main background |
| `sbi-dark-card` | `#0a120c` | Card backgrounds |
| `sbi-dark-border` | `#16301d` | Borders, dividers |
| `sbi-dark-btn` | `#0f1a12` | Button backgrounds |
| `sbi-muted` | `#8a9a93` | Secondary text |
| `sbi-muted-dark` | `#6b7c74` | Tertiary text |

### Typography

- **Primary Font**: Urbanist (applied via `font-urbanist` class)
- **Accent Font**: Old Standard TT (for editorial touches, `font-old-standard`)
- **Headings**: `font-light` or `font-extralight`, `tracking-tight` or `tracking-tighter`
- **Labels**: `text-xs tracking-[0.2em] uppercase text-sbi-green`

### Animation Standards

```typescript
// Standard easing curve
const ease = [0.22, 1, 0.36, 1];

// Stagger delays
const staggerDelay = 0.1; // seconds between items

// Viewport trigger
viewport={{ once: true, margin: "-100px" }}
```

### Section Pattern

```tsx
<section className="relative py-32 md:py-48 overflow-hidden">
  <BlueprintGrid />
  <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
    {/* Section header */}
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      className="mb-20"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-px bg-sbi-green" />
        <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
          Section Label
        </span>
      </div>
      <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
        Section Title
      </h2>
    </motion.div>
    {/* Content */}
  </div>
</section>
```

---

## Shared Components

### 1. PageHero (`components/v2/page-hero.tsx`)

Inner page hero component (smaller than homepage).

**Props:**
```typescript
interface PageHeroProps {
  label: string;        // e.g., "About Us"
  title: string;        // Main headline
  subtitle?: string;    // Optional description
  backgroundImage?: string; // Optional background
}
```

**Features:**
- 50-60vh height
- Animated text reveal (staggered)
- Blueprint grid background
- Gradient fade to content below

### 2. TeamCard (`components/v2/team-card.tsx`)

Profile card for team members.

**Props:**
```typescript
interface TeamCardProps {
  name: string;
  role: string;
  email: string;
  imagePath?: string;
  index: number; // For stagger animation
}
```

**Features:**
- Dark card with hover glow (like StrategyCard)
- Image with brightness overlay
- Email icon link
- Staggered reveal animation

### 3. ProjectCard (`components/v2/project-card.tsx`)

Project showcase card.

**Props:**
```typescript
interface ProjectCardProps {
  project: Project;
  index: number;
  featured?: boolean;
}
```

**Features:**
- Cover image with hover zoom
- Title, description, status badge
- Click to expand details
- Optional 3D model integration

### 4. ContactForm (`components/v2/contact-form.tsx`)

Contact form with dark theme styling.

**Features:**
- Dark inputs with green focus ring
- Floating/animated labels
- Subject dropdown
- Form validation
- Submit with loading state
- Success/error feedback

---

## Page Specifications

### About Page (`/v2/about`)

**Sections:**
1. **Hero** - "About Us" with subtitle
2. **Mission Statement** - Large quote-style text
3. **Our Story** - Two-column: image + text
4. **Partner Universities** - Logo row with hover effects
5. **Leadership Team** - Grid of TeamCards
6. **CTA** - Join the team

**Content Sources:**
- Team data from legacy `app/(static)/about/page.tsx`
- University logos from `assets/images/schools/`

### Outreach Page (`/v2/outreach`)

**Sections:**
1. **Hero** - "Outreach" with subtitle
2. **Mission Statement** - Outreach goals
3. **Stats Row** - Counter components (schools, students, partnerships)
4. **Network Map** - Styled Google Maps embed
5. **CTA** - Partner with us

**Content Sources:**
- Google Maps embed URL from legacy page
- Stats can be placeholder for now

### Projects Page (`/v2/projects`)

**Sections:**
1. **Hero** - "Our Projects" with subtitle
2. **Featured Project** - Full-width showcase
3. **Project Grid** - 2-column grid of ProjectCards
4. **CTA** - Work with us

**Content Sources:**
- Project data from legacy `AccordionProjects.tsx`
- Images from `assets/images/project-one/` and `project-two/`
- 3D models from `public/models/`

**Projects Data:**
```typescript
const projects = [
  {
    slug: "sustainable-family-home",
    title: "Sustainable Family Home Project",
    description: "A modern farmhouse concept designed for sustainable family living...",
    status: "completed",
    featured: true,
    images: { cover: "...", gallery: [...] },
    model3D: null, // Uses R3FViewer
    tags: ["Residential", "Modern Farmhouse", "2BR/2BA"],
  },
  {
    slug: "hobbie-farm",
    title: "Hobbie Farm Project",
    description: "A small, space-efficient housing concept...",
    status: "in-progress",
    featured: false,
    images: { cover: "...", gallery: [...] },
    model3D: "/models/hobbie_farm.glb",
    tags: ["Prototype", "Space-Efficient", "Sustainable"],
  },
];
```

### Contact Page (`/v2/contact`)

**Sections:**
1. **Hero** - "Contact Us" with subtitle
2. **Two-Column Layout**:
   - Left: Contact info, social links, location
   - Right: Contact form
3. **Inquiry Types** - Cards for different contact reasons

**Form Fields:**
- Name (required)
- Email (required)
- Subject (dropdown: General, Project Inquiry, Membership, Partnership)
- Message (required, textarea)

**Contact Info:**
- Primary emails: pedro@utsbi.org, sam@utsbi.org
- Location: UT Austin
- Social: Instagram, LinkedIn

---

## Data Structures

### Team Member
```typescript
interface TeamMember {
  name: string;
  role: string;
  email: string;
  imagePath?: string; // Optional, defaults to /assets/images/people/{firstName}.jpg
}
```

### Project
```typescript
interface Project {
  slug: string;
  title: string;
  description: string;
  longDescription?: string;
  status: "completed" | "in-progress" | "concept";
  featured: boolean;
  images: {
    cover: StaticImageData;
    gallery: StaticImageData[];
  };
  model3D?: string; // Path to .glb file
  tags: string[];
}
```

### Contact Form Data
```typescript
interface ContactFormData {
  name: string;
  email: string;
  subject: "general" | "project" | "membership" | "partnership";
  message: string;
}
```

---

## File Structure

```
app/v2/
├── page.tsx                 # Homepage (existing)
├── layout.tsx               # Layout (existing)
├── about/
│   └── page.tsx             # About page
├── outreach/
│   └── page.tsx             # Outreach page
├── projects/
│   └── page.tsx             # Projects page
├── contact/
│   ├── page.tsx             # Contact page
│   └── actions.ts           # Form server action
└── login/
    └── page.tsx             # (future)

components/v2/
├── background.tsx           # (existing)
├── background-images.tsx    # (existing)
├── blueprint-grid.tsx       # (existing)
├── counter.tsx              # (existing)
├── decorative-element.tsx   # (existing)
├── department-item.tsx      # (existing)
├── footer.tsx               # (existing)
├── loading-screen.tsx       # (existing)
├── magnetic-button.tsx      # (existing)
├── nav-link.tsx             # (existing)
├── navbar.tsx               # (existing)
├── strategy-card.tsx        # (existing)
├── theme-toggle.tsx         # (existing)
│
├── page-hero.tsx            # NEW: Inner page hero
├── team-card.tsx            # NEW: Team member card
├── project-card.tsx         # NEW: Project showcase card
└── section-header.tsx       # NEW: Reusable section header
```

---

## Implementation Checklist

### Phase 1: Shared Components
- [ ] `page-hero.tsx` - Inner page hero
- [ ] `team-card.tsx` - Team member cards
- [ ] `project-card.tsx` - Project cards
- [ ] `section-header.tsx` - Reusable section headers

### Phase 2: Pages (Rough Draft)
- [ ] About page - Basic structure and content
- [ ] Outreach page - Basic structure with map
- [ ] Projects page - Grid layout with project data
- [ ] Contact page - Form with styling

### Phase 3: Polish
- [ ] Add all animations
- [ ] Responsive testing
- [ ] Image optimization
- [ ] Form functionality (server action)
- [ ] Accessibility review

### Phase 4: Integration
- [ ] Update footer links to use /v2/ paths
- [ ] Verify navbar links work
- [ ] Test all page transitions
- [ ] Build verification

---

## Notes

- All pages use `"use client"` directive for motion animations
- Server components can be used for data fetching if needed
- Form submission can be handled via Server Actions
- 3D models are optional - can be added in polish phase
- Mobile responsiveness follows existing v2 patterns

---

*Last updated: January 2026*
