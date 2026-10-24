import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/admin';
import { requireStaff, consumeQuota, errorResponse, HttpError } from '@/lib/server/intel-guard';
import { groundedGenerate, resolveSources } from '@/lib/server/gemini';
import { cleanInput, canRecheck, hostOf, MAX_NAME, painPrompt, parsePain, type PainSignals } from '@/lib/intel';
import { normaliseCompany } from '@/lib/verticals';
import { WA_SUGGESTED_PROSPECTS } from '@/data/wa-suggested-prospects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const caller = await requireStaff(req);
    const body = await req.json().catch(() => ({}));
    const db = adminDb();

    let company: string | null = null;
    let website: string | null = null;
    const prospectId = typeof body.prospectId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.prospectId) ? body.prospectId : null;
    if (prospectId) {
      const p = await db.doc(`verticalProspects/${prospectId}`).get();
      if (!p.exists) throw new HttpError(404, 'Prospect not found');
      company = cleanInput(p.get('company'), 200);
    } else if (typeof body.discoveredId === 'string' && /^[a-z0-9]{1,150}$/.test(body.discoveredId)) {
      const d = await db.doc(`discoveredLeads/${body.discoveredId}`).get();
      if (!d.exists) throw new HttpError(404, 'Lead not found');
      company = cleanInput(d.get('company'), 200); website = typeof d.get('website') === 'string' ? d.get('website') : null;
    } else if (typeof body.suggestedId === 'string') {
      const s = WA_SUGGESTED_PROSPECTS.find(x => x.id === body.suggestedId);
      if (!s) throw new HttpError(404, 'Suggested prospect not found');
      company = s.company; website = s.website;
    } else {
      company = cleanInput(body.company, MAX_NAME);
    }
    if (!company) throw new HttpError(400, `Company name required (max ${MAX_NAME} chars)`);
    // Website is only ever used as prompt text; it is never fetched.
    const host = website ? hostOf(website) : null;

    const key = normaliseCompany(company).slice(0, 100) || 'x';
    const cacheRef = db.doc(`intelCache/pain_${key}`);
    const cached = await cacheRef.get();
    let result: PainSignals;
    let fromCache = false;
    if (cached.exists && !canRecheck(cached.get('result') as PainSignals)) {
      result = cached.get('result') as PainSignals; fromCache = true;
    } else {
      await consumeQuota(caller.uid, 'pain');
      const g = await groundedGenerate(painPrompt(company, host));
      result = parsePain(g, await resolveSources(g));
      await cacheRef.set({ company, result, checkedBy: caller.uid, updatedAt: FieldValue.serverTimestamp() });
    }
    if (prospectId) {
      // Server-only fields; clients cannot write these (see firestore.rules).
      await db.doc(`verticalProspects/${prospectId}`).update({ painSignals: result, painCheckedAt: Timestamp.fromMillis(result.checkedAt) });
    }
    return Response.json({ company, result, cached: fromCache });
  } catch (e) { return errorResponse(e); }
}
