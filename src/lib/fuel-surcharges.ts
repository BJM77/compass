/**
 * Fuel surcharges: carrier allow-list, HTML parsers, seed data and refresh logic.
 * PURE + self-contained (no '@/' imports) so functions/ can copy it (npm run sync-shared).
 * Parsers never guess: if a pattern isn't found they return null ("Check source").
 */

export type FuelRate = { label: string; pct: number; from?: string | null; to?: string | null };
export type ParsedFuel = { current: FuelRate[]; previous: FuelRate[]; upcoming: FuelRate[] };
export type FuelStatus = 'ok' | 'stale' | 'check_source' | 'unavailable' | 'not_published';

export type Carrier = {
  id: string;
  name: string;
  url: string | null;
  frequency: string;
  note?: string;
  ours?: boolean;
  /** No public page: rate card / portal only. */
  notPublished?: boolean;
  parse?: (html: string, now: number) => ParsedFuel | null;
};

export type FuelDoc = {
  carrierId: string;
  name: string;
  sourceUrl: string | null;
  status: FuelStatus;
  current: FuelRate[];
  previous: FuelRate[];
  upcoming: FuelRate[];
  lastCheckedAt: number | null;   // epoch ms, last attempt
  lastSuccessAt: number | null;   // epoch ms, last good parse
  error: string | null;
  seeded?: boolean;
};

export type FuelOverride = { pct: number; label: string; note: string; effective: string | null; enteredBy: string; enteredByName: string; enteredAt: any };

export const AIP_TGP_URL = 'https://www.aip.com.au/pricing/terminal-gate-prices';
export const REFRESH_MIN_INTERVAL_MS = 10 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_HTML_BYTES = 3_000_000;
export const TGE_BENCHMARK_LABEL = 'Express Parcels Road';

