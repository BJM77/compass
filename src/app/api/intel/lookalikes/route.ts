import { adminDb } from '@/lib/server/admin';
import { requireStaff, consumeQuota, errorResponse, HttpError } from '@/lib/server/intel-guard';
import { groundedGenerate, resolveSources, domainResolves } from '@/lib/server/gemini';
import { buildLookalikes, cleanInput, lookalikePrompt, MAX_NAME, MAX_NOTES } from '@/lib/intel';
import { WA_SUGGESTED_PROSPECTS } from '@/data/wa-suggested-prospects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const caller = await requireStaff(req);
    const body = await req.json().catch(() => ({}));
    const db = adminDb();
    const notes = body.notes == null || body.notes === '' ? null : cleanInput(body.notes, MAX_NOTES);
    if (body.notes && !notes) throw new HttpError(400, `Notes too long (max ${MAX_NOTES} chars)`);

    let seed: { company: string; sector?: string | null; region?: string | null; size?: string | null; notes?: string | null } | null = null;
    if (typeof body.prospectId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.prospectId)) {
      const p = await db.doc(`verticalProspects/${body.prospectId}`).get();
      if (!p.exists) throw new HttpError(404, 'Prospect not found');
      seed = { company: String(p.get('company')).slice(0, 200), sector: String(p.get('vertical') || '').toLowerCase(), notes };
    } else if (typeof body.suggestedId === 'string') {
      const s = WA_SUGGESTED_PROSPECTS.find(x => x.id === body.suggestedId);
      if (!s) throw new HttpError(404, 'Suggested prospect not found');
      seed = { company: s.company, sector: s.onlineCategory || s.sector, region: s.region, size: s.size, notes };
    } else {
      const c = cleanInput(body.company, MAX_NAME);
      if (c) seed = { company: c, notes };
    }
    if (!seed) throw new HttpError(400, `Seed company required (max ${MAX_NAME} chars)`);

    await consumeQuota(caller.uid, 'lookalike');
    const existing = (await db.collection('verticalProspects').select('company').get()).docs.map(d => String(d.get('company') || ''));
    const names = [...existing, ...WA_SUGGESTED_PROSPECTS.flatMap(s => [s.company, s.aka || ''])];
    const g = await groundedGenerate(lookalikePrompt(seed));
    const results = await buildLookalikes(g, await resolveSources(g), names, seed.company, domainResolves);
    return Response.json({ seed: seed.company, results });
  } catch (e) { return errorResponse(e); }
}
