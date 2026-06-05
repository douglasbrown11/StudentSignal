"use client";

import { useState } from "react";
import type { WorkOrder } from "@/lib/types";

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
          <>
            <h3>⚡ Report a problem</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              One sentence is enough. AI turns it into a structured, compliance-aware work item.
            </p>
            <div className="signal-form">
              <label>Which work order is this about?</label>
              <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}>
                <option value="">New issue (no existing work order)</option>
                {openWorkOrders.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                    {w.location?.name ? ` — ${w.location.name}` : ""}
                  </option>
                ))}
              </select>

              <label>What did you experience? *</label>
              <textarea
                rows={3}
                placeholder="e.g. The exit sign by the gym stairwell is dark and the backup light didn't come on during the drill."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />

              <div className="grid2">
                <div>
                  <label>Where exactly?</label>
                  <input value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} placeholder="2nd floor, gym stairwell" />
                </div>
                <div>
                  <label>When?</label>
                  <input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Monday, during the drill" />
                </div>
              </div>

              <div className="grid2">
                <div>
                  <label>Still happening?</label>
                  <select value={stillHappening} onChange={(e) => setStillHappening(e.target.value)}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="unsure">Not sure</option>
                  </select>
                </div>
                <div>
                  <label>How disruptive?</label>
                  <select value={disruption} onChange={(e) => setDisruption(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid2">
                <div>
                  <label>Who is affected?</label>
                  <input value={whoAffected} onChange={(e) => setWhoAffected(e.target.value)} placeholder="Students & staff" />
                </div>
                <div>
                  <label>Happened before?</label>
                  <select value={happenedBefore} onChange={(e) => setHappenedBefore(e.target.value)}>
                    <option value="unsure">Not sure</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <label>Add a photo note (describe what a photo would show)</label>
              <input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="Sign face completely unlit" />

              <label>Your name (optional)</label>
              <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Anonymous" />

              {error && <div style={{ color: "var(--overdue)", fontSize: 12 }}>{error}</div>}
              <button className="btn" onClick={submit}>
                Generate field intelligence →
              </button>
            </div>
          </>
        )}

        {step === "loading" && (
          <div className="loading" style={{ padding: "60px 20px" }}>
            <div className="spinner" />
            <div style={{ marginTop: 16 }}>{LOADING_LINES[loadingLine]}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Opus 4.8 is analyzing the signal — this takes a few seconds.
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
          <ReportView result={result} onNew={reset} />
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

function ReportView({ result, onNew }: { result: IntakeResult; onNew: () => void }) {
  const r = result.report;
  const s = r.structured;
  const esc = r.recommendedWorkflow.escalation;
  const [closed, setClosed] = useState<null | boolean>(null);
  const [closing, setClosing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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
    <div className="report">
      <div className="report-head">
        <h3>🛰️ Field Intelligence</h3>
        <button className="btn secondary" onClick={onNew}>
          + New report
        </button>
      </div>

      {esc.shouldEscalate && (
        <div className="esc-banner">
          ⚠ Escalate — <b>{esc.level}</b>: {esc.reason}
        </div>
      )}

      {/* TL;DR — the only things you must read */}
      <div className="tldr">
        {r.headline && <div className="tldr-headline">{r.headline}</div>}
        {r.bottomLine && (
          <div className="tldr-bottom">
            <span className="tldr-k">Do now</span> {r.bottomLine}
          </div>
        )}
      </div>

      <div className="pills">
        <Pill label="Severity" value={s.severity} tone={sevTone(s.severity)} />
        <Pill label="Urgency" value={s.urgency.replace("_", " ")} tone={sevTone(s.urgency)} />
        <Pill label="Category" value={s.assetCategory.replace(/_/g, " ")} />
        <Pill label="Evidence" value={s.evidenceQuality} tone={s.evidenceQuality === "strong" ? "ok" : "warn"} />
      </div>

      <Section title={`Next steps · ${r.recommendedWorkflow.suggestedAssignmentGroup}`}>
        <ol>{r.recommendedWorkflow.suggestedNextActions.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol>
      </Section>

      <Section title="Message to the reporter">
        <p className="student-msg">{r.studentStatusMessage}</p>
      </Section>

      <button className="details-toggle" onClick={() => setShowDetails((v) => !v)}>
        {showDetails ? "▾ Hide full analysis" : "▸ Show full analysis"}
      </button>

      {showDetails && (
        <div className="details-body">
          <Section title="What this is">
            <p>{r.cleanedDescription}</p>
          </Section>

          <div className="report-cols">
            <Section title="Location">
              <p className="muted">{s.locationDetail}</p>
            </Section>
            <Section title="Affected">
              <p className="muted">{s.affectedUsers}</p>
            </Section>
          </div>

          <Section title="Likely root causes">
            <ul>{s.likelyRootCauses.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
          </Section>

          <div className="report-cols">
            <Section title="Still unknown">
              <ul>{s.missingInformation.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            </Section>
            <Section title="Ask the reporter">
              <ul>{s.followUpQuestions.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            </Section>
          </div>

          <Section title={`Public data · ${result.publicData?.source ?? "—"}`}>
            <p>{r.publicData.operationalMeaning}</p>
            {r.publicData.references?.length > 0 ? (
              <ul>
                {r.publicData.references.map((x: any, i: number) => (
                  <li key={i}>
                    <b>{x.source}:</b> {x.detail}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>
                No directly-relevant public records linked{result.publicData?.note ? ` (${result.publicData.note})` : ""}.
              </p>
            )}
          </Section>

          <Section title="Check before closing">
            {r.compliance.map((c: any, i: number) => (
              <div key={i} className="oblig">
                <div className="oblig-top">
                  <b>{c.obligation}</b>
                  <span className="oblig-src">{c.source}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{c.why}</div>
              </div>
            ))}
          </Section>

          <Section title="If left unaddressed">
            <ul>{r.operationalImplications.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
          </Section>

          <Section title="Evidence checklist">
            <div className="checklist">
              {r.recommendedWorkflow.evidenceChecklist.map((x: string, i: number) => (
                <label key={i} className="check"><input type="checkbox" /> {x}</label>
              ))}
            </div>
          </Section>
        </div>
      )}

      <div className="closure">
        <div className="closure-q">🔁 {r.closureVerificationQuestion}</div>
        {closed === null ? (
          <div className="closure-btns">
            <button className="btn" disabled={closing} onClick={() => confirm(true)}>
              ✓ Yes, it's fixed
            </button>
            <button className="btn secondary" disabled={closing} onClick={() => confirm(false)}>
              ✗ No, still a problem
            </button>
          </div>
        ) : (
          <div className={`closure-result ${closed ? "ok" : "bad"}`}>
            {closed ? "Closure confirmed by reporter — reality changed. ✓" : "Reporter says it's NOT resolved — keep the signal open."}
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
