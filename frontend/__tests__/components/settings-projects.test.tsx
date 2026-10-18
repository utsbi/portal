import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  activeId: 6,
  section: "projects",
  role: "director",
  roster: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ section: state.section }),
}));
vi.mock("@/lib/project/project-context", () => ({
  useProject: () => ({
    user: { id: 1, role: state.role },
    isLoading: false,
    activeProject: {
      projectId: state.activeId,
      companyName: state.activeId === 6 ? "SBI" : "Client Project",
    },
    refetch: vi.fn(),
    switchProject: vi.fn(),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/app/dashboard/settings/actions", () => ({
  listProjects: async () => ({
    projects: [
      {
        id: 6,
        company_name: "SBI",
        is_default: true,
        config: { workspace_type: "sbi" },
      },
      { id: 7, company_name: "Client Project", is_default: false, config: {} },
    ],
  }),
  listArchivedProjects: async () => ({ projects: [] }),
  listProjectMembers: (id: number) => state.roster(id),
  listUnassignedMembers: async () => ({ members: [] }),
  listAvailableOwners: async () => ({ clients: [] }),
  listAccounts: async () => ({ accounts: [] }),
  listMemberProfiles: async () => ({ members: [] }),
}));

import SettingsPage from "@/app/dashboard/settings/page";

const person = (id: number, name: string, role: string, owner = false) => ({
  id,
  profile_id: id,
  role,
  isOwner: owner,
  canRemove: false,
  accountStatus: role === "member" ? "no_account" : "active",
  profiles: { id, name, role, email: null, contact_email: null },
});

beforeEach(() => {
  state.activeId = 6;
  state.section = "projects";
  state.role = "director";
  state.roster.mockReset();
  state.roster.mockImplementation(async (id: number) => ({
    members:
      id === 6
        ? [
            person(1, "A Director", "director"),
            person(2, "B President", "president"),
            person(3, "C Member", "member"),
          ]
        : [
            person(4, "Z Client Owner", "client", true),
            person(1, "A Director", "director"),
          ],
  }));
});
afterEach(cleanup);

describe("Projects settings UI", () => {
  it("shows directors and presidents in SBI, with account roles and login status", async () => {
    render(<SettingsPage />);
    await screen.findByText("C Member");
    expect(screen.getByText("A Director")).toBeTruthy();
    expect(screen.getByText("B President")).toBeTruthy();
    expect(screen.getByText("3 people")).toBeTruthy();
    expect(screen.getByText("No account")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add member" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Assign owner" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Archive project" }),
    ).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("Default member project")).toBeNull();
  });

  it("client-project owners have a separate badge and their account role", async () => {
    state.activeId = 7;
    render(<SettingsPage />);
    await screen.findByText("Z Client Owner");
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("client")).toBeTruthy();
    expect(screen.queryByText("A Director")).toBeNull();
    expect(screen.getByRole("button", { name: "Add member" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Archive project" }),
    ).toBeTruthy();
  });

  it("clears the old roster immediately when the header project changes", async () => {
    const view = render(<SettingsPage />);
    await screen.findByText("C Member");
    state.roster.mockImplementation(() => new Promise(() => {}));
    state.activeId = 7;
    view.rerender(<SettingsPage />);
    expect(screen.queryByText("C Member")).toBeNull();
    expect(screen.getByText("Loading project access…")).toBeTruthy();
  });

  it("ignores an older in-flight roster response after switching projects", async () => {
    let resolveOld: (value: unknown) => void = () => {};
    state.roster.mockImplementation((id: number) =>
      id === 6
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve({
            members: [person(4, "Z Client Owner", "client", true)],
          }),
    );
    const view = render(<SettingsPage />);
    await waitFor(() => expect(state.roster).toHaveBeenCalledWith(6));
    state.activeId = 7;
    view.rerender(<SettingsPage />);
    await screen.findByText("Z Client Owner");
    await act(async () => {
      resolveOld({ members: [person(3, "Outdated Member", "member")] });
    });
    expect(screen.queryByText("Outdated Member")).toBeNull();
    expect(screen.getByText("Z Client Owner")).toBeTruthy();
  });

  it("keeps legacy Team bookmarks working", async () => {
    state.section = "team";
    render(<SettingsPage />);
    await screen.findByText("C Member");
    expect(screen.queryByRole("button", { name: "Team" })).toBeNull();
  });
});
