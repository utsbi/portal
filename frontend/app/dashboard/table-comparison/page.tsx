"use client";

import {
  AlertCircle,
  ArrowUpDown,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Filter,
  Mail,
  Search,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { EmptyState, inputClass } from "@/components/dashboard/common/ui";
import { type ColumnDef, DataTable } from "@/components/data-table";
import { StatusPill } from "@/components/data-table/status-pill";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// MOCK DATA: Questionnaire
// ─────────────────────────────────────────────────────────────

const QUESTIONNAIRE_MOCK = [
  {
    id: 1,
    formName: "General Form",
    priority: "High" as const,
    questionCount: 8,
    team: "Architecture",
    status: "In Process" as const,
    missingRequired: true,
  },
  {
    id: 2,
    formName: "Conceptual Basics",
    priority: "Critical" as const,
    questionCount: 5,
    team: "Architecture",
    status: "Done" as const,
    missingRequired: false,
  },
  {
    id: 3,
    formName: "Interior Detail",
    priority: "High" as const,
    questionCount: 6,
    team: "Architecture",
    status: "In Process" as const,
    missingRequired: false,
  },
  {
    id: 4,
    formName: "Architecture & Aesthetic",
    priority: "Medium" as const,
    questionCount: 5,
    team: "Architecture",
    status: "Done" as const,
    missingRequired: false,
  },
  {
    id: 5,
    formName: "The Estate",
    priority: "Medium" as const,
    questionCount: 7,
    team: "Architecture",
    status: "In Process" as const,
    missingRequired: true,
  },
  {
    id: 6,
    formName: "Pool Specifications",
    priority: "High" as const,
    questionCount: 3,
    team: "Architecture",
    status: "In Process" as const,
    missingRequired: false,
  },
  {
    id: 7,
    formName: "Pool - Civil Engineering",
    priority: "Medium" as const,
    questionCount: 2,
    team: "Engineering",
    status: "Done" as const,
    missingRequired: false,
  },
  {
    id: 8,
    formName: "Pool - Mechanical Systems",
    priority: "Medium" as const,
    questionCount: 2,
    team: "Engineering",
    status: "In Process" as const,
    missingRequired: false,
  },
  {
    id: 9,
    formName: "Pool - Finance",
    priority: "Low" as const,
    questionCount: 1,
    team: "Finance",
    status: "Done" as const,
    missingRequired: false,
  },
];

type QSortKey = "priority" | "status" | "questionCount" | "team" | null;

const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };

// ─────────────────────────────────────────────────────────────
// MOCK DATA: Reports
// ─────────────────────────────────────────────────────────────

const REPORTS_MOCK = [
  {
    id: "r1",
    numid: "1",
    title: "Foundation Soil Analysis",
    department: "Civil",
    director: "Sarah Chen",
    date: "2026-02-20",
    status: "Done" as const,
  },
  {
    id: "r2",
    numid: "2",
    title: "HVAC System Specs Draft",
    department: "Engineering",
    director: "Marco Rivera",
    date: "2026-02-18",
    status: "In Progress" as const,
  },
  {
    id: "r3",
    numid: "3",
    title: "Q1 Budget Reconciliation",
    department: "Finance",
    director: "David Kim",
    date: "2026-02-15",
    status: "Pending" as const,
  },
  {
    id: "r4",
    numid: "4",
    title: "Solar Panel ROI Study",
    department: "Engineering",
    director: "Lisa Park",
    date: "2026-02-12",
    status: "Done" as const,
  },
  {
    id: "r5",
    numid: "5",
    title: "Zoning Permit Application",
    department: "Legal",
    director: "James Wright",
    date: "2026-02-10",
    status: "Denied" as const,
  },
  {
    id: "r6",
    numid: "6",
    title: "Client Portal UX Review",
    department: "Internal Technologies",
    director: "Anna Kowalski",
    date: "2026-02-08",
    status: "In Progress" as const,
  },
  {
    id: "r7",
    numid: "7",
    title: "Landscape Master Plan",
    department: "Architecture",
    director: "Carlos Mendez",
    date: "2026-02-05",
    status: "Done" as const,
  },
  {
    id: "r8",
    numid: "8",
    title: "Structural Load Assessment",
    department: "Structural",
    director: "Sarah Chen",
    date: "2026-01-28",
    status: "Pending" as const,
  },
  {
    id: "r9",
    numid: "9",
    title: "Water Reclamation Study",
    department: "Environmental",
    director: "Lisa Park",
    date: "2026-01-25",
    status: "In Progress" as const,
  },
  {
    id: "r10",
    numid: "10",
    title: "PR Campaign Brief",
    department: "Public Relations",
    director: "David Kim",
    date: "2026-01-20",
    status: "Done" as const,
  },
];

