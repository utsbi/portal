# SBI Portal V2 Design System

A comprehensive design guide for the Sustainable Building Initiative portal redesign. This document captures the visual language, component patterns, and animation principles derived from the v2 index page.

---

## Design Philosophy

The v2 design follows an **architectural blueprint aesthetic** — minimal, precise, and professional. Key principles:

- **Restraint**: Dark backgrounds with strategic accent usage
- **Precision**: Clean geometry, subtle grid patterns, technical markers
- **Motion**: Purposeful animations that reveal and guide
- **Typography**: Ultra-light weights with generous tracking

---

## Color Palette

### Core Colors

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

### Font Family

**Urbanist** — Primary typeface for all v2 pages

```tsx
import { urbanist } from "@/utils/fonts";
<div className={urbanist.className}>...</div>
```

### Type Scale

| Element | Size | Weight | Tracking | Notes |
|---------|------|--------|----------|-------|
| Hero H1 | `text-6xl` to `text-9xl` | `font-extralight` | `tracking-tighter` | Responsive scaling |
| Section H2 | `text-4xl` to `text-6xl` | `font-light` | `tracking-tight` | |
| Card Title | `text-2xl` to `text-3xl` | `font-light` | `tracking-tight` | |
| Body | `text-lg` to `text-xl` | `font-light` | — | `leading-relaxed` |
| Labels | `text-xs` | — | `tracking-[0.2em]` to `tracking-[0.3em]` | `uppercase` |
| Stats | `text-5xl` to `text-7xl` | `font-thin` | `tracking-tighter` | `tabular-nums` |

### First Letter Accent

The "SBI" pattern emphasizes first letters in green:

```tsx
<span className="text-sbi-green">S</span>ustainable
<span className="text-sbi-green">B</span>uilding
<span className="text-sbi-green">I</span>nitiative
```

---

## Components

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

### Cards (StrategyCard)

- Background: `bg-sbi-dark-card`
- Border: `border border-sbi-dark-border`
- Hover: `hover:border-sbi-green/30`
- Padding: `p-8 md:p-10`
- Mouse-following glow effect on hover
- Animated bottom line reveal

### Buttons (MagneticButton)

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
- Magnetic follow on mouse movement (±15% offset)
- Arrow icon with diagonal translate on hover
- Spring physics: `stiffness: 400, damping: 25`

### Accordion (DepartmentItem)

- Full-width with bottom border
- Slide-right on hover (`whileHover={{ x: 8 }}`)
- Plus icon rotates 45° when expanded
- AnimatePresence for smooth expand/collapse

### Counter

Animated number counting with:
- `useInView` trigger (once, -100px margin)
- 2.5s duration with custom easing
- Locale-formatted output

---

## Background Patterns

### Blueprint Grid

SVG-based architectural grid with two scales:

```tsx
<BlueprintGrid />
```

- Small grid: 50px cells, 0.7px stroke
- Large grid: 250px cells, 1.2px stroke
- Opacity: `opacity-[0.05]`
- Non-interactive: `pointer-events-none`

### Hero Background

Image grid with staggered reveal animation:
- 9x5 grid layout
- Images animate in with `staggerChildren: 0.07`
- Scale and opacity transitions
- Theme-aware (switches tower image for dark/light)

---

## Animation Patterns

### Easing

Standard easing curve across all animations:

```ts
ease: [0.22, 1, 0.36, 1]  // Custom cubic-bezier
```

### Staggered Reveal

For lists and grids:

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
  animate={showContent ? { y: 0 } : {}}
  transition={{ delay: 0.1, duration: 1, ease: [0.22, 1, 0.36, 1] }}
>
```

### Line Draw

Horizontal lines that scale from 0:

```tsx
<motion.div
  initial={{ scaleX: 0 }}
  whileInView={{ scaleX: 1 }}
  className="w-24 h-px bg-sbi-green origin-left"
/>
```

### Parallax

Hero section uses scroll-driven transforms:

```tsx
const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
```

---

## Loading Screen

Three-phase loading experience:

1. **Loading** — Progress bar with pulsing dot
2. **Revealing** — Letters scale pulse, glow effect
3. **Done** — Fade out

Features:
- SBI letters with staggered entrance
- Corner accent animations
- Blueprint grid background
- Progress percentage display

---

## Navigation

### Desktop

- Fixed position, transparent → blur on scroll
- Hide on scroll down, show on scroll up
- Logo: "SBI" with green S, underline animation on hover
- Links: Letter-by-letter stagger animation on hover

### Mobile

- Animated hamburger icon (lines rotate to X)
- Full-screen overlay with backdrop blur
- Staggered menu item entrance
- Decorative vertical line and bottom SBI marker

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
<line stroke="url(#gradient)" /> // Fades from transparent → green → transparent
```

### Rotating Decorative (DecorativeElement)

Interactive geometric element:
- Three nested rotating squares
- Central pulsing dot
- Expanding ring effect on hover
- 30s infinite rotation

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

When creating new v2 pages/sections:

- [ ] Apply `urbanist.className` to root wrapper
- [ ] Use `bg-sbi-dark` as page background
- [ ] Include `<BlueprintGrid />` for visual texture
- [ ] Add section labels with green line + uppercase text
- [ ] Use `motion/react` for animations (NOT framer-motion)
- [ ] Apply standard easing `[0.22, 1, 0.36, 1]`
- [ ] Set `viewport={{ once: true }}` on scroll animations
- [ ] Maintain color hierarchy (white → green → muted)
- [ ] Use `tracking-[0.2em]` or `tracking-[0.3em]` on labels
- [ ] Add `select-none` to decorative/hero content
