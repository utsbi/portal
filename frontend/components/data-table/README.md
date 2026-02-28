# DataTable Component Suite

A fully-featured, accessible data table component for Next.js 16 with TypeScript, Tailwind CSS v4, and SBI dark theme. Includes search, filtering, sorting, pagination, row selection, expandable rows, column visibility toggle, and loading states.

## Installation

The component is located at `frontend/components/data-table/` and exported via barrel export.

```tsx
import { DataTable, type ColumnDef, StatusPill, type FilterDef } from "@/components/data-table";
```

## Quick Start

### Minimal Example

```tsx
import { DataTable, type ColumnDef } from "@/components/data-table";

interface User {
  id: number;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
];

const columns: ColumnDef<User>[] = [
  { accessor: "name", header: "Name", sortable: true },
  { accessor: "email", header: "Email" },
];

export function UserTable() {
  return <DataTable data={users} columns={columns} rowKey="id" />;
}
```

### Full-Featured Example

```tsx
import { DataTable, type ColumnDef, StatusPill, type FilterDef } from "@/components/data-table";

interface Task {
  id: number;
  title: string;
  status: string;
  priority: "low" | "medium" | "high";
  assignee: string;
  dueDate: string;
}

const tasks: Task[] = [
  { id: 1, title: "Design landing page", status: "In Progress", priority: "high", assignee: "Alice", dueDate: "2025-03-15" },
  { id: 2, title: "Setup database", status: "Done", priority: "high", assignee: "Bob", dueDate: "2025-03-10" },
];

const columns: ColumnDef<Task>[] = [
  { accessor: "title", header: "Title", sortable: true, primaryColumn: true },
  {
    accessor: "status",
    header: "Status",
    render: (value) => <StatusPill status={value} />,
  },
  {
    accessor: "priority",
    header: "Priority",
    render: (value) => <span className="capitalize">{value}</span>,
  },
  { accessor: "assignee", header: "Assigned To", sortable: true },
  { accessor: "dueDate", header: "Due Date", sortable: true },
];

const filters: FilterDef[] = [
  {
    key: "priority",
    label: "Priority",
    options: [
      { value: "", label: "All Priorities" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    defaultValue: "",
  },
];

export function TaskTable() {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  return (
    <DataTable
      data={tasks}
      columns={columns}
      rowKey="id"
      title="Tasks"
      description="View and manage all project tasks"
      searchable
      searchKeys={["title", "assignee"]}
      filters={filters}
      toggleFilter={{
        key: "status",
        value: "Done",
        label: "Hide Completed",
      }}
      pageSize={10}
      selectable
      selectedRows={selectedRows}
      onSelectionChange={setSelectedRows}
      columnToggle
      primaryColumn="title"
      onRowClick={(row) => console.log("Clicked:", row)}
    />
  );
}
```

## API Reference

### DataTable Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| **data** | `T[]` | — | Array of data rows to display (required) |
| **columns** | `ColumnDef<T>[]` | — | Column definitions (required) |
| **rowKey** | `keyof T \| string` | Index | Unique identifier for each row. Use a stable property like `id`. |
| **title** | `string` | — | Page title shown above the table |
| **description** | `string` | — | Subtitle shown below title |
| **searchable** | `boolean` | `false` | Enable search bar |
| **searchKeys** | `(keyof T)[]` | `[]` | Keys to search across (only used if `searchable=true`) |
| **searchPlaceholder** | `string` | "Search..." | Placeholder text for search input |
| **filters** | `FilterDef[]` | `[]` | Dropdown filter definitions |
| **toggleFilter** | `{ key, value, label }` | — | Single toggle filter (e.g., "Hide Done") |
| **pageSize** | `number` | `10` | Items per page. Set to `0` to disable pagination. |
| **onRowClick** | `(row: T) => void` | — | Callback when a row is clicked |
| **primaryColumn** | `keyof T \| string` | — | Column accessor that highlights green on hover. Only works with `onRowClick`. |
| **selectable** | `boolean` | `false` | Enable row selection checkboxes |
| **selectedRows** | `Set<string>` | Internal state | Controlled selection state |
| **onSelectionChange** | `(rows: Set<string>) => void` | — | Callback when selection changes |
| **renderExpandedRow** | `(row: T) => ReactNode` | — | Render function for expanded row content. Enables expandable rows. |
| **isRowExpandable** | `(row: T) => boolean` | All rows | Predicate to determine which rows can expand |
| **loading** | `boolean` | `false` | Show loading skeleton instead of data |
| **skeletonRows** | `number` | `pageSize` or `5` | Number of skeleton rows to display when loading |
| **columnToggle** | `boolean` | `false` | Enable column visibility toggle dropdown |
| **defaultHiddenColumns** | `string[]` | `[]` | Column accessors to hide by default |

