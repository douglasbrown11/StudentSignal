# StudentSignals Dashboard — Design Spec

**Date:** 2026-06-05
**Status:** Approved for implementation

## Goal

A dashboard that reads work orders from the CriticalAsset GraphQL API (via our own
backend) and renders them with counters, a filterable table, per-row detail panels,
asset enrichment, a buildings view, category grouping, and a student "signal" feature
that lets a student attach a one-line observation to a chosen open work order.

## Decisions (locked)

- **Stack:** Next.js (App Router) full-stack. Browser talks only to our `/api/*`.
- **Secret handling:** `CA_CLIENT_ID` / `CA_CLIENT_SECRET` stay server-side. The browser
  never receives the secret or the upstream GraphQL URL.
- **Map view:** building list with "Top 5 by open work orders" (no map tiles/keys).
- **Signal storage:** local JSON file (`data/signals.json`) on the backend.
- **Demo data:** live CriticalAsset data + a clearly-labeled mock dataset, merged when a
  `demo` toggle is on, so category grouping / top-5 buildings have substance.
- **Category source:** `workOrderServiceCategory` enum on the work order
  (`hvac, electrical, plumbing, architectural, computers_and_telecom,
  fire_and_life_safety, landscape, security, structural, general`). The `Asset` type has
  no `category`; this enum is the reliable grouping key.
- **Asset enrichment:** `asset.status` and `asset.lastServiceDate` (both exist directly
  on `Asset`). Plus asset `name`.
- **Assignees:** shown as IDs only. The live `users` resolver is broken server-side
  (`column u.phone does not exist`), so we do not resolve names for now.
- **Student signal target:** the **student explicitly picks** the open work order from a
  list. (No geographic "nearest" heuristic.)

## Upstream API facts (verified via introspection)

- Endpoint: `CA_API_URL` (= `https://350grand.stg.criticalasset.com/api`), GraphQL.
- Auth: `Authorization: Bearer <token>`. Token minted via
  `applicationClientCredentialsToken` mutation, `expiresIn: 3600`.
- Required scopes for this app: `assets.read locations.read workorders.read workorders.write`.
- `workOrders(filter, limit, offset)` returns a `WorkOrderConnection { totalCount, nodes }`.
- WorkOrder fields used: `id, title, description, executionPriority, severity,
  workOrderServiceCategory, createdAt, endDate, workOrderStage { id name },
  location { id locationName address coordinates },
  workOrderAssets { id assetId asset { id name status lastServiceDate } },
  workOrderAssignments { id assignmentType userIds }`.
  - `executionPriority`: `low | medium | high | critical`.
  - `createdAt` / `endDate`: epoch milliseconds (strings).
  - Do NOT request `workOrderAssignments.users { ... }` — triggers the `u.phone` bug.
- `workOrder(id)` for single fetch; `locations()` for buildings; `masterWorkOrderStages()`
  to enumerate real stage names for status bucketing.

## Architecture

```
Browser (React dashboard)
      │  fetch /api/*
      ▼
Next.js API routes
  • token manager (in-memory): mint, cache until ~exp (60s skew), refresh on 401
  • CA client: POST GraphQL with bearer
  • normalizer: raw GraphQL → clean WorkOrder DTO (isolates UI from schema quirks)
  • signals store: data/signals.json (read/append)
  • mock dataset: emitted in the SAME DTO shape, merged when demo=on
      ▼
CriticalAsset GraphQL (staging)   +   local mock dataset
```

### Modules (each independently testable)

- `lib/ca/token.ts` — `getToken()`: returns a valid access token, minting/refreshing as
  needed. Pure-ish; network mintable behind an injected fetch for tests.
- `lib/ca/client.ts` — `caQuery(query, variables)`: posts to upstream with bearer, throws
  typed errors on GraphQL errors / 401 / 403 / 429 (with one retry+backoff on 429, one
  re-mint+retry on 401).
- `lib/normalize.ts` — `normalizeWorkOrder(raw)` and helpers: `bucketStatus(stageName)`,
  `isOverdue(dueMs, status)`. Pure functions. **Primary unit-test target.**
