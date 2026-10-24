/**
 * Verticals page: static content (lead sources, industrial belts, playbooks)
 * and helpers for the `verticalProspects` collection.
 *
 * Link URLs were checked on 16 Oct 2026. `flag` notes any that block
 * automated checks or were substituted.
 */

export type VerticalId = 'MINING' | 'MEDICAL' | 'ECOMMERCE' | 'OTHER';
export const VERTICALS: { id: VerticalId; label: string; short: string }[] = [
  { id: 'MINING', label: 'Mining Services', short: 'Mining' },
  { id: 'MEDICAL', label: 'Medical', short: 'Medical' },
  { id: 'ECOMMERCE', label: 'Ecommerce', short: 'Ecommerce' },
  { id: 'OTHER', label: 'Other', short: 'Other' },
];

export type BeltId = 'NORTH' | 'EAST' | 'SOUTH' | 'CENTRAL' | 'REGIONAL_WA' | 'INTERSTATE';
export const BELTS: { id: BeltId; label: string; suburbs: string[] }[] = [
  { id: 'NORTH', label: 'North', suburbs: ['Malaga', 'Wangara', 'Balcatta', 'Osborne Park', 'Joondalup'] },
  { id: 'EAST', label: 'East', suburbs: ['Kewdale', 'Welshpool', 'Canning Vale', "O'Connor"] },
  { id: 'SOUTH', label: 'South', suburbs: ['Henderson', 'Bibra Lake', 'Cockburn', 'Rockingham'] },
  { id: 'CENTRAL', label: 'Central', suburbs: ['Perth CBD', 'West Perth', 'Subiaco', 'Nedlands'] },
  { id: 'REGIONAL_WA', label: 'Regional WA', suburbs: [] },
  { id: 'INTERSTATE', label: 'Interstate', suburbs: [] },
];
/** Belts with Google Maps search buttons. */
export const METRO_BELTS = BELTS.filter(b => b.suburbs.length);

export type FreightProfile = 'SATCHEL' | 'PARCEL' | 'CARTON' | 'SKID' | 'PALLET';
export const FREIGHT_PROFILES: { id: FreightProfile; label: string }[] = [
  { id: 'SATCHEL', label: 'Satchel' },
  { id: 'PARCEL', label: 'Parcel' },
  { id: 'CARTON', label: 'Carton' },
  { id: 'SKID', label: 'Skid' },
  { id: 'PALLET', label: 'Pallet (single / small multi)' },
];

export type SfStatus = 'UNCHECKED' | 'NOT_IN_SF' | 'EXISTING_AM' | 'LOST_DORMANT';
export const SF_STATUSES: { id: SfStatus; label: string; className: string }[] = [
  { id: 'UNCHECKED', label: 'Unchecked', className: 'bg-secondary text-foreground/75 border-border' },
  { id: 'NOT_IN_SF', label: 'Not in SF', className: 'bg-success-soft text-success-ink border-success/25' },
  { id: 'EXISTING_AM', label: 'Existing customer – AM opportunity', className: 'bg-info-soft text-info border-info/25' },
  { id: 'LOST_DORMANT', label: 'Lost / Dormant', className: 'bg-warning-soft text-warning-ink border-warning/25' },
];

export type LeadSourceTag = 'AUSTMINE' | 'CME' | 'GOOGLE_MAPS' | 'REFERRAL' | 'TENDER' | 'LINKEDIN' | 'RESEARCH' | 'LOOKALIKE' | 'OTHER';
export const SOURCE_TAGS: { id: LeadSourceTag; label: string }[] = [
  { id: 'AUSTMINE', label: 'Austmine' },
  { id: 'CME', label: 'CME' },
  { id: 'GOOGLE_MAPS', label: 'Google Maps' },
  { id: 'REFERRAL', label: 'Referral' },
  { id: 'TENDER', label: 'Tender' },
  { id: 'LINKEDIN', label: 'LinkedIn' },
  { id: 'RESEARCH', label: 'Research list' },
  { id: 'LOOKALIKE', label: 'WA lookalike' },
  { id: 'OTHER', label: 'Other' },
];

