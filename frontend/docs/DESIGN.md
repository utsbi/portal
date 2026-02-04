# SBI Portal Design System

Design guide for the Sustainable Building Initiative public website. Captures the visual language, component patterns, and animation principles.

---

## Design Philosophy

The design follows an **architectural blueprint aesthetic** — minimal, precise, and professional.

- **Restraint**: Dark backgrounds with strategic green accent usage
- **Precision**: Clean geometry, subtle grid patterns, technical markers
- **Motion**: Purposeful animations that reveal and guide
- **Typography**: Ultra-light weights with generous tracking

---

## Color Palette

### Core Colors (defined in globals.css)

| Token | Hex | Usage |
|-------|-----|-------|
| `sbi-green` | `#22c55e` | Primary accent, CTAs, highlights |
| `sbi-dark` | `#050807` | Page backgrounds |
| `sbi-dark-card` | `#0a120c` | Card/section backgrounds |
| `sbi-dark-border` | `#16301d` | Borders, dividers |
| `sbi-dark-btn` | `#0f1a12` | Button backgrounds |
| `sbi-muted` | `#8a9a93` | Body text |
| `sbi-muted-dark` | `#6b7c74` | Secondary/descriptive text |

### Color Hierarchy

1. **White** (`#ffffff`) — Headlines, emphasized text
2. **sbi-green** — Interactive elements, accents, first letters
3. **sbi-muted** — Body copy, navigation
4. **sbi-muted-dark** — Descriptions, metadata
5. **sbi-dark-border** — Structural lines, separators

### Gradient Patterns

```css
/* Hero fade to background */
bg-linear-to-b from-transparent via-transparent to-sbi-dark

/* CTA overlay */
bg-linear-to-t from-sbi-dark via-sbi-dark/80 to-sbi-dark/60
```

---

## Typography

### Font Families

- **Urbanist** — Primary UI font (applied to `<body>` via `font-urbanist`)
- **Old Standard TT** — Serif accent font (`font-old-standard`)

### Type Scale

| Element | Size | Weight | Tracking | Notes |
|---------|------|--------|----------|-------|
| Hero H1 | `text-6xl` to `text-9xl` | `font-extralight` | `tracking-tighter` | Responsive scaling |
| Section H2 | `text-4xl` to `text-6xl` | `font-light` | `tracking-tight` | |
| Card Title | `text-2xl` to `text-3xl` | `font-light` | `tracking-tight` | |
| Body | `text-lg` to `text-xl` | `font-light` | — | `leading-relaxed` |
| Labels | `text-xs` | — | `tracking-[0.2em]` to `tracking-[0.3em]` | `uppercase` |
| Stats | `text-5xl` to `text-7xl` | `font-thin` | `tracking-tighter` | `tabular-nums` |

### First Letter Accent (SBI Pattern)

```tsx
<span className="text-sbi-green">S</span>ustainable
<span className="text-sbi-green">B</span>uilding
<span className="text-sbi-green">I</span>nitiative
```

---

## Components

### PageHero

Reusable hero for interior pages with label, title, subtitle:

```tsx
<PageHero
  label="About Us"
  title="Who We Are"
  subtitle="A student-powered initiative..."
/>
```

Features: BlueprintGrid background, diagonal accent lines, animated line draws.

### Section Labels

Consistent pattern for section headers:

```tsx
<div className="flex items-center gap-4 mb-6">
  <div className="w-16 h-px bg-sbi-green" />
  <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
    Section Label
  </span>
</div>
```

### Badge/Tag

Bordered inline element:

```tsx
<span className="inline-block px-4 py-2 text-xs tracking-[0.3em] uppercase text-sbi-green border border-sbi-green/30">
  Tag Text
</span>
```

### Cards (StrategyCard, ProjectCard, TeamCard)

- Background: `bg-sbi-dark-card`
- Border: `border border-sbi-dark-border`
- Hover: `hover:border-sbi-green/30`
- Padding: `p-8 md:p-10`
- Animated bottom line reveal on scroll

### MagneticButton

Two variants with magnetic hover effect:

**Primary:**
```tsx
bg-sbi-dark-btn text-sbi-green border border-sbi-green/30
hover:bg-sbi-green hover:text-sbi-dark-btn
```

**Secondary:**
```tsx
bg-transparent text-white border border-white/30
hover:bg-white hover:text-sbi-dark-btn
```

Features:
- Magnetic follow on mouse movement (15% offset)
- Arrow icon with diagonal translate on hover
- Spring physics: `stiffness: 400, damping: 25`

### Accordion (DepartmentItem)

- Full-width with bottom border
- Slide-right on hover (`whileHover={{ x: 8 }}`)
- Plus icon rotates 45deg when expanded
- AnimatePresence for smooth expand/collapse

### Counter

Animated number counting:
- `useInView` trigger (once, -100px margin)
- 2.5s duration with custom easing
- Locale-formatted output