// ─── Text helpers ───────────────────────────────────────────────────────────
const ENT: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '-', mdash: '-', '#39': "'", rsquo: "'" };
export function htmlToText(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/\\r\\n|\\n|\\t/g, ' ')        // AEM embeds escaped table HTML in JSON attributes
    .replace(/\\"/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (m, e) => ENT[e.toLowerCase()] ?? (e[0] === '#' ? String.fromCharCode(parseInt(e.slice(1).replace(/^x/i, '0x'))) : m))
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(January|February|March|April|May|June|July|August|September|October|November|December)';
const pad = (n: number) => String(n).padStart(2, '0');
/** "19 October 2026" → "2026-10-19" */
export function isoDate(d: number, month: string, year: number): string | null {
  const m = MONTHS.indexOf(month.toLowerCase());
  if (m < 0 || d < 1 || d > 31 || year < 2000 || year > 2100) return null;
  return `${year}-${pad(m + 1)}-${pad(d)}`;
}
function parseDmy(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  return m ? isoDate(+m[1], m[2], +m[3]) : null;
}
function monthRange(month: string, year: number): { from: string; to: string } | null {
  const m = MONTHS.indexOf(month.toLowerCase());
  if (m < 0) return null;
  const last = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  return { from: `${year}-${pad(m + 1)}-01`, to: `${year}-${pad(m + 1)}-${pad(last)}` };
}
/** Perth calendar date for `now`. */
export function perthIso(now: number): string { return new Date(now + 8 * 3600e3).toISOString().slice(0, 10); }
const pct = (s: string) => { const n = Number(s); return Number.isFinite(n) && n >= 0 && n < 100 ? n : null; };

/** Split dated rows into previous / current / upcoming around today (Perth). */
export function splitByDate(rows: FuelRate[], now: number): ParsedFuel | null {
  const today = perthIso(now);
  const sorted = rows.filter(r => r.from).sort((a, b) => (a.from! < b.from! ? -1 : 1));
  if (!sorted.length) return null;
  let ci = -1;
  sorted.forEach((r, i) => { if (r.from! <= today && (!r.to || r.to >= today)) ci = i; });
  if (ci < 0) { // between/after periods: latest started one
    sorted.forEach((r, i) => { if (r.from! <= today) ci = i; });
    if (ci < 0) return { current: [], previous: [], upcoming: sorted };
  }
  return { current: [sorted[ci]], previous: ci > 0 ? [sorted[ci - 1]] : [], upcoming: sorted.slice(ci + 1) };
}

// ─── Parsers (patterns verified against saved fixtures, 18 Oct 2026) ────────
export function parseTge(html: string, now: number): ParsedFuel | null {
  const t = htmlToText(html);
  const cur = t.match(/Effective Date\s*-?\s*(\d{1,2} [A-Za-z]+ \d{4})\s+Palletised Express\s+Express Parcels Road\s+Express Parcels Air\s+Fuel Surcharge\s+(\d{1,2}\.\d{1,2})%\s+(\d{1,2}\.\d{1,2})%\s+(\d{1,2}\.\d{1,2})%/i);
  if (!cur) return null;
  const labels = ['Palletised Express', 'Express Parcels Road', 'Express Parcels Air'];
  // Weekly sets, newest first: headline + history "Effective 12 October 2026 42.84% 30.21% 25.77%"
  const sets: { from: string; vals: number[] }[] = [];
  const add = (d: string, vs: string[]) => {
    const from = parseDmy(d); const vals = vs.map(pct);
    if (from && vals.every(v => v != null) && !sets.some(x => x.from === from)) sets.push({ from, vals: vals as number[] });
  };
  add(cur[1], [cur[2], cur[3], cur[4]]);
  if (!sets.length) return null;
  for (const m of t.matchAll(/Effective (\d{1,2} [A-Za-z]+ \d{4}) (\d{1,2}\.\d{1,2})% (\d{1,2}\.\d{1,2})% (\d{1,2}\.\d{1,2})%/g)) {
    add(m[1], [m[2], m[3], m[4]]);
    if (sets.length >= 4) break;
  }
  sets.sort((a, b) => (a.from < b.from ? 1 : -1));
  const today = perthIso(now);
  const ci = sets.findIndex(x => x.from <= today);
  const rows = (x?: { from: string; vals: number[] }) => (x ? labels.map((label, i) => ({ label, pct: x.vals[i], from: x.from })) : []);
  if (ci < 0) return { current: [], previous: [], upcoming: rows(sets[sets.length - 1]) };
  return { current: rows(sets[ci]), previous: rows(sets[ci + 1]), upcoming: sets.slice(0, ci).reverse().flatMap(x => rows(x)) };
}

/** StarTrack: "November 2026 (28 October - 24 November) 24.2%" */
export function parseStarTrack(html: string, now: number): ParsedFuel | null {
  const t = htmlToText(html);
  const re = new RegExp(`${MONTH_RE} (\\d{4}) \\((\\d{1,2}) ${MONTH_RE} - (\\d{1,2}) ${MONTH_RE}\\) (\\d{1,2}(?:\\.\\d{1,2})?)%`, 'g');
  const rows: FuelRate[] = [];
  for (const m of t.matchAll(re)) {
    const year = +m[2];
    const fromMonth = MONTHS.indexOf(m[4].toLowerCase()), labelMonth = MONTHS.indexOf(m[1].toLowerCase());
    const fromYear = fromMonth > labelMonth ? year - 1 : year; // "January 2027 (30 December - …)"
    const toMonth = MONTHS.indexOf(m[6].toLowerCase());
    const toYear = toMonth < fromMonth ? fromYear + 1 : fromYear;
    const v = pct(m[7]);
    const from = isoDate(+m[3], m[4], fromYear), to = isoDate(+m[5], m[6], toYear);
    if (v != null && from && to && !rows.some(r => r.from === from)) rows.push({ label: 'Express & Premium', pct: v, from, to });
  }
  return rows.length ? splitByDate(rows, now) : null;
}

/** Monthly tables: "November 2026 13.5%" (Australia Post), "Month Domestic October 2026 16.70%" (CP). */
function parseMonthTable(t: string, label: string, now: number, prefix = ''): ParsedFuel | null {
  const re = new RegExp(`${prefix}${MONTH_RE} (\\d{4})(?:\\s*\\([^)]{0,40}\\))? (\\d{1,2}(?:\\.\\d{1,2})?)%`, 'g');
  const rows: FuelRate[] = [];
  for (const m of t.matchAll(re)) {
    const r = monthRange(m[1], +m[2]); const v = pct(m[3]);
    if (r && v != null && !rows.some(x => x.from === r.from)) rows.push({ label, pct: v, ...r });
  }
  return rows.length ? splitByDate(rows, now) : null;
}
export function parseAusPost(html: string, now: number): ParsedFuel | null {
  const t = htmlToText(html);
  const i = t.search(/Month Surcharge/i);
  return i < 0 ? null : parseMonthTable(t.slice(i, i + 4000), 'eParcel / Parcel Post', now);
}
export function parseCouriersPlease(html: string, now: number): ParsedFuel | null {
  const t = htmlToText(html);
  const i = t.search(/Month Domestic/i);
  return i < 0 ? null : parseMonthTable(t.slice(i, i + 600), 'Domestic', now);
}

/** Aramex: "2026 Fuel Surcharge Month Surcharge October 11.50% September 7.90% …" */
export function parseAramex(html: string, now: number): ParsedFuel | null {
  const t = htmlToText(html);
  const h = t.match(/(\d{4}) Fuel Surcharge Month Surcharge ((?:[A-Za-z]+ \d{1,2}(?:\.\d{1,2})?% ?){1,12})/);
  if (!h) return null;
  const year = +h[1];
  const rows: FuelRate[] = [];
  for (const m of h[2].matchAll(new RegExp(`${MONTH_RE} (\\d{1,2}(?:\\.\\d{1,2})?)%`, 'g'))) {
    const r = monthRange(m[1], year); const v = pct(m[2]);
    if (r && v != null) rows.push({ label: 'Domestic parcels', pct: v, ...r });
  }
  return rows.length ? splitByDate(rows, now) : null;
}

/** TNT/FedEx: "From 11 October 2026 to 24 October 2026: 44.9%" */
export function parseTnt(html: string, now: number): ParsedFuel | null {
  const t = htmlToText(html);
  const rows: FuelRate[] = [];
  for (const m of t.matchAll(/From (\d{1,2} [A-Za-z]+ \d{4}) to (\d{1,2} [A-Za-z]+ \d{4}):? (\d{1,2}(?:\.\d{1,2})?)%/g)) {
    const from = parseDmy(m[1]), to = parseDmy(m[2]), v = pct(m[3]);
    if (from && to && v != null) rows.push({ label: 'Domestic', pct: v, from, to });
  }
  return rows.length ? splitByDate(rows, now) : null;
}

/**
 * DHL Express AU weekly table: "Period Surcharges October 26- 1 November 2026 49.25% October 19 - 25 2026 49.75%
 * September 28 - 4 October 2026 46.25%". Only the block between "Period Surcharges" and "Jet Fuel Index" is read.
 */
export function parseDhl(html: string, now: number): ParsedFuel | null {
  const t = htmlToText(html);
  const i = t.search(/Period Surcharges/i);
  if (i < 0) return null;
  const end = t.slice(i).search(/Jet Fuel Index/i);
  const block = t.slice(i, end > 0 ? i + end : i + 800);
  const rows: FuelRate[] = [];
  const re = new RegExp(`${MONTH_RE} (\\d{1,2}) ?- ?(\\d{1,2})(?: ${MONTH_RE})? (\\d{4}) (\\d{1,2}\\.\\d{2})%`, 'g');
  for (const m of block.matchAll(re)) {
    const toMonth = m[4] || m[1];
    const year = +m[5];
    const fromYear = MONTHS.indexOf(m[1].toLowerCase()) > MONTHS.indexOf(toMonth.toLowerCase()) ? year - 1 : year;
    const from = isoDate(+m[2], m[1], fromYear), to = isoDate(+m[3], toMonth, year), v = pct(m[6]);
    if (from && to && v != null && !rows.some(r => r.from === from)) rows.push({ label: 'Express (road & air)', pct: v, from, to });
  }
  return rows.length ? splitByDate(rows, now) : null;
}

/** Sendle: page didn't load from the box; accept only "current fuel surcharge is NN%". */
export function parseSendle(html: string, now: number): ParsedFuel | null {
  const t = htmlToText(html);
  const m = t.match(/current fuel surcharge (?:is|of) (\d{1,2}(?:\.\d{1,2})?)%/i);
  const v = m ? pct(m[1]) : null;
  return v == null ? null : { current: [{ label: 'Domestic', pct: v, from: perthIso(now) }], previous: [], upcoming: [] };
}

// ─── Carrier allow-list (fixed URLs only) ───────────────────────────────────
export const CARRIERS: Carrier[] = [
  { id: 'tge', name: 'Team Global Express', ours: true, frequency: 'Weekly', url: 'https://teamglobalexp.com/fuel-surcharge', parse: parseTge },
  { id: 'startrack', name: 'StarTrack', frequency: 'Monthly period', url: 'https://auspost.com.au/business/shipping/parcels/startrack/pricing-updates', parse: parseStarTrack },
  { id: 'auspost', name: 'Australia Post (eParcel)', frequency: 'Monthly', url: 'https://auspost.com.au/business/shipping/postage-costs/fuel-surcharge', parse: parseAusPost },
  { id: 'tnt', name: 'TNT / FedEx (domestic)', frequency: 'Fortnightly', url: 'https://www.tnt.com/express/en_au/site/how-to/understand-fuel-surcharges.html', note: 'Separate 10% WA regional surcharge applies.', parse: parseTnt },
  { id: 'aramex', name: 'Aramex', frequency: 'Monthly', url: 'https://www.aramex.com.au/terms-and-conditions/fuel-surcharge/', parse: parseAramex },
  { id: 'couriersplease', name: 'CouriersPlease', frequency: 'Monthly', url: 'https://www.couriersplease.com.au/fuel-surcharge', parse: parseCouriersPlease },
  { id: 'dhl', name: 'DHL Express AU', frequency: 'Weekly', url: 'https://www.dhl.com/au-en/home/express/products-and-solutions/products-and-services-overview/surcharges.html', parse: parseDhl },
  { id: 'sendle', name: 'Sendle', frequency: '—', url: 'https://try.sendle.com/en-au/fuel-surcharge', parse: parseSendle },
  ...([
    ['kal', 'Kal Express'], ['direct', 'Direct Couriers'], ['hunter', 'Hunter Express'], ['northline', 'Northline'],
    ['border', 'Border Express'], ['allied', 'Allied Express'], ['mainfreight', 'Mainfreight'], ['followmont', 'Followmont'], ['capital', 'Capital Transport'],
  ] as const).map(([id, name]) => ({ id, name, url: null, frequency: '—', notPublished: true } as Carrier)),
];
export const CARRIER_IDS = CARRIERS.map(c => c.id);
export const carrierById = (id: string) => CARRIERS.find(c => c.id === id);

// ─── Seed (research pass, 18 Oct 2026) so the page isn't empty before first refresh ─
const SEED_AT = Date.UTC(2026, 9, 18, 0, 0); // 18 Oct 2026 08:00 AWST
const r = (label: string, p: number, from: string | null, to: string | null = null): FuelRate => ({ label, pct: p, from, to });
const SEED_DATA: Record<string, ParsedFuel> = {
  tge: { current: [r('Palletised Express', 42.84, '2026-10-12'), r('Express Parcels Road', 30.21, '2026-10-12'), r('Express Parcels Air', 25.77, '2026-10-12')],
         previous: [r('Palletised Express', 41.66, '2026-10-05'), r('Express Parcels Road', 29.38, '2026-10-05'), r('Express Parcels Air', 24.90, '2026-10-05')],
         upcoming: [r('Palletised Express', 42.95, '2026-10-19'), r('Express Parcels Road', 30.29, '2026-10-19'), r('Express Parcels Air', 26.26, '2026-10-19')] },
  startrack: { current: [r('Express & Premium', 22.2, '2026-09-30', '2026-10-27')], previous: [], upcoming: [r('Express & Premium', 24.2, '2026-10-28', '2026-11-24')] },
  auspost: { current: [r('eParcel / Parcel Post', 11.5, '2026-10-01', '2026-10-31')], previous: [], upcoming: [r('eParcel / Parcel Post', 13.5, '2026-11-01', '2026-11-30')] },
  tnt: { current: [r('Domestic', 44.9, '2026-10-11', '2026-10-24')], previous: [r('Domestic', 41.2, '2026-09-27', '2026-10-10')], upcoming: [] },
  aramex: { current: [r('Domestic parcels', 11.5, '2026-10-01', '2026-10-31')], previous: [], upcoming: [] },
  couriersplease: { current: [r('Domestic', 16.7, '2026-10-01', '2026-10-31')], previous: [], upcoming: [] },
  dhl: { current: [r('Express (road & air)', 49.0, '2026-10-12', '2026-10-18')], previous: [], upcoming: [r('Express (road & air)', 49.75, '2026-10-19', '2026-10-25')] },
};
export function seedDoc(c: Carrier): FuelDoc {
  const s = SEED_DATA[c.id];
  return {
    carrierId: c.id, name: c.name, sourceUrl: c.url,
    status: c.notPublished ? 'not_published' : s ? 'ok' : 'unavailable',
    current: s?.current || [], previous: s?.previous || [], upcoming: s?.upcoming || [],
    lastCheckedAt: s ? SEED_AT : null, lastSuccessAt: s ? SEED_AT : null, error: null, seeded: !!s,
  };
}

/** Delta vs previous for the same label (percentage points), or null. */
export function deltaFor(d: Pick<FuelDoc, 'previous'>, rate: FuelRate): number | null {
  const p = d.previous.find(x => x.label === rate.label);
  return p ? Math.round((rate.pct - p.pct) * 100) / 100 : null;
}

/** Rate to show for "today": current, or (if the page only listed upcoming) none. */
export function headlineRate(d: Pick<FuelDoc, 'current'>): FuelRate | null { return d.current[0] || null; }

// ─── Refresh (server-only callers: Next route + scheduled function) ─────────
export type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function fetchAllowed(c: Carrier, fetchImpl: FetchLike): Promise<string> {
  if (!c.url || !CARRIERS.some(x => x.url === c.url)) throw new Error('not allow-listed');
  const res = await fetchImpl(c.url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; BDM-Compass fuel-surcharge checker)', accept: 'text/html', 'accept-language': 'en-AU,en' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
}

/** Fetch + parse one carrier and merge with the last stored doc (keeps last good value on failure). */
export async function refreshCarrier(c: Carrier, prev: FuelDoc | null, fetchImpl: FetchLike, now: number): Promise<{ doc: FuelDoc; changed: boolean }> {
  const base = prev || seedDoc(c);
  if (c.notPublished || !c.parse) return { doc: { ...base, status: 'not_published', lastCheckedAt: now }, changed: false };
  let parsed: ParsedFuel | null = null;
  let error: string | null = null;
  try { parsed = c.parse(await fetchAllowed(c, fetchImpl), now); if (!parsed || !parsed.current.length) { error = 'Could not find a rate on the page'; parsed = null; } }
  catch (e: any) { error = e?.name === 'TimeoutError' ? 'Timed out' : String(e?.message || 'Fetch failed').slice(0, 120); }
  if (!parsed) {
    const hasGood = base.current.length > 0;
    return { doc: { ...base, status: hasGood ? 'stale' : (error === 'Could not find a rate on the page' ? 'check_source' : 'unavailable'), lastCheckedAt: now, error }, changed: false };
  }
  const key = (rs: FuelRate[]) => JSON.stringify(rs.map(x => [x.label, x.pct, x.from]));
  const changed = key(parsed.current) !== key(base.current);
  // Prefer the page's own previous row; else carry the last stored current as previous when it changed.
  const previous = parsed.previous.length ? parsed.previous : changed ? base.current : base.previous;
  return {
    doc: { carrierId: c.id, name: c.name, sourceUrl: c.url, status: 'ok', current: parsed.current, previous, upcoming: parsed.upcoming, lastCheckedAt: now, lastSuccessAt: now, error: null, seeded: false },
    changed,
  };
}

/** Minimal Firestore surface (admin SDK compatible) so this file stays dependency-free. */
export type DbLike = {
  doc(path: string): { get(): Promise<{ exists: boolean; data(): any }>; set(d: any, o?: any): Promise<any> };
  collection(path: string): { add(d: any): Promise<any> };
  runTransaction<T>(fn: (tx: { get(ref: any): Promise<{ exists: boolean; data(): any }>; set(ref: any, d: any, o?: any): any }) => Promise<T>): Promise<T>;
};

export type RefreshSummary = { ran: boolean; lastRunAt: number; results: { carrierId: string; status: FuelStatus; changed: boolean; error: string | null }[] };

/** Global throttle (10 min) then refresh every carrier; writes fuelSurcharges + history. */
export async function runFuelRefresh(db: DbLike, fetchImpl: FetchLike, now: number, opts: { force?: boolean; by?: string } = {}): Promise<RefreshSummary> {
  const metaRef = db.doc('fuelSurchargeMeta/refresh');
  const last = await db.runTransaction(async tx => {
    const s = await tx.get(metaRef);
    const lastRunAt = s.exists ? Number(s.data()?.lastRunAt || 0) : 0;
    if (!opts.force && now - lastRunAt < REFRESH_MIN_INTERVAL_MS) return lastRunAt;
    tx.set(metaRef, { lastRunAt: now, by: opts.by || 'system' }, { merge: true });
    return -1;
  });
  if (last >= 0) return { ran: false, lastRunAt: last, results: [] };
  const results = await Promise.all(CARRIERS.map(async c => {
    const ref = db.doc(`fuelSurcharges/${c.id}`);
    const snap = await ref.get();
    const { doc, changed } = await refreshCarrier(c, snap.exists ? (snap.data() as FuelDoc) : null, fetchImpl, now);
    await ref.set(doc);
    if (changed) await db.collection('fuelSurchargeHistory').add({ carrierId: c.id, current: doc.current, previous: doc.previous, recordedAt: now });
    return { carrierId: c.id, status: doc.status, changed, error: doc.error };
  }));
  return { ran: true, lastRunAt: now, results };
}
