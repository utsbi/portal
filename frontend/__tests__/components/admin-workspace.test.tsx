import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDuesPage from "@/app/dashboard/admin/dues/page";
import AdminLayout from "@/app/dashboard/admin/layout";
import AdminOverviewPage from "@/app/dashboard/admin/page";
import AdminStatsPage from "@/app/dashboard/admin/stats/page";
import { DuesWorkspace } from "@/components/dashboard/admin/DuesWorkspace";
import { AdminNavigation } from "@/components/dashboard/common/AdminNavigation";

const { gate, pathname, adminClient, redirect } = vi.hoisted(() => ({
  gate: vi.fn(),
  pathname: vi.fn(() => "/dashboard/admin"),
  adminClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireDirector: gate }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: adminClient }));
vi.mock("next/navigation", () => ({
  usePathname: pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect,
}));

beforeEach(() => {
  vi.clearAllMocks();
  pathname.mockReturnValue("/dashboard/admin");
  gate.mockResolvedValue({ ok: false, error: "Director role required" });
});

describe("Admin workspace", () => {
  it("hides admin navigation and content when access is denied", async () => {
    render(await AdminLayout({ children: <div>Restricted content</div> }));
    expect(screen.getByText("Admin access required")).toBeInTheDocument();
    expect(screen.queryByText("Restricted content")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it.each([
    "director",
    "president",
  ])("shows the workspace for %s", async (role) => {
    gate.mockResolvedValue({ ok: true, role });
    render(await AdminLayout({ children: <div>Restricted content</div> }));
    expect(screen.getByText("Restricted content")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Admin sections" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Dues as the current page", () => {
    pathname.mockReturnValue("/dashboard/admin/dues");
    render(<AdminNavigation />);
    expect(screen.getByRole("link", { name: "Dues" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not read privileged stats when access is denied, independent of the layout", async () => {
    render(await AdminOverviewPage());
    expect(adminClient).not.toHaveBeenCalled();
    expect(screen.getByText("Admin access required")).toBeInTheDocument();
  });

  it("keeps the old stats URL pointing at the overview", () => {
    AdminStatsPage();
    expect(redirect).toHaveBeenCalledWith("/dashboard/admin");
  });

  it("starts dues without fake records", () => {
    render(
      <DuesWorkspace
        periods={[]}
        selected={null}
        accounts={[]}
        members={[]}
        payments={[]}
      />,
    );
    expect(screen.getByText("Start with a dues period")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("guards dues data independently of the layout", async () => {
    render(await AdminDuesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Admin access required")).toBeInTheDocument();
  });
});
