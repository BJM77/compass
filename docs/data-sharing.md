# Access: sharing one user's data with another

Admins (role `LEADER`, `GM`, `ADMIN`, `SUPER_ADMIN` in `users/{uid}.role`) can open **Leadership & Admin → Access**
and tick boxes to share one BDM / Account Manager's data with another.

* **One-way.** Ticking Isaac → Namra gives Namra Isaac's data. It does *not* give Isaac Namra's data.
* **Full access** (read, edit, delete) to the owner's records in the ticked areas. The owner stays the owner
  (`userId` is preserved on every shared edit; rules enforce this with `keepsOwner()`), so credit and reporting are unchanged.
* **Areas:** Fact Finding, White Space, Call Plans, Canvassing. Ticking **Fact Finding also ticks (and locks)
  White Space and Call Plans**. Canvassing is ticked separately.
* Shared records appear in the viewer's normal lists (Fact Finding, White Space history, Call Plans "Shared With You",
  Canvassing) with a **Shared by <name>** badge.
* Sharing never grants admin. Admin access comes only from the `role` field.
* Nothing is seeded; no names or emails are hard-coded.

## Data model

`dataShares/{ownerUid}_{viewerUid}`

```
{ ownerId, ownerName, viewerId, viewerName,
  areas: { factFinding, whiteSpace, callPlans, canvassing },   // booleans
  updatedAt, updatedBy }
```

Only admins can create / update / delete shares. A viewer can read only shares where `viewerId == their uid`.
If a person has more than one `users` doc, a tick writes a share for every owner-id × viewer-id pair.

## Security rules

`firestore.rules` adds `hasShare()` / `sharedWith()` and uses them to extend read / update / delete on
`factFindingDocs`, `whitespacePlans`, `callPlans` and `canvass_leads`. Each shared evaluation costs one extra
document read (`exists` + `get` of the share doc). Rules are not filters, so the client always queries
`where('userId', '==', ownerId)` per sharing owner (see `src/hooks/use-data-shares.ts`) and merges the results with the
user's own query. Those queries reuse the existing `userId + createdAt` indexes; no new indexes are needed.

Tests: `npm run test:rules` (needs Java for the Firestore emulator) → `describe('Access: dataShares ...')`.

## Deploy

**A Firestore rules deploy is required from the Mac** (rules are not deployed by App Hosting):

```
cd "/Users/bjmack/Downloads/Apps/Main Compass"
firebase deploy --only firestore:rules --project studio-5306701288-d19b1
```

Deploy the rules **before or together with** the app release. Until rules are live, the Access page can't save shares,
and viewers simply see their own data as before (the shared queries fail soft and are logged to the console).
No data migration or index deploy is needed.
