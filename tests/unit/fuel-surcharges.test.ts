import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  CARRIERS, carrierById, parseTge, parseStarTrack, parseAusPost, parseTnt, parseAramex, parseCouriersPlease, parseDhl, parseSendle,
  refreshCarrier, runFuelRefresh, seedDoc, deltaFor, htmlToText, fetchAllowed, REFRESH_MIN_INTERVAL_MS, type DbLike,
} from '@/lib/fuel-surcharges';

// Fixtures saved from the live official pages on 18 Oct 2026 (Perth).
const fx = (n: string) => readFileSync(resolve(__dirname, '../fixtures/fuel', `${n}.html`), 'utf8');
const NOW = Date.UTC(2026, 9, 18, 6, 0); // 18 Oct 2026 14:00 AWST
const pcts = (rs: { pct: number }[]) => rs.map(r => r.pct);

describe('parsers on saved official pages (18 Oct 2026)', () => {
  it('TGE: current week 12 Oct, next 19 Oct (42.95/30.29/26.26), previous 5 Oct', () => {
    const p = parseTge(fx('tge'), NOW)!;
    expect(p.current.map(r => [r.label, r.pct, r.from])).toEqual([
      ['Palletised Express', 42.84, '2026-10-12'], ['Express Parcels Road', 30.21, '2026-10-12'], ['Express Parcels Air', 25.77, '2026-10-12']]);
    expect(pcts(p.upcoming)).toEqual([42.95, 30.29, 26.26]);
    expect(p.upcoming[0].from).toBe('2026-10-19');
    expect(pcts(p.previous)).toEqual([41.66, 29.38, 24.9]);
    // From 19 Oct the new week becomes current, with 12 Oct as previous
    const p2 = parseTge(fx('tge'), Date.UTC(2026, 9, 19, 1))!;
    expect(pcts(p2.current)).toEqual([42.95, 30.29, 26.26]);
    expect(pcts(p2.previous)).toEqual([42.84, 30.21, 25.77]);
    expect(deltaFor(p2, p2.current[1])).toBe(0.08);
  });
  it('StarTrack: 22.2% 30 Sep–27 Oct, next 24.2% 28 Oct–24 Nov', () => {
    const p = parseStarTrack(fx('startrack'), NOW)!;
    expect(p.current[0]).toMatchObject({ pct: 22.2, from: '2026-09-30', to: '2026-10-27' });
    expect(p.upcoming[0]).toMatchObject({ pct: 24.2, from: '2026-10-28', to: '2026-11-24' });
  });
  it('Australia Post: Oct 11.5%, Nov 13.5%', () => {
    const p = parseAusPost(fx('auspost'), NOW)!;
    expect(p.current[0]).toMatchObject({ pct: 11.5, from: '2026-10-01', to: '2026-10-31' });
    expect(p.upcoming[0]).toMatchObject({ pct: 13.5, from: '2026-11-01' });
    expect(p.previous[0].pct).toBe(6.9);
  });
  it('TNT: 44.9% 11–24 Oct, previous 41.2%', () => {
    const p = parseTnt(fx('tnt'), NOW)!;
    expect(p.current[0]).toMatchObject({ pct: 44.9, from: '2026-10-11', to: '2026-10-24' });
    expect(p.previous[0].pct).toBe(41.2);
  });
  it('Aramex: Oct 11.50% (prev Sep 7.90%)', () => {
    const p = parseAramex(fx('aramex'), NOW)!;
    expect(p.current[0]).toMatchObject({ pct: 11.5, from: '2026-10-01' });
    expect(p.previous[0].pct).toBe(7.9);
  });
  it('CouriersPlease: Oct domestic 16.70%', () => {
    expect(parseCouriersPlease(fx('couriersplease'), NOW)!.current[0]).toMatchObject({ pct: 16.7, from: '2026-10-01' });
  });
  it('DHL: 49.00% 12–18 Oct, next 49.75% 19–25 Oct; jet-fuel index table ignored', () => {
    const p = parseDhl(fx('dhl'), NOW)!;
    expect(p.current[0]).toMatchObject({ pct: 49, from: '2026-10-12', to: '2026-10-18' });
    expect(p.upcoming.map(r => [r.pct, r.from])).toEqual([[49.75, '2026-10-19'], [49.25, '2026-10-26']]);
    expect(p.previous[0].pct).toBe(48);
    expect(p.upcoming.concat(p.current, p.previous).every(r => r.pct > 40)).toBe(true);
  });
  it('never invents: unrelated or empty pages → null', () => {
    const junk = '<html><body><p>Fuel surcharge applies. 10% off today!</p></body></html>';
    for (const fn of [parseTge, parseStarTrack, parseAusPost, parseTnt, parseAramex, parseCouriersPlease, parseDhl, parseSendle]) {
      expect(fn(junk, NOW)).toBeNull();
      expect(fn('', NOW)).toBeNull();
    }
    expect(parseTge(fx('tnt'), NOW)).toBeNull(); // wrong carrier's page
  });
  it('htmlToText unescapes AEM-embedded table markup', () => {
    expect(htmlToText('<div data-x="<td>October 2026<\\/td>\\r\\n<td>11.5%</td>">x</div>')).toContain('October 2026');
  });
});

