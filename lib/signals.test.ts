import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { addSignal, groupSignals, listSignals } from "./signals";

const tmpFiles: string[] = [];
function tmp() {
  const f = path.join(os.tmpdir(), `signals-test-${Math.floor(performance.now() * 1000)}-${tmpFiles.length}.json`);
  tmpFiles.push(f);
  return f;
}

afterEach(async () => {
  await Promise.all(tmpFiles.map((f) => fs.rm(f, { force: true })));
  tmpFiles.length = 0;
});

describe("signals store", () => {
  it("returns [] when the file does not exist", async () => {
    expect(await listSignals(tmp())).toEqual([]);
  });

  it("appends and reads back a signal", async () => {
    const file = tmp();
    const created = await addSignal({ workOrderId: "wo-1", text: "  loose handle  ", studentName: "Sam" }, file);
    expect(created.workOrderId).toBe("wo-1");
    expect(created.text).toBe("loose handle"); // trimmed
    expect(created.studentName).toBe("Sam");
    expect(created.id).toBeTruthy();

    const all = await listSignals(file);
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe("loose handle");
  });

  it("accumulates multiple signals", async () => {
    const file = tmp();
    await addSignal({ workOrderId: "wo-1", text: "first" }, file);
    await addSignal({ workOrderId: "wo-2", text: "second" }, file);
    expect(await listSignals(file)).toHaveLength(2);
  });

  it("rejects empty text or missing work order", async () => {
    const file = tmp();
    await expect(addSignal({ workOrderId: "wo-1", text: "   " }, file)).rejects.toThrow();
    await expect(addSignal({ workOrderId: "", text: "hi" }, file)).rejects.toThrow();
  });

  it("groups signals by work order id", () => {
    const grouped = groupSignals([
      { id: "a", workOrderId: "wo-1", text: "x", studentName: null, createdAt: "t" },
      { id: "b", workOrderId: "wo-1", text: "y", studentName: null, createdAt: "t" },
      { id: "c", workOrderId: "wo-2", text: "z", studentName: null, createdAt: "t" },
    ]);
    expect(grouped.get("wo-1")).toHaveLength(2);
    expect(grouped.get("wo-2")).toHaveLength(1);
  });
});
