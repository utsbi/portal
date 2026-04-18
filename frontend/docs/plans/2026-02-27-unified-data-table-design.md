# Unified DataTable Component Design

**Date:** 2026-02-27
**Branch:** `feat/frontend/unified-data-table`
**Status:** Approved

## Context

Three branches (`questionnaire`, `feat/frontend/reports`, `feat/frontend/requests`) each implement their own table/list components with different patterns. This design unifies them into a single reusable `DataTable` component.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Composable `<Table>` primitives (Design A) | Semantic HTML for accessibility, composable via className |
| Column API | Generic config array with `ColumnDef<T>` | Maximum reuse — any page passes column definitions |
| Sorting | ChevronUp/Down (single arrow) with green active | Clearer direction indicator than ArrowUpDown |
| Filtering | Search bar + SearchableDropdown + hide-done checkbox | Best of B + A |
| Status display | B-style badge pills with icon + color tint | Most scannable, richest visual info |
| Pagination | C-style prev/next with counts | Clean, proven pattern |
| Row hover | B-style: subtle bg tint + primary column turns green | Elegant feedback |
| Header style | C-style: uppercase tracking, green-tinted bg | Professional, scannable |
| Animations | Framer Motion: row stagger, sort transition, filter fade | Polished feel without excess |
| Alternating rows | Odd/even color differentiation | Improves readability on wide tables |

## Component API

```tsx
<DataTable<T>
  data={T[]}
  columns={ColumnDef<T>[]}
  searchable?: boolean
  searchKeys?: (keyof T)[]
  filters?: FilterDef[]
  hideCompletedToggle?: boolean
  hideCompletedKey?: keyof T
  hideCompletedValue?: string
  pageSize?: number           // default 10, 0 = no pagination
  onRowClick?: (row: T) => void
  title?: string
  description?: string
/>
```

## File Structure

```
components/ui/data-table.tsx            — Main generic component
components/ui/data-table-pagination.tsx — Pagination subcomponent
components/ui/data-table-filters.tsx    — Filter bar subcomponent
components/ui/status-pill.tsx           — Reusable status badge
```

## Visual Layout

```
┌──────────────────────────────────────────────────┐
│ Title (left)                   [Search box] (right) │
│ Description                                         │
├──────────────────────────────────────────────────┤
│ [Hide Done ☑]  [Status ▾]  [Team ▾]  [Time ▾]      │
├──────────────────────────────────────────────────┤
│ HEADER ROW (green-tinted bg, uppercase)  ▲/▼ sort   │
├──────────────────────────────────────────────────┤
│ Row 1 (darker)                                      │
│ Row 2 (lighter)                                     │
│ Row 3 (darker)                                      │
├──────────────────────────────────────────────────┤
│ Showing 1-10 of 24         Page 1 of 3  [◀] [▶]    │
└──────────────────────────────────────────────────┘
```

## Style Tokens

| Element | Classes |
|---------|---------|
| Container | `rounded-xl border border-sbi-dark-border bg-sbi-dark-card overflow-hidden` |
| Header row | `bg-sbi-green/8 uppercase tracking-[0.15em] text-xs text-sbi-muted` |
| Odd rows | `bg-sbi-dark-card` |
| Even rows | `bg-white/[0.02]` |
| Row hover | `hover:bg-white/[0.04]` + primary text `group-hover:text-sbi-green` |
| Sort active | `text-sbi-green` ChevronUp or ChevronDown |
| Sort inactive | `text-sbi-muted-dark/40` ChevronDown |
| Pill badges | `bg-*/10 border-*/20 text-* rounded-full px-2.5 py-1` |
| Date cells | Monospace, `Intl.DateTimeFormat` "Feb 24, 2026" |