export type ScoreKey = 'frequency' | 'freightFit' | 'regionalNeed' | 'carrierPain' | 'growth';
export const SCORE_CRITERIA: { id: ScoreKey; label: string; hint: string }[] = [
  { id: 'frequency', label: 'Frequency', hint: 'Ships daily / several times a week' },
  { id: 'freightFit', label: 'Freight fit', hint: 'Satchel → single pallet / small multi-pallet' },
  { id: 'regionalNeed', label: 'Regional need', hint: 'Regional WA and/or interstate lanes' },
  { id: 'carrierPain', label: 'Carrier pain', hint: 'Unhappy with current carrier / multiple carriers' },
  { id: 'growth', label: 'Growth', hint: 'Expanding, new sites, contracts or channels' },
];

export type VerticalProspect = {
  id: string;
  company: string;
  vertical: VerticalId;
  belt: BeltId;
  freightProfile: FreightProfile[];
  source: LeadSourceTag;
  contactName: string;
  contactTitle: string;
  notes: string;
  ownerUid: string | null;
  ownerName: string | null;
  claimedAt: any | null;
  sfStatus: SfStatus;
  sfCheckedBy?: string | null;
  sfCheckedAt?: any | null;
  scores: Record<ScoreKey, boolean>;
  score: number;
  lastActivityAt: any;
  createdBy: string;
  createdByName: string;
  createdAt: any;
  convertedAt?: any | null;
  convertedBy?: string | null;
  /** Assigned Account Manager when sfStatus = EXISTING_AM. */
  amUid?: string | null;
  amName?: string | null;
  /** AM growth notes. */
  amNotes?: string;
  /** Server-written delivery-pain check (clients cannot edit). */
  painSignals?: import('./intel').PainSignals | null;
  painCheckedAt?: any | null;
};

/** Claim/score need an SF check first; existing customers are AM-only (no BDM claim). */
export function canBdmClaim(p: VerticalProspect, now = Date.now()): boolean {
  return p.sfStatus !== 'UNCHECKED' && p.sfStatus !== 'EXISTING_AM' && isClaimable(p, now);
}

export const CLAIM_EXPIRY_DAYS = 30;
const DAY_MS = 86400000;

export function tsMs(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return 0;
}

/** A claim lapses after 30 days without activity (display + rules). */
export function isClaimExpired(p: Pick<VerticalProspect, 'ownerUid' | 'lastActivityAt' | 'claimedAt'>, now = Date.now()): boolean {
  if (!p.ownerUid) return false;
  const last = Math.max(tsMs(p.lastActivityAt), tsMs(p.claimedAt));
  return now - last > CLAIM_EXPIRY_DAYS * DAY_MS;
}

export function isClaimable(p: VerticalProspect, now = Date.now()): boolean {
  return !p.ownerUid || isClaimExpired(p, now);
}

export function scoreOf(scores: Partial<Record<ScoreKey, boolean>>): number {
  return SCORE_CRITERIA.filter(c => scores?.[c.id]).length;
}

/** Monday 00:00 Perth of the week containing `now`. */
export function perthWeekStart(now = Date.now()): number {
  const off = 8 * 3600000;
  const d = new Date(now + off);
  const dow = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow) - off;
}

