import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverPrompt, filterNewLeads, domainKey, discoveredKey, type Lookalike } from '@/lib/intel';

// ─── Pure helpers ──────────────────────────────────────────────────────────
const L = (company: string, website: string, sources = [{ url: `${website}/about`, title: website }]): Lookalike => ({
  company, website, region: 'Perth', sector: 'x', size: 'x', why: 'ships', confidence: 'HIGH', vertical: 'OTHER', belt: 'CENTRAL',
  verifiedBy: 'grounded', sources, alreadyInList: false,
});

describe('discover helpers', () => {
  it('prompt is parcel-only, WA, grounded, and lists exclusions', () => {
    const p = discoverPrompt('MEDICAL', ['Acme Medical', 'Bob Dental']);
    expect(p).toMatch(/Western Australia/);
    expect(p).toMatch(/parcels/);
    expect(p).toMatch(/Only list companies you actually found in search results/);
    expect(p).toMatch(/Do not include names, emails or phone numbers/);
    expect(p).toMatch(/Do NOT list any of these \(already known\): Acme Medical; Bob Dental/);
    expect(p).toMatch(/COMPANY: <company name> \|/);
  });
  it('domainKey normalises hosts', () => {
    expect(domainKey('https://www.Acme.com.au/shop')).toBe('acme.com.au');
    expect(domainKey('shop.acme.com.au')).toBe('acme.com.au');
    expect(domainKey('10.0.0.1')).toBeNull();
    expect(domainKey(null)).toBeNull();
  });
  it('discoveredKey is letters+digits only', () => {
    expect(discoveredKey('Acme Pty Ltd (WA)')).toBe('acme');
  });
  it('filterNewLeads drops known names/domains, duplicates and unsourced results', () => {
    const out = filterNewLeads([
      L('Acme Pty Ltd', 'https://acme.com.au'),          // known name
      L('Brand New Co', 'https://known.com.au'),          // known domain
      L('Fresh Supplies', 'https://fresh.com.au'),        // new
      L('Fresh Supplies Ltd', 'https://fresh2.com.au'),   // same normalised name as previous
      L('Other Fresh', 'https://shop.fresh.com.au'),      // same domain as previous
      L('No Source Co', 'https://nosource.com.au', []),   // no evidence
      L('Second New', 'https://second.com.au'),
    ], ['Acme'], ['https://www.known.com.au/x']);
    expect(out.map(o => o.company)).toEqual(['Fresh Supplies', 'Second New']);
  });
});

// ─── Route: leader-only, quota, de-dup, server write ───────────────────────
const verifyIdToken = vi.fn();
const roles: Record<string, string> = { bdm: 'BDM', am: 'ACCOUNT_MANAGER', boss: 'GM', lead: 'LEADER', guest: 'GUEST' };
const created: Record<string, any> = {};
const usage: Record<string, any> = {};
const snap = (docs: Record<string, any>[]) => ({ docs: docs.map(d => ({ get: (k: string) => d[k] })) });
const collections: Record<string, Record<string, any>[]> = {
  verticalProspects: [{ company: 'Existing Medical Pty Ltd', vertical: 'MEDICAL' }],
  verticalDismissals: [{ company: 'Trading Co' }],
  discoveredLeads: [{ company: 'Earlier Find', domain: 'earlier.com.au', vertical: 'MEDICAL' }],
};
vi.mock('@/lib/server/admin', () => ({
  adminAuth: () => ({ verifyIdToken }),
  adminDb: () => ({
    doc: (p: string) => ({
      path: p,
      get: async () => ({ exists: false, get: (k: string) => (k === 'role' ? roles[p.split('/')[1]] : k === 'name' ? 'Lea' : '') }),
      create: async (data: any) => {
        if (created[p]) { const e: any = new Error('exists'); e.code = 6; throw e; }
        created[p] = data;
      },
    }),
    collection: (name: string) => ({ select: () => ({ get: async () => snap(collections[name] || []) }) }),
    runTransaction: async (fn: any) => fn({
      get: async (ref: any) => ({ exists: !!usage[ref.path], get: (k: string) => usage[ref.path]?.[k] }),
      set: (ref: any, data: any) => { usage[ref.path] = { ...(usage[ref.path] || {}), ...data }; },
    }),
  }),
}));
const groundedGenerate = vi.fn();
vi.mock('@/lib/server/gemini', () => ({
  groundedGenerate: (...a: any[]) => groundedGenerate(...a),
  resolveSources: async () => [
    { url: 'https://www.newmed.com.au/about', title: 'newmed.com.au' },
    { url: 'https://earlier.com.au/', title: 'earlier.com.au' },
    { url: 'https://www.existingmed.com.au/', title: 'existingmed.com.au' },
    { url: 'https://perthvet.com.au/', title: 'perthvet.com.au' },
    { url: 'https://tradingco.com.au/', title: 'tradingco.com.au' },
  ],
  domainResolves: async () => false,
}));