describe('refresh logic', () => {
  const tge = carrierById('tge')!;
  const okFetch = (html: string) => vi.fn(async () => ({ ok: true, status: 200, text: async () => html }));

  it('only fetches allow-listed URLs', async () => {
    const f = okFetch('');
    await expect(fetchAllowed({ ...tge, url: 'http://169.254.169.254/latest' }, f)).rejects.toThrow('not allow-listed');
    expect(f).not.toHaveBeenCalled();
  });
  it('failure keeps the last good value and marks stale', async () => {
    const prev = seedDoc(tge);
    const { doc, changed } = await refreshCarrier(tge, prev, vi.fn(async () => { throw new Error('ECONNRESET'); }), NOW);
    expect(changed).toBe(false);
    expect(doc).toMatchObject({ status: 'stale', current: prev.current, lastSuccessAt: prev.lastSuccessAt, lastCheckedAt: NOW, error: 'ECONNRESET' });
  });
  it('unparseable page with no previous value → check_source (no number shown)', async () => {
    const sendle = carrierById('sendle')!;
    const { doc } = await refreshCarrier(sendle, null, okFetch('<html>loading…</html>'), NOW);
    expect(doc.status).toBe('check_source');
    expect(doc.current).toEqual([]);
  });
  it('not-published carriers are never fetched', async () => {
    const f = okFetch('');
    const { doc } = await refreshCarrier(carrierById('kal')!, null, f, NOW);
    expect(doc.status).toBe('not_published');
    expect(f).not.toHaveBeenCalled();
  });

  function fakeDb(meta: any = null) {
    const store = new Map<string, any>(meta ? [['fuelSurchargeMeta/refresh', meta]] : []);
    const history: any[] = [];
    const ref = (p: string) => ({ p, get: async () => ({ exists: store.has(p), data: () => store.get(p) }), set: async (d: any) => { store.set(p, { ...(store.get(p) || {}), ...d }); } });
    const db: DbLike = {
      doc: ref as any,
      collection: () => ({ add: async (d: any) => { history.push(d); } }),
      runTransaction: async (fn: any) => fn({ get: (r: any) => r.get(), set: (r: any, d: any) => r.set(d) }),
    };
    return { db, store, history };
  }
  it('throttles to once per 10 minutes globally', async () => {
    const { db } = fakeDb({ lastRunAt: NOW - REFRESH_MIN_INTERVAL_MS + 60_000 });
    const f = okFetch('');
    const r = await runFuelRefresh(db, f, NOW);
    expect(r.ran).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('writes every carrier and logs history only on change', async () => {
    const { db, store, history } = fakeDb();
    const pages: Record<string, string> = { tge: fx('tge'), startrack: fx('startrack'), auspost: fx('auspost'), tnt: fx('tnt'), aramex: fx('aramex'), couriersplease: fx('couriersplease'), dhl: fx('dhl') };
    const f = vi.fn(async (url: string) => {
      const c = CARRIERS.find(x => x.url === url)!;
      return pages[c.id] ? { ok: true, status: 200, text: async () => pages[c.id] } : { ok: false, status: 503, text: async () => '' };
    });
    const r = await runFuelRefresh(db, f, NOW, { by: 'u1' });
    expect(r.ran).toBe(true);
    expect(f).toHaveBeenCalledTimes(8); // 8 published pages, 9 static rows untouched
    expect(store.get('fuelSurchargeMeta/refresh')).toMatchObject({ lastRunAt: NOW, by: 'u1' });
    const st = Object.fromEntries(r.results.map(x => [x.carrierId, x.status]));
    expect(st).toMatchObject({ tge: 'ok', startrack: 'ok', auspost: 'ok', tnt: 'ok', aramex: 'ok', couriersplease: 'ok', dhl: 'ok', sendle: 'unavailable', kal: 'not_published' });
    // Pages match the 18 Oct seed → nothing changed, no history yet
    expect(history).toHaveLength(0);
    // Stored TGE value is older → next run records a change
    store.set('fuelSurcharges/tge', { ...store.get('fuelSurcharges/tge'), current: [{ label: 'Express Parcels Road', pct: 29.38, from: '2026-10-05' }] });
    await runFuelRefresh(db, f, NOW + REFRESH_MIN_INTERVAL_MS + 1);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ carrierId: 'tge' });
    // Identical pages again → no new history
    await runFuelRefresh(db, f, NOW + 2 * REFRESH_MIN_INTERVAL_MS + 2);
    expect(history).toHaveLength(1);
  });
});
