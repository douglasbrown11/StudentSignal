// Local persistence for student signals — a JSON file on the backend.
// Functions accept an optional file path so tests can use a temp file.

import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import type { Signal } from "./types";

const DEFAULT_FILE = path.join(process.cwd(), "data", "signals.json");

async function readAll(file: string): Promise<Signal[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listSignals(file: string = DEFAULT_FILE): Promise<Signal[]> {
  return readAll(file);
}

export interface NewSignal {
  workOrderId: string;
  text: string;
  studentName?: string | null;
}

export async function addSignal(input: NewSignal, file: string = DEFAULT_FILE): Promise<Signal> {
  const text = (input.text ?? "").trim();
  if (!input.workOrderId) throw new Error("workOrderId is required");
  if (!text) throw new Error("text is required");

  const signal: Signal = {
    id: randomUUID(),
    workOrderId: input.workOrderId,
    text,
    studentName: input.studentName?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  const all = await readAll(file);
  all.push(signal);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(all, null, 2));
  return signal;
}

/** Group signals by work-order id for quick hydration. */
export function groupSignals(signals: Signal[]): Map<string, Signal[]> {
  const map = new Map<string, Signal[]>();
  for (const s of signals) {
    const list = map.get(s.workOrderId) ?? [];
    list.push(s);
    map.set(s.workOrderId, list);
  }
  return map;
}
