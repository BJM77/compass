/**
 * Verticals intel: pure helpers shared by the server routes and the UI.
 * Carrier-pain signals + WA lookalike finder. No network, no secrets here.
 */
import type { VerticalId, BeltId } from './verticals';
import { guessBelt, normaliseCompany } from './verticals';

export type PainScore = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export const PAIN_SCORES: PainScore[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];
export const PAIN_LABEL: Record<PainScore, string> = { NONE: 'No signal', LOW: 'Low pain', MEDIUM: 'Medium pain', HIGH: 'High pain' };
export const PAIN_RECHECK_DAYS = 14;
export const INTEL_DAILY_LIMIT = 30;
export const BATCH_SCAN_MAX = 10;

export type SourceRef = { url: string; title: string };
export type PainFinding = { text: string; sources: SourceRef[] };
export type PainSignals = {
  score: PainScore;
  carrier: string | null;
  findings: PainFinding[];
  opening: string | null;
  checkedAt: number; // epoch ms
  noSignal: boolean;
};

export type Lookalike = {
  company: string;
  website: string;
  region: string;
  sector: string;
  size: string;
  why: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  vertical: VerticalId;
  belt: BeltId;
  /** 'grounded' = domain seen in search sources; 'dns' = domain resolves only. */
  verifiedBy: 'grounded' | 'dns';
  sources: SourceRef[];
  alreadyInList: boolean;
};

// ─── Gemini grounding shapes (subset) ───────────────────────────────────────
export type GroundingChunk = { web?: { uri?: string; title?: string } };
export type GroundingSupport = { segment?: { text?: string }; groundingChunkIndices?: number[] };
export type Grounded = { text: string; chunks: GroundingChunk[]; supports: GroundingSupport[] };

// ─── Input validation ──────────────────────────────────────────────────────
export const MAX_NAME = 120;
export const MAX_NOTES = 600;
export function cleanInput(s: unknown, max: number): string | null {
  if (typeof s !== 'string') return null;
  const t = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > max) return null;
  return t;
}

// ─── Privacy: strip personal contact data ──────────────────────────────────
export function scrubPersonal(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email removed]')
    .replace(/(\+?61|0)[\s-]?[2-478](?:[\s-]?\d){8}/g, '[phone removed]')
    .replace(/\b04\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g, '[phone removed]');
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Sources (chunk refs) whose support segment overlaps the given line. */
export function sourcesForLine(line: string, g: Grounded, resolved: SourceRef[]): SourceRef[] {
  const nl = norm(line);
  if (nl.length < 8) return [];
  const idx = new Set<number>();
  for (const s of g.supports || []) {
    const seg = norm(s.segment?.text || '');
    if (seg.length < 8) continue;
    if (nl.includes(seg) || seg.includes(nl)) (s.groundingChunkIndices || []).forEach(i => idx.add(i));
  }
  const out: SourceRef[] = [];
  for (const i of Array.from(idx).sort((a, b) => a - b)) {
    const r = resolved[i];
    if (r && /^https:\/\//.test(r.url) && !out.some(o => o.url === r.url)) out.push(r);
  }
  return out;
}

function field(text: string, key: string): string | null {
  const m = text.match(new RegExp(`^\\s*\\**${key}\\**\\s*:\\s*(.+)$`, 'im'));
  return m ? m[1].trim() : null;
}

/** Parse the model's pain answer; keep only grounded findings. */
export function parsePain(g: Grounded, resolved: SourceRef[], now = Date.now()): PainSignals {
  const lines = (g.text || '').split('\n');
  const findings: PainFinding[] = [];
  for (const raw of lines) {
    const m = raw.match(/^\s*[-*]?\s*\**FINDING\**\s*:\s*(.+)$/i);
    if (!m) continue;
    const text = scrubPersonal(m[1].replace(/\s*\(Source:[^)]*\)\s*$/i, '').trim()).slice(0, 400);
    const sources = sourcesForLine(m[1], g, resolved);
    if (sources.length && text) findings.push({ text, sources: sources.slice(0, 3) });
    if (findings.length >= 5) break;
  }
  const rawScore = (field(g.text, 'SCORE') || '').toUpperCase().replace(/[^A-Z]/g, '');
  let score: PainScore = (PAIN_SCORES as string[]).includes(rawScore) ? (rawScore as PainScore) : 'NONE';
  if (!findings.length) score = 'NONE';
  else if (score === 'NONE') score = 'LOW';
  // One weak finding can't be High.
  if (findings.length === 1 && score === 'HIGH') score = 'MEDIUM';
  let carrier = field(g.text, 'CARRIER');
  if (!carrier || /^(none|n\/a|unknown|not mentioned)/i.test(carrier) || !findings.length) carrier = null;
  else carrier = carrier.slice(0, 80);
  let opening = field(g.text, 'OPENING');
  opening = findings.length && opening ? scrubPersonal(opening).slice(0, 300) : null;
  return { score, carrier, findings, opening, checkedAt: now, noSignal: findings.length === 0 };
}

