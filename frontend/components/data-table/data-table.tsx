"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { CaretUpIcon, CaretDownIcon, ColumnsIcon } from "@phosphor-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DataTableFilters,
  type FilterDef,
} from "@/components/data-table/data-table-filters";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  /** Key to access data, or a dot-path string */
  accessor: keyof T | string;
  /** Column header label */
  header: string;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Custom render function for the cell */
  render?: (value: any, row: T) => React.ReactNode;
  /** Tailwind width class e.g. "w-24" */
  width?: string;
  /** Text alignment */
  align?: "left" | "right" | "center";
  /** Extra classes on td */
  className?: string;
  /** Custom sort comparator. Return negative, 0, or positive. */
  sortFn?: (a: T, b: T) => number;
}

export interface DataTableProps<T> {
  /** Data array */
  data: T[];
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Unique key accessor for each row */
  rowKey?: keyof T | string;

  // ── Layout ──
  /** Page title shown top-left */
  title?: string;
  /** Description text below title */
  description?: string;

  // ── Search ──
  /** Enable search bar */
  searchable?: boolean;
  /** Which keys to search across */
  searchKeys?: (keyof T)[];
  /** Placeholder for search input */
  searchPlaceholder?: string;

  // ── Filters ──
  /** Dropdown filter definitions */
  filters?: FilterDef[];
  /** Generic toggle filter (replaces hideCompleted*) */
  toggleFilter?: {
    key: keyof T;
    value: string;
    label: string;
  };

  // ── Pagination ──
  /** Items per page. 0 = no pagination */
  pageSize?: number;

  // ── Interaction ──
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Which column accessor is the "primary" one (turns green on hover) */
  primaryColumn?: keyof T | string;

  // ── Row Selection ──
  /** Enable row selection checkboxes */
  selectable?: boolean;
  /** Controlled selection state */
  selectedRows?: Set<string>;
  /** Callback when selection changes */
  onSelectionChange?: (selectedRows: Set<string>) => void;

  // ── Expandable Rows ──
  /** Render function for expanded row content */
  renderExpandedRow?: (row: T) => React.ReactNode;
  /** Control which rows are expandable (default: all) */
  isRowExpandable?: (row: T) => boolean;

  // ── Loading ──
  /** Show loading skeleton rows instead of data */
  loading?: boolean;
  /** Number of skeleton rows to display */
  skeletonRows?: number;

  // ── Column Visibility ──
  /** Enable column visibility toggle dropdown */
  columnToggle?: boolean;
  /** Initially hidden column accessors */
  defaultHiddenColumns?: string[];

