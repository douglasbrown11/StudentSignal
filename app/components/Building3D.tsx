"use client";

// A lightweight, dependency-free 3D-ish building view. Floors are stacked
// translucent slabs (CSS 3D transforms); each open work order is placed on a
// floor as a colored marker. Floor + position are derived deterministically
// from the work-order id — real floor coordinates aren't in the API, so this is
// illustrative (stable per work order, never random per render). Drag to rotate.

import { useEffect, useMemo, useRef, useState } from "react";
import { isOpen } from "@/lib/select";
import type { WorkOrder } from "@/lib/types";

const PRIORITY_COLOR: Record<string, string> = {
  critical: "var(--crit)",
  high: "var(--high)",
  medium: "var(--med)",
  low: "var(--low)",
};

// Tiny stable string hash → unsigned int.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface Placed {
  wo: WorkOrder;
  floor: number;
  x: number; // 0..100 within the slab
  y: number;
}

export default function Building3D({
  workOrders,
  selectedId,
  onSelect,
}: {
  workOrders: WorkOrder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Buildings present in the data, ranked by open work-order count.
  const buildings = useMemo(() => {
    const m = new Map<string, { id: string; name: string | null; openCount: number }>();
    for (const w of workOrders) {
      if (!w.location) continue;
      const e = m.get(w.location.id) ?? { id: w.location.id, name: w.location.name, openCount: 0 };
      if (isOpen(w)) e.openCount += 1;
      m.set(w.location.id, e);
    }
    return [...m.values()].sort((a, b) => b.openCount - a.openCount);
  }, [workOrders]);

  const [buildingId, setBuildingId] = useState<string | null>(null);
  const activeId = buildingId ?? buildings[0]?.id ?? null;
  const active = buildings.find((b) => b.id === activeId) ?? null;

  // Open work orders in the active building, placed on floors.
  const placed = useMemo<Placed[]>(() => {
    if (!activeId) return [];
    const wos = workOrders.filter((w) => w.location?.id === activeId && isOpen(w));
    const floors = Math.min(6, Math.max(3, Math.ceil(wos.length / 2)));
    return wos.map((wo) => {
      const h = hash(wo.id);
      return {
        wo,
        floor: h % floors,
        x: 14 + ((h >> 3) % 72),
        y: 14 + ((h >> 9) % 72),
      };
    });
  }, [workOrders, activeId]);

  const floorCount = useMemo(
    () => (placed.length ? Math.max(...placed.map((p) => p.floor)) + 1 : 3),
    [placed],
  );

  // Rotation: gentle auto-spin, overridable by dragging.
  const [spin, setSpin] = useState(35);
  const dragging = useRef(false);
  const last = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!dragging.current) setSpin((s) => (s + 0.18) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    last.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current;
    last.current = e.clientX;
    setSpin((s) => (s + dx * 0.5 + 360) % 360);
  };
  const onUp = () => {
    dragging.current = false;
  };

  if (!active) {
    return (
      <div className="panel">
        <h2>Building Map</h2>
        <div className="muted">No building locations in the current data.</div>
      </div>
    );
  }

  const GAP = 42; // px between floors

  return (
    <div className="panel">
      <div className="b3d-head">
        <h2 style={{ margin: 0 }}>Building Map · {active.name ?? active.id}</h2>
        {buildings.length > 1 && (
          <select
            className="b3d-select"
            value={activeId ?? ""}
            onChange={(e) => setBuildingId(e.target.value)}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? b.id} ({b.openCount})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="b3d-scene" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <div
          className="b3d-stage"
          style={{ transform: `rotateX(62deg) rotateZ(${spin}deg)` }}
        >
          {Array.from({ length: floorCount }).map((_, f) => (
            <div
              key={f}
              className="b3d-floor"
              style={{ transform: `translateZ(${f * GAP}px)` }}
            >
              <span className="b3d-floor-label">L{f + 1}</span>
              {placed
                .filter((p) => p.floor === f)
                .map((p) => (
                  <button
                    key={p.wo.id}
                    className={`b3d-pin${p.wo.id === selectedId ? " sel" : ""}`}
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      background: PRIORITY_COLOR[p.wo.priority] ?? "var(--accent)",
                      transform: `translate(-50%, -50%) translateZ(10px) rotateZ(${-spin}deg) rotateX(-62deg)`,
                    }}
                    title={`${p.wo.title} · ${p.wo.priority}${p.wo.isOverdue ? " · overdue" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(p.wo.id);
                    }}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="b3d-foot">
        <div className="b3d-legend">
          {(["critical", "high", "medium", "low"] as const).map((p) => (
            <span key={p} className="b3d-leg">
              <i style={{ background: PRIORITY_COLOR[p] }} /> {p}
            </span>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 11 }}>
          {placed.length} open · drag to rotate · click a marker
        </span>
      </div>
    </div>
  );
}