export function canRecheck(p: { checkedAt?: number } | null | undefined, now = Date.now()): boolean {
  return !p?.checkedAt || now - p.checkedAt >= PAIN_RECHECK_DAYS * 864e5;
}

export function hasCarrierPain(p: PainSignals | null | undefined): boolean {
  return !!p && (p.score === 'MEDIUM' || p.score === 'HIGH');
}

// ─── Lookalikes ────────────────────────────────────────────────────────────
export function hostOf(u: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
    const h = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return null; // no IP literals w/o dots-only check below
    if (/^\d+(\.\d+){3}$/.test(h)) return null;
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null;
    return h;
  } catch { return null; }
}

/** Registrable-ish base: strips one subdomain level except for *.com.au style. */
export function baseDomain(h: string): string {
  const parts = h.split('.');
  const n = /\.(com|net|org|gov|edu|asn|id)\.au$/.test(h) ? 3 : 2;
  return parts.slice(-n).join('.');
}

export function mapVertical(sector: string): VerticalId {
  const s = sector.toLowerCase();
  if (/mining|mine|resources|drill|mineral|exploration|metallurg/.test(s)) return 'MINING';
  if (/medical|health|pharma|dental|clinic|veterinar|hospital|lab/.test(s)) return 'MEDICAL';
  if (/ecommerce|e-commerce|online|retail|shop|apparel|fashion|beauty|cosmetic|direct.to.consumer|dtc/.test(s)) return 'ECOMMERCE';
  return 'OTHER';
}

export type LookalikeRaw = { company: string; website: string; region: string; sector: string; size: string; why: string; confidence: string };

export function parseLookalikeLines(text: string): LookalikeRaw[] {
  const out: LookalikeRaw[] = [];
  for (const raw of (text || '').split('\n')) {
    const m = raw.match(/^\s*[-*]?\s*\**COMPANY\**\s*:\s*(.+)$/i);
    if (!m) continue;
    const parts = m[1].split('|').map(x => x.trim());
    if (parts.length < 7) continue;
    const [company, website, region, sector, size, why, confidence] = parts;
    if (!company || !website) continue;
    out.push({ company: company.slice(0, 120), website, region: region.slice(0, 120), sector: sector.slice(0, 120), size: size.slice(0, 80), why: scrubPersonal(why).slice(0, 400), confidence });
  }
  return out;
}

/**
 * Turn raw lookalike lines into verified results.
 * `dnsOk(host)` is injected (server does a DNS lookup; tests mock it).
 */
