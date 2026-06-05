# StudentSignals

**NYC Facilities Intelligence Platform** — built for [The City Hacks The State](https://thecityhacksthestate.com) hackathon.

A work order is only a record of what someone managed to write down. **StudentSignals captures what actually happened** — by letting students, teachers, and custodians report problems in plain English, then using AI to turn that signal into a structured, compliance-aware intelligence report that gives facilities operators a clear next action.

---

## Screenshots

![Dashboard — work order table with signal quality indicators and hero banner](screenshots/dashboard.png)

![Field intake — photo upload and plain-language observation form](screenshots/intake.png)

![Field Intelligence Report — structured analysis with DO NOW callout, severity scorecard, and escalation](screenshots/report.png)

![Before and after — weak work order enriched with field signal](screenshots/before-after.png)

> To add screenshots: take them at 1280px+ width with demo data ON, save to a `/screenshots` folder in the repo, and the images above will appear automatically.

---

## The problem

A facilities team at 350 Grand Street opens their work order queue and sees:

> *Room too hot.*

That is the entire record. No location. No timeline. No severity. No context. The operator has no idea if this is one person having a warm afternoon or 28 students getting headaches three days running while a damper fails.

**StudentSignals closes that gap.**

---

## What it does

### Challenge 01 — Work Order Dashboard

Connect to the **CriticalAsset API**, pull live work orders, and display them in a fully operational dashboard:

- Filterable work-order table (status, priority, category, building)
- Counter row: Open / In Progress / Overdue / Field Signals
- Top 5 buildings by open work orders (click to filter)
- Group by category
- Work-order detail panel with linked assets, service history, and attached signals
- Demo data toggle — merges a realistic mock dataset so the dashboard has substance beyond staging records
- Signal quality badges — rows marked `no signal`, `weak`, or `partial` show which work orders are missing field context

### Challenge 02 — Field Intelligence

The core innovation. Takes a one-sentence field observation and produces a structured **Field Intelligence Report**:

**Signal capture**
- Student or teacher opens the intake from the header or from any work order's detail panel
- Describes what they experienced in plain English — one sentence is enough
- Optionally attaches a photo from their device (analyzed by the AI as visual evidence)
- Marks whether it is still happening, how disruptive it is, and whether it has happened before
- Submits in seconds — no long forms, no jargon

**AI structuring (Claude Sonnet with adaptive thinking)**
- Issue type, severity, urgency, asset category
- Likely root causes (3–5 specific, operational candidates)
- What the system still does not know — named explicitly
- Recommended follow-up questions for the reporter
- Cleaned-up work-order description ready to update the ticket
- Evidence checklist for the responding technician
- Suggested assignment group

**Enrichment**
- **NYC 311 open data** — real Socrata API query matching complaint type to asset category, translated into operational meaning (not just counts)
- Historical work orders from the same building and category
- Public data context is always translated into action — the AI is instructed never to fabricate records

**Compliance and obligations**
- Maps issue type to likely obligations (NYC Fire Code, NFPA, DOB, DOE SOP, Local Law 97)
- Language is careful — "may require review" not legal advice
- Shown as orange cards the operator must check before closing

**Closure verification loop**
- After the operator marks the issue resolved, the original reporter is asked: *"Was it actually fixed?"*
- Three options: Yes, it's fixed / Still a problem / It's worse now
- If not resolved: work order is flagged for re-inspection and escalated automatically
- Escalation reason is logged with the report

**Deterministic escalation rules (on top of AI)**

Some escalations are too critical to leave to model judgment:

| Trigger | Action |
|---|---|
| Water near electrical equipment | Force severity to critical, escalate immediately |
| Fire door / blocked egress / smoke | Force severity to critical, escalate to life-safety team |
| Recurring issue (happenedBefore or prior work orders found) | Bump severity, log escalation reason |
| Multiple users or occupied classroom affected | Increase priority |
| Reporter confirms still happening or worse | Reopen and escalate automatically |

These rules are centralized in `lib/challenge2/escalation.ts` and always run after the AI response.

---

## Demo scenario

Open the dashboard → scroll to **"Room too hot"** → click the row → **"Add field signal to this work order"**.

The intake auto-fills with:

> *Room 304 has been extremely hot after 11 AM for the last three school days. Students are complaining of headaches and the teacher has been keeping the hallway door open. It is still happening today.*

Submit → the Field Intelligence Report shows:

- **Issue**: Recurring HVAC Overheating — Localized Thermal Comfort Failure
- **Severity**: CRITICAL (bumped from high because it is recurring with prior work orders found)
- **Do now**: Dispatch HVAC technician to Room 304 today — inspect VAV box, damper actuator, and zone thermostat
- Cleaned description with full context
- 5 specific root-cause candidates
- BMS trend data and evidence checklist
- NYC compliance implications (DOE health and safety, ASHRAE 55)
- Escalation to HVAC/Mechanical Controls Team

Then click **"Mark for Closure Verification"** → select **"Still a problem"** → see automatic escalation fire.

A second demo scenario for **"Bathroom smell"** (plumbing/sanitary/drainage) is also pre-loaded.

---

## Setup

```bash
cp .env.example .env.local
# Fill in:
#   CA_API_URL=https://350grand.stg.criticalasset.com/api
#   CA_CLIENT_ID=ca_...
#   CA_CLIENT_SECRET=...
#   ANTHROPIC_API_KEY=sk-ant-...    # optional — falls back to deterministic mock

npm install
npm run dev        # http://localhost:3000
```

`npm run build && npm start` for production. `npm test` runs 34 unit tests.

If `ANTHROPIC_API_KEY` is not set, the system uses a keyword-based deterministic fallback that produces valid structured output for all demo scenarios. The AI path is a drop-in replacement — no UI change required.

---

## Architecture

```
Browser (React / Next.js App Router)
  │
  └─ fetch /api/* ──────────────────────────────────────────────────►  Next.js API routes (server-side)
                                                                          │
                                    ┌─────────────────────────────────────┤
                                    │                                     │
                              Challenge 01                          Challenge 02
                                    │                                     │
                         lib/ca/token.ts          lib/ai/intake.ts   (Claude Sonnet)
                         lib/ca/client.ts         lib/publicdata.ts  (NYC 311)
                         lib/normalize.ts         lib/reports.ts     (JSON store)
                         lib/select.ts            lib/challenge2/    (deterministic rules)
                         lib/signals.ts
                         lib/mock.ts
                                    │
                                    ▼
                         CriticalAsset GraphQL API
                         (350 Grand staging)
```

The browser never sees the CriticalAsset secret, the CA API URL, or the Anthropic key. All three are server-side only.

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/workorders` | GET | Filtered work-order list + live error |
| `/api/workorders/:id` | GET | Single work order with assets and signals |
| `/api/summary` | GET | Counter and category totals |
| `/api/buildings` | GET | Buildings ranked by open work orders |
| `/api/signals` | GET / POST | List or submit a student signal |
| `/api/intake` | POST | Generate a Field Intelligence Report |
| `/api/intake/:id` | GET / PATCH | Fetch a report or record closure status |
| `/api/chat` | POST | Dashboard assistant (ChatBot) |
| `/api/cluster` | POST | Cross-building issue clustering |
| `/api/workorders/draft` | POST | AI-assisted work order creation |

### Key source files

| File | Purpose |
|---|---|
| `lib/ai/intake.ts` | Core AI call — builds prompt, passes photo as vision input, returns Zod-validated report |
| `lib/ai/schema.ts` | Zod schema for `FieldIntelligenceReport` |
| `lib/publicdata.ts` | NYC 311 Socrata query, timeboxed, never throws |
| `lib/challenge2/enrich.ts` | Deterministic enrichment fallback + Claude API path |
| `lib/challenge2/escalation.ts` | Rule-based escalation logic applied on top of AI output |
| `lib/challenge2/obligations.ts` | Issue type → compliance obligation mapping |
| `lib/challenge2/history.ts` | Historical work order matching by building + category + keyword |
| `app/components/IntakeTool.tsx` | Field intake form + report view + closure UI |
| `app/components/Dashboard.tsx` | Main dashboard, hero banner, work order table |

---

## Additional features

**3D building map** — Three.js visualization of buildings with work-order heat as bar height. Click a building to filter the table.

**Cross-building clustering** (`Group similar`) — Sends open work orders to Claude, which identifies patterns across buildings and suggests a single coordinated response.

**AI work order creation** — `Create work order` uses Claude to draft a structured work order from a free-text description.

**Dashboard assistant** — Floating chat interface that can answer questions about the current work order data.

---

## Known limitations

- Assignee names are not resolved — the upstream `users` resolver in staging has a schema bug (`column u.phone does not exist`). IDs are shown instead.
- Signals and reports are stored locally (`data/signals.json`, `data/reports.json`), not written back to CriticalAsset.
- NYC 311 data is citywide pattern data — it is not filtered to this specific building address. The AI is instructed to be honest about this.
- `npm audit` shows some advisories: Next.js (only resolved in a major upgrade to v16) and vitest/esbuild (dev tooling only). Not a concern for a hackathon demo; revisit before production.

---

## Judging criteria alignment

| Criterion | Points | What we built |
|---|---|---|
| Quality of student signal capture | 25 | Mobile-friendly intake: photo first, one textarea, toggle buttons — no government forms |
| AI enrichment and structuring | 25 | Claude Sonnet with adaptive thinking, Zod schema, vision for photos, 13 structured fields |
| Workflow usefulness | 20 | Numbered action steps, evidence checklist, assignment group, escalation rules |
| Compliance and public-data context | 15 | NYC 311 real data, obligation mapping (fire code / NFPA / DOE SOP / Local Law 97) |
| Feedback and closure loop | 10 | Three-state closure (fixed / still happening / worse), auto-escalation on non-resolution |
| Demo and storytelling | 5 | Hero banner with before/after, two pre-loaded demo scenarios, clear narrative |
