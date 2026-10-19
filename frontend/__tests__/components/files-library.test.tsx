import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "director",
  department: null as string | null,
  spaces: [
    {
      id: 11,
      name: "Business",
      root_prefix: "department/11",
      department_id: 1,
    },
    { id: 12, name: "Legal", root_prefix: "department/12", department_id: 2 },
  ],
  members: [] as { file_space_id: number; permission: string }[],
  entries: [
    {
      id: "file-1",
      name: "Annual planning.xlsx",
      updated_at: "2026-10-13T00:00:00Z",
    },
    { id: null, name: "Active matters", updated_at: "2026-10-12T00:00:00Z" },
  ],
  links: [
    {
      file_space_id: 11,
      storage_path: "department/11/Annual planning.xlsx",
      project_id: 7,
    },
  ],
  projects: [{ id: 7, company_name: "Riverside Community Center" }],
  uploads: [] as string[],
  uploadError: null as { message: string } | null,
  extraEntries: [] as { id: string; name: string; updated_at: string }[],
  listOffsets: [] as number[],
}));

vi.mock("@/lib/project/project-context", () => ({
  useProject: () => ({
    user: { id: 1, role: state.role, department: state.department },
    activeProject: { projectId: 7, companyName: "Riverside Community Center" },
    switchProject: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const from = (table: string) => {
      const filters: { key: string; value: unknown }[] = [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push({ key, value });
          return query;
        },
        in: (key: string, values: unknown[]) => {
          filters.push({ key, value: values });
          return query;
        },
        order: () => query,
        // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable and the test double mirrors that contract.
        then: (
          resolve: (value: { data: unknown[]; error: null }) => unknown,
        ) => {
          let rows: unknown[] = [];
          if (table === "file_spaces") {
            rows =
              state.role === "member"
                ? state.spaces.filter((space) =>
                    state.members.some(
                      (member) => member.file_space_id === space.id,
                    ),
                  )
                : state.spaces;
          }
          if (table === "file_space_members") rows = state.members;
          if (table === "department_file_project_links") {
            rows = state.links.filter((row) =>
              filters.every((filter) => {
                if (filter.key === "file_space_id")
                  return row.file_space_id === filter.value;
                return row.storage_path === filter.value;
              }),
            );
          }
          if (table === "projects") {
            const ids = filters.find((filter) => filter.key === "id")?.value;
            rows = state.projects.filter((project) =>
              Array.isArray(ids) ? ids.includes(project.id) : true,
            );
          }
          return resolve({ data: rows, error: null });
        },
      };
      return query;
    };
    return {
      from,
      storage: {
        from: () => ({
          list: async (
            _path: string,
            options: { offset: number; limit: number },
          ) => {
            state.listOffsets.push(options.offset);
            return {
              data: [...state.entries, ...state.extraEntries].slice(
                options.offset,
                options.offset + options.limit,
              ),
              error: null,
            };
          },
          upload: async (path: string) => {
            state.uploads.push(path);
            return { data: { path }, error: state.uploadError };
          },
          createSignedUrl: async (path: string) => ({
            data: { signedUrl: `https://files.test/${path}` },
            error: null,
          }),
        }),
      },
    };
  },
}));

import DepartmentLibrary from "@/app/dashboard/files/DepartmentLibrary";
import FilesWorkspace from "@/app/dashboard/files/FilesWorkspace";

beforeEach(() => {
  state.role = "director";
  state.department = null;
  state.members = [];
  state.uploads = [];
  state.uploadError = null;
  state.extraEntries = [];
  state.listOffsets = [];
});
afterEach(cleanup);

