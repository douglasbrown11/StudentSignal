// Pure selectors that derive dashboard views from a list of work orders.
// Shared by API routes (server) and the dashboard (client). No side effects.

import type { BuildingSummary, CategoryCount, SummaryCounts, WorkOrder } from "./types";

/** A work order is "open" (still needs attention) when it isn't Done. */
export function isOpen(wo: WorkOrder): boolean {
  return wo.status !== "Done";
}

export function summaryCounts(workOrders: WorkOrder[]): SummaryCounts {
  return {
    open: workOrders.filter((w) => w.status === "Open").length,
    inProgress: workOrders.filter((w) => w.status === "In Progress").length,
    overdue: workOrders.filter((w) => w.isOverdue).length,
  };
}

export function groupByCategory(workOrders: WorkOrder[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const w of workOrders) {
    counts.set(w.category, (counts.get(w.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/** Buildings ranked by number of open (non-Done) work orders, highest first. */
export function topBuildings(workOrders: WorkOrder[], n = 5): BuildingSummary[] {
  const byId = new Map<string, BuildingSummary>();
  for (const w of workOrders) {
    if (!w.location) continue;
    const id = w.location.id;
    const entry =
      byId.get(id) ??
      { id, name: w.location.name, address: w.location.address, openCount: 0 };
    if (isOpen(w)) entry.openCount += 1;
    byId.set(id, entry);
  }
  return [...byId.values()]
    .sort((a, b) => b.openCount - a.openCount || (a.name ?? "").localeCompare(b.name ?? ""))
    .slice(0, n);
}

export function filterWorkOrders(
  workOrders: WorkOrder[],
  opts: { status?: string | null; priority?: string | null; buildingId?: string | null },
): WorkOrder[] {
  return workOrders.filter((w) => {
    if (opts.status && w.status !== opts.status) return false;
    if (opts.priority && w.priority !== opts.priority) return false;
    if (opts.buildingId && w.location?.id !== opts.buildingId) return false;
    return true;
  });
}
