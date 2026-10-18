import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePain, buildLookalikes, cleanInput, scrubPersonal, hostOf, canRecheck, hasCarrierPain, type Grounded } from '@/lib/intel';
import { groundedGenerate, resolveSources } from '@/lib/server/gemini';

const src = [
  { url: 'https://www.productreview.com.au/listings/acme', title: 'productreview.com.au' },
  { url: 'https://acme.com.au/shipping', title: 'acme.com.au' },
  { url: 'https://www.reddit.com/r/perth/x', title: 'reddit.com' },
];

describe('parsePain (mocked model output)', () => {
  const g: Grounded = {
    text: [
      'SCORE: High', 'CARRIER: Australia Post',
      'FINDING: Several reviewers say orders to Perth took over two weeks to arrive',
      'FINDING: Shipping page says WA and NT orders excluded from free shipping (Source: acme.com.au)',
      'FINDING: A made-up claim that has no grounding support at all here',
      'OPENING: Saw WA customers waiting two weeks for orders, keen to show how TGE Parcel can fix that.',
    ].join('\n'),
    chunks: [],
    supports: [
      { segment: { text: 'Several reviewers say orders to Perth took over two weeks to arrive' }, groundingChunkIndices: [0, 2] },
      { segment: { text: 'WA and NT orders excluded from free shipping' }, groundingChunkIndices: [1] },
    ],
  };
  it('keeps only grounded findings with real source URLs', () => {
    const r = parsePain(g, src, 1000);
    expect(r.findings).toHaveLength(2);
    expect(r.findings[0].sources.map(s => s.url)).toEqual([src[0].url, src[2].url]);
    expect(r.findings[1].text).not.toMatch(/Source:/);
    expect(r.score).toBe('HIGH');
    expect(r.carrier).toBe('Australia Post');
    expect(r.opening).toMatch(/TGE Parcel/);
    expect(r.checkedAt).toBe(1000);
    expect(hasCarrierPain(r)).toBe(true);
  });
  it('no grounded support → None / no signal, even if the model claims High', () => {
    const r = parsePain({ ...g, supports: [] }, src);
    expect(r).toMatchObject({ score: 'NONE', noSignal: true, findings: [], carrier: null, opening: null });
    expect(hasCarrierPain(r)).toBe(false);
  });
  it('a single finding cannot be High; chunk index without a URL is dropped', () => {
    const r = parsePain({ ...g, supports: [g.supports[0]] }, [{ url: '', title: 'x' }, src[1], src[2]]);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].sources).toEqual([src[2]]);
    expect(r.score).toBe('MEDIUM');
  });
  it('strips personal contact data', () => {
    expect(scrubPersonal('email jane@acme.com or 0412 345 678')).toBe('email [email removed] or [phone removed]');
  });
  it('re-check only after 14 days', () => {
    const now = Date.now();
    expect(canRecheck({ checkedAt: now - 13 * 864e5 }, now)).toBe(false);
    expect(canRecheck({ checkedAt: now - 14 * 864e5 }, now)).toBe(true);
    expect(canRecheck(null)).toBe(true);
  });
});

describe('buildLookalikes (mocked model + DNS)', () => {
  const g: Grounded = {
    text: [
      'COMPANY: Acme Outdoor | acme.com.au | Osborne Park, Perth | Online outdoor retail | 20-50 staff | Same DTC outdoor niche | High',
      'COMPANY: Fake Co | totally-fake-domain.com.au | Perth | ecommerce | small | Invented | High',
      'COMPANY: Bob Medical | bobmed.com.au | Bunbury | Medical supplies | 10 staff | Ships clinic consumables | High',
      'COMPANY: Seed Brand | seedbrand.com.au | Perth | ecommerce | x | the seed itself | High',
      'COMPANY: Bad IP | 10.0.0.1 | Perth | ecommerce | x | ip | High',
      'COMPANY: Existing Pty Ltd | existing.com.au | Welshpool | Mining supplies | 30 | similar | Medium',
    ].join('\n'),
    chunks: [], supports: [],
  };
  const resolved = [{ url: 'https://www.acme.com.au/about', title: 'acme.com.au' }, { url: 'https://existing.com.au/', title: 'existing.com.au' }];
  it('returns only verified URLs, maps vertical/belt, flags already-in-list, excludes seed', async () => {
    const dns = vi.fn(async (h: string) => h === 'bobmed.com.au');
    const out = await buildLookalikes(g, resolved, ['Existing'], 'Seed Brand', dns);
    expect(out.map(o => o.company)).toEqual(['Acme Outdoor', 'Bob Medical', 'Existing Pty Ltd']);
    expect(out[0]).toMatchObject({ website: 'https://acme.com.au', verifiedBy: 'grounded', confidence: 'HIGH', vertical: 'ECOMMERCE', alreadyInList: false });
    expect(out[1]).toMatchObject({ verifiedBy: 'dns', confidence: 'MEDIUM', vertical: 'MEDICAL', belt: 'REGIONAL_WA' });
    expect(out[2]).toMatchObject({ alreadyInList: true, vertical: 'MINING', belt: 'EAST' });
    expect(dns).not.toHaveBeenCalledWith('10.0.0.1');
  });
});

describe('input validation / SSRF guards', () => {
  it('cleanInput enforces length and strips control chars', () => {
    expect(cleanInput('  Acme\n Ltd ', 120)).toBe('Acme Ltd');
    expect(cleanInput('x'.repeat(121), 120)).toBeNull();
    expect(cleanInput(42, 120)).toBeNull();
    expect(cleanInput('   ', 120)).toBeNull();
  });
  it('hostOf rejects IPs and internal hosts', () => {
    expect(hostOf('https://www.Acme.com.au/x')).toBe('acme.com.au');
    for (const bad of ['127.0.0.1', 'http://localhost:9002', 'metadata.google.internal', 'printer.local']) expect(hostOf(bad)).toBeNull();
  });
});

describe('gemini client (mocked fetch)', () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key-not-real'; });
  it('posts to the fixed Gemini host with google_search and header key; parses grounding', async () => {
    const fetchMock = vi.fn(async (_u: any, _i: any) => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'SCORE: None' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://a.com', title: 'a.com' } }], groundingSupports: [] } }],
    })));
    const g = await groundedGenerate('hi', fetchMock as any);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent$/);
    expect(String(url)).not.toContain('key=');
    expect(init.headers['x-goog-api-key']).toBe('test-key-not-real');
    expect(JSON.parse(init.body).tools).toEqual([{ google_search: {} }]);
    expect(g.chunks).toHaveLength(1);
  });
  it('only follows the vertexaisearch redirect host', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://real.example.com/page' } }));
    const out = await resolveSources({ text: '', supports: [], chunks: [
      { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'real.example.com' } },
      { web: { uri: 'https://other.example.org/x', title: 'other' } },
      { web: { uri: 'http://insecure.example.org/x', title: 'insecure' } },
    ] }, fetchMock as any);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.map(o => o.url)).toEqual(['https://real.example.com/page', 'https://other.example.org/x', '']);
  });
});