---

## Background Patterns

### BlueprintGrid

SVG-based architectural grid:

```tsx
<BlueprintGrid />
```

- Small grid: 50px cells, 0.7px stroke
- Large grid: 250px cells, 1.2px stroke
- Opacity: `opacity-[0.05]`
- Non-interactive: `pointer-events-none`

### Hero Background (Home page)

Image grid with staggered reveal animation:
- 9x5 grid layout
- `staggerChildren: 0.07`
- Scale and opacity transitions

---

## Animation Patterns

### Standard Easing

```ts
ease: [0.22, 1, 0.36, 1]  // Custom cubic-bezier used everywhere
```

### Staggered Reveal

```ts
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
};
```

### Scroll-Triggered

```tsx
<motion.div
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
  viewport={{ once: true, margin: "-100px" }}
>
```

### Hero Text Slide-Up

```tsx
<motion.h1
  initial={{ y: "100%" }}
  animate={{ y: 0 }}
  transition={{ delay: 0.1, duration: 1, ease: [0.22, 1, 0.36, 1] }}
>
```

### Line Draw

```tsx
<motion.div
  initial={{ scaleX: 0 }}
  whileInView={{ scaleX: 1 }}
  className="w-24 h-px bg-sbi-green origin-left"
/>
```

### Parallax (Home Hero)

```tsx
const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
```

---

## Navigation

### Desktop Navbar

- Fixed position, transparent -> blur on scroll
- Hide on scroll down, show on scroll up
- Logo: "SBI" with green S, underline animation on hover
- Links: Letter-by-letter stagger animation on hover (NavLink component)

### Mobile Menu

- Animated hamburger icon (lines rotate to X)
- Full-screen overlay with backdrop blur
- Staggered menu item entrance
- Decorative vertical line and bottom SBI marker

---

## Footer

- Grid background pattern (opacity 2%)
- Diagonal accent SVG lines
- Three-column link layout: Navigate, Resources, Connect
- Technical corner markers at bottom border
- Animated status indicator ("Building Sustainably")

---

## Decorative Elements

### Technical Markers

Small corner squares at section boundaries:

```tsx
<div className="w-3 h-3 -translate-y-1/2 border border-sbi-dark-border bg-sbi-dark">
  <div className="absolute inset-1 bg-sbi-green/20" />
</div>
```

### Diagonal Accent Lines

SVG lines with gradient fade:

```tsx
<line stroke="url(#gradient)" /> // Fades: transparent -> green -> transparent
```

### DecorativeElement

Interactive geometric element on home page:
- Three nested rotating squares
- Central pulsing dot
- Expanding ring effect on hover
- 30s infinite rotation

---

## Page Structure

### Home (`/`)

1. **Hero** - Full viewport, parallax background, SBI title reveal, CTA buttons
2. **Mission** - Centered text block with badge
3. **Stats** - Three-column with animated counters
4. **Strategy** - Three StrategyCards (Identify, Architect, Execute)
5. **Departments** - Two-column: text + accordion list
6. **CTA** - Background image with gradient overlay

### About (`/about`)

1. PageHero
2. Story section (centered text)
3. Vision section (image + text two-column)
4. Partner Universities (logo row)
5. Team grid (TeamCards)
6. Join CTA

### Projects (`/projects`)

1. PageHero
2. Featured project (large ProjectCard)
3. All projects grid
4. Collaboration CTA
5. Image gallery modal (AnimatePresence)

### Outreach (`/outreach`)

1. PageHero
2. Mission text
3. Stats row
4. NetworkGlobe (3D React Three Fiber)
5. Partner categories (Schools, Organizations, Sponsors)
6. Collaboration CTA

### Contact (`/contact`)

1. PageHero
2. Inquiry types row
3. Two-column: contact info + form
4. Turnstile bot protection

---

## Responsive Breakpoints

Standard Tailwind breakpoints:

| Prefix | Min Width |
|--------|-----------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |

Common patterns:
- `text-6xl md:text-8xl lg:text-9xl` — Scaling headlines
- `px-8 md:px-16 lg:px-24` — Horizontal padding
- `py-32 md:py-48` — Vertical section spacing
- `grid-cols-1 md:grid-cols-3` — Responsive grids

---

## Implementation Checklist

When creating new pages/sections:

- [ ] Use `bg-sbi-dark` as page background
- [ ] Include `<BlueprintGrid />` for visual texture
- [ ] Add section labels with green line + uppercase text
- [ ] Use `motion/react` for animations (NOT framer-motion)
- [ ] Apply standard easing `[0.22, 1, 0.36, 1]`
- [ ] Set `viewport={{ once: true }}` on scroll animations
- [ ] Maintain color hierarchy (white -> green -> muted)
- [ ] Use `tracking-[0.2em]` or `tracking-[0.3em]` on labels
- [ ] Add `select-none` to decorative/hero content