export async function buildLookalikes(
  g: Grounded,
  resolved: SourceRef[],
  existingNames: string[],
  seedName: string,
  dnsOk: (host: string) => Promise<boolean>,
): Promise<Lookalike[]> {
  const known = new Set(existingNames.map(normaliseCompany).filter(Boolean));
  const seedN = normaliseCompany(seedName);
  const groundedHosts = new Map<string, SourceRef[]>();
  for (const r of resolved) {
    const h = hostOf(r.url); if (h) { const b = baseDomain(h); groundedHosts.set(b, [...(groundedHosts.get(b) || []), r]); }
    // Grounding chunk titles are usually the site's domain.
    const t = hostOf(r.title || ''); if (t) { const b = baseDomain(t); groundedHosts.set(b, [...(groundedHosts.get(b) || []), r]); }
  }
  const out: Lookalike[] = [];
  const seen = new Set<string>();
  for (const r of parseLookalikeLines(g.text)) {
    const h = hostOf(r.website); if (!h) continue;
    const b = baseDomain(h);
    const n = normaliseCompany(r.company);
    if (!n || n === seedN || seen.has(n) || seen.has(b)) continue;
    const lineSources = sourcesForLine(`${r.company} ${r.why}`, g, resolved);
    let verifiedBy: Lookalike['verifiedBy'] | null = null;
    let sources: SourceRef[] = [];
    if (groundedHosts.has(b)) { verifiedBy = 'grounded'; sources = groundedHosts.get(b)!.slice(0, 2); }
    else if (await dnsOk(b)) { verifiedBy = 'dns'; sources = lineSources.slice(0, 2); }
    if (!verifiedBy) continue; // never return an unverified URL
    seen.add(n); seen.add(b);
    const c = r.confidence.toUpperCase();
    let confidence: Lookalike['confidence'] = c.startsWith('H') ? 'HIGH' : c.startsWith('M') ? 'MEDIUM' : 'LOW';
    if (verifiedBy === 'dns' && confidence === 'HIGH') confidence = 'MEDIUM';
    out.push({
      company: r.company, website: `https://${h}`, region: r.region, sector: r.sector, size: r.size, why: r.why,
      confidence, vertical: mapVertical(r.sector), belt: guessBelt(r.region), verifiedBy, sources,
      alreadyInList: known.has(n),
    });
    if (out.length >= 10) break;
  }
  return out;
}

export function painPrompt(company: string, website: string | null): string {
  return `You are researching PUBLIC evidence that the Western Australian business "${company}"${website ? ` (website ${website})` : ''} has parcel delivery / shipping pain. Use Google Search.
Look for: customer reviews mentioning late, lost or damaged deliveries or slow shipping (ProductReview.com.au, Trustpilot, Google review snippets, Reddit), and the company's own shipping/FAQ page (long WA or regional delivery times, "excludes WA/regional", flat high WA shipping rates, carrier named).
Rules: only report things you actually found in search results. Do NOT include names, emails or phone numbers of individuals. Do not mention freight/pallet linehaul services. If nothing relevant is found, give SCORE: None and no FINDING lines.
Answer EXACTLY in this format, one item per line:
SCORE: None|Low|Medium|High
CARRIER: <carrier named in the evidence, or None>
FINDING: <one short quote or paraphrase of a single piece of evidence>
(2 to 5 FINDING lines, each about one source)
OPENING: <one-sentence friendly opening line a Team Global Express Parcel sales rep could use, referencing the evidence>`;
}

export function lookalikePrompt(seed: { company: string; sector?: string | null; region?: string | null; size?: string | null; notes?: string | null }): string {
  return `Find 5 to 10 real companies similar to "${seed.company}"${seed.sector ? ` (sector: ${seed.sector})` : ''}${seed.region ? `, located ${seed.region}` : ''}${seed.size ? `, size ${seed.size}` : ''}. Use Google Search.
${seed.notes ? `Notes about why this seed is a great customer: ${seed.notes}\n` : ''}Requirements: headquartered in Western Australia or with major WA operations; same or adjacent sector; similar size; they likely ship parcels, cartons or single pallets (not bulk freight). Exclude "${seed.company}" itself. Only list companies you found in search results with their real official website. Do not include names, emails or phones of individuals.
Answer with one line per company in EXACTLY this format:
COMPANY: <company name> | <official website domain> | <WA suburb or region> | <sector> | <approx size> | <why similar, one sentence> | <High|Medium|Low confidence>`;
}

