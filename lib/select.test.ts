import { describe, it, expect } from "vitest";
import { filterWorkOrders, groupByCategory, summaryCounts, topBuildings } from "./select";
import type { WorkOrder } from "./types";

function wo(p: Partial<WorkOrder>): WorkOrder {
  return {
    id: "id",
    title: "t",
    description: null,
    status: "Open",
    stageName: "To Do",
    priority: "medium",
    severity: null,
    category: "general",
    createdAt: null,
    dueDate: null,
    isOverdue: false,
    location: null,
    assets: [],
    assigneeIds: [],
    source: "live",
    signals: [],
    ...p,
  };
}

const loc = (id: string, name: string) => ({ id, name, address: name });

const SAMPLE: WorkOrder[] = [
  wo({ id: "1", status: "Open", category: "hvac", isOverdue: true, location: loc("b1", "Alpha"), priority: "high" }),
  wo({ id: "2", status: "Open", category: "hvac", location: loc("b1", "Alpha"), priority: "low" }),
  wo({ id: "3", status: "In Progress", category: "electrical", location: loc("b2", "Beta") }),
  wo({ id: "4", status: "Done", category: "electrical", location: loc("b2", "Beta") }),
  wo({ id: "5", status: "Open", category: "plumbing", isOverdue: true, location: loc("b3", "Gamma") }),
];

describe("summaryCounts", () => {
  it("counts open / in progress / overdue", () => {
    expect(summaryCounts(SAMPLE)).toEqual({ open: 3, inProgress: 1, overdue: 2 });
  });
});

describe("groupByCategory", () => {
  it("counts per category, sorted desc", () => {
    const g = groupByCategory(SAMPLE);
    expect(g[0]).toEqual({ category: "electrical", count: 2 });
    expect(g.find((c) => c.category === "hvac")?.count).toBe(2);
    expect(g.find((c) => c.category === "plumbing")?.count).toBe(1);
  });
});

describe("topBuildings", () => {
  it("ranks by open (non-Done) work orders", () => {
    const b = topBuildings(SAMPLE, 5);
    expect(b[0]).toMatchObject({ id: "b1", openCount: 2 });
    const beta = b.find((x) => x.id === "b2");
    expect(beta?.openCount).toBe(1); // In Progress counts as open, Done does not
  });
  it("respects the limit", () => {
    expect(topBuildings(SAMPLE, 1)).toHaveLength(1);
  });
  it("ignores work orders without a location", () => {
    expect(topBuildings([wo({ location: null })], 5)).toHaveLength(0);
  });
});

describe("filterWorkOrders", () => {
  it("filters by status", () => {
    expect(filterWorkOrders(SAMPLE, { status: "Open" })).toHaveLength(3);
  });
  it("filters by priority", () => {
    expect(filterWorkOrders(SAMPLE, { priority: "high" })).toHaveLength(1);
  });
  it("filters by building", () => {
    expect(filterWorkOrders(SAMPLE, { buildingId: "b1" })).toHaveLength(2);
  });
  it("filters by category", () => {
    expect(filterWorkOrders(SAMPLE, { category: "hvac" })).toHaveLength(2);
    expect(filterWorkOrders(SAMPLE, { category: "plumbing" })).toHaveLength(1);
  });
  it("combines filters", () => {
    expect(filterWorkOrders(SAMPLE, { status: "Open", buildingId: "b1" })).toHaveLength(2);
    expect(filterWorkOrders(SAMPLE, { category: "hvac", status: "Open" })).toHaveLength(2);
    expect(filterWorkOrders(SAMPLE, { category: "electrical", status: "Open" })).toHaveLength(0);
  });
});
