"use client";

import { useState } from "react";
import type { WorkOrder } from "@/lib/types";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "hvac", label: "HVAC" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "architectural", label: "Architectural" },
  { value: "computers_and_telecom", label: "Computers & Telecom" },
  { value: "fire_and_life_safety", label: "Fire & Life Safety" },
  { value: "landscape", label: "Landscape" },
  { value: "security", label: "Security" },
  { value: "structural", label: "Structural" },
  { value: "general", label: "General" },
];

const NEW_BUILDING = "__new__";

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CreateWorkOrder({
  open,
  onClose,
  buildings,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  buildings: { id: string; name: string }[];
  onCreated: (wo: WorkOrder) => void;
}) {
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [severity, setSeverity] = useState("medium");
  const [status, setStatus] = useState("Open");
  const [buildingChoice, setBuildingChoice] = useState("");
  const [newBuilding, setNewBuilding] = useState("");
  const [assetName, setAssetName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reporterName, setReporterName] = useState("");

  const [autofilling, setAutofilling] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{ confidence: string; needsMoreInfo: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setDescription(""); setTitle(""); setCategory("general"); setPriority("medium");
    setSeverity("medium"); setStatus("Open"); setBuildingChoice(""); setNewBuilding("");
    setAssetName(""); setDueDate(""); setReporterName(""); setDraftMeta(null); setError(null);
  };
  const close = () => { reset(); onClose(); };

  const autofill = async () => {
    if (description.trim().length < 10) {
      setError("Add at least a sentence describing the problem, then let AI fill the rest.");
      return;
    }
    setAutofilling(true);
    setError(null);
    try {
      const res = await fetch("/api/workorders/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, buildingNames: buildings.map((b) => b.name) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const d = json.draft;

      setTitle(d.title ?? "");
      setCategory(d.category ?? "general");
      setPriority(d.priority ?? "medium");
      setSeverity(d.severity ?? d.priority ?? "medium");
      if (d.cleanedDescription) setDescription(d.cleanedDescription);
      setAssetName(d.assetName ?? "");
      if (typeof d.suggestedDueInDays === "number") setDueDate(inDays(d.suggestedDueInDays));

      // Match AI's location to an existing building, else stage it as a new one.
      if (d.locationName) {
        const match = buildings.find((b) => b.name.toLowerCase() === String(d.locationName).toLowerCase());
        if (match) {
          setBuildingChoice(match.id);
          setNewBuilding("");
        } else {
          setBuildingChoice(NEW_BUILDING);
          setNewBuilding(d.locationName);
        }
      }

      setDraftMeta({ confidence: d.confidence, needsMoreInfo: d.needsMoreInfo ?? [] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAutofilling(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      setError("Give the work order a title (or use Autofill).");
      return;
    }
    setSubmitting(true);
    setError(null);

    let locationId: string | null = null;
    let locationName: string | null = null;
    if (buildingChoice && buildingChoice !== NEW_BUILDING) {
      locationId = buildingChoice;
      locationName = buildings.find((b) => b.id === buildingChoice)?.name ?? null;
    } else if (buildingChoice === NEW_BUILDING && newBuilding.trim()) {
      locationName = newBuilding.trim();
    }

    try {
      const res = await fetch("/api/workorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, category, priority, severity, status,
          locationId, locationName,
          assetName: assetName || null,
          dueDate: dueDate || null,
          reporterName: reporterName || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      onCreated(json.workOrder);
      reset();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overlay" onClick={close}>
      <div className="intake" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>×</button>

        <h3>➕ New work order</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Describe the problem and fill the fields — or let AI draft them for you.
        </p>

        <div className="signal-form">
          <label>Describe the problem *</label>
          <textarea
            rows={3}
            placeholder="e.g. The boiler in the basement of Oakwood Science Hall is leaking water onto the floor and making a loud banging noise."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button className="autofill-btn" onClick={autofill} disabled={autofilling || description.trim().length < 10}>
            {autofilling ? "✨ Drafting…" : "✨ Autofill fields with AI"}
          </button>

          {draftMeta && (
            <div className="draft-note">
              <span className={`conf conf-${draftMeta.confidence}`}>AI confidence: {draftMeta.confidence}</span>
              {draftMeta.needsMoreInfo.length > 0 && (
                <ul>
                  {draftMeta.needsMoreInfo.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              )}
            </div>
          )}

          <label>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Boiler leak — basement" />

          <div className="grid2">
            <div>
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid2">
            <div>
              <label>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            </div>
          </div>

          <label>Building</label>
          <select value={buildingChoice} onChange={(e) => setBuildingChoice(e.target.value)}>
            <option value="">No building / unspecified</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value={NEW_BUILDING}>➕ New building…</option>
          </select>
          {buildingChoice === NEW_BUILDING && (
            <input value={newBuilding} onChange={(e) => setNewBuilding(e.target.value)} placeholder="New building name" />
          )}

          <div className="grid2">
            <div>
              <label>Asset / equipment</label>
              <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Boiler Unit B-1" />
            </div>
            <div>
              <label>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <label>Your name (optional)</label>
          <input value={reporterName} onChange={(e) => setReporterName(e.target.value)} placeholder="Anonymous" />

          {error && <div style={{ color: "var(--overdue)", fontSize: 12 }}>{error}</div>}

          <button className="btn" disabled={submitting} onClick={submit}>
            {submitting ? "Creating…" : "Create work order"}
          </button>
        </div>
      </div>
    </div>
  );
}
