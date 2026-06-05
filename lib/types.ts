export type Status = "Open" | "In Progress" | "Done";
export type Priority = "low" | "medium" | "high" | "critical";

export interface AssetRef {
  id: string;
  name: string | null;
  status: string | null;
  lastServiceDate: string | null;
}

export interface LocationRef {
  id: string;
  name: string | null;
  address: string | null;
}

export interface Signal {
  id: string;
  workOrderId: string;
  text: string;
  studentName: string | null;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  stageName: string | null;
  priority: Priority;
  severity: string | null;
  category: string;
  createdAt: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  location: LocationRef | null;
  assets: AssetRef[];
  assigneeIds: string[];
  source: "live" | "demo";
  signals: Signal[];
}

export interface BuildingSummary {
  id: string;
  name: string | null;
  address: string | null;
  openCount: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface SummaryCounts {
  open: number;
  inProgress: number;
  overdue: number;
}