export function mapsSearchUrl(keyword: string, suburb: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(`${keyword} ${suburb} WA`)}`;
}

export function linkedInPeopleUrl(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export type LeadSource = { label: string; url: string; description: string; flag?: string };

const LINKEDIN_TITLES = '(logistics OR "supply chain" OR procurement OR warehouse OR dispatch OR operations) manager';

export const LEAD_SOURCES: Record<VerticalId, LeadSource[]> = {
  MINING: [
    { label: 'Austmine – OZMETS member directory', url: 'https://austmine.com.au/Public/OZMETS_Hub/OMETSHUB_Company.aspx', description: 'METS suppliers by capability and location.' },
    { label: 'CME WA', url: 'https://www.cmewa.com.au/', description: 'Chamber of Minerals & Energy WA. Members and events.', flag: 'Site blocks automated checks (403). Opens normally in a browser.' },
    { label: 'AMEC', url: 'https://amec.org.au/', description: 'Association of Mining & Exploration Companies. Member explorers and suppliers.', flag: 'Site blocks automated checks (403). Opens normally in a browser.' },
    { label: 'MINEDEX (DEMIRS)', url: 'https://minedex.dmirs.wa.gov.au/', description: 'WA mines and projects database. Find operators and project owners.' },
    { label: 'Tenders WA', url: 'https://www.tenders.wa.gov.au/watenders/index.do', description: 'WA Government tenders and awarded contracts.' },
    { label: 'ICN Gateway (WA projects)', url: 'https://gateway.icn.org.au/', description: 'Work packages and awarded suppliers on WA mining projects.' },
    { label: 'Rio Tinto – suppliers', url: 'https://www.riotinto.com/en/suppliers', description: 'Supplier portal and registration.' },
    { label: 'BHP – suppliers', url: 'https://www.bhp.com/suppliers', description: 'Supplier information and registration.', flag: 'Site blocks automated checks (403). Opens normally in a browser.' },
    { label: 'Fortescue (FMG) – suppliers', url: 'https://www.fortescue.com/en/suppliers', description: 'Supplier registration and opportunities.' },
    { label: 'Hancock Iron Ore (Roy Hill)', url: 'https://www.hancockironore.com.au/', description: 'Roy Hill now trades as Hancock Iron Ore (royhill.com.au/suppliers redirects to a dead page).', flag: 'Substituted: Roy Hill supplier page is dead.' },
    { label: 'Gold Fields Australia – suppliers', url: 'https://www.goldfields.com/australia.php', description: 'Agnew, Granny Smith, Gruyere, St Ives. Ariba registration.', flag: 'Could not connect from the check server; confirmed via search.' },
    { label: 'Northern Star – suppliers', url: 'https://www.nsrltd.com/suppliers/', description: 'Supplier requirements; tenders via ICN.' },
    { label: 'South32 – suppliers', url: 'https://www.south32.net/suppliers', description: 'Supplier information (Worsley Alumina etc.).', flag: 'Site blocks automated checks (403). Opens normally in a browser.' },
    { label: 'Mineral Resources – suppliers', url: 'https://www.mineralresources.com.au/suppliers/', description: 'Supplier registration.' },
    { label: 'LinkedIn – WA mining logistics people', url: linkedInPeopleUrl(`${LINKEDIN_TITLES} mining Western Australia`), description: 'Prefilled people search: WA + logistics/supply chain/procurement titles.' },
  ],
  MEDICAL: [
    { label: 'MTAA', url: 'https://www.mtaa.org.au/', description: 'Medical Technology Association of Australia. Member device companies.' },
    { label: 'Pharmacy Guild – WA Branch', url: 'https://www.guild.org.au/guild-branches/wa', description: 'Community pharmacy network in WA.' },
    { label: 'NDIS – find a registered provider', url: 'https://www.ndis.gov.au/participants/working-providers/find-registered-provider', description: 'Consumables, equipment and assistive-tech providers.' },
    { label: 'My Aged Care – find a provider', url: 'https://www.myagedcare.gov.au/find-a-provider/', description: 'Aged care providers (consumables and continence supplies).' },
    { label: 'WA Primary Health Alliance', url: 'https://www.wapha.org.au/', description: 'Primary care network across metro and regional WA.' },
    { label: 'Tenders WA', url: 'https://www.tenders.wa.gov.au/watenders/index.do', description: 'Health Support Services and WA Health supply contracts.' },
    { label: 'LinkedIn – WA medical supply people', url: linkedInPeopleUrl(`${LINKEDIN_TITLES} (medical OR pharmacy OR healthcare) Western Australia`), description: 'Prefilled people search.' },
  ],
  ECOMMERCE: [
    { label: 'Power Retail', url: 'https://www.powerretail.com.au/', description: 'Ecommerce news and Top 100 online retailers.', flag: 'Site blocks automated checks (403). Opens normally in a browser.' },
    { label: 'Inside Retail', url: 'https://insideretail.com.au/', description: 'Retail news. Watch for WA brands expanding.' },
    { label: 'Shopify stores in Perth (Google)', url: `https://www.google.com/search?q=${encodeURIComponent('site:myshopify.com Perth WA')}`, description: 'Google search for Shopify stores mentioning Perth.' },
    { label: 'Instagram – #perthsmallbusiness', url: 'https://www.instagram.com/explore/tags/perthsmallbusiness/', description: 'WA product brands selling online.' },
    { label: 'TikTok – Perth small business', url: `https://www.tiktok.com/search?q=${encodeURIComponent('perth small business')}`, description: 'TikTok Shop and DTC sellers.' },
    { label: 'StartupWA', url: 'https://www.startupwa.org/', description: 'WA startup ecosystem and directory.' },
    { label: 'Spacecubed', url: 'https://spacecubed.com/', description: 'Perth co-working and startup community.' },
    { label: 'LinkedIn – WA ecommerce people', url: linkedInPeopleUrl(`(ecommerce OR "online store" OR founder OR operations OR fulfilment) Perth Western Australia`), description: 'Prefilled people search.' },
  ],
  OTHER: [
    { label: 'Tenders WA', url: 'https://www.tenders.wa.gov.au/watenders/index.do', description: 'WA Government tenders and awarded contracts.' },
    { label: 'ICN Gateway', url: 'https://gateway.icn.org.au/', description: 'Industry capability network: suppliers and projects.' },
    { label: 'LinkedIn – WA logistics people', url: linkedInPeopleUrl(`${LINKEDIN_TITLES} Western Australia`), description: 'Prefilled people search.' },
  ],
};