type RSortColumn =
  | "numid"
  | "status"
  | "title"
  | "department"
  | "date"
  | "director"
  | null;

const DEPARTMENTS = [
  { value: "All Depts", label: "All Departments" },
  { value: "Architecture", label: "Architecture" },
  {
    label: "Engineering",
    options: [
      { value: "Engineering", label: "General" },
      { value: "Civil", label: "Civil" },
      { value: "Environmental", label: "Environmental" },
      { value: "Structural", label: "Structural" },
    ],
  },
  { value: "Finance", label: "Finance" },
  { value: "Public Relations", label: "Public Relations" },
  { value: "Internal Technologies", label: "Internal Tech" },
  { value: "Legal", label: "Legal" },
];

const STATUS_OPTIONS = [
  { value: "All", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Done", label: "Done" },
  { value: "Denied", label: "Denied" },
];

const TIMEFRAME_OPTIONS = [
  { value: "All Time", label: "All Time" },
  { value: "This Week", label: "This Week" },
  { value: "This Month", label: "This Month" },
  { value: "Last Month", label: "Last Month" },
];

// ─────────────────────────────────────────────────────────────
// MOCK DATA: Requests
// ─────────────────────────────────────────────────────────────

type RequestStatus = "pending" | "in-progress" | "done" | "denied";

const REQUESTS_MOCK = [
  {
    id: "req-1",
    name: "Pedro Guzman",
    email: "pedro@utsbi.org",
    subject: "Solar Panel Vendor Approval",
    department: "Engineering",
    assignedTo: "Kabir Muzumdar",
    project: "Project One",
    message:
      "Need approval for the solar panel vendor contract before Q2 deadline.",
    status: "pending" as RequestStatus,
    createdAt: new Date("2026-02-24"),
    updatedAt: new Date("2026-02-24"),
  },
  {
    id: "req-2",
    name: "Sam Moran",
    email: "sam@utsbi.org",
    subject: "Foundation Inspection Report",
    department: "Engineering",
    assignedTo: "Preston Vajdos",
    project: "Project One",
    message:
      "The foundation inspection was completed last week. Attached are the results.",
    status: "done" as RequestStatus,
    createdAt: new Date("2026-02-20"),
    updatedAt: new Date("2026-02-22"),
  },
  {
    id: "req-3",
    name: "Arianne Yude",
    email: "arianne@utsbi.org",
    subject: "PR Campaign Draft Review",
    department: "Public Relations",
    assignedTo: "Pedro Guzman",
    project: "General",
    message:
      "Please review the attached campaign materials for the spring launch.",
    status: "in-progress" as RequestStatus,
    createdAt: new Date("2026-02-18"),
    updatedAt: new Date("2026-02-21"),
  },
  {
    id: "req-4",
    name: "Dev Shroff",
    email: "dev@utsbi.org",
    subject: "Q1 Budget Allocation Update",
    department: "Business",
    assignedTo: "Sam Moran",
    project: "Project One",
    message: "Updated budget allocation reflecting the new material costs.",
    status: "pending" as RequestStatus,
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-02-15"),
  },
  {
    id: "req-5",
    name: "Alim Makanov",
    email: "alim@utsbi.org",
    subject: "Zoning Variance Application",
    department: "Legal",
    assignedTo: "Brendan Lyon",
    project: "Project One",
    message:
      "The zoning variance application has been denied by the city. See attached letter.",
    status: "denied" as RequestStatus,
    createdAt: new Date("2026-02-10"),
    updatedAt: new Date("2026-02-14"),
  },
  {
    id: "req-6",
    name: "Daniel Lam",
    email: "daniel@utsbi.org",
    subject: "Portal Auth System Upgrade",
    department: "Tech",
    assignedTo: "Enoch Zhu",
    project: "Internal",
    message: "Proposing migration to OAuth 2.0 for the client portal.",
    status: "in-progress" as RequestStatus,
    createdAt: new Date("2026-02-08"),
    updatedAt: new Date("2026-02-19"),
  },
  {
    id: "req-7",
    name: "Christian Butler",
    email: "christian@utsbi.org",
    subject: "Interior Material Samples",
    department: "Architecture",
    assignedTo: "Pedro Guzman",
    project: "Project One",
    message: "Material samples for the interior finishes are ready for review.",
    status: "done" as RequestStatus,
    createdAt: new Date("2026-02-05"),
    updatedAt: new Date("2026-02-12"),
  },
  {
    id: "req-8",
    name: "Brendan Lyon",
    email: "brendan@utsbi.org",
    subject: "Construction Timeline Update",
    department: "Engineering",
    assignedTo: "Kabir Muzumdar",
    project: "Project One",
    message: "Revised timeline accounting for weather delays in January.",
    status: "pending" as RequestStatus,
    createdAt: new Date("2026-01-30"),
    updatedAt: new Date("2026-02-01"),
  },
];

const REQUEST_STATUS_OPTIONS: {
  label: string;
  value: RequestStatus | "all";
}[] = [
  { label: "All Statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in-progress" },
  { label: "Done", value: "done" },
  { label: "Denied", value: "denied" },
];

// ─────────────────────────────────────────────────────────────
// MOCK DATA: Unified (Design D)
// ─────────────────────────────────────────────────────────────

interface UnifiedItem {
  id: string;
  title: string;
  department: string;
  director: string;
  date: string;
  status: string;
  priority: string;
}

const UNIFIED_MOCK: UnifiedItem[] = [
  {
    id: "u1",
    title: "Foundation Soil Analysis",
    department: "Civil",
    director: "Sarah Chen",
    date: "2026-02-20",
    status: "Done",
    priority: "High",
  },
  {
    id: "u2",
    title: "HVAC System Specs Draft",
    department: "Engineering",
    director: "Marco Rivera",
    date: "2026-02-18",
    status: "In Progress",
    priority: "Critical",
  },
  {
    id: "u3",
    title: "Q1 Budget Reconciliation",
    department: "Finance",
    director: "David Kim",
    date: "2026-02-15",
    status: "Pending",
    priority: "Medium",
  },
  {
    id: "u4",
    title: "Solar Panel ROI Study",
    department: "Engineering",
    director: "Lisa Park",
    date: "2026-02-12",
    status: "Done",
    priority: "High",
  },
  {
    id: "u5",
    title: "Zoning Permit Application",
    department: "Legal",
    director: "James Wright",
    date: "2026-02-10",
    status: "Denied",
    priority: "High",
  },
  {
    id: "u6",
    title: "Client Portal UX Review",
    department: "Internal Technologies",
    director: "Anna Kowalski",
    date: "2026-02-08",
    status: "In Progress",
    priority: "Medium",
  },
  {
    id: "u7",
    title: "Landscape Master Plan",
    department: "Architecture",
    director: "Carlos Mendez",
    date: "2026-02-05",
    status: "Done",
    priority: "Low",
  },
  {
    id: "u8",
    title: "Structural Load Assessment",
    department: "Structural",
    director: "Sarah Chen",
    date: "2026-01-28",
    status: "Pending",
    priority: "High",
  },
  {
    id: "u9",
    title: "Water Reclamation Study",
    department: "Environmental",
    director: "Lisa Park",
    date: "2026-01-25",
    status: "In Progress",
    priority: "Medium",
  },
  {
    id: "u10",
    title: "PR Campaign Brief",
    department: "Public Relations",
    director: "David Kim",
    date: "2026-01-20",
    status: "Done",
    priority: "Low",
  },
  {
    id: "u11",
    title: "Fire Safety Compliance",
    department: "Engineering",
    director: "Marco Rivera",
    date: "2026-01-18",
    status: "In Progress",
    priority: "Critical",
  },
  {
    id: "u12",
    title: "Interior Finishes Schedule",
    department: "Architecture",
    director: "Carlos Mendez",
    date: "2026-01-15",
    status: "Done",
    priority: "Medium",
  },
];

const UNIFIED_COLUMNS: ColumnDef<UnifiedItem>[] = [
  {
    accessor: "title",
    header: "Title",
    sortable: true,
  },
  {
    accessor: "department",
    header: "Department",
    sortable: true,
    responsivePriority: 3,
  },
  {
    accessor: "status",
    header: "Status",
    sortable: true,
    render: (value: string) => <StatusPill status={value} />,
  },
  {
    accessor: "priority",
    header: "Priority",
    sortable: true,
    render: (value: string) => {
      const colors: Record<string, string> = {
        Critical: "text-red-400",
        High: "text-amber-400",
        Medium: "text-blue-400",
        Low: "text-sbi-muted",
      };
      return (
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wider",
            colors[value] ?? "text-sbi-muted",
          )}
        >
          {value}
        </span>
      );
    },
    sortFn: (a: UnifiedItem, b: UnifiedItem) => {
      const order: Record<string, number> = {
        Critical: 0,
        High: 1,
        Medium: 2,
        Low: 3,
      };
      return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
    },
  },
  {
    accessor: "director",
    header: "Director",
    sortable: true,
    responsivePriority: 3,
  },
  {
    accessor: "date",
    header: "Date",
    sortable: true,
    align: "right" as const,
    responsivePriority: 2,
    render: (value: string) => (
      <span className="text-xs text-sbi-muted tabular-nums">
        {new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(value))}
      </span>
    ),
  },
];

