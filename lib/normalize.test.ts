import { describe, it, expect } from "vitest";
import { bucketStatus, isOverdue, normalizeWorkOrder, toIso } from "./normalize";

const RAW = {
  id: "wo-1",
  title: "Annual Steam System Inspection",
  description: "Inspect steam system",
  executionPriority: "high",
  severity: "high",
  workOrderServiceCategory: "fire_and_life_safety",
  createdAt: "1780401565928",
  endDate: "1781169552232",
  workOrderStage: { id: "s1", name: "To Do" },
  location: { id: "loc-1", locationName: "350 Grand Street", address: "350 Grand St" },
  workOrderAssets: [
    { id: "wa1", assetId: "a1", asset: { id: "a1", name: "Steam Valve", status: "operational", lastServiceDate: "1770000000000" } },
  ],
  workOrderAssignments: [{ id: "asn1", assignmentType: "primary", userIds: ["u1", "u2"] }],
};

describe("bucketStatus", () => {
  it("maps todo/backlog/new to Open", () => {
    for (const s of ["To Do", "Backlog", "New", "Open", "anything-unknown"]) {
      expect(bucketStatus(s)).toBe("Open");
    }
  });
  it("maps in-progress variants", () => {
    for (const s of ["In Progress", "in_progress", "Doing", "Active", "WIP"]) {
      expect(bucketStatus(s)).toBe("In Progress");
    }
  });
  it("maps done variants", () => {
    for (const s of ["Done", "Completed", "Closed", "Resolved", "Cancelled"]) {
      expect(bucketStatus(s)).toBe("Done");
    }
  });
  it("defaults null to Open", () => {
    expect(bucketStatus(null)).toBe("Open");
    expect(bucketStatus(undefined)).toBe("Open");
  });
});

describe("toIso", () => {
  it("converts epoch-millis strings to ISO", () => {
    expect(toIso("1780401565928")).toBe(new Date(1780401565928).toISOString());
  });
  it("handles numbers", () => {
    expect(toIso(1780401565928)).toBe(new Date(1780401565928).toISOString());
  });
  it("passes through ISO strings", () => {
    expect(toIso("2026-01-01T00:00:00.000Z")).toBe("2026-01-01T00:00:00.000Z");
  });
  it("returns null for empty/invalid", () => {
    expect(toIso(null)).toBeNull();
    expect(toIso("")).toBeNull();
    expect(toIso("not-a-date")).toBeNull();
  });
});

describe("isOverdue", () => {
  const now = Date.parse("2026-06-05T00:00:00Z");
  it("true when due in the past and not Done", () => {
    expect(isOverdue("2026-06-01T00:00:00Z", "Open", now)).toBe(true);
  });
  it("false when Done even if past", () => {
    expect(isOverdue("2026-06-01T00:00:00Z", "Done", now)).toBe(false);
  });
  it("false when due in the future", () => {
    expect(isOverdue("2026-06-10T00:00:00Z", "Open", now)).toBe(false);
  });
  it("false when no due date", () => {
    expect(isOverdue(null, "Open", now)).toBe(false);
  });
});

describe("normalizeWorkOrder", () => {
  const now = Date.parse("2027-01-01T00:00:00Z"); // after both dates -> overdue
  const wo = normalizeWorkOrder(RAW, [], now);

  it("maps core fields", () => {
    expect(wo.id).toBe("wo-1");
    expect(wo.title).toBe("Annual Steam System Inspection");
    expect(wo.status).toBe("Open");
    expect(wo.stageName).toBe("To Do");
    expect(wo.priority).toBe("high");
    expect(wo.category).toBe("fire_and_life_safety");
    expect(wo.source).toBe("live");
  });
  it("converts dates to ISO", () => {
    expect(wo.createdAt).toBe(new Date(1780401565928).toISOString());
    expect(wo.dueDate).toBe(new Date(1781169552232).toISOString());
  });
  it("computes overdue against now", () => {
    expect(wo.isOverdue).toBe(true);
  });
  it("flattens location and assets", () => {
    expect(wo.location).toEqual({ id: "loc-1", name: "350 Grand Street", address: "350 Grand St" });
    expect(wo.assets[0]).toMatchObject({ id: "a1", name: "Steam Valve", status: "operational" });
  });
  it("collects assignee ids without resolving users", () => {
    expect(wo.assigneeIds).toEqual(["u1", "u2"]);
  });
  it("defaults unknown priority to medium", () => {
    expect(normalizeWorkOrder({ ...RAW, executionPriority: "weird" }, [], now).priority).toBe("medium");
  });
  it("tolerates missing nested data", () => {
    const sparse = normalizeWorkOrder({ id: "x", title: "T" }, [], now);
    expect(sparse.location).toBeNull();
    expect(sparse.assets).toEqual([]);
    expect(sparse.category).toBe("general");
    expect(sparse.status).toBe("Open");
  });
});