/** Google Maps keywords per vertical. */
export const MAPS_KEYWORDS: Record<VerticalId, string[]> = {
  MINING: ['mining supplies', 'industrial supplies', 'engineering', 'hydraulics', 'PPE safety supplies'],
  MEDICAL: ['medical supplies', 'pharmacy wholesaler', 'dental supplies', 'mobility equipment', 'laboratory supplies'],
  ECOMMERCE: ['online store warehouse', 'fulfilment', 'wholesale distributor', 'cosmetics manufacturer', 'apparel'],
  OTHER: ['distributor', 'wholesale', 'manufacturer', 'trade supplies'],
};

/** Parcel scope note shown in each Playbook. */
export const PARCEL_SCOPE =
  'Parcel scope: satchels, parcels, cartons, skids, single pallets and small multi-pallet customers, across Perth metro, regional WA and interstate.';

export type Playbook = { pitch: string; pains: string[]; titles: string[]; steps: string[] };

const CORE = 'One carrier for satchels through to single pallets (and small multi-pallet consignments), across Perth metro, regional WA and interstate: one account, one invoice, one point of contact.';

export const PLAYBOOKS: Record<VerticalId, Playbook> = {
  MINING: {
    pitch: `${CORE} We keep parts, PPE and consumables moving to Perth workshops, regional hubs (Kalgoorlie, Port Hedland, Karratha, Newman) and east-coast OEMs, so sites aren't waiting on small but critical items.`,
    pains: [
      'Urgent breakdown parts stuck behind bulk shipment schedules',
      'Several carriers for different sizes and lanes; no single view',
      'Regional WA transit times and failed deliveries to sites',
      'Supplier-portal compliance (Ariba, insurances, inductions) slowing onboarding',
      'Interstate OEM inbound parts with poor visibility',
    ],
    titles: ['Logistics / Transport Manager', 'Supply Chain Manager', 'Procurement / Category Manager', 'Warehouse / Stores Manager', 'Operations Manager', 'Branch Manager (METS supplier)'],
    steps: [
      'Pick a belt (Kewdale/Welshpool/Malaga/Henderson). Map 10 METS suppliers from Austmine and Maps.',
      'Check each in Salesforce (click the company name) and set SF status.',
      'Score the 5 criteria. Claim anything scoring 3+.',
      'LinkedIn: connect with the logistics/procurement lead and reference regional lanes (Goldfields/Pilbara).',
      'Call or drop in: ask "how do urgent parts get to site today?"',
      'Book a fact-finding meeting, then Convert to Fact Finding.',
    ],
  },
  MEDICAL: {
    pitch: `${CORE} Reliable, trackable delivery for consumables, devices and pharmacy stock to hospitals, clinics, aged care and NDIS participants in Perth, regional WA and interstate.`,
    pains: [
      'Time-sensitive consumables and failed or late deliveries',
      'Regional WA clinics and aged-care sites with long transit times',
      'Proof of delivery and traceability requirements',
      'Mixed sizes (satchels for scripts and samples, pallets for consumables) across several carriers',
      'Home delivery to NDIS / aged-care clients',
    ],
    titles: ['Supply Chain / Logistics Manager', 'Operations Manager', 'Warehouse Manager', 'Practice / Pharmacy Owner', 'Customer Service Manager', 'Procurement Officer'],
    steps: [
      'Start with MTAA members and NDIS/My Aged Care providers based in WA.',
      'Search Maps for medical suppliers in Osborne Park, Canning Vale and Malaga.',
      'Check SF status. Existing accounts → AM opportunity.',
      'Lead with POD/tracking and regional reach. Ask about failed deliveries.',
      'Offer a trial lane (e.g. Perth → Bunbury/Geraldton).',
      'Fact-find, then Convert to Fact Finding.',
    ],
  },
  ECOMMERCE: {
    pitch: `${CORE} Fast, affordable satchel and parcel delivery for WA online brands to customers across Australia, plus carton and pallet replenishment to 3PLs and retailers.`,
    pains: [
      'High satchel costs and inconsistent interstate transit',
      'Customer complaints: tracking gaps and lost parcels',
      'Peak-season capacity (Click Frenzy, BFCM, Christmas)',
      'Juggling Australia Post, couriers and pallet carriers',
      'Returns handling',
    ],
    titles: ['Founder / Owner', 'Operations Manager', 'Ecommerce Manager', 'Fulfilment / Warehouse Lead', 'Customer Experience Manager'],
    steps: [
      'Find WA brands via Shopify/Instagram/TikTok searches, StartupWA and Spacecubed.',
      'Check order volume signals (reviews, ads, wholesale stockists).',
      'Check SF. Score frequency and growth carefully.',
      'DM or email the founder with an interstate satchel transit-time comparison.',
      'Offer a rate review on their top 3 lanes.',
      'Fact-find, then Convert to Fact Finding.',
    ],
  },
  OTHER: {
    pitch: `${CORE} The right fit for any WA business shipping satchels to single pallets regularly.`,
    pains: ['Multiple carriers', 'Regional WA reach', 'Interstate transit and visibility', 'Cost per consignment'],
    titles: ['Logistics Manager', 'Operations Manager', 'Warehouse Manager', 'Owner / GM'],
    steps: ['Source from Maps and LinkedIn', 'Check SF and score', 'Claim 3+ scores', 'Call, then fact-find, then Convert to Fact Finding'],
  },
};