  // ── Deprecated (backward compat) ──
  /** @deprecated Use toggleFilter instead */
  hideCompletedToggle?: boolean;
  /** @deprecated Use toggleFilter instead */
  hideCompletedKey?: keyof T;
  /** @deprecated Use toggleFilter instead */
  hideCompletedValue?: string;
  /** @deprecated Use toggleFilter instead */
  hideCompletedLabel?: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

const alignClass = (align?: string) => {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  rowKey,
  title,
  description,
  searchable = false,
  searchKeys = [],
  searchPlaceholder,
  filters = [],
  toggleFilter,
  pageSize = 10,
  onRowClick,
  primaryColumn,
  selectable = false,
  selectedRows: controlledSelection,
  onSelectionChange,
  renderExpandedRow,
  isRowExpandable,
  loading = false,
  skeletonRows,
  columnToggle = false,
  defaultHiddenColumns,
  // Deprecated props
  hideCompletedToggle,
  hideCompletedKey,
  hideCompletedValue = "Done",
  hideCompletedLabel,
}: DataTableProps<T>) {
  // ── Resolve deprecated toggle props ──
  const resolvedToggle =
    toggleFilter ??
    (hideCompletedToggle && hideCompletedKey
      ? {
        key: hideCompletedKey,
        value: hideCompletedValue,
        label: hideCompletedLabel ?? "Hide Done",
      }
      : undefined);

  const expandable = !!renderExpandedRow;

  // ── State ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const f of filters) {
        initial[f.key] = f.defaultValue;
      }
      return initial;
    },
  );
  const [toggleActive, setToggleActive] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [internalSelection, setInternalSelection] = useState<Set<string>>(
    new Set(),
  );
  const selection = controlledSelection ?? internalSelection;
  const setSelection = onSelectionChange ?? setInternalSelection;

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Column visibility state
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    new Set(defaultHiddenColumns ?? []),
  );
  const [columnToggleOpen, setColumnToggleOpen] = useState(false);
  const columnToggleRef = useRef<HTMLDivElement>(null);

  // Close column toggle on outside click
  useEffect(() => {
    if (!columnToggleOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        columnToggleRef.current &&
        !columnToggleRef.current.contains(e.target as Node)
      ) {
        setColumnToggleOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnToggleOpen]);

  // Visible columns (filtered by hidden state)
  const visibleColumns = useMemo(
    () =>
      columnToggle
        ? columns.filter((c) => !hiddenColumns.has(String(c.accessor)))
        : columns,
    [columns, hiddenColumns, columnToggle],
  );

  // Total visible column count (including selection + expand columns)
  const totalColSpan =
    visibleColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);

  // ── Handlers ──
  const getRowKey = useCallback(
    (row: T, index: number): string => {
      return rowKey
        ? String(getNestedValue(row, rowKey as string))
        : String(index);
    },
    [rowKey],
  );

  const handleSort = useCallback(
    (accessor: string) => {
      if (sortColumn === accessor) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(accessor);
        setSortDirection("asc");
      }
      setCurrentPage(1);
    },
    [sortColumn],
  );

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Filtering ──
  const filteredData = useMemo(() => {
    let result = [...data];

    // Toggle filter
    if (toggleActive && resolvedToggle) {
      result = result.filter((row) => {
        const val = String(
          getNestedValue(row, resolvedToggle.key as string),
        ).toLowerCase();
        return val !== resolvedToggle.value.toLowerCase();
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) =>
        searchKeys.some((key) => {
          const val = getNestedValue(row, key as string);
          return val != null && String(val).toLowerCase().includes(q);
        }),
      );
    }

    // Dropdown filters
    for (const filter of filters) {
      const selectedValue = filterValues[filter.key];
      if (selectedValue && selectedValue !== filter.defaultValue) {
        result = result.filter((row) => {
          const val = getNestedValue(row, filter.key);
          return val != null && String(val) === selectedValue;
        });
      }
    }

    return result;
  }, [
    data,
    toggleActive,
    resolvedToggle,
    searchQuery,
    searchKeys,
    filters,
    filterValues,
  ]);

  // ── Sorting ──
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;

    const col = columns.find((c) => String(c.accessor) === sortColumn);

    return [...filteredData].sort((a, b) => {
      if (col?.sortFn) {
        const result = col.sortFn(a, b);
        return sortDirection === "asc" ? result : -result;
      }

      let aVal: any = getNestedValue(a, sortColumn);
      let bVal: any = getNestedValue(b, sortColumn);

      if (aVal instanceof Date && bVal instanceof Date) {
        aVal = aVal.getTime();
        bVal = bVal.getTime();
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        const aDate = Date.parse(aVal);
        const bDate = Date.parse(bVal);
        if (!isNaN(aDate) && !isNaN(bDate) && aVal.includes("-")) {
          aVal = aDate;
          bVal = bDate;
        } else {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  // ── Pagination ──
  const totalItems = sortedData.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1;
  const paginatedData =
    pageSize > 0
      ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
      : sortedData;

  // ── Column Toggle Slot ──
  const columnToggleSlot = columnToggle ? (
    <div className="relative" ref={columnToggleRef}>
      <button
        onClick={() => setColumnToggleOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs text-sbi-muted hover:text-white border border-sbi-dark-border/50 rounded-lg transition-colors bg-[#0d120e]"
      >
        <ColumnsIcon size={14} />
        Columns
      </button>
      <AnimatePresence>
        {columnToggleOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1 w-48 bg-sbi-dark-card border border-sbi-dark-border rounded-lg shadow-xl z-50 p-2"
          >
            {columns.map((col) => {
              const accessor = String(col.accessor);
              return (
                <label
                  key={accessor}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-white/[0.04] transition-colors"
                >
                  <Checkbox
                    checked={!hiddenColumns.has(accessor)}
                    onCheckedChange={(checked) => {
                      setHiddenColumns((prev) => {
                        const next = new Set(prev);
                        if (checked) next.delete(accessor);
                        else next.add(accessor);
                        return next;
                      });
                    }}
                    className="border-sbi-dark-border data-[state=checked]:bg-sbi-green data-[state=checked]:text-sbi-dark"
                  />
                  <span
                    className={cn(
                      hiddenColumns.has(accessor)
                        ? "text-sbi-muted-dark"
                        : "text-white",
                    )}
                  >
                    {col.header}
                  </span>
                </label>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : undefined;

  // ── Render ──
  return (
    <div className="flex flex-col space-y-4">
      {/* Title row + filters */}
      {(title ||
        searchable ||
        filters.length > 0 ||
        resolvedToggle ||
        columnToggle) && (
          <div className="flex flex-col gap-3">
            {title && (
              <div>
                <h2 className="text-2xl font-extralight tracking-tight text-white">
                  {title}
                </h2>
                {description && (
                  <p className="text-sbi-muted-dark mt-1 text-sm">
                    {description}
                  </p>
                )}
              </div>
            )}
            <DataTableFilters
              searchable={searchable}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              searchPlaceholder={searchPlaceholder}
              filters={filters}
              filterValues={filterValues}
              onFilterChange={handleFilterChange}
              toggleFilter={
                resolvedToggle
                  ? {
                    key: resolvedToggle.key as string,
                    value: resolvedToggle.value,
                    label: resolvedToggle.label,
                  }
                  : undefined
              }
              toggleActive={toggleActive}
              onToggleChange={setToggleActive}
              columnToggleSlot={columnToggleSlot}
              disabled={loading}
            />
          </div>
        )}

      {/* Table */}
      <div className="rounded-lg border border-white/[0.06] bg-sbi-dark-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-white/[0.04] hover:bg-transparent bg-sbi-dark-btn/50">
              {/* Selection header */}
              {selectable && (
                <TableHead className="px-3 py-2.5 w-[44px]">
                  <Checkbox
                    checked={
                      paginatedData.length > 0 &&
                      paginatedData.every((row, i) =>
                        selection.has(
                          getRowKey(row, (currentPage - 1) * pageSize + i),
                        ),
                      )
                    }
                    onCheckedChange={(checked) => {
                      const next = new Set(selection);
                      paginatedData.forEach((row, i) => {
                        const key = getRowKey(
                          row,
                          (currentPage - 1) * pageSize + i,
                        );
                        if (checked) next.add(key);
                        else next.delete(key);
                      });
                      setSelection(next);
                    }}
                    className="border-sbi-dark-border data-[state=checked]:bg-sbi-green data-[state=checked]:text-sbi-dark"
                  />
                </TableHead>
              )}
              {/* Expand header */}
              {expandable && <TableHead className="px-3 py-2.5 w-[44px]" />}
              {/* Data columns */}
              {visibleColumns.map((col) => {
                const accessor = String(col.accessor);
                const isActive = sortColumn === accessor;
                return (
                  <TableHead
                    key={accessor}
                    className={cn(
                      "px-5 py-2.5 text-[11px] tracking-wider uppercase font-semibold select-none transition-colors",
                      col.width,
                      alignClass(col.align),
                      col.sortable
                        ? "cursor-pointer hover:text-white text-sbi-muted-dark"
                        : "text-sbi-muted-dark",
                    )}
                    onClick={
                      col.sortable ? () => handleSort(accessor) : undefined
                    }
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1.5",
                        col.align === "right" && "justify-end",
                        col.align === "center" && "justify-center",
                      )}
                    >
                      {col.header}
                      {col.sortable && (
                        <span className="inline-flex flex-col items-center -space-y-1">
                          {isActive ? (
                            sortDirection === "asc" ? (
                              <CaretUpIcon
                                size={14}
                                weight="bold"
                                className="text-sbi-green"
                              />
                            ) : (
                              <CaretDownIcon
                                size={14}
                                weight="bold"
                                className="text-sbi-green"
                              />
                            )
                          ) : (
                            <CaretDownIcon
                              size={14}
                              className="text-sbi-muted-dark/40"
                            />
                          )}
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          {/* Loading skeleton */}
          {loading ? (
            <TableBody>
              {Array.from({ length: skeletonRows ?? (pageSize || 5) }).map(
                (_, rowIdx) => (
                  <TableRow
                    key={`skeleton-${rowIdx}`}
                    className="border-b border-white/[0.04]"
                  >
                    {selectable && (
                      <TableCell className="px-3 py-3 w-[44px]">
                        <Skeleton className="h-4 w-4 rounded bg-white/[0.06]" />
                      </TableCell>
                    )}
                    {expandable && (
                      <TableCell className="px-3 py-3 w-[44px]">
                        <Skeleton className="h-4 w-4 rounded bg-white/[0.06]" />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={String(col.accessor)}
                        className={cn("px-5 py-3", col.width)}
                      >
                        <Skeleton
                          className={cn(
                            "h-4 rounded bg-white/[0.06]",
                            col.align === "right" ? "ml-auto w-16" : "w-3/4",
                          )}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ),
              )}
            </TableBody>
          ) : (
            <TableBody>
              <AnimatePresence mode="popLayout">
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={totalColSpan}
                      className="text-center py-12 text-sbi-muted"
                    >
                      No results found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((row, index) => {
                    const key = String(
                      getRowKey(row, (currentPage - 1) * pageSize + index),
                    );
                    const isSelected = selectable && selection.has(key);
                    const isExpanded = expandable && expandedRows.has(key);
                    const canExpand =
                      expandable && (!isRowExpandable || isRowExpandable(row));
                    const rowClicksExpand = expandable && !onRowClick;

                    return (
                      <React.Fragment key={key}>
                        <motion.tr
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ delay: index * 0.02, duration: 0.2 }}
                          data-state={isSelected ? "selected" : undefined}
                          className={cn(
                            "border-b border-white/[0.04] transition-colors group",
                            "hover:bg-white/[0.04]",
                            (onRowClick || rowClicksExpand) && "cursor-pointer",
                            isSelected && "bg-sbi-green/[0.04]",
                          )}
                          onClick={() => {
                            if (onRowClick) onRowClick(row);
                            else if (rowClicksExpand && canExpand)
                              toggleExpanded(key);
                          }}
                        >
                          {/* Selection checkbox */}
                          {selectable && (
                            <TableCell
                              className="px-3 py-3 w-[44px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={selection.has(key)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(selection);
                                  if (checked) next.add(key);
                                  else next.delete(key);
                                  setSelection(next);
                                }}
                                className="border-sbi-dark-border data-[state=checked]:bg-sbi-green data-[state=checked]:text-sbi-dark"
                              />
                            </TableCell>
                          )}
                          {/* Expand chevron */}
                          {expandable && (
                            <TableCell
                              className="px-3 py-3 w-[44px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {canExpand && (
                                <button
                                  onClick={() => toggleExpanded(key)}
                                  className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
                                >
                                  <CaretDownIcon
                                    size={14}
                                    className={cn(
                                      "text-sbi-muted transition-transform duration-200",
                                      isExpanded && "rotate-180",
                                    )}
                                  />
                                </button>
                              )}
                            </TableCell>
                          )}
                          {/* Data cells */}
                          {visibleColumns.map((col) => {
                            const accessor = String(col.accessor);
                            const value = getNestedValue(row, accessor);
                            const isPrimary =
                              primaryColumn &&
                              String(primaryColumn) === accessor;
                            return (
                              <TableCell
                                key={accessor}
                                className={cn(
                                  "px-5 py-3",
                                  col.width,
                                  alignClass(col.align),
                                  isPrimary &&
                                  "font-medium text-white group-hover:text-sbi-green transition-colors text-sm",
                                  !isPrimary && "text-sbi-muted text-sm",
                                  col.className,
                                )}
                              >
                                {col.render
                                  ? col.render(value, row)
                                  : String(value ?? "")}
                              </TableCell>
                            );
                          })}
                        </motion.tr>
                        {/* Expanded row content */}
                        {expandable && isExpanded && (
                          <motion.tr
                            key={`${key}-expanded`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <TableCell colSpan={totalColSpan} className="p-0">
                              <div className="px-5 py-4 bg-white/[0.02] border-b border-white/[0.04]">
                                {renderExpandedRow!(row)}
                              </div>
                            </TableCell>
                          </motion.tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </AnimatePresence>
            </TableBody>
          )}
        </Table>

        {/* Pagination */}
        {pageSize > 0 && !loading && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
}