### ColumnDef<T> Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| **accessor** | `keyof T \| string` | — | Data key. Supports dot-paths like `"user.name"` (required) |
| **header** | `string` | — | Column header label (required) |
| **sortable** | `boolean` | `false` | Enable click-to-sort on this column |
| **render** | `(value, row) => ReactNode` | — | Custom render function. Receives cell value and full row. |
| **width** | `string` | — | Tailwind width class (e.g., `"w-24"`, `"w-1/3"`) |
| **align** | `"left" \| "right" \| "center"` | `"left"` | Text alignment |
| **className** | `string` | — | Extra Tailwind classes on the cell |
| **sortFn** | `(a: T, b: T) => number` | Built-in | Custom sort function. Return negative/0/positive. |

### FilterDef Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| **key** | `string` | — | Data key to filter on (required) |
| **label** | `string` | — | Filter label shown in UI (required) |
| **options** | `Option[]` | — | Array of options or option groups (required) |
| **defaultValue** | `string` | — | Default selected value (required) |
| **width** | `string` | `"w-36"` | Tailwind width class for dropdown button |

**Option Structure (flat):**
```ts
{ value: string; label: string }
```

**Option Structure (grouped):**
```ts
{ label: string; options: { value: string; label: string }[] }
```

### StatusPill Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| **status** | `string` | — | Status string (auto-normalized) |
| **className** | `string` | — | Extra Tailwind classes |

**Supported Status Values:**
- `"done"`, `"complete"`, `"completed"` → green checkmark
- `"in-progress"`, `"in-process"` → blue clock
- `"pending"` → amber warning
- `"denied"`, `"rejected"` → red prohibition

Status strings are case-insensitive and normalized automatically.

## Features

### Search

Client-side full-text search across specified keys. Resets pagination to page 1.

```tsx
<DataTable
  searchable
  searchKeys={["title", "description"]}
  searchPlaceholder="Search by title or description..."
/>
```

### Filtering

Two types of filters:

**Dropdown Filters** — Multi-value filters with searchable dropdown:
```tsx
const filters: FilterDef[] = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "", label: "All Statuses" },
      { value: "done", label: "Done" },
      { value: "pending", label: "Pending" },
    ],
    defaultValue: "",
  },
];

<DataTable filters={filters} />
```

**Toggle Filter** — Boolean exclude filter (e.g., "Hide Done"):
```tsx
<DataTable
  toggleFilter={{
    key: "status",
    value: "Done",
    label: "Hide Completed",
  }}
/>
```

### Sorting

Per-column sorting with auto-detection of dates, numbers, and strings.

```tsx
const columns: ColumnDef<Task>[] = [
  { accessor: "createdAt", header: "Created", sortable: true },
  { accessor: "title", header: "Title", sortable: true },
  {
    accessor: "priority",
    header: "Priority",
    sortable: true,
    sortFn: (a, b) => {
      const order = { high: 3, medium: 2, low: 1 };
      return (order[a.priority] || 0) - (order[b.priority] || 0);
    },
  },
];
```

