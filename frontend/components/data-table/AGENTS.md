# DataTable — Agent Reference

Architecture guide for AI agents. For usage examples, see README.md. For implementation, read the source.

## Public API

Only import from `@/components/data-table` (barrel in `index.ts`):

- `DataTable<T>` — main component
- `ColumnDef<T>`, `DataTableProps<T>`, `FilterDef` — types
- `StatusPill`, `StatusVariant` — status badge

Everything else is internal.

## Component Hierarchy

```
DataTable<T>  (data-table.tsx)
├── DataTableFilters  (data-table-filters.tsx)
│   ├── SearchableDropdown × N  (searchable-dropdown.tsx)
│   └── columnToggleSlot  (rendered by DataTable, passed as ReactNode)
├── Table / TableHeader / TableBody / TableRow / TableCell  (shadcn)
├── Checkbox  (shadcn, for row selection)
├── Skeleton  (shadcn, for loading state)
└── DataTablePagination  (data-table-pagination.tsx)
```

## Data Flow

```
data → filteredData (toggle + search + dropdowns, AND logic) → sortedData → paginatedData → render
```

All three stages are `useMemo`-wrapped. Changing any filter/search/sort resets `currentPage` to 1.

## Key Patterns

- **Generic `T`**: flows through `data`, `columns[].accessor`, `toggleFilter.key`, `render(value, row)`, `onRowClick(row)`
- **Dot-path accessors**: `"user.name"` works via `getNestedValue()` helper
- **Controlled vs uncontrolled selection**: if `selectedRows` + `onSelectionChange` are passed, selection is controlled; otherwise internal `Set<string>`
- **Deprecated props**: `hideCompletedToggle/Key/Value/Label` resolve internally to `toggleFilter` via `resolvedToggle`

## Styling Rules

- Phosphor Icons with `Icon` suffix (`CaretDownIcon`, not `CaretDown`)
- `rounded-lg` everywhere, `border-white/[0.06]` container, `border-white/[0.04]` dividers
- No `font-mono` — use `tabular-nums` for number alignment
- SBI dark theme tokens: `sbi-green`, `sbi-dark`, `sbi-dark-card`, `sbi-dark-border`, `sbi-muted`, `sbi-muted-dark`
- Animations via `motion/react` (Framer Motion)