// ─── Outreach templates (copy to clipboard) ─────────────────────────────────
export type Template = { id: string; label: string; body: string };

const VERT_HOOK: Record<VerticalId, { who: string; hook: string; proof: string }> = {
  MINING: { who: 'mining services suppliers', hook: 'getting urgent parts, PPE and consumables to Perth workshops and regional sites (Goldfields, Pilbara) without waiting on bulk shipments', proof: 'one carrier from satchels to single pallets, Perth metro + regional WA + interstate' },
  MEDICAL: { who: 'medical and healthcare suppliers', hook: 'reliable, trackable delivery of consumables and devices to clinics, aged care and NDIS clients, including regional WA', proof: 'proof of delivery and tracking on every consignment, satchel to single pallet' },
  ECOMMERCE: { who: 'WA online brands', hook: 'faster, more consistent satchel and parcel delivery to customers interstate and in regional WA', proof: 'competitive satchel rates with carton and pallet replenishment on the same account' },
  OTHER: { who: 'WA businesses', hook: 'simplifying deliveries from satchels to single pallets', proof: 'one carrier for Perth metro, regional WA and interstate' },
};

export function templatesFor(v: VerticalId): Template[] {
  const h = VERT_HOOK[v];
  return [
    { id: 'email1', label: 'First-touch email', body:
`Subject: Quick question on your WA deliveries

Hi [First name],

I look after Parcel accounts for Team Global Express here in WA, working with ${h.who}. A common challenge we solve is ${h.hook}.

We give you ${h.proof}: one account, one invoice, one local contact.

Would you be open to a 15-minute chat next week to see if there's a fit? Happy to work around you.

Kind regards,
[Your name]
Team Global Express | [Mobile]` },
    { id: 'email2', label: 'Follow-up email', body:
`Subject: Re: Quick question on your WA deliveries

Hi [First name],

Following up on my note last week. If it helps, I can run a quick comparison on your top 2–3 lanes (e.g. Perth → regional WA and Perth → east coast) with transit times and pricing. No commitment needed.

Is [day] at [time] any good for a short call?

Cheers,
[Your name]` },
    { id: 'email3', label: 'Breakup email', body:
`Subject: Should I close the loop?

Hi [First name],

I haven't heard back, so I'll assume deliveries aren't a priority right now, and that's completely fine.

If anything changes (a new site, a carrier issue, peak season), just reply to this email and I'll get a comparison to you the same week.

All the best,
[Your name]` },
    { id: 'linkedin', label: 'LinkedIn connection note', body:
`Hi [First name], I work with ${h.who} in WA on ${v === 'ECOMMERCE' ? 'parcel delivery' : 'deliveries from satchels to single pallets'}, Perth, regional and interstate. Would be great to connect.` },
    { id: 'call', label: 'Call script + objections', body:
`OPENER
"Hi [Name], it's [Your name] from Team Global Express. I'll be brief: we help ${h.who} with ${h.hook}. Who looks after your outbound deliveries?"

DISCOVERY
- What are you sending most: satchels, cartons, skids or pallets? How often?
- Where does it go: Perth metro, regional WA, interstate?
- Who do you use today, and what's one thing you'd change?

CLOSE
"Let's book 20 minutes to map your lanes. I'll bring a transit and price comparison."

OBJECTIONS
1. "We're happy with our current carrier."
   → "Great. Most of our customers were too. Is there one lane (regional or interstate) where service could be better? A quick comparison costs nothing."
2. "Send me an email."
   → "Will do. So it's useful, what's your biggest freight headache right now?" (then book a follow-up)
3. "We're locked into a contract."
   → "When does it end? I'll diarise 90 days prior so you have a benchmark going into renewal."
4. "You're too expensive."
   → "Price matters. Let's compare on your actual lanes and include failed deliveries, re-sends and admin across multiple carriers."` },
  ];
}

