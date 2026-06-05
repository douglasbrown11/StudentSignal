# StudentSignals

A work-order dashboard for the **CriticalAsset** API. It reads work orders through
its own backend (which holds the client secret and auto-refreshes the access token),
enriches them with asset and location data, and lets students attach one-line
observations ("signals") to open work orders.

## Features

- **Counter row** — Open / In Progress / Overdue.
- **Work-order table** — title · status · priority · asset · location · due date, with
  **filters** by status and priority. Click a row for a detail panel.
- **Detail panel** — full work order + linked asset(s) (status, last service date) +
  location + attached student signals.
- **Top 5 buildings** by open work orders (click to filter the table).
- **Group by category** (`workOrderServiceCategory`).
- **Student signals** — pick an open work order, submit a one-line observation; it's
  stored locally and shown in the work order's detail panel and as a row badge.
- **Demo data toggle** — merges a labeled mock dataset (5 buildings, several categories)
  with the live data so the views have substance beyond the few real staging records.

### Challenge 02 — AI field-intake & workflow

A work order is only a record of what someone captured. The **Field Intake (AI)** tool
(launch from the header, or "Act on this with AI" inside a work-order detail panel) lets a
student/field user report what's really happening in one sentence, and uses **Claude Opus
4.8** (adaptive thinking, Zod-validated structured output) to turn it into a **Field
Intelligence Report**:

- structured signal — issue type, severity, urgency, affected users, **evidence quality**,
  likely root causes, **what the system still doesn't know**, follow-up questions
- cleaned-up work-order description
- **public-data context** — best-effort real **NYC 311** open-data lookup, translated into
  operational meaning (and honest when records aren't relevant — it won't fabricate)
- **compliance & obligations** to check before closure (fire code, NFPA, inspections, SOPs)
- operational implications, recommended workflow, assignment group, **evidence checklist**
- **escalation logic** (safety / recurrence / compliance / unresolved)
- a plain-language **student status message** + a **closure verification question**, so the
  reporter can later confirm whether reality actually changed (the closure loop).

Backend: `POST /api/intake` (resolve WO context → NYC 311 → one structured Claude call →
persist), `PATCH /api/intake/:id` (closure). The Anthropic key stays server-side, never
sent to the browser — same boundary as the CriticalAsset secret.

## Setup

```bash
cp .env.example .env      # fill in CA_CLIENT_ID / CA_CLIENT_SECRET / CA_API_URL
npm install
npm run dev               # http://localhost:3000
```

`npm run build && npm run start` for a production build. `npm test` runs the unit tests.

## Architecture

```
Browser (React dashboard)  ──fetch /api/*──►  Next.js API routes
                                                ├─ lib/ca/token.ts   mint + cache + refresh token
                                                ├─ lib/ca/client.ts  GraphQL POST (401/429 retry)
                                                ├─ lib/normalize.ts  raw → clean WorkOrder DTO
                                                ├─ lib/select.ts     counters / buildings / categories
                                                ├─ lib/signals.ts    data/signals.json store
                                                └─ lib/mock.ts        demo dataset
                                                       │
                                                       ▼
                                          CriticalAsset GraphQL (staging)
```

The browser only ever talks to our `/api/*` routes — the client secret and the upstream
GraphQL URL never reach it.

### API routes

| Route | Purpose |
|---|---|
| `GET /api/workorders?status=&priority=&buildingId=&demo=` | filtered work-order list |
| `GET /api/workorders/:id?demo=` | single work order + assets + signals |
| `GET /api/summary?demo=` | counters + category counts |
| `GET /api/buildings?demo=` | buildings ranked by open work orders |
| `GET/POST /api/signals` | list / submit a student signal |
| `POST /api/intake` | AI field-intake → Field Intelligence Report (Challenge 02) |
| `GET/PATCH /api/intake/:id` | fetch a report / record the student closure confirmation |

## Notes & known limitations

- **Category** uses the work order's `workOrderServiceCategory` enum; the `Asset` type has
  no `category` field. Asset enrichment uses `asset.status` and `asset.lastServiceDate`.
- **Assignees** are shown as IDs only. The upstream `users` resolver is broken in staging
  (`column u.phone does not exist`), so names aren't resolved.
- Signals are stored locally (`data/signals.json`), not written back to CriticalAsset.
- **Security:** runs on the latest patched Next 14.2.x. Some `npm audit` advisories remain
  (Next → only fixed by a major upgrade to 16; vitest/esbuild → dev-tooling only). Revisit
  before any production deployment.

See `docs/superpowers/specs/2026-06-05-studentsignals-dashboard-design.md` for the full design.
