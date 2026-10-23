# Dashboard Designer

Admins and Leaders choose which widgets appear on the dashboard, their order and their width, in
**Settings → Dashboard Design**.

## What it controls
- **Everyone** tab: the dashboard for BDMs and Account Managers.
- **Leaders** tab: a separate Leader dashboard. It is used only when *"Leaders use the same layout as
  everyone"* is switched **off** (default: on, so Leaders see the Everyone layout).
- Per widget: drag (or ↑/↓) to reorder, width 1 / 2 / 3 columns, show/hide.
- Reset to default, Save, a live preview of the **real** widgets (desktop / mobile), and the last 5
  saved layouts with Restore (Restore loads into the editor; press Save to apply).
- Mobile is always one column in the same order. Tablet is 2 columns, desktop 3.

Nothing applies until **Save**.

## Widgets (`src/lib/dashboard-layout.ts`)
| id | Widget | Default width | Data |
|---|---|---|---|
| `today` | Today: overdue + due-today Manage Time tasks | 3 | `timeManagementPlans` (own) |
| `kpi-pipeline` | Revenue & Pipeline cards | 3 | `bdmStats/{uid}` (team totals on the Leader dashboard) |
| `weekly-rhythm` | Thursday TWTW + Friday FW + next-week commitments | 2 | one doc per week each |
| `ambd-notes` | AMBD notes | 1 | existing widget |
| `verticals` | New / claimed / pain-flagged + top suggested WA prospects | 2 | `verticalProspects` (limit 300) |
| `fuel` | Fuel Surcharges: TGE vs competitors, last checked | 1 | `fuelSurcharges` + overrides |
| `fact-finding` | Fact Finding in progress | 1 | own `factFindingDocs` |
| `canvassing` | Canvassing leads | 1 | own `canvass_leads` (limit 100) |
| `call-plans` | Call plans / White Space still to do | 1 | own Top-8 deals + plans |
| `team-snapshot` | Team snapshot (**Leaders only**): TWTW submitted, shared access, CRM data health | 3 | bounded team queries |
| `crm-summary`, `customer-review`, `pipeline-review` | Optional (hidden by default): the older CRM / customer / pipeline tables | 3 | existing components |

"Due" for Call plans / White Space is gap-based (a Top-8 deal with Fact Finding but no Call Plan, or a bare
account without White Space) because those documents have no due date.

## Storage: `appSettings/global`
- `dashboardLayout` – Everyone layout `[{ id, name, width, visible }]`
- `leaderDashboardLayout` – Leaders layout
- `useSameLayoutForLeaders` – boolean (missing = true)
- `dashboardLayoutHistory` – last 5 saves, newest first
- `dashboardLayoutUpdatedAt`, `dashboardLayoutUpdatedBy`

Old layouts are upgraded on read (`normalizeLayout`): `kpi-cards → kpi-pipeline`, `twiw` / `friday-fw →
weekly-rhythm`, `call-prep → call-plans`; `monday-planning` and `voice-logger` are dropped; widgets that did
not exist before are appended with defaults. Nothing is forced or pinned: the saved layout is what renders.

## Security
`appSettings/{docId}` is readable by staff and writable only by `isAdmin()` (role field: LEADER, GM, ADMIN,
SUPER_ADMIN). No rules change was needed. `tests/rules/firestore.rules.test.ts` covers the layout write.
