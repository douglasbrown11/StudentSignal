// Pure transformation from the raw CriticalAsset GraphQL shape into our clean
// WorkOrder DTO. No network, no side effects — the primary unit-test target.

import type { Priority, Signal, Status, WorkOrder } from "./types";

const VALID_PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

export function bucketStatus(stageName?: string | null): Status {
  const s = (stageName ?? "").toLowerCase().trim();
  if (/in[\s_-]?progress|doing|active|wip|ongoing/.test(s)) return "In Progress";
  if (/done|complete|completed|closed|resolved|cancel/.test(s)) return "Done";
  return "Open"; // includes "To Do", "Backlog", "New", "Open", and unknowns
}

/** Coerce an epoch-millis string/number (or ISO string) into an ISO string. */
export function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  // Numeric (or numeric string) -> treat as epoch millis.
  const asNum = Number(value);
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value.trim()))) {
    if (!Number.isFinite(asNum)) return null;
    const d = new Date(asNum);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Otherwise assume it is already a date string.
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isOverdue(dueIso: string | null, status: Status, now: number = Date.now()): boolean {
  if (!dueIso || status === "Done") return false;
  const t = new Date(dueIso).getTime();
  return Number.isFinite(t) && t < now;
}

function normPriority(value: unknown): Priority {
  const v = String(value ?? "").toLowerCase();
  return (VALID_PRIORITIES as string[]).includes(v) ? (v as Priority) : "medium";
}

export function normalizeWorkOrder(raw: any, signals: Signal[] = [], now: number = Date.now()): WorkOrder {
  const stageName: string | null = raw?.workOrderStage?.name ?? null;
  const status = bucketStatus(stageName);
  const dueDate = toIso(raw?.endDate);

  const assets = (raw?.workOrderAssets ?? [])
    .map((wa: any) => {
      const a = wa?.asset;
      if (a) {
        return {
          id: a.id,
          name: a.name ?? null,
          status: a.status ?? null,
          lastServiceDate: a.lastServiceDate ? toIso(a.lastServiceDate) ?? String(a.lastServiceDate) : null,
        };
      }
      return wa?.assetId
        ? { id: wa.assetId, name: null, status: null, lastServiceDate: null }
        : null;
    })
    .filter(Boolean);

  const assigneeIds = (raw?.workOrderAssignments ?? []).flatMap((x: any) => x?.userIds ?? []);

  return {
    id: raw.id,
    title: raw.title ?? "(untitled)",
    description: raw.description ?? null,
    status,
    stageName,
    priority: normPriority(raw?.executionPriority),
    severity: raw?.severity ?? null,
    category: raw?.workOrderServiceCategory ?? "general",
    createdAt: toIso(raw?.createdAt),
    dueDate,
    isOverdue: isOverdue(dueDate, status, now),
    location: raw?.location
      ? {
          id: raw.location.id,
          name: raw.location.locationName ?? null,
          address: raw.location.address ?? null,
        }
      : null,
    assets,
    assigneeIds,
    source: "live",
    signals,
  };
}