/** Normalised company name for de-duplication (matches the research-list merge). */
export function normaliseCompany(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\bincl\..*$/, '')
    .replace(/\b(pty|ltd|limited|group|the|australia|aust)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** verticalDismissals doc ID for a company ("Trading with TGE" marker). Letters + digits only. */
export function dismissalKey(name: string): string {
  return normaliseCompany(name).slice(0, 150);
}

export type VerticalDismissal = {
  id: string;
  company: string;
  reason: 'TRADING_WITH_TGE';
  suggestedId?: string;
  dismissedBy: string;
  dismissedByName?: string;
  dismissedAt: any;
};

const BELT_HINTS: [BeltId, RegExp][] = [
  ['REGIONAL_WA', /bunbury|harvey|geraldton|margaret river|mount barker|northcliffe|kemerton|kalgoorlie|albany|karratha|hedland/i],
  ['SOUTH', /henderson|bibra lake|cockburn|rockingham|kwinana|munster|jandakot|fremantle|myaree|palmyra/i],
  ['EAST', /kewdale|welshpool|canning vale|o'connor|forrestdale|forrestfield|guildford|bayswater|morley|victoria park|burswood|midland/i],
  ['NORTH', /malaga|wangara|balcatta|osborne park|joondalup|neerabup/i],
  ['CENTRAL', /subiaco|west perth|nedlands|perth/i],
];
/** Best-guess belt from a free-text HQ location. */
export function guessBelt(region: string | null | undefined): BeltId {
  for (const [belt, re] of BELT_HINTS) if (re.test(region || '')) return belt;
  return 'CENTRAL';
}