### Pagination

Auto-hides pagination controls when all results fit on one page.

```tsx
<DataTable pageSize={25} />  // 25 items per page
<DataTable pageSize={0} />   // Disable pagination (show all)
```

### Row Selection

Uncontrolled or controlled selection state:

**Uncontrolled:**
```tsx
<DataTable selectable />
```

**Controlled:**
```tsx
const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

<DataTable
  selectable
  selectedRows={selectedRows}
  onSelectionChange={setSelectedRows}
/>
```

### Expandable Rows

Show detailed content below each row:

```tsx
<DataTable
  renderExpandedRow={(row) => (
    <div className="space-y-2">
      <p><strong>Description:</strong> {row.description}</p>
      <p><strong>Notes:</strong> {row.notes}</p>
    </div>
  )}
  isRowExpandable={(row) => !!row.description}
/>
```

### Column Visibility

Enable users to toggle column visibility:

```tsx
<DataTable
  columnToggle
  defaultHiddenColumns={["internalNotes", "metadata"]}
/>
```

### Loading State

Show animated skeleton rows while loading:

```tsx
const [loading, setLoading] = useState(false);

<DataTable
  loading={loading}
  skeletonRows={8}
/>
```

### Row Click Handler

Navigate or perform actions on row click:

```tsx
<DataTable
  onRowClick={(row) => router.push(`/tasks/${row.id}`)}
  primaryColumn="title"  // Highlights primary column on hover
/>
```

## Dot-Path Accessors

Access nested properties using dot notation:

```tsx
interface User {
  id: number;
  profile: {
    name: string;
    email: string;
  };
}

const columns: ColumnDef<User>[] = [
  { accessor: "profile.name", header: "Name" },
  { accessor: "profile.email", header: "Email" },
];
```

## Styling

The component uses SBI dark theme tokens:

| Token | Usage |
|-------|-------|
| `sbi-green` | Primary accent color |
| `sbi-dark` | Background base |
| `sbi-dark-card` | Card/elevated surfaces |
| `sbi-dark-btn` | Button backgrounds |
| `sbi-dark-border` | Border color |
| `sbi-muted` | Secondary text |
| `sbi-muted-dark` | Tertiary text |

All spacing uses `rounded-lg` for consistency. Rows are compact at `py-2.5` headers and `py-3` body cells.

## Migration from Deprecated Props

The `hideCompleted*` props are deprecated. Use `toggleFilter` instead:

**Old:**
```tsx
<DataTable
  hideCompletedToggle
  hideCompletedKey="status"
  hideCompletedValue="Done"
  hideCompletedLabel="Hide Completed"
/>
```

**New:**
```tsx
<DataTable
  toggleFilter={{
    key: "status",
    value: "Done",
    label: "Hide Completed",
  }}
/>
```

The component automatically converts deprecated props to `toggleFilter` for backward compatibility.

## Internal Components

These components are for internal use only and should not be imported directly:

- `DataTableFilters` — Renders search, filters, and column toggle controls
- `DataTablePagination` — Renders pagination controls
- `SearchableDropdown` — Internal dropdown used by filters

## Dependencies

- `@phosphor-icons/react` — Icon library (CaretUpIcon, CaretDownIcon, ColumnsIcon, etc.)
- `motion/react` — Framer Motion for row animations
- `shadcn/ui` — Base primitives: Table, Checkbox, Skeleton, Label

## Notes

- All row keys are converted to strings internally. Use a stable unique value (e.g., `id`).
- Search is case-insensitive.
- Filters and sorting reset pagination to page 1.
- When `onRowClick` and `renderExpandedRow` are both present, row click triggers the handler instead of expanding.
- When `renderExpandedRow` is present without `onRowClick`, row click expands the row.
- Column visibility state is local to the component instance. To persist across sessions, manage `defaultHiddenColumns` in parent state.
