"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterWorkOrders,
  groupByCategory,
  isOpen,
  summaryCounts,
  topBuildings,
} from "@/lib/select";
import type { WorkOrder } from "@/lib/types";
import IntakeTool from "./IntakeTool";
import ClusterTool from "./ClusterTool";
import ChatBot from "./ChatBot";
import Building3D from "./Building3D";
import CreateWorkOrder from "./CreateWorkOrder";

const CATEGORY_LABELS: Record<string, string> = {
  hvac: "HVAC",
  electrical: "Electrical",
  plumbing: "Plumbing",
  architectural: "Architectural",
  computers_and_telecom: "Computers & Telecom",
  fire_and_life_safety: "Fire & Life Safety",
  landscape: "Landscape",
  security: "Security",
  structural: "Structural",
  general: "General",
};

function catLabel(c: string) {
  return CATEGORY_LABELS[c] ?? c;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function Dashboard() {
  const [demo, setDemo] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeWOId, setIntakeWOId] = useState<string | null>(null);
  const [clusterOpen, setClusterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workorders?demo=${demo ? "1" : "0"}`, { cache: "no-store" });
      const json = await res.json();
      setWorkOrders(json.workOrders ?? []);
      setLiveError(json.liveError ?? null);
    } catch (e) {
      setLiveError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    load();
  }, [load]);

  // Counters / buildings / categories reflect ALL work orders; filters affect the table only.
  const counts = useMemo(() => summaryCounts(workOrders), [workOrders]);
  const buildings = useMemo(() => topBuildings(workOrders, 5), [workOrders]);
  const categories = useMemo(() => groupByCategory(workOrders), [workOrders]);
  const maxOpen = Math.max(1, ...buildings.map((b) => b.openCount));

  const tableRows = useMemo(
    () =>
      filterWorkOrders(workOrders, {
        status: statusFilter || null,
        priority: priorityFilter || null,
        category: categoryFilter || null,
        buildingId: buildingFilter,
      }),
    [workOrders, statusFilter, priorityFilter, categoryFilter, buildingFilter],
  );

  const selected = workOrders.find((w) => w.id === selectedId) ?? null;
  const openWorkOrders = useMemo(() => workOrders.filter(isOpen), [workOrders]);
  const buildingOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workOrders) {
      if (w.location?.id && w.location.name) m.set(w.location.id, w.location.name);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [workOrders]);
  const exitSignId =
    workOrders.find((w) => /exit sign/i.test(w.title))?.id ?? openWorkOrders[0]?.id ?? null;

  const openIntake = (woId: string | null) => {
    setIntakeWOId(woId);
    setIntakeOpen(true);
  };

  const buildingName = buildingFilter
    ? workOrders.find((w) => w.location?.id === buildingFilter)?.location?.name
    : null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>
            Student<span className="brand-accent">Signals</span>
          </h1>
          <div className="sub">Work orders · CriticalAsset · 350 Grand staging</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="create-launch" onClick={() => setCreateOpen(true)}>
            ➕ New work order
          </button>
          <button className="cluster-launch" onClick={() => setClusterOpen(true)}>
            🧩 Group similar (AI)
          </button>
          <button className="intake-launch" onClick={() => openIntake(exitSignId)}>
            ⚡ Field Intake (AI)
          </button>
          <label className="toggle">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            Show demo data
          </label>
        </div>
      </div>

      {liveError && (
        <div className="banner">
          Live data unavailable: {liveError}
          {demo ? " — showing demo data only." : " — try enabling demo data."}
        </div>
      )}

      <div className="counters">
        <div className="counter open">
          <div className="label">Open</div>
          <div className="value">{counts.open}</div>
        </div>
        <div className="counter progress">
          <div className="label">In Progress</div>
          <div className="value">{counts.inProgress}</div>
        </div>
        <div className="counter overdue">
          <div className="label">Overdue ⚠</div>
          <div className="value">{counts.overdue}</div>
        </div>
      </div>

      <div className="grid">
        {/* Left: filters + table */}
        <div className="panel">
          <div className="filters">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {catLabel(c.category)} ({c.count})
                </option>
              ))}
            </select>
            {buildingFilter && (
              <span className="muted">
                Building: {buildingName ?? buildingFilter}{" "}
                <button className="clear" onClick={() => setBuildingFilter(null)}>
                  clear
                </button>
              </span>
            )}
            {(statusFilter || priorityFilter || categoryFilter) && (
              <button
                className="clear"
                onClick={() => {
                  setStatusFilter("");
                  setPriorityFilter("");
                  setCategoryFilter("");
                }}
              >
                reset filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">Loading work orders…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Asset</th>
                  <th>Location</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No work orders match these filters.
                    </td>
                  </tr>
                )}
                {tableRows.map((w) => (
                  <tr
                    key={w.id}
                    className={w.id === selectedId ? "selected" : ""}
                    onClick={() => setSelectedId(w.id)}
                  >
                    <td className="title-cell">
                      {w.title}
                      {w.source === "demo" && <span className="demo-tag">demo</span>}
                      {w.source === "user" && <span className="user-tag">yours</span>}
                      {w.signals.length > 0 && <span className="sig-badge">💬 {w.signals.length}</span>}
                    </td>
                    <td>
                      <span className={`badge s-${w.status.replace(" ", ".")}`}>{w.status}</span>
                      {w.isOverdue && <span className="badge s-overdue" style={{ marginLeft: 4 }}>overdue</span>}
                    </td>
                    <td className={`p-${w.priority}`}>{w.priority}</td>
                    <td>{w.assets[0]?.name ?? "—"}</td>
                    <td>{w.location?.name ?? "—"}</td>
                    <td>{fmtDate(w.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: 3D map, buildings, categories, signal form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Building3D workOrders={workOrders} selectedId={selectedId} onSelect={setSelectedId} />

          <div className="panel">
            <h2>Top 5 Buildings · open work orders</h2>
            {buildings.length === 0 && <div className="muted">No buildings yet.</div>}
            {buildings.map((b, i) => (
              <div key={b.id} className="bld" onClick={() => setBuildingFilter(b.id)}>
                <span className="rank">{i + 1}</span>
                <span className="bld-name">{b.name ?? b.id}</span>
                <span className="bld-bar" style={{ width: `${(b.openCount / maxOpen) * 90 + 6}px` }} />
                <span className="bld-count">{b.openCount}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <h2>By Category</h2>
            {categories.length === 0 && <div className="muted">No categories yet.</div>}
            {categories.map((c) => (
              <div
                key={c.category}
                className={`cat-row clickable${categoryFilter === c.category ? " active" : ""}`}
                onClick={() => setCategoryFilter(categoryFilter === c.category ? "" : c.category)}
              >
                <span className="cat-name">{catLabel(c.category)}</span>
                <span className="cat-count">{c.count}</span>
              </div>
            ))}
          </div>

          <SignalForm openWorkOrders={openWorkOrders} onSubmitted={(wo) => {
            load();
            showToast(`Signal attached to "${wo.title}"`);
          }} />
        </div>
      </div>

      {selected && (
        <DetailPanel
          workOrder={selected}
          onClose={() => setSelectedId(null)}
          onAct={() => {
            const id = selected.id;
            setSelectedId(null);
            openIntake(id);
          }}
        />
      )}

      <IntakeTool
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        openWorkOrders={openWorkOrders}
        defaultWorkOrderId={intakeWOId}
        demo={demo}
      />

      <ClusterTool
        open={clusterOpen}
        onClose={() => setClusterOpen(false)}
        workOrders={workOrders}
        demo={demo}
      />

      <CreateWorkOrder
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        buildings={buildingOptions}
        onCreated={async (wo) => {
          await load();
          setSelectedId(wo.id);
          showToast(`Work order "${wo.title}" created`);
        }}
      />

      <ChatBot demo={demo} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function DetailPanel({
  workOrder: w,
  onClose,
  onAct,
}: {
  workOrder: WorkOrder;
  onClose: () => void;
  onAct: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="detail" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>
          ×
        </button>
        <h3>{w.title}</h3>
        <button className="act-btn" onClick={onAct}>
          ⚡ Act on this with AI — capture field truth
        </button>
        <div className="meta-row">
          <span className={`badge s-${w.status.replace(" ", ".")}`}>{w.status}</span>
          {w.isOverdue && <span className="badge s-overdue">overdue</span>}
          <span className={`badge`} style={{ background: "var(--panel-2)" }}>
            {catLabel(w.category)}
          </span>
          <span className={`p-${w.priority}`}>priority: {w.priority}</span>
          {w.source === "demo" && <span className="demo-tag">demo</span>}
        </div>

        {w.description && <p className="muted">{w.description}</p>}

        <div className="section">
          <h4>Details</h4>
          <div className="kv"><span className="k">Stage</span><span>{w.stageName ?? "—"}</span></div>
          <div className="kv"><span className="k">Severity</span><span>{w.severity ?? "—"}</span></div>
          <div className="kv"><span className="k">Created</span><span>{fmtDate(w.createdAt)}</span></div>
          <div className="kv"><span className="k">Due</span><span>{fmtDate(w.dueDate)}</span></div>
          <div className="kv"><span className="k">Assignees</span><span>{w.assigneeIds.length || "—"}</span></div>
        </div>

        <div className="section">
          <h4>Location</h4>
          <div className="kv"><span className="k">Building</span><span>{w.location?.name ?? "—"}</span></div>
          <div className="kv"><span className="k">Address</span><span>{w.location?.address ?? "—"}</span></div>
        </div>

        <div className="section">
          <h4>Linked Assets</h4>
          {w.assets.length === 0 && <div className="muted">No linked assets.</div>}
          {w.assets.map((a) => (
            <div key={a.id} className="asset-card">
              <div className="an">{a.name ?? a.id}</div>
              <div className="am">
                status: {a.status ?? "—"} · last service: {fmtDate(a.lastServiceDate)}
              </div>
            </div>
          ))}
        </div>

        <div className="section">
          <h4>Student Signals ({w.signals.length})</h4>
          {w.signals.length === 0 && <div className="muted">No observations yet.</div>}
          {w.signals.map((s) => (
            <div key={s.id} className="signal">
              <div className="txt">“{s.text}”</div>
              <div className="by">
                {s.studentName ? `${s.studentName} · ` : ""}
                {relTime(s.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalForm({
  openWorkOrders,
  onSubmitted,
}: {
  openWorkOrders: WorkOrder[];
  onSubmitted: (wo: WorkOrder) => void;
}) {
  const [workOrderId, setWorkOrderId] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const target = openWorkOrders.find((w) => w.id === workOrderId);
    if (!target) {
      setError("Pick a work order.");
      return;
    }
    if (!text.trim()) {
      setError("Enter an observation.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId, text, studentName: name }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setText("");
      setName("");
      setWorkOrderId("");
      onSubmitted(target);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h2>Add a Student Signal</h2>
      <div className="signal-form">
        <label>Work order</label>
        <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}>
          <option value="">Select an open work order…</option>
          {openWorkOrders.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
              {w.location?.name ? ` — ${w.location.name}` : ""}
            </option>
          ))}
        </select>

        <label>Observation</label>
        <input
          type="text"
          maxLength={140}
          placeholder="e.g. Water pooling under the boiler"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        <label>Your name (optional)</label>
        <input type="text" placeholder="Anonymous" value={name} onChange={(e) => setName(e.target.value)} />

        {error && <div style={{ color: "var(--overdue)", fontSize: 12 }}>{error}</div>}

        <button className="btn" disabled={submitting} onClick={submit}>
          {submitting ? "Submitting…" : "Submit signal"}
        </button>
      </div>
    </div>
  );
}
