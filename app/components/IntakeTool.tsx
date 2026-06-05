"use client";

import { useState, useRef } from "react";
import type { WorkOrder } from "@/lib/types";

async function compressImage(file: File, maxPx = 1024, quality = 0.8): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

type Step = "form" | "loading" | "report" | "error";

interface IntakeResult {
  id: string;
  report: any;
  publicData: any;
  workOrder: WorkOrder | null;
}

const LOADING_LINES = [
  "Structuring the field signal…",
  "Pulling public data (NYC 311)…",
  "Checking compliance & obligations…",
  "Drafting the operator workflow…",
];

export default function IntakeTool({
  open,
  onClose,
  openWorkOrders,
  defaultWorkOrderId,
  demo,
}: {
  open: boolean;
  onClose: () => void;
  openWorkOrders: WorkOrder[];
  defaultWorkOrderId: string | null;
  demo: boolean;
}) {
  const [step, setStep] = useState<Step>("form");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingLine, setLoadingLine] = useState(0);

  // form state
  const [workOrderId, setWorkOrderId] = useState(defaultWorkOrderId ?? "");
  const [text, setText] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [when, setWhen] = useState("");
  const [stillHappening, setStillHappening] = useState("yes");
  const [whoAffected, setWhoAffected] = useState("");
  const [disruption, setDisruption] = useState("high");
  const [happenedBefore, setHappenedBefore] = useState("unsure");
  const [photoNote, setPhotoNote] = useState("");
  const [studentName, setStudentName] = useState("");

  // photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string>("image/jpeg");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (file: File) => {
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("Image must be under 10 MB.");
      return;
    }
    try {
      const { base64, mimeType } = await compressImage(file);
      setPhotoBase64(base64);
      setPhotoMimeType(mimeType);
      setPhotoPreview(`data:${mimeType};base64,${base64}`);
    } catch {
      setPhotoError("Failed to process image. Try a different file.");
    }
  };

  const removePhoto = () => {
    setPhotoBase64(null);
    setPhotoPreview(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!open) return null;

  const reset = () => {
    setStep("form");
    setResult(null);
    setError(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!text.trim()) {
      setError("Please describe what you experienced.");
      return;
    }
    setStep("loading");
    setError(null);
    let i = 0;
    setLoadingLine(0);
    const timer = setInterval(() => {
      i = (i + 1) % LOADING_LINES.length;
      setLoadingLine(i);
    }, 2500);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: workOrderId || null,
          demo,
          studentName,
          observation: { text, locationDetail, when, stillHappening, whoAffected, disruption, happenedBefore, photoNote },
          photoBase64: photoBase64 ?? undefined,
          photoMimeType: photoBase64 ? photoMimeType : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json);
      setStep("report");
    } catch (e) {
      setError((e as Error).message);
      setStep("error");
    } finally {
      clearInterval(timer);
    }
  };

  return (
    <div className="overlay" onClick={close}>
      <div className="intake" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          ×
        </button>

        {step === "form" && (
          <div className="intake-body">
            <div className="intake-header-row">
              <div>
                <div className="intake-eyebrow">Field Report</div>
                <h3 className="intake-title">What did you see?</h3>
              </div>
            </div>

            {/* Photo FIRST — evidence before description */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
            />
            {!photoPreview ? (
              <button type="button" className="photo-zone" onClick={() => fileInputRef.current?.click()}>
                <span className="photo-zone-label">Attach a photo</span>
                <span className="photo-zone-sub">Optional · taken from your device or camera roll</span>
              </button>
            ) : (
              <div className="photo-preview-wrap">
                <img src={photoPreview} alt="Field photo" className="photo-preview" />
                <button type="button" className="photo-remove" onClick={removePhoto}>✕</button>
                <div className="photo-ai-badge">Photo attached</div>
              </div>
            )}
            {photoError && <div className="intake-err">{photoError}</div>}

            {/* Main description */}
            <textarea
              className="intake-textarea"
              rows={4}
              placeholder="Describe what you saw or experienced. One sentence is enough."
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />

            {/* Context row */}
            <div className="intake-context-grid">
              <input className="intake-input" value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} placeholder="Exact location — room, floor, wing" />
              <input className="intake-input" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="When did it start?" />
              <input className="intake-input" value={whoAffected} onChange={(e) => setWhoAffected(e.target.value)} placeholder="Who is affected?" />
              <input className="intake-input" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Your name (optional)" />
            </div>

            {/* Toggle row */}
            <div className="intake-toggle-row">
              <button type="button" className={`intake-toggle-btn ${stillHappening === "yes" ? "active" : ""}`} onClick={() => setStillHappening(stillHappening === "yes" ? "no" : "yes")}>
                Still happening
              </button>
              <button type="button" className={`intake-toggle-btn ${disruption === "high" ? "active-warn" : ""}`} onClick={() => setDisruption(disruption === "high" ? "medium" : disruption === "medium" ? "low" : "high")}>
                {disruption === "high" ? "Very disruptive" : disruption === "medium" ? "Somewhat disruptive" : "Minor disruption"}
              </button>
              <button type="button" className={`intake-toggle-btn ${happenedBefore === "yes" ? "active" : ""}`} onClick={() => setHappenedBefore(happenedBefore === "yes" ? "no" : "yes")}>
                Happened before
              </button>
            </div>

            {/* Work order selector — secondary */}
            <details className="intake-wo-details">
              <summary className="intake-wo-summary">Link to an existing work order (optional)</summary>
              <select className="intake-input" style={{ marginTop: 8 }} value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}>
                <option value="">No existing work order</option>
                {openWorkOrders.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}{w.location?.name ? ` — ${w.location.name}` : ""}</option>
                ))}
              </select>
            </details>

            {error && <div className="intake-err">{error}</div>}

            <button className="intake-submit" disabled={!text.trim()} onClick={submit}>
              Generate field intelligence report →
            </button>
          </div>
        )}

        {step === "loading" && (
          <div className="loading" style={{ padding: "60px 20px" }}>
            <div className="spinner" />
            <div style={{ marginTop: 16 }}>{LOADING_LINES[loadingLine]}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Analyzing the signal — this takes a few seconds.
            </div>
          </div>
        )}

        {step === "error" && (
          <div style={{ padding: 20 }}>
            <h3>Something went wrong</h3>
            <div className="banner">{error}</div>
            <button className="btn secondary" onClick={reset}>
              ← Back to form
            </button>
          </div>
        )}

        {step === "report" && result && (
          <ReportView result={result} onNew={reset} photoPreview={photoPreview} />
        )}
      </div>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className={`pill ${tone ?? ""}`}>
      <span className="pill-k">{label}</span>
      <span className="pill-v">{value}</span>
    </span>
  );
}

