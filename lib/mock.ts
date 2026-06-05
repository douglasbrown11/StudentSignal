// Clearly-labeled demo data, emitted in the SAME normalized DTO shape as live
// work orders (source: "demo"). Merged in only when the demo toggle is on, so
// category grouping / top-5 buildings / counters have something substantial to
// show beyond the handful of real staging records.

import type { Priority, Status, WorkOrder } from "./types";

const DAY = 24 * 60 * 60 * 1000;

const BUILDINGS = [
  { id: "demo-loc-1", name: "120 Riverside Plaza", address: "120 Riverside Plaza" },
  { id: "demo-loc-2", name: "Oakwood Science Hall", address: "44 Oakwood Ave" },
  { id: "demo-loc-3", name: "Lincoln Residence Tower", address: "8 Lincoln Way" },
  { id: "demo-loc-4", name: "Maple Athletic Center", address: "210 Maple Rd" },
  { id: "demo-loc-5", name: "Cedar Library Annex", address: "5 Cedar Ct" },
];

interface Seed {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: Status;
  stageName: string;
  building: number; // index into BUILDINGS
  dueInDays: number; // negative => past (overdue when not Done)
  asset: { name: string; status: string; servicedDaysAgo: number };
}

const SEEDS: Seed[] = [
  { id: "demo-wo-1", title: "Rooftop AHU Belt Replacement", category: "hvac", priority: "high", status: "Open", stageName: "To Do", building: 0, dueInDays: -3, asset: { name: "Air Handling Unit 3", status: "operational", servicedDaysAgo: 120 } },
  { id: "demo-wo-2", title: "Lobby Lighting Circuit Fault", category: "electrical", priority: "critical", status: "Open", stageName: "To Do", building: 0, dueInDays: 2, asset: { name: "Lighting Panel L-2", status: "fault", servicedDaysAgo: 64 } },
  { id: "demo-wo-3", title: "Boiler Annual Inspection", category: "hvac", priority: "medium", status: "In Progress", stageName: "In Progress", building: 1, dueInDays: 6, asset: { name: "Boiler Unit B-1", status: "operational", servicedDaysAgo: 300 } },
  { id: "demo-wo-4", title: "Fire Extinguisher Recharge", category: "fire_and_life_safety", priority: "high", status: "Open", stageName: "To Do", building: 1, dueInDays: -1, asset: { name: "Extinguisher Set 2F", status: "needs_service", servicedDaysAgo: 200 } },
  { id: "demo-wo-5", title: "Elevator Cab Leveling", category: "structural", priority: "high", status: "In Progress", stageName: "In Progress", building: 2, dueInDays: 4, asset: { name: "Passenger Elevator 1", status: "degraded", servicedDaysAgo: 30 } },
  { id: "demo-wo-6", title: "Domestic Water Pump Seal Leak", category: "plumbing", priority: "medium", status: "Open", stageName: "To Do", building: 2, dueInDays: 9, asset: { name: "Booster Pump P-4", status: "leaking", servicedDaysAgo: 88 } },
  { id: "demo-wo-7", title: "Court Floor Refinish", category: "general", priority: "low", status: "Open", stageName: "Backlog", building: 3, dueInDays: 20, asset: { name: "Gymnasium Floor", status: "operational", servicedDaysAgo: 400 } },
  { id: "demo-wo-8", title: "Access Control Reader Replacement", category: "security", priority: "medium", status: "Done", stageName: "Done", building: 3, dueInDays: -10, asset: { name: "Door Reader E-Wing", status: "operational", servicedDaysAgo: 12 } },
  { id: "demo-wo-9", title: "HVAC Filter Change", category: "hvac", priority: "low", status: "Open", stageName: "To Do", building: 4, dueInDays: 14, asset: { name: "RTU-7", status: "operational", servicedDaysAgo: 45 } },
  { id: "demo-wo-10", title: "Emergency Egress Sign Audit", category: "fire_and_life_safety", priority: "critical", status: "Open", stageName: "To Do", building: 4, dueInDays: -2, asset: { name: "Egress Sign Set", status: "needs_service", servicedDaysAgo: 150 } },
];

export function mockWorkOrders(now: number = Date.now()): WorkOrder[] {
  return SEEDS.map((s): WorkOrder => {
    const b = BUILDINGS[s.building];
    const dueDate = new Date(now + s.dueInDays * DAY).toISOString();
    return {
      id: s.id,
      title: s.title,
      description: `Demo work order at ${b.name}.`,
      status: s.status,
      stageName: s.stageName,
      priority: s.priority,
      severity: s.priority,
      category: s.category,
      createdAt: new Date(now - 30 * DAY).toISOString(),
      dueDate,
      isOverdue: s.status !== "Done" && new Date(dueDate).getTime() < now,
      location: { id: b.id, name: b.name, address: b.address },
      assets: [
        {
          id: `${s.id}-asset`,
          name: s.asset.name,
          status: s.asset.status,
          lastServiceDate: new Date(now - s.asset.servicedDaysAgo * DAY).toISOString(),
        },
      ],
      assigneeIds: [],
      source: "demo",
      signals: [],
    };
  });
}