describe("department file spaces", () => {
  it("shows persistent department spaces instead of an organization-wide library", async () => {
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "director", department: null }}
      />,
    );
    expect(screen.queryByText("Department-owned files.")).toBeNull();
    const spaces = await screen.findByRole("navigation", {
      name: "Department spaces",
    });
    expect(
      within(spaces).getByRole("button", { name: "Business" }),
    ).toBeInTheDocument();
    expect(
      within(spaces).getByRole("button", { name: "Legal" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Annual planning.xlsx")).toBeInTheDocument();
    expect(screen.queryByText("All SBI")).toBeNull();
  });

  it("keeps a department's files independent from the active project", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "director", department: null }}
      />,
    );
    const spaces = await screen.findByRole("navigation", {
      name: "Department spaces",
    });
    await user.click(within(spaces).getByRole("button", { name: "Legal" }));
    expect(
      within(spaces).getByRole("button", { name: "Legal" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("department/12")).toBeNull();
  });

  it("uses department membership for members rather than project membership", async () => {
    state.role = "member";
    state.department = "Legal";
    state.members = [{ file_space_id: 12, permission: "viewer" }];
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "member", department: "Legal" }}
      />,
    );
    expect(
      await within(
        screen.getByRole("navigation", { name: "Department spaces" }),
      ).findByRole("button", { name: "Legal" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Upload" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Folder" })).toBeNull();
  });

  it("allows editors to upload into their department space", async () => {
    const user = userEvent.setup();
    state.role = "member";
    state.department = "Business";
    state.members = [{ file_space_id: 11, permission: "editor" }];
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "member", department: "Business" }}
      />,
    );
    await screen.findByRole("button", { name: "Upload" });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["planning"], "forecast.txt", { type: "text/plain" });
    await user.upload(input, file);
    expect(state.uploads).toContain("department/11/forecast.txt");
  });

  it("shows related projects as context without using them as access", async () => {
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "director", department: null }}
      />,
    );
    const user = userEvent.setup();
    const main = await screen.findByRole("main", {
      name: "Department files",
    });
    await user.click(
      await within(main).findByRole("button", {
        name: "Details for Annual planning.xlsx",
      }),
    );
    const details = await screen.findByLabelText("Department file details");
    expect(
      within(details).getByText("Riverside Community Center"),
    ).toBeInTheDocument();
    expect(within(details).getByText("Business space")).toBeInTheDocument();
  });

  it("keeps project link controls available after closing the preview", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "director", department: null }}
      />,
    );
    const main = await screen.findByRole("main", { name: "Department files" });
    await user.click(await within(main).findByText("Annual planning.xlsx"));
    const preview = await screen.findByRole("dialog");
    await user.click(within(preview).getByRole("button", { name: "Close" }));
    await user.click(
      within(main).getByRole("button", {
        name: "Details for Annual planning.xlsx",
      }),
    );
    const details = screen.getByLabelText("Department file details");
    expect(
      within(details).getByRole("button", {
        name: "Remove Riverside Community Center project link",
      }),
    ).toBeInTheDocument();
    await user.click(within(details).getByRole("button", { name: "Link" }));
    expect(
      await screen.findByRole("dialog", {
        name: "Link file to a project",
      }),
    ).toBeInTheDocument();
  });

  it("preserves upload failures after refreshing the file list", async () => {
    state.uploadError = { message: "The resource already exists" };
    const user = userEvent.setup();
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "director", department: null }}
      />,
    );
    await screen.findByRole("button", { name: "Upload" });
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["duplicate"], "forecast.txt", { type: "text/plain" }),
    );
    expect(
      await screen.findByText("forecast.txt: The resource already exists"),
    ).toBeInTheDocument();
  });

  it("loads entries beyond the first storage page", async () => {
    state.extraEntries = Array.from({ length: 200 }, (_, index) => ({
      id: `extra-${index}`,
      name: `extra-${index}.txt`,
      updated_at: "2026-10-13T00:00:00Z",
    }));
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "director", department: null }}
      />,
    );
    expect(await screen.findByText("extra-199.txt")).toBeInTheDocument();
    expect(state.listOffsets).toEqual([0, 200]);
  });

  it("previews a real storage object through a signed URL", async () => {
    const user = userEvent.setup();
    render(
      <DepartmentLibrary
        user={{ id: 1, role: "director", department: null }}
      />,
    );
    const main = await screen.findByRole("main", {
      name: "Department files",
    });
    await user.click(await within(main).findByText("Annual planning.xlsx"));
    const dialog = await screen.findByRole("dialog", {
      name: "Annual planning.xlsx",
    });
    expect(
      within(dialog).getByText(
        "This file type cannot be previewed in the portal.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Download file" }),
    ).toBeInTheDocument();
  });
});

describe("files workspace", () => {
  it("labels the second location Department files and leaves project files intact", async () => {
    render(<FilesWorkspace>Existing project browser</FilesWorkspace>);
    expect(
      screen.getByRole("button", { name: "Department files" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Existing project browser")).toBeVisible();
  });

  it("does not expose department spaces to clients", () => {
    state.role = "client";
    render(<FilesWorkspace>Existing project browser</FilesWorkspace>);
    expect(
      screen.queryByRole("button", { name: "Department files" }),
    ).toBeNull();
    expect(screen.getByText("Existing project browser")).toBeVisible();
  });
});