function sevTone(v: string) {
  return v === "critical" || v === "high" || v === "immediate" || v === "emergency" || v === "urgent"
    ? "danger"
    : v === "medium" || v === "same_day"
      ? "warn"
      : "ok";
}

const SEV_COLORS: Record<string, string> = {
  critical: "#ff5c5c", high: "#ff9f43", medium: "#f5d65a", low: "#3fb950",
};

function ReportView({ result, onNew, photoPreview }: { result: IntakeResult; onNew: () => void; photoPreview?: string | null }) {
  const r = result.report;
  const s = r.structured;
  const esc = r.recommendedWorkflow.escalation;
  const [closed, setClosed] = useState<null | boolean>(null);
  const [closing, setClosing] = useState(false);
  const sevColor = SEV_COLORS[s.severity] ?? "#8b98a8";

  const confirm = async (resolved: boolean) => {
    setClosing(true);
    try {
      await fetch(`/api/intake/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      setClosed(resolved);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="report" style={{ borderTop: `4px solid ${sevColor}` }}>
      {/* Header */}
      <div className="rpt-topbar">
        <div className="rpt-eyebrow">Field Intelligence Report</div>

        <button className="rpt-new-btn" onClick={onNew}>+ New report</button>
      </div>

      {/* Escalation */}
      {esc.shouldEscalate && (
        <div className="rpt-escalate">
          <div className="rpt-esc-bar" />
          <div>
            <strong>Escalate — {esc.level.toUpperCase()}</strong>
            <div style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>{esc.reason}</div>
          </div>
        </div>
      )}

      {/* Headline */}
      {r.headline && <h2 className="rpt-headline">{r.headline}</h2>}

      {/* DO NOW callout */}
      {r.bottomLine && (
        <div className="rpt-do-now">
          <div className="rpt-do-now-label">DO NOW</div>
          <div className="rpt-do-now-text">{r.bottomLine}</div>
        </div>
      )}

      {/* Photo evidence */}
      {photoPreview && (
        <div className="rpt-photo-block">
          <img src={photoPreview} alt="Field evidence" className="rpt-photo-img" />
          <div className="rpt-photo-caption">Field photo submitted with report</div>
        </div>
      )}

      {/* Status scorecard */}
      <div className="rpt-scorecard">
        <div className="rpt-score-item" style={{ borderColor: sevColor }}>
          <div className="rpt-score-val" style={{ color: sevColor }}>{s.severity.toUpperCase()}</div>
          <div className="rpt-score-key">Severity</div>
        </div>
        <div className="rpt-score-item">
          <div className="rpt-score-val" style={{ color: sevTone(s.urgency) === "danger" ? "#ff9f43" : "#f5d65a" }}>
            {s.urgency.replace(/_/g, " ").toUpperCase()}
          </div>
          <div className="rpt-score-key">Urgency</div>
        </div>
        <div className="rpt-score-item">
          <div className="rpt-score-val">{s.assetCategory.replace(/_/g, " ")}</div>
          <div className="rpt-score-key">Category</div>
        </div>
        <div className="rpt-score-item">
          <div className="rpt-score-val" style={{ color: s.evidenceQuality === "strong" ? "#3fb950" : "#f5d65a" }}>
            {s.evidenceQuality.toUpperCase()}
          </div>
          <div className="rpt-score-key">Evidence</div>
        </div>
      </div>

      {/* Cleaned description */}
      <div className="rpt-desc">{r.cleanedDescription}</div>

      {/* Context row */}
      <div className="rpt-context-row">
        {s.locationDetail && <span className="rpt-ctx-chip">Location: {s.locationDetail}</span>}
        {s.affectedUsers && <span className="rpt-ctx-chip">Affected: {s.affectedUsers}</span>}
      </div>

      {/* Next steps */}
      <div className="rpt-section">
        <div className="rpt-section-label">Next steps · {r.recommendedWorkflow.suggestedAssignmentGroup}</div>
        <ol className="rpt-actions">
          {r.recommendedWorkflow.suggestedNextActions.map((x: string, i: number) => (
            <li key={i} className="rpt-action-item">
              <span className="rpt-action-num">{i + 1}</span>
              <span>{x}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Evidence checklist */}
      <div className="rpt-section">
        <div className="rpt-section-label">Collect this evidence</div>
        <div className="rpt-checklist">
          {r.recommendedWorkflow.evidenceChecklist.map((x: string, i: number) => (
            <label key={i} className="rpt-check-item"><input type="checkbox" /> {x}</label>
          ))}
        </div>
      </div>

      {/* Compliance — orange cards */}
      {r.compliance?.length > 0 && (
        <div className="rpt-section">
          <div className="rpt-section-label">Check before closing</div>
          {r.compliance.map((c: any, i: number) => (
            <div key={i} className="rpt-compliance-card">
              <div className="rpt-compliance-top">
                <strong>{c.obligation}</strong>
                <span className="rpt-compliance-src">{c.source}</span>
              </div>
              <div className="rpt-compliance-why">{c.why}</div>
            </div>
          ))}
        </div>
      )}

      {/* Public data */}
      {r.publicData?.operationalMeaning && (
        <div className="rpt-section rpt-public-data">
          <div className="rpt-section-label">NYC public data context</div>
          <div className="rpt-public-text">{r.publicData.operationalMeaning}</div>
          {r.publicData.references?.length > 0 && (
            <ul className="rpt-pub-refs">
              {r.publicData.references.map((x: any, i: number) => (
                <li key={i}><strong>{x.source}:</strong> {x.detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Root causes + unknowns */}
      <div className="rpt-two-col">
        {s.likelyRootCauses?.length > 0 && (
          <div className="rpt-section">
            <div className="rpt-section-label">Likely root causes</div>
            <ul className="rpt-list">{s.likelyRootCauses.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {s.missingInformation?.length > 0 && (
          <div className="rpt-section">
            <div className="rpt-section-label">Still unknown</div>
            <ul className="rpt-list rpt-list-warn">{s.missingInformation.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
      </div>

      {/* Reporter message */}
      <div className="rpt-reporter-msg">
        <div className="rpt-section-label">Message to the reporter</div>
        <div className="rpt-msg-text">{r.studentStatusMessage}</div>
      </div>

      {/* Closure */}
      <div className="rpt-closure">
        <div className="rpt-closure-q">{r.closureVerificationQuestion}</div>
        {closed === null ? (
          <div className="rpt-closure-btns">
            <button className="rpt-close-yes" disabled={closing} onClick={() => confirm(true)}>Yes, it's fixed</button>
            <button className="rpt-close-no" disabled={closing} onClick={() => confirm(false)}>Still a problem</button>
          </div>
        ) : (
          <div className={`rpt-closure-result ${closed ? "rpt-cr-ok" : "rpt-cr-bad"}`}>
            {closed ? "Closure confirmed — reality changed." : "Reporter says it is not resolved — signal stays open."}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rsec">
      <h4>{title}</h4>
      {children}
    </div>
  );
}