const TOKEN = 'Bearer ' + 'a'.repeat(40);
const call = async (uid: string | null, body: Record<string, unknown> = { vertical: 'MEDICAL' }) => {
  if (uid) verifyIdToken.mockResolvedValueOnce({ uid });
  const { POST } = await import('@/app/api/intel/discover/route');
  const res = await POST(new Request('http://x/api/intel/discover', {
    method: 'POST', headers: uid ? { authorization: TOKEN, 'content-type': 'application/json' } : {}, body: JSON.stringify(body),
  }));
  return { status: res.status, json: await res.json() };
};

describe('POST /api/intel/discover', () => {
  beforeEach(() => {
    for (const k of Object.keys(created)) delete created[k];
    for (const k of Object.keys(usage)) delete usage[k];
    groundedGenerate.mockReset();
    groundedGenerate.mockResolvedValue({
      text: [
        'COMPANY: New Med Supplies | newmed.com.au | Malaga | Medical supplies | 20 staff | Ships clinic consumables statewide | High',
        'COMPANY: Earlier Find | earlier.com.au | Perth | Medical | x | dup of earlier find | High',
        'COMPANY: Existing Medical | existingmed.com.au | Perth | Medical | x | already a prospect | High',
        'COMPANY: Made Up Health | madeup-health.com.au | Perth | Medical | x | not grounded | High',
        'COMPANY: Perth Vet Wholesale | perthvet.com.au | Bunbury | Veterinary supplies | 15 staff | Sends parcels to regional vets | Medium',
        'COMPANY: Trading Co | tradingco.com.au | Perth | Medical | x | already a customer | High',
      ].join('\n'),
      chunks: [], supports: [],
    });
  });

  it('rejects non-leaders server-side (BDM, AM, guest, no token)', async () => {
    expect((await call(null)).status).toBe(401);
    for (const u of ['bdm', 'am', 'guest']) expect((await call(u)).status).toBe(403);
    expect(groundedGenerate).not.toHaveBeenCalled();
    expect(Object.keys(created)).toHaveLength(0);
  });

  it('rejects unknown verticals', async () => {
    expect((await call('lead', { vertical: 'FREIGHT' })).status).toBe(400);
  });

  it('saves only new, verified leads for leaders/admins', async () => {
    const r = await call('boss');
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ vertical: 'MEDICAL', added: 2, companies: ['New Med Supplies', 'Perth Vet Wholesale'] });
    const a = created['discoveredLeads/newmedsupplies'];
    expect(a).toMatchObject({ company: 'New Med Supplies', website: 'https://newmed.com.au', domain: 'newmed.com.au', vertical: 'MEDICAL', discoveredBy: 'boss', evidenceUrl: 'https://www.newmed.com.au/about' });
    expect(created['discoveredLeads/perthvetwholesale']).toMatchObject({ belt: 'REGIONAL_WA' });
    expect(groundedGenerate.mock.calls[0][0]).toMatch(/Earlier Find/);
  });

  it('enforces the daily discover quota', async () => {
    for (let i = 0; i < 5; i++) expect((await call('lead')).status).toBe(200);
    const r = await call('lead');
    expect(r.status).toBe(429);
    expect(groundedGenerate).toHaveBeenCalledTimes(5);
  });
});
