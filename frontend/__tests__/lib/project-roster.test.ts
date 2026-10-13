import { describe, expect, it } from "vitest";
import {
  buildProjectRoster,
  isInternalProject,
  type RosterAssignment,
  type RosterProfile,
} from "@/lib/project/roster";

const profile = (
  id: number,
  role: RosterProfile["role"],
  name = `Person ${id}`,
): RosterProfile => ({
  id,
  role,
  name,
  email: null,
  contact_email: null,
  uid: null,
  portal_activated_at: null,
});
const assignment = (p: RosterProfile, role = "member"): RosterAssignment => ({
  id: p.id + 100,
  profile_id: p.id,
  role,
  created_at: null,
  profiles: p,
  assigner: null,
});

describe("project roster", () => {
  it("includes every non-client in SBI even without a membership or login", () => {
    const roster = buildProjectRoster(
      [],
      [
        profile(1, "member"),
        profile(2, "director"),
        profile(3, "president"),
        profile(4, "client"),
      ],
      true,
    );
    expect(roster.map((p) => p.role)).toEqual([
      "member",
      "director",
      "president",
    ]);
    expect(
      roster.every((p) => !p.canRemove && p.accountStatus === "no_account"),
    ).toBe(true);
  });

  it("uses the profile role even when the access row has a different role", () => {
    const p = profile(1, "president");
    expect(
      buildProjectRoster([assignment(p, "director")], [p], true)[0].role,
    ).toBe("president");
  });

  it("sorts the owner first while still displaying their account role", () => {
    const owner = profile(1, "client", "Zoe");
    const member = profile(2, "member", "Alice");
    const roster = buildProjectRoster(
      [assignment(member), assignment(owner, "owner")],
      [],
      false,
    );
    expect(roster[0]).toMatchObject({
      role: "client",
      isOwner: true,
      canRemove: false,
    });
    expect(roster[1]).toMatchObject({
      role: "member",
      isOwner: false,
      canRemove: true,
    });
  });

  it("does not lose an owner who became a director", () => {
    const p = profile(1, "director");
    expect(
      buildProjectRoster([assignment(p, "owner")], [p], false)[0],
    ).toMatchObject({ isOwner: true, role: "director", canRemove: false });
  });

  it("never includes a client in SBI, even with a legacy assignment", () => {
    const client = profile(1, "client");
    expect(buildProjectRoster([assignment(client)], [client], true)).toEqual(
      [],
    );
  });

  it("does not duplicate automatic staff who already have a real access row", () => {
    const director = profile(1, "director");
    expect(
      buildProjectRoster([assignment(director, "director")], [director], false),
    ).toHaveLength(1);
  });

  it("does not grant regular members automatic client-project access", () => {
    expect(
      buildProjectRoster(
        [],
        [profile(1, "member"), profile(2, "director")],
        false,
      ).map((p) => p.profile_id),
    ).toEqual([2]);
  });

  it("distinguishes no login, pending setup, and active accounts", () => {
    const pending = { ...profile(2, "member"), uid: "pending" };
    const active = {
      ...profile(3, "member"),
      uid: "active",
      portal_activated_at: "2026-01-01",
    };
    expect(
      buildProjectRoster([], [profile(1, "member"), pending, active], true).map(
        (p) => p.accountStatus,
      ),
    ).toEqual(["no_account", "pending", "active"]);
  });

  it("identifies SBI by its stable marker after renaming", () => {
    expect(
      isInternalProject({
        config: { workspace_type: "sbi" },
        company_name: "Renamed",
        is_default: false,
      }),
    ).toBe(true);
    expect(
      isInternalProject({ config: {}, company_name: "SBI", is_default: true }),
    ).toBe(true);
    expect(
      isInternalProject({
        config: {},
        company_name: "SBI Test Inc",
        is_default: true,
      }),
    ).toBe(false);
    expect(
      isInternalProject({ config: {}, company_name: "SBI", is_default: false }),
    ).toBe(false);
  });
});