const UNIFIED_FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "All Status", label: "All Status" },
      { value: "Pending", label: "Pending" },
      { value: "In Progress", label: "In Progress" },
      { value: "Done", label: "Done" },
      { value: "Denied", label: "Denied" },
    ],
    defaultValue: "All Status",
    width: "w-36",
  },
  {
    key: "department",
    label: "Department",
    options: [
      { value: "All Depts", label: "All Departments" },
      { value: "Architecture", label: "Architecture" },
      {
        label: "Engineering",
        options: [
          { value: "Engineering", label: "General" },
          { value: "Civil", label: "Civil" },
          { value: "Environmental", label: "Environmental" },
          { value: "Structural", label: "Structural" },
        ],
      },
      { value: "Finance", label: "Finance" },
      { value: "Public Relations", label: "Public Relations" },
      { value: "Internal Technologies", label: "Internal Tech" },
      { value: "Legal", label: "Legal" },
    ],
    defaultValue: "All Depts",
    width: "w-44",
  },
];

// ─────────────────────────────────────────────────────────────
// QUESTIONNAIRE TABLE COMPONENT
// ─────────────────────────────────────────────────────────────

function QuestionnaireTable() {
  const [sortConfig, setSortConfig] = useState<{
    key: QSortKey;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });
  const [hideCompleted, setHideCompleted] = useState(false);

  const handleSort = (key: QSortKey) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedForms = useMemo(() => {
    let result = [...QUESTIONNAIRE_MOCK];

    if (hideCompleted) {
      result = result.filter((form) => form.status !== "Done");
    }

    const sortKey = sortConfig.key;
    if (sortKey) {
      result.sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];

        if (sortKey === "priority") {
          const aPriority =
            priorityOrder[aValue as keyof typeof priorityOrder] ?? 99;
          const bPriority =
            priorityOrder[bValue as keyof typeof priorityOrder] ?? 99;
          return sortConfig.direction === "asc"
            ? aPriority - bPriority
            : bPriority - aPriority;
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [sortConfig, hideCompleted]);

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extralight tracking-tight text-white">
            Questionnaires
          </h2>
          <p className="text-sbi-muted-dark mt-1 text-sm">
            Manage and review your questionnaires.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hide-completed"
            checked={hideCompleted}
            onCheckedChange={(checked) => setHideCompleted(checked as boolean)}
            className="border-sbi-dark-border data-[state=checked]:bg-sbi-green data-[state=checked]:text-sbi-dark"
          />
          <Label
            htmlFor="hide-completed"
            className="text-sbi-muted cursor-pointer text-sm"
          >
            Hide Completed
          </Label>
        </div>
      </div>

      <div className="rounded-md border border-sbi-dark-border bg-sbi-dark-card">
        <Table>
          <TableHeader>
            <TableRow className="border-sbi-dark-border hover:bg-transparent">
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="text-sbi-muted-dark">Form Name</TableHead>
              <TableHead
                className="text-sbi-muted-dark cursor-pointer hover:text-white"
                onClick={() => handleSort("priority")}
              >
                <div className="flex items-center gap-1">
                  Priority/Deadline
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="text-sbi-muted-dark cursor-pointer hover:text-white"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1">
                  Status
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="text-sbi-muted-dark text-right cursor-pointer hover:text-white"
                onClick={() => handleSort("questionCount")}
              >
                <div className="flex items-center justify-end gap-1">
                  Number of Questions
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead
                className="text-sbi-muted-dark cursor-pointer hover:text-white"
                onClick={() => handleSort("team")}
              >
                <div className="flex items-center gap-1">
                  What team this is for
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedForms.map((form) => (
              <TableRow
                key={form.id}
                className="border-sbi-dark-border cursor-pointer hover:bg-sbi-dark-card/50 transition-colors"
              >
                <TableCell>
                  <div className="h-4 w-4 rounded border border-sbi-dark-border" />
                </TableCell>
                <TableCell className="font-light text-white">
                  <div className="flex items-center gap-2">
                    {form.formName}
                    {form.missingRequired && (
                      <Badge
                        variant="destructive"
                        className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10 h-5 px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Missing Required
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={
                      form.priority === "Critical"
                        ? "text-red-400 font-medium"
                        : form.priority === "High"
                          ? "text-orange-400"
                          : "text-sbi-muted-dark"
                    }
                  >
                    {form.priority}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {form.status === "Done" ? (
                      <div className="h-2 w-2 rounded-full bg-sbi-green" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    )}
                    <span
                      className={
                        form.status === "Done"
                          ? "text-sbi-green"
                          : "text-yellow-500"
                      }
                    >
                      {form.status}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sbi-muted-dark">
                  {form.questionCount}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="bg-sbi-dark-card text-sbi-muted-dark border-sbi-dark-border hover:bg-sbi-dark-card"
                  >
                    {form.team}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REPORTS TABLE COMPONENT
// ─────────────────────────────────────────────────────────────

function ReportsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All Depts");
  const [timeframeFilter, setTimeframeFilter] = useState("All Time");
  const [sortColumn, setSortColumn] = useState<RSortColumn>("numid");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: RSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (column: RSortColumn) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3 inline-block ml-1 text-sbi-green transition-transform" />
    ) : (
      <ChevronDown className="w-3 h-3 inline-block ml-1 text-sbi-green transition-transform" />
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Done":
        return "text-sbi-green bg-sbi-green/10 border-sbi-green/20";
      case "Denied":
        return "text-red-400 bg-red-400/10 border-red-400/20";
      case "In Progress":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "Pending":
        return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      default:
        return "text-sbi-muted bg-sbi-muted/10 border-sbi-muted/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Done":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Denied":
        return <Ban className="w-3.5 h-3.5" />;
      case "In Progress":
        return <Clock className="w-3.5 h-3.5" />;
      case "Pending":
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredReports = REPORTS_MOCK.filter((req) => {
    const matchesSearch =
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.director.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.numid.includes(searchQuery);
    const matchesStatus = statusFilter === "All" || req.status === statusFilter;
    const matchesTeam =
      teamFilter === "All Depts" || req.department === teamFilter;
    return matchesSearch && matchesStatus && matchesTeam;
  });

  const sortedReports = useMemo(() => {
    if (!sortColumn) return filteredReports;

    return [...filteredReports].sort((a, b) => {
      let aVal: string | number = a[sortColumn];
      let bVal: string | number = b[sortColumn];

      if (sortColumn === "status") {
        const statusOrder = {
          Done: 1,
          "In Progress": 2,
          Pending: 3,
          Denied: 4,
        };
        aVal = statusOrder[a.status as keyof typeof statusOrder] || 5;
        bVal = statusOrder[b.status as keyof typeof statusOrder] || 5;
      } else if (sortColumn === "date") {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else if (sortColumn === "numid") {
        aVal = parseInt(a.numid, 10) || 0;
        bVal = parseInt(b.numid, 10) || 0;
      } else {
        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredReports, sortColumn, sortDirection]);

  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-2xl font-extralight tracking-tight text-white">
          Reports
        </h2>
        <p className="text-sbi-muted-dark mt-1 text-sm">
          View and manage submitted reports.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 w-full bg-sbi-dark p-2 rounded-xl">
        <div className="relative flex-grow min-w-0 w-full sm:w-auto sm:min-w-[300px] max-w-md group bg-sbi-input rounded-lg border border-sbi-green/10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sbi-green/60 group-focus-within:text-sbi-green transition-colors" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-12 py-2.5 text-sm bg-transparent rounded-lg text-white placeholder:text-sbi-muted-dark focus:outline-none focus:ring-1 focus:ring-sbi-green/30 focus:border-sbi-green/30 transition-all shadow-sm"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-[#1a2e20] text-sbi-green border border-sbi-green/20 rounded-md pointer-events-none">
            <Filter className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <SearchableDropdown
            value={timeframeFilter}
            onChange={setTimeframeFilter}
            options={TIMEFRAME_OPTIONS}
            className="w-36 z-50"
          />
          <SearchableDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            className="w-36 z-40"
          />
          <SearchableDropdown
            value={teamFilter}
            onChange={setTeamFilter}
            options={DEPARTMENTS}
            className="w-48 z-30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-sbi-dark-card rounded-xl border border-sbi-dark-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sbi-dark-border bg-sbi-dark-btn/50">
                <th
                  onClick={() => handleSort("numid")}
                  className="px-6 py-5 font-semibold text-sbi-muted-dark uppercase tracking-wider text-xs w-24 cursor-pointer hover:text-white transition-colors select-none"
                >
                  ID {renderSortIcon("numid")}
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="px-6 py-5 font-semibold text-sbi-muted-dark uppercase tracking-wider text-xs w-48 cursor-pointer hover:text-white transition-colors select-none"
                >
                  Status {renderSortIcon("status")}
                </th>
                <th
                  onClick={() => handleSort("title")}
                  className="px-6 py-5 font-semibold text-sbi-muted-dark uppercase tracking-wider text-xs cursor-pointer hover:text-white transition-colors select-none"
                >
                  Report Task {renderSortIcon("title")}
                </th>
                <th
                  onClick={() => handleSort("department")}
                  className="px-6 py-5 font-semibold text-sbi-muted-dark uppercase tracking-wider text-xs cursor-pointer hover:text-white transition-colors select-none"
                >
                  Team {renderSortIcon("department")}
                </th>
                <th
                  onClick={() => handleSort("date")}
                  className="px-6 py-5 font-semibold text-sbi-muted-dark uppercase tracking-wider text-xs cursor-pointer hover:text-white transition-colors select-none"
                >
                  Date {renderSortIcon("date")}
                </th>
                <th
                  onClick={() => handleSort("director")}
                  className="px-6 py-5 font-semibold text-sbi-muted-dark uppercase tracking-wider text-xs cursor-pointer hover:text-white transition-colors select-none"
                >
                  Director {renderSortIcon("director")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sbi-dark-border">
              {sortedReports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                >
                  <td className="px-6 py-5 text-sbi-muted font-mono text-xs">
                    #{report.numid}
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm",
                        getStatusColor(report.status),
                      )}
                    >
                      {getStatusIcon(report.status)}
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-medium text-white group-hover:text-sbi-green transition-colors text-base">
                    {report.title}
                  </td>
                  <td className="px-6 py-5 text-sbi-muted">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full border border-sbi-dark-border bg-transparent" />
                      {report.department}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sbi-muted text-xs font-mono">
                    {formatDate(report.date)}
                  </td>
                  <td className="px-6 py-5 text-sbi-muted">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-sbi-dark-btn border border-sbi-dark-border flex items-center justify-center text-xs font-medium text-white shadow-sm">
                        {report.director.charAt(0)}
                      </div>
                      {report.director}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REQUESTS TABLE COMPONENT
// ─────────────────────────────────────────────────────────────

function RequestsTable() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">(
    "all",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const filteredRequests = REQUESTS_MOCK.filter((req) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      req.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRequests = filteredRequests.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    setExpandedId(null);
  };

  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-2xl font-extralight tracking-tight text-white">
          Requests
        </h2>
        <p className="text-sbi-muted-dark mt-1 text-sm">
          View and manage submitted requests.
        </p>
      </div>

      {/* Section Header with Search & Filter */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-px bg-sbi-green" />
          <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted">
            Request History
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-sbi-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search requests..."
              className={cn(inputClass, "pl-6 pr-6 py-1.5 w-45 text-xs")}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sbi-muted hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as RequestStatus | "all");
              setCurrentPage(1);
              setExpandedId(null);
            }}
            className="bg-sbi-dark-card border border-sbi-dark-border/50 text-sbi-muted text-xs py-1.5 px-2 focus:outline-none focus:border-sbi-green/50 transition-colors appearance-none cursor-pointer pr-6"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
          >
            {REQUEST_STATUS_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-sbi-dark-card"
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Column Headers */}
      {filteredRequests.length > 0 && (
        <div className="grid grid-cols-[auto_1fr_160px_120px_160px] gap-4 px-4 pb-2 border-b border-sbi-dark-border/40">
          <div className="w-4" />
          <p className="text-xs tracking-[0.15em] uppercase text-sbi-muted">
            Subject
          </p>
          <p className="text-xs tracking-[0.15em] uppercase text-sbi-muted">
            Name
          </p>
          <p className="text-xs tracking-[0.15em] uppercase text-sbi-muted">
            Date
          </p>
          <p className="text-xs tracking-[0.15em] uppercase text-sbi-muted">
            Status
          </p>
        </div>
      )}

      {/* Request Rows */}
      <div className="space-y-1">
        {currentRequests.map((request, index) => {
          const isExpanded = expandedId === request.id;
          return (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="border border-sbi-dark-border/50 bg-sbi-dark-card hover:border-sbi-green/30 transition-all duration-300"
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : request.id)}
                className="w-full grid grid-cols-[auto_1fr_160px_120px_160px] gap-4 items-center px-4 py-3 text-left"
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sbi-muted w-4"
                  style={{ height: "16px" }}
                >
                  <ChevronDown className="w-4 h-4 absolute" />
                </motion.div>
                <div className="min-w-0">
                  <p className="text-sm font-light text-white truncate">
                    {request.subject}
                  </p>
                  <p className="text-xs text-sbi-muted truncate">
                    {request.department}
                  </p>
                </div>
                <p className="text-xs text-white/80 truncate">{request.name}</p>
                <p className="text-xs text-sbi-muted whitespace-nowrap">
                  {formatDate(request.createdAt)}
                </p>
                <div className="flex justify-start">
                  <StatusPill status={request.status} />
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden border-t border-sbi-dark-border/30"
                  >
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-start gap-3">
                          <User className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                          <div>
                            <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">
                              Name
                            </p>
                            <p className="text-sm text-white">{request.name}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Mail className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                          <div>
                            <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">
                              Email
                            </p>
                            <p className="text-sm text-white">
                              {request.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <User className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                          <div>
                            <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">
                              Assigned To
                            </p>
                            <p className="text-sm text-white">
                              {request.assignedTo}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Calendar className="w-4 h-4 text-sbi-green mt-1 shrink-0" />
                          <div>
                            <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-1">
                              Project
                            </p>
                            <p className="text-sm text-white">
                              {request.project}
                            </p>
                          </div>
                        </div>
                      </div>
                      {request.message && (
                        <div>
                          <p className="text-xs tracking-[0.2em] uppercase text-sbi-muted mb-3">
                            Message
                          </p>
                          <p className="text-sm text-white/80 leading-relaxed">
                            {request.message}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {filteredRequests.length === 0 && (
          <EmptyState
            icon={<Search className="w-6 h-6" />}
            title="No requests match your filters"
            description="Try adjusting your search or status filter to find what you're looking for."
          />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-sbi-dark-border/30">
          <p className="text-xs text-sbi-muted">
            Showing {startIndex + 1}-
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} of{" "}
            {filteredRequests.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCurrentPage((p) => p - 1);
                setExpandedId(null);
              }}
              disabled={currentPage === 1}
              className="p-2 border border-sbi-dark-border/50 hover:border-sbi-green/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <span className="text-xs text-sbi-muted px-3">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => {
                setCurrentPage((p) => p + 1);
                setExpandedId(null);
              }}
              disabled={currentPage === totalPages}
              className="p-2 border border-sbi-dark-border/50 hover:border-sbi-green/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPARISON PAGE
// ─────────────────────────────────────────────────────────────

export default function TableComparisonPage() {
  return (
    <div className="flex flex-col min-h-screen w-full bg-sbi-dark p-6 md:p-10 space-y-12 overflow-auto">
      {/* Page Header */}
      <div className="space-y-2 border-b border-sbi-dark-border pb-6">
        <h1 className="text-3xl font-extralight tracking-tight text-white">
          Table Design Comparison
        </h1>
        <p className="text-sbi-muted-dark text-sm max-w-2xl">
          Comparison of the{" "}
          <span className="text-sbi-green font-medium">Questionnaire</span>,{" "}
          <span className="text-sbi-green font-medium">Reports</span>, and{" "}
          <span className="text-sbi-green font-medium">Requests</span> branch
          table designs. All are fully interactive — try sorting, filtering,
          expanding, and hovering to compare the feel of each.
        </p>
      </div>

      {/* Design A: Questionnaire */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-sbi-dark bg-sbi-green px-3 py-1 rounded-full">
            A
          </span>
          <div>
            <h3 className="text-lg font-medium text-white">
              Questionnaire Branch
            </h3>
            <p className="text-xs text-sbi-muted-dark">
              Radix UI Table primitives &bull; ArrowUpDown sort icons &bull;
              Checkbox filter &bull; Animated pulse status dots &bull; Badge
              pills for teams
            </p>
          </div>
        </div>
        <div className="border border-sbi-dark-border rounded-xl p-6 bg-sbi-dark-card/30">
          <QuestionnaireTable />
        </div>
      </section>

      {/* Design B: Reports */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-sbi-dark bg-sbi-green px-3 py-1 rounded-full">
            B
          </span>
          <div>
            <h3 className="text-lg font-medium text-white">Reports Branch</h3>
            <p className="text-xs text-sbi-muted-dark">
              Native HTML table &bull; Chevron sort icons &bull; Search bar +
              dropdowns &bull; Status badge pills with icons &bull; Avatar
              circles &bull; Date formatting
            </p>
          </div>
        </div>
        <div className="border border-sbi-dark-border rounded-xl p-6 bg-sbi-dark-card/30">
          <ReportsTable />
        </div>
      </section>

      {/* Design C: Requests */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-sbi-dark bg-sbi-green px-3 py-1 rounded-full">
            C
          </span>
          <div>
            <h3 className="text-lg font-medium text-white">Requests Branch</h3>
            <p className="text-xs text-sbi-muted-dark">
              CSS Grid rows (not table) &bull; Expandable detail panels &bull;
              Animated ping status dots &bull; Pagination &bull; Native select
              filter &bull; Framer Motion animations
            </p>
          </div>
        </div>
        <div className="border border-sbi-dark-border rounded-xl p-6 bg-sbi-dark-card/30">
          <RequestsTable />
        </div>
      </section>

      {/* Design D: Unified DataTable */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-sbi-dark bg-sbi-green px-3 py-1 rounded-full">
            D
          </span>
          <div>
            <h3 className="text-lg font-medium text-white">
              Unified DataTable
            </h3>
            <p className="text-xs text-sbi-muted-dark">
              Composable Table primitives &bull; Phosphor icons throughout
              &bull; Search + SearchableDropdowns + Toggle filter &bull; Row
              selection &bull; Expandable rows &bull; Column visibility &bull;
              Loading skeleton &bull; Pagination &bull; Framer Motion
            </p>
          </div>
        </div>
        <DataTable<UnifiedItem>
          data={UNIFIED_MOCK}
          columns={UNIFIED_COLUMNS}
          title="Project Reports"
          description="Unified component combining the best of all three designs"
          searchable
          searchKeys={["title", "director", "department"]}
          searchPlaceholder="Search reports..."
          filters={UNIFIED_FILTERS}
          toggleFilter={{ key: "status", value: "Done", label: "Hide Done" }}
          pageSize={5}
          onRowClick={(row) => console.log("Clicked:", row)}
          primaryColumn="title"
          rowKey="id"
          selectable
          columnToggle
          renderExpandedRow={(row) => (
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <span className="text-sbi-muted-dark text-xs uppercase tracking-wider">
                  Director
                </span>
                <p className="text-white mt-1">{row.director}</p>
              </div>
              <div>
                <span className="text-sbi-muted-dark text-xs uppercase tracking-wider">
                  Department
                </span>
                <p className="text-white mt-1">{row.department}</p>
              </div>
              <div>
                <span className="text-sbi-muted-dark text-xs uppercase tracking-wider">
                  Date
                </span>
                <p className="text-white mt-1">{row.date}</p>
              </div>
            </div>
          )}
        />
      </section>

      {/* Feature Checklist for comparison */}
      <section className="space-y-4 border-t border-sbi-dark-border pt-8 pb-16">
        <h3 className="text-lg font-medium text-white">Feature Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Layout
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span> Composable UI
                primitives (Table/TableRow)
              </p>
              <p>
                <span className="text-white font-medium">B:</span> Native HTML
                table/thead/tbody
              </p>
              <p>
                <span className="text-white font-medium">C:</span> CSS Grid rows
                (not a table at all)
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span>{" "}
                Composable primitives + generic ColumnDef&lt;T&gt;
              </p>
            </div>
          </div>
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Sorting
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span> ArrowUpDown
                icon, toggle asc/desc
              </p>
              <p>
                <span className="text-white font-medium">B:</span>{" "}
                ChevronUp/Down, green active indicator
              </p>
              <p>
                <span className="text-white font-medium">C:</span> No sorting
                (chronological only)
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span>{" "}
                CaretUp/Down (Phosphor), green active state
              </p>
            </div>
          </div>
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Filtering
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span> Simple
                checkbox ("Hide Completed")
              </p>
              <p>
                <span className="text-white font-medium">B:</span> Search bar +
                3 searchable dropdowns
              </p>
              <p>
                <span className="text-white font-medium">C:</span> Search bar +
                native select dropdown
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span> Search +
                SearchableDropdowns + Hide Done checkbox
              </p>
            </div>
          </div>
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Status Display
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span> Pulse dots +
                colored text
              </p>
              <p>
                <span className="text-white font-medium">B:</span> Badge pills
                with icons + bg tint
              </p>
              <p>
                <span className="text-white font-medium">C:</span> Ping-animated
                dots + colored text
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span>{" "}
                StatusPill badges (Phosphor icons + color tint)
              </p>
            </div>
          </div>
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Row Interaction
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span> Click opens
                Dialog modal
              </p>
              <p>
                <span className="text-white font-medium">B:</span> Click opens
                full-screen modal
              </p>
              <p>
                <span className="text-white font-medium">C:</span> Click expands
                inline detail panel
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span>{" "}
                Configurable onRowClick callback
              </p>
            </div>
          </div>
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Pagination
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span> None
              </p>
              <p>
                <span className="text-white font-medium">B:</span> None
              </p>
              <p>
                <span className="text-white font-medium">C:</span> Prev/Next
                with page counter
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span> Prev/Next
                with "Showing X-Y of Z"
              </p>
            </div>
          </div>
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Row Hover
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span>{" "}
                bg-sbi-dark-card/50 tint
              </p>
              <p>
                <span className="text-white font-medium">B:</span> white/[0.02]
                tint + title turns green
              </p>
              <p>
                <span className="text-white font-medium">C:</span> Border turns
                green on hover
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span>{" "}
                white/[0.04] tint + primary column turns green
              </p>
            </div>
          </div>
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Header Style
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span> Muted text,
                no background
              </p>
              <p>
                <span className="text-white font-medium">B:</span> Uppercase +
                semibold, dark bg tint
              </p>
              <p>
                <span className="text-white font-medium">C:</span> Uppercase +
                wide tracking, border-bottom
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span> Uppercase
                tracking + green-tinted bg
              </p>
            </div>
          </div>
          <div className="bg-sbi-dark-card border border-sbi-dark-border rounded-lg p-4 space-y-3">
            <h4 className="text-sbi-green font-semibold text-xs uppercase tracking-wider">
              Animations
            </h4>
            <div className="space-y-1.5 text-sbi-muted">
              <p>
                <span className="text-white font-medium">A:</span> CSS pulse on
                status dot
              </p>
              <p>
                <span className="text-white font-medium">B:</span> None (CSS
                transitions only)
              </p>
              <p>
                <span className="text-white font-medium">C:</span> Framer
                Motion: row stagger, expand/collapse, chevron rotate
              </p>
              <p>
                <span className="text-sbi-green font-medium">D:</span> Framer
                Motion: row stagger, AnimatePresence filter/sort
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