- `lib/signals.ts` — `listSignals()`, `addSignal({workOrderId, text, studentName})`.
- `lib/mock.ts` — mock work orders / buildings in normalized shape (flag: `source: 'demo'`).
- `lib/select.ts` — `topBuildings(workOrders, n)`, `groupByCategory(workOrders)`,
  `summaryCounts(workOrders)`. Pure functions. Unit-tested.

### Normalized WorkOrder DTO

```ts
{
  id, title, description,
  status,            // "Open" | "In Progress" | "Done"
  stageName,         // raw, e.g. "To Do"
  priority,          // "low" | "medium" | "high" | "critical"
  severity,
  category,          // workOrderServiceCategory enum value
  createdAt,         // ISO string
  dueDate,           // ISO string | null
  isOverdue,         // boolean
  location: { id, name, address, coordinates } | null,
  assets: [{ id, name, status, lastServiceDate }],
  assigneeIds: string[],
  source: "live" | "demo",
  signals: [{ id, text, studentName, createdAt }]   // hydrated from signals store
}
```

**Status bucketing:** fetch `masterWorkOrderStages()` once (cached). Map by name,
case-insensitive: `todo|to do|backlog|open|new` → `Open`; `in progress|doing|active` →
`In Progress`; `done|complete|completed|closed|resolved` → `Done`. Unknown → `Open`.
**Overdue:** `dueDate` in the past AND status ≠ `Done`.

## API routes

| Route | Behavior |
|---|---|
| `GET /api/workorders?status=&priority=&demo=` | normalized list, filtered server-side; hydrates signals |
| `GET /api/workorders/:id?demo=` | one WO + assets + signals |
| `GET /api/summary?demo=` | `{ open, inProgress, overdue }` + `categories: [{category,count}]` |
| `GET /api/buildings?demo=` | `[{ id, name, address, openCount }]` sorted desc (UI takes top 5) |
| `GET /api/signals` | all signals |
| `POST /api/signals` | body `{ workOrderId, text, studentName? }` → append, return created signal |

Error mapping surfaced to UI: 401 → "session expired" (auto-handled by re-mint), 403 →
"missing scope", 429 → "rate limited, retrying". Upstream GraphQL field errors → 502 with
message.

## UI (single dashboard page)

```
Header: StudentSignals            [ ☐ Show demo data ]
Counter row: [ Open N ] [ In Progress N ] [ Overdue N ⚠ ]
Left: Filter [Status ▾][Priority ▾]; Table rows = title · status · priority ·
      asset name · location · due date; signal-count badge per row; click → detail panel
Right: TOP 5 BUILDINGS (open counts, click filters table) ; BY CATEGORY (counts)
Detail panel (on row click): full WO + linked asset(s) (name/status/last service) +
      location + student signals list + "add observation" affordance
```

### Student signal flow

A "Add observation" form: one-line text, optional student name, and a **work-order picker**
(a select of currently **open** work orders, showing title + building). On submit →
`POST /api/signals`. The signal then appears in that work order's detail panel and as a
badge on its table row. Confirmation shows which WO it was attached to.

## Testing

Pure-function unit tests (no network):
- `normalizeWorkOrder` against a raw GraphQL fixture (incl. ms→ISO, null handling).
- `bucketStatus` across known/unknown stage names.
- `isOverdue` boundary cases.
- `summaryCounts`, `topBuildings` (ordering/ties), `groupByCategory`.
- `signals.addSignal` / `listSignals` round-trip against a temp file.

Smoke: app builds, dev server serves the dashboard, `/api/workorders` returns live data,
demo toggle adds mock rows, submitting a signal attaches it to the picked WO.

## Out of scope (YAGNI)

- Real interactive map / tiles.
- Resolving assignee names (blocked by upstream bug).
- Writing work orders back to CriticalAsset (signals are local).
- Auth/login for students (single shared dashboard).
- Pagination UI (live set is tiny; `limit` is generous, `offset` supported if needed).
