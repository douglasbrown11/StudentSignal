// Local persistence for AI intake reports (data/reports.json), including the
// student closure loop — the reporter can later confirm whether reality changed.

import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import type { FieldIntelligenceReport } from "./ai/schema";
import type { FieldObservation } from "./ai/intake";

const FILE = path.join(process.cwd(), "data", "reports.json");

export interface Closure {
  resolved: boolean;
  comment: string | null;
  confirmedAt: string;
}

export interface IntakeReport {
  id: string;
  workOrderId: string | null;
  workOrderTitle: string | null;
  studentName: string | null;
  observation: FieldObservation;
  report: FieldIntelligenceReport;
  createdAt: string;
  closure: Closure | null;
}

async function readAll(): Promise<IntakeReport[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(all: IntakeReport[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

export async function listReports(): Promise<IntakeReport[]> {
  return readAll();
}

export async function getReport(id: string): Promise<IntakeReport | null> {
  const all = await readAll();
  return all.find((r) => r.id === id) ?? null;
}

export async function addReport(input: Omit<IntakeReport, "id" | "createdAt" | "closure">): Promise<IntakeReport> {
  const record: IntakeReport = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    closure: null,
  };
  const all = await readAll();
  all.push(record);
  await writeAll(all);
  return record;
}

export async function setClosure(id: string, closure: Omit<Closure, "confirmedAt">): Promise<IntakeReport | null> {
  const all = await readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  all[idx].closure = { ...closure, confirmedAt: new Date().toISOString() };
  await writeAll(all);
  return all[idx];
}
