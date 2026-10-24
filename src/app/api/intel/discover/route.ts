import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/admin';
import { requireLeader, consumeQuota, errorResponse, HttpError } from '@/lib/server/intel-guard';
import { groundedGenerate, resolveSources, domainResolves } from '@/lib/server/gemini';
import { buildLookalikes, discoverPrompt, discoveredKey, domainKey, filterNewLeads, DISCOVER_DAILY_LIMIT } from '@/lib/intel';
import { VERTICALS, guessBelt, type VerticalId } from '@/lib/verticals';
import { WA_SUGGESTED_PROSPECTS } from '@/data/wa-suggested-prospects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Find new leads" for one vertical (leaders/admins only).
 * Grounded Google Search via Gemini → verified websites → de-duplicated against
 * prospects, the research list, Trading-with-TGE markers and earlier finds →
 * saved team-wide in `discoveredLeads` (server-only writes).
 */
export async function POST(req: Request) {
  try {
    const caller = await requireLeader(req);
    const body = await req.json().catch(() => ({}));
    const vertical = VERTICALS.find(v => v.id === body.vertical)?.id as VerticalId | undefined;
    if (!vertical) throw new HttpError(400, 'Unknown vertical');

    const remaining = await consumeQuota(caller.uid, 'discover', DISCOVER_DAILY_LIMIT);
    const db = adminDb();
    const [prospects, dismissals, discovered] = await Promise.all([
      db.collection('verticalProspects').select('company', 'vertical').get(),
      db.collection('verticalDismissals').select('company').get(),
      db.collection('discoveredLeads').select('company', 'domain', 'vertical').get(),
    ]);
    const suggested = WA_SUGGESTED_PROSPECTS.flatMap(s => [s.company, s.aka || '']);
    const knownNames = [
      ...prospects.docs.map(d => String(d.get('company') || '')),
      ...dismissals.docs.map(d => String(d.get('company') || '')),
      ...discovered.docs.map(d => String(d.get('company') || '')),
      ...suggested,
    ].filter(Boolean);
    const knownDomains = [
      ...discovered.docs.map(d => String(d.get('domain') || '')),
      ...WA_SUGGESTED_PROSPECTS.map(s => s.website || ''),
    ].filter(Boolean);

    // Steer the model away from names we already have in this vertical (the filter is the real guard).
    const inVertical = (d: FirebaseFirestore.QueryDocumentSnapshot) => d.get('vertical') === vertical;
    const promptExclude = [
      ...WA_SUGGESTED_PROSPECTS.filter(s => s.vertical === vertical).map(s => s.company),
      ...discovered.docs.filter(inVertical).map(d => String(d.get('company') || '')),
      ...prospects.docs.filter(inVertical).map(d => String(d.get('company') || '')),
    ];

    const g = await groundedGenerate(discoverPrompt(vertical, promptExclude));
    const found = await buildLookalikes(g, await resolveSources(g), [], '', domainResolves);
    const fresh = filterNewLeads(found, knownNames, knownDomains, 10);

    const saved: string[] = [];
    for (const r of fresh) {
      const key = discoveredKey(r.company);
      const domain = domainKey(r.website);
      if (!key || !domain) continue;
      try {
        await db.doc(`discoveredLeads/${key}`).create({
          company: r.company.slice(0, 200),
          website: r.website.slice(0, 300),
          domain,
          vertical,
          belt: guessBelt(r.region),
          sector: r.sector.slice(0, 120),
          region: r.region.slice(0, 120),
          size: r.size.slice(0, 80),
          whyTheyShip: r.why.slice(0, 400),
          confidence: r.confidence,
          verifiedBy: r.verifiedBy,
          evidenceUrl: r.sources[0]?.url || null,
          sources: r.sources.slice(0, 2).map(s => ({ url: s.url.slice(0, 500), title: s.title.slice(0, 200) })),
          discoveredBy: caller.uid,
          discoveredByName: (caller.name || 'Unknown').slice(0, 200),
          createdAt: FieldValue.serverTimestamp(),
        });
        saved.push(r.company);
      } catch (e: any) {
        // ALREADY_EXISTS (6): another search saved it first; skip.
        if (e?.code !== 6) throw e;
      }
    }
    return Response.json({ vertical, added: saved.length, companies: saved, remaining: Math.max(0, remaining) });
  } catch (e) { return errorResponse(e); }
}
