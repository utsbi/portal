import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DuesWorkspace,
  type DuesWorkspaceProps,
} from "@/components/dashboard/admin/DuesWorkspace";

const { manage, push, refresh } = vi.hoisted(() => ({
  manage: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/dashboard/admin/dues/actions", () => ({ manageDues: manage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
const period = {
  id: 1,
  name: "Fall 2026",
  amount_cents: 5000,
  due_on: "2026-01-01",
  created_by: 1,
  created_at: "2026-01-01",
};
const props: DuesWorkspaceProps = {
  periods: [period],
  selected: period,
  members: [
    { id: 1, name: "Jane Doe", email: "jane@example.com", role: "member" },
    { id: 2, name: "Alex Smith", email: "alex@example.com", role: "member" },
  ],
  accounts: [1, 2].map((id) => ({
    id,
    period_id: 1,
    profile_id: id,
    amount_cents: 5000,
    waived: false,
    waiver_reason: null,
    waiver_by: null,
    waiver_at: null,
    created_at: "2026-01-01",
  })),
  payments: [
    {
      id: 1,
      account_id: 2,
      request_id: "d2df01a9-fd08-4624-a370-9c56e37c8234",
      amount_cents: 2000,
      paid_on: "2020-01-01",
      historical: false,
      method: "Cash",
      note: "Historical payment",
      recorded_by: "Director",
      recorded_at: "2026-01-01",
      void_reason: null,
      voided_by: null,
      voided_at: null,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  manage.mockResolvedValue({ id: 1 });
});

describe("Dues tracker", () => {
  it("filters by member and payment status", () => {
    render(<DuesWorkspace {...props} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter dues status" }),
      { target: { value: "Partial" } },
    );
    expect(screen.getByText("Alex Smith")).toBeInTheDocument();
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter dues status" }),
      { target: { value: "All statuses" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search dues records" }),
      { target: { value: "jane@" } },
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("Alex Smith")).not.toBeInTheDocument();
  });

  it("records an earlier payment with integer cents and a retry key", async () => {
    render(<DuesWorkspace {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "View dues for Jane Doe" }),
    );
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "20.25" },
    });
    fireEvent.change(screen.getByLabelText("Date received"), {
      target: { value: "2020-02-01" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save payment record" }),
    );
    await waitFor(() =>
      expect(manage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "record_payment",
          account_id: 1,
          amount_cents: 2025,
          paid_on: "2020-02-01",
          request_id: expect.any(String),
        }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows server validation errors without closing the record", async () => {
    manage.mockResolvedValue({ error: "Balance has changed" });
    render(<DuesWorkspace {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "View dues for Jane Doe" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save payment record" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Balance has changed",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("creates a period with chosen members and reuses its key after a lost response", async () => {
    manage.mockRejectedValueOnce(new Error("Response lost"));
    render(
      <DuesWorkspace
        {...props}
        periods={[]}
        selected={null}
        accounts={[]}
        payments={[]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create first period" }),
    );
    fireEvent.change(screen.getByLabelText("Period name"), {
      target: { value: "Spring 2027" },
    });
    fireEvent.change(screen.getByLabelText("Amount per member (USD)"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2027-02-01" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /^Jane Doe/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Already paid: Jane Doe" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create period" }));
    await waitFor(() =>
      expect(manage).toHaveBeenCalledWith({
        action: "create_period",
        request_id: expect.any(String),
        name: "Spring 2027",
        amount_cents: 5000,
        due_on: "2027-02-01",
        profile_ids: [1],
        paid_profile_ids: [1],
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Retry the unchanged form",
    );
    expect(push).not.toHaveBeenCalled();
    const firstRequest = manage.mock.calls[0][0];
    fireEvent.click(
      await screen.findByRole("button", { name: "Create period" }),
    );
    await waitFor(() => expect(manage).toHaveBeenCalledTimes(2));
    expect(manage.mock.calls[1][0]).toEqual(firstRequest);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/dashboard/admin/dues?period=1"),
    );
  });

  it("bulk-reconciles existing unpaid members without offering partial balances", async () => {
    render(<DuesWorkspace {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark already paid" }));
    expect(
      screen.queryByRole("checkbox", { name: /Alex Smith/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /^Jane Doe/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm already paid" }),
    );
    await waitFor(() =>
      expect(manage).toHaveBeenCalledWith({
        action: "mark_paid",
        request_id: expect.any(String),
        period_id: 1,
        profile_ids: [1],
      }),
    );
  });

  it("assigns a new member and their historical payment in one request", async () => {
    render(
      <DuesWorkspace
        {...props}
        members={[
          ...props.members,
          { id: 3, name: "Sam Lee", email: "sam@example.com", role: "member" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add members" }));
    const paid = screen.getByRole("checkbox", {
      name: "Already paid: Sam Lee",
    });
    expect(paid).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /^Sam Lee/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mark selected paid" }));
    expect(paid).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /^Sam Lee/ }));
    expect(paid).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /^Sam Lee/ }));
    fireEvent.click(paid);
    fireEvent.click(screen.getByRole("button", { name: "Assign dues" }));
    await waitFor(() =>
      expect(manage).toHaveBeenCalledWith({
        action: "assign_members",
        request_id: expect.any(String),
        period_id: 1,
        profile_ids: [3],
        paid_profile_ids: [3],
      }),
    );
  });

  it("shows honest unknown details for historical payments", () => {
    render(
      <DuesWorkspace
        {...props}
        payments={[
          {
            ...props.payments[0],
            account_id: 1,
            amount_cents: 5000,
            historical: true,
            paid_on: null,
            method: null,
            note: "Historical payment—details unknown",
          },
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "View dues for Jane Doe" }),
    );
    expect(screen.getByText("Payment date unknown")).toBeInTheDocument();
    expect(screen.getByText(/Method unknown/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded by Director/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save payment record" }),
    ).not.toBeInTheDocument();
  });

  it("keeps payment corrections explicit and reasoned", async () => {
    render(<DuesWorkspace {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "View dues for Alex Smith" }),
    );
    expect(screen.getByText("Historical payment")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Correct record" }));
    fireEvent.change(screen.getByLabelText("Correction reason"), {
      target: { value: "Entered twice" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Void payment record" }),
    );
    await waitFor(() =>
      expect(manage).toHaveBeenCalledWith({
        action: "void_payment",
        payment_id: 1,
        reason: "Entered twice",
      }),
    );
  });
});