// ─── Find new leads (per vertical) ─────────────────────────────────────────
/** Per-user daily cap on "Find new leads" searches (also counts toward INTEL_DAILY_LIMIT). */
export const DISCOVER_DAILY_LIMIT = 5;
/** Leaders and admins only (matches isAdmin() in firestore.rules). */
export const DISCOVER_ROLES = ['LEADER', 'GM', 'ADMIN', 'SUPER_ADMIN'];

/** A lead found by "Find new leads", stored team-wide in `discoveredLeads/{key}`. */
export type DiscoveredLead = {
  id: string;
  company: string;
  website: string;
  domain: string;
  vertical: VerticalId;
  belt: BeltId;
  sector: string;
  region: string;
  size: string;
  whyTheyShip: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  verifiedBy: 'grounded' | 'dns';
  evidenceUrl: string | null;
  sources: SourceRef[];
  discoveredBy: string;
  discoveredByName: string;
  createdAt: any;
};

const DISCOVER_FOCUS: Record<VerticalId, string> = {
  MINING: 'mining services and supply businesses (equipment, parts, consumables, PPE, safety gear, drilling supplies, lab and assay supplies, hydraulics, electrical, industrial distributors)',
  MEDICAL: 'medical, health and allied-health businesses (medical and dental suppliers, pharmacies and pharmacy groups, pathology/lab suppliers, veterinary suppliers, health product distributors, mobility and aged-care equipment)',
  ECOMMERCE: 'online retailers and direct-to-consumer brands (fashion, beauty, homewares, health and supplements, sporting and outdoor, pet, gifts, specialty food and drink)',
  OTHER: 'wholesalers, distributors, manufacturers and trade suppliers (automotive parts, building and hardware supplies, packaging, office and print, agricultural supplies, industrial products)',
};

export function discoverPrompt(vertical: VerticalId, exclude: string[]): string {
  const ex = exclude.filter(Boolean).slice(0, 120).join('; ');
  return `Find 8 to 10 real companies in Western Australia in this sector: ${DISCOVER_FOCUS[vertical]}. Use Google Search.
Requirements: headquartered in Western Australia or with major WA operations (warehouse, store network or distribution centre in WA); they likely send parcels and cartons to customers in Perth, regional WA or interstate (online orders, trade orders, spare parts, consumables). Focus on small to mid-sized businesses that a Team Global Express Parcel sales rep could win.
Only list companies you actually found in search results, with their real official website domain. Do not invent companies or websites. Do not include names, emails or phone numbers of individuals. Do not mention freight, pallets or linehaul.
${ex ? `Do NOT list any of these (already known): ${ex}.\n` : ''}Answer with one line per company in EXACTLY this format:
COMPANY: <company name> | <official website domain> | <WA suburb or region> | <sector> | <approx size> | <why they likely ship parcels, one sentence> | <High|Medium|Low confidence>`;
}

/** Normalised domain key for de-duplication (e.g. "https://www.Acme.com.au/x" → "acme.com.au"). */
export function domainKey(u: string | null | undefined): string | null {
  const h = u ? hostOf(u) : null;
  return h ? baseDomain(h) : null;
}

/**
 * Keep only genuinely new leads: drop anything whose normalised name or domain
 * is already known (prospects, research list, Trading with TGE, earlier finds),
 * and anything without a source URL (we only keep search-backed results).
 */
export function filterNewLeads(results: Lookalike[], knownNames: string[], knownDomains: string[], max = 10): Lookalike[] {
  const names = new Set(knownNames.map(normaliseCompany).filter(Boolean));
  const domains = new Set(knownDomains.map(d => domainKey(d)).filter((d): d is string => !!d));
  const out: Lookalike[] = [];
  for (const r of results) {
    const n = normaliseCompany(r.company);
    const d = domainKey(r.website);
    if (!n || !d || names.has(n) || domains.has(d)) continue;
    if (!r.sources.length) continue;
    names.add(n); domains.add(d);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** Firestore doc ID for a discovered lead: normalised name, letters + digits only. */
export function discoveredKey(company: string): string {
  return normaliseCompany(company).slice(0, 150);
}
