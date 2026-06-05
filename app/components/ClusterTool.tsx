"use client";

import { useMemo, useState } from "react";
import { findCrossBuildingClusters, type WorkOrderCluster } from "@/lib/cluster";
import type { WorkOrder } from "@/lib/types";

type Step = "list" | "loading" | "analysis" | "error";

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
const catLabel = (c: string) => CATEGORY_LABELS[c] ?? c.replace(/_/g, " ");

export default function ClusterTool({
  open,
  onClose,
  workOrders,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  demo: boolean;
}) {
  const clusters = useMemo(() => findCrossBuildingClusters(workOrders), [workOrders]);
  const [step, setStep] = useState<Step>("list");
  const [active, setActive] = useState<WorkOrderCluster | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    setStep("list");
    setActive(null);
    setAnalysis(null);
    setError(null);
    onClose();
  };

  const analyze = async (cluster: WorkOrderCluster) => {
    setActive(cluster);
    setStep("loading");
    setError(null);
    try {
      const res = await fetch("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderIds: cluster.workOrders.map((w) => w.id),
          category: cluster.category,
          demo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setAnalysis(json.analysis);
      setStep("analysis");
    } catch (e) {
      setError((e as Error).message);
      setStep("error");
    }
  };

  return (
    <div className="overlay" onClick={close}>
      <div className="intake" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          ×
        </button>

        {step === "list" && (
          <>
            <h3>🧩 Group similar issues</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Open work orders of the same type across multiple buildings — candidates to handle as one
              coordinated response. Pick a group to analyze.
            </p>
            {clusters.length === 0 ? (
              <div className="muted" style={{ padding: "20px 0" }}>
                No cross-building patterns right now — every open issue type is contained to a single building.
                {!demo && " Try enabling demo data for more to work with."}
              </div>
            ) : (
              <div className="cluster-list">
                {clusters.map((c) => (
                  <div key={c.key} className="cluster-card">
                    <div className="cluster-top">
                      <b>{catLabel(c.category)}</b>
                      <span className="cluster-badges">
                        {c.hasOverdue && <span className="badge s-overdue">overdue</span>}
                        <span className={`p-${c.topPriority}`}>{c.topPriority}</span>
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.workOrders.length} work orders · {c.buildingCount} buildings
                    </div>
                    <div className="cluster-buildings">{c.buildingNames.join(" · ")}</div>
                    <button className="btn" style={{ marginTop: 8 }} onClick={() => analyze(c)}>
                      Analyze this group with AI →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === "loading" && (
          <div className="loading" style={{ padding: "60px 20px" }}>
            <div className="spinner" />
            <div style={{ marginTop: 16 }}>
              Analyzing {active?.workOrders.length} work orders across {active?.buildingCount} buildings…
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Looking for a shared root cause and the most efficient response.
            </div>
          </div>
        )}

        {step === "error" && (
          <div style={{ padding: 20 }}>
            <h3>Something went wrong</h3>
            <div className="banner">{error}</div>
            <button className="btn secondary" onClick={() => setStep("list")}>
              ← Back to groups
            </button>
          </div>
        )}

        {step === "analysis" && analysis && active && (
          <AnalysisView cluster={active} a={analysis} onBack={() => setStep("list")} />
        )}
      </div>
    </div>
  );
}

function AnalysisView({
  cluster,
  a,
  onBack,
}: {
  cluster: WorkOrderCluster;
  a: any;
  onBack: () => void;
}) {
  const esc = a.escalation;
  return (
    <div className="report">
      <div className="report-head">
        <h3>🧩 {catLabel(cluster.category)} · portfolio view</h3>
        <button className="btn secondary" onClick={onBack}>
          ← Groups
        </button>
      </div>

      {esc?.shouldEscalate && (
        <div className="esc-banner">
          Escalate — <b>{esc.level}</b>: {esc.reason}
        </div>
      )}

      <div className="tldr">
        <div className="tldr-headline">{a.headline}</div>
        <div className="tldr-bottom">
          <span className="tldr-k">Do now</span> {a.bottomLine}
        </div>
      </div>

      <div className="pills">
        <span className={`pill ${a.isSystemic ? "warn" : "ok"}`}>
          <span className="pill-k">Assessment</span>
          <span className="pill-v">{a.isSystemic ? "Systemic pattern" : "Loosely related"}</span>
        </span>
        <span className="pill">
          <span className="pill-k">Owner</span>
          <span className="pill-v">{a.recommendedOwner}</span>
        </span>
        <span className="pill">
          <span className="pill-k">Scope</span>
          <span className="pill-v">{cluster.workOrders.length} WOs · {cluster.buildingCount} bldgs</span>
        </span>
      </div>

      <div className="rsec">
        <h4>The pattern</h4>
        <p>{a.pattern}</p>
      </div>

      <div className="rsec">
        <h4>Coordinated plan</h4>
        <ol>{a.consolidatedActions.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol>
      </div>

      <div className="rsec">
        <h4>Tackle buildings in this order</h4>
        {a.prioritizedBuildings.map((b: any, i: number) => (
          <div key={i} className="oblig">
            <div className="oblig-top">
              <b>{b.building}</b>
              <span className={`oblig-src order-${b.priority}`}>{b.priority}</span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{b.why}</div>
          </div>
        ))}
      </div>

      <div className="report-cols">
        <div className="rsec">
          <h4>Likely shared cause</h4>
          <ul>{a.sharedRootCauses.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
        </div>
        <div className="rsec">
          <h4>Why batch it</h4>
          <p>{a.efficiencyGain}</p>
        </div>
      </div>

      <div className="rsec">
        <h4>Work orders in this group</h4>
        {cluster.workOrders.map((w) => (
          <div key={w.id} className="cluster-wo">
            <span className={`dot p-${w.priority}`}>●</span> {w.title}
            <span className="muted"> — {w.location?.name ?? "—"}</span>
            {w.isOverdue && <span className="badge s-overdue" style={{ marginLeft: 6 }}>overdue</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
