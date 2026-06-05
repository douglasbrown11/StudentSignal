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
