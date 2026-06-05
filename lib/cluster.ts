// Pure clustering: find groups of similar OPEN work orders that span MULTIPLE
// buildings — the candidates for a single coordinated response instead of N
// separate one-off fixes. Similarity here is the service category (the strongest
// signal we have in the data); each cluster must touch at least two buildings so
// it's genuinely a portfolio-level pattern, not one building's problem.

import { isOpen } from "./select";
import type { WorkOrder } from "./types";

export interface WorkOrderCluster {
  key: string; // category
  category: string;
  label: string;
  workOrders: WorkOrder[];
  buildingCount: number;
  buildingNames: string[];
  hasOverdue: boolean;
  topPriority: string;
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function findCrossBuildingClusters(workOrders: WorkOrder[]): WorkOrderCluster[] {
  const byCat = new Map<string, WorkOrder[]>();
  for (const w of workOrders) {
    if (!isOpen(w)) continue;
    const list = byCat.get(w.category) ?? [];
    list.push(w);
    byCat.set(w.category, list);
  }

  const clusters: WorkOrderCluster[] = [];
  for (const [category, list] of byCat) {
    const buildings = new Map<string, string>();
    for (const w of list) {
      if (w.location) buildings.set(w.location.id, w.location.name ?? w.location.id);
    }
    // A real cluster: 2+ work orders across 2+ distinct buildings.
    if (list.length < 2 || buildings.size < 2) continue;

    const sorted = [...list].sort(
      (a, b) =>
        Number(b.isOverdue) - Number(a.isOverdue) ||
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
    );

    clusters.push({
      key: category,
      category,
      label: category.replace(/_/g, " "),
      workOrders: sorted,
      buildingCount: buildings.size,
      buildingNames: [...buildings.values()],
      hasOverdue: list.some((w) => w.isOverdue),
      topPriority: sorted[0]?.priority ?? "low",
    });
  }

  return clusters.sort(
    (a, b) =>
      Number(b.hasOverdue) - Number(a.hasOverdue) ||
      b.buildingCount - a.buildingCount ||
      b.workOrders.length - a.workOrders.length,
  );
}
