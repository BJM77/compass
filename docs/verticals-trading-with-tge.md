# Verticals: "Trading with TGE" + prospect list view

## Trading with TGE
- Each suggested WA prospect has a **Trading with TGE** button (already a customer).
- It writes `verticalDismissals/{key}` where `key = normaliseCompany(company)` (letters + digits). The marker is shared by all BDM/AM/admin users.
- Marked companies disappear from Suggested WA prospects. **Show hidden (N)** lists them with **Restore** (deletes the marker).
- The Lookalike finder shows a "Trading with TGE" badge (no Add button) for marked companies, matched by normalised name.
- Rules: staff read; staff create (own uid, fixed reason, whitelisted fields, server time); no updates; staff delete.
- **Rules deploy needed (from the Mac):** `firebase deploy --only firestore:rules --project studio-5306701288-d19b1`. Until then the button shows an error toast and nothing is hidden; the page otherwise works.

## Prospects list view
- Cards / List toggle on the saved Prospects card. Choice stored in `localStorage` key `verticals.prospectView`.
- List rows: company (opens Salesforce search), vertical, location, SF status, contact, saved date, score. One line on md+; two short lines on mobile. Chevron expands the full card for actions.
