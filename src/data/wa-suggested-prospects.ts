/**
 * Suggested WA prospects for the Verticals page.
 *
 * Merged and de-duplicated from Ben's research handover (Oct 2026):
 *  - wa_large_shippers.csv   (51 WA-HQ shippers)
 *  - wa_online_retailers.csv (30 WA ecommerce brands)
 *  - top200.csv              (Power Retail Top 200; WA-HQ rows only)
 * Company-level data only (no personal contacts). Duplicates were merged on
 * normalised name; `sources` lists every list a company came from.
 * Generated; edit the CSVs and regenerate rather than hand-editing.
 */
import type { VerticalId } from '@/lib/verticals';

export type SuggestedProspect = {
  id: string;
  company: string;
  /** Group/legal/parent detail from the source name, e.g. "Dorsett Retail". */
  aka: string | null;
  vertical: VerticalId;
  sector: string;
  onlineCategory?: string | null;
  size: string | null;
  whyTheyShip: string;
  region: string;
  website: string | null;
  evidenceUrl: string | null;
  /** Evidence that isn't a URL (e.g. "ABN Lookup: ..."). */
  evidenceNote: string | null;
  confidence: string;
  lowPriority: boolean;
  lowPriorityReason: string | null;
  sources: string[];
};

export const WA_SUGGESTED_PROSPECTS: SuggestedProspect[] = [
  {
    "id": "wesfarmers-ltd",
    "company": "Wesfarmers Ltd",
    "aka": "group HQ",
    "vertical": "OTHER",
    "sector": "Retail & consumer",
    "onlineCategory": null,
    "size": "ASX top-20 conglomerate; owns Bunnings, Kmart, Officeworks, WesCEF etc.",
    "whyTheyShip": "Corporate HQ in Perth; brand freight decisions are mostly made by VIC-based divisions, except WesCEF",
    "region": "Perth WA 6000",
    "website": null,
    "evidenceUrl": "https://www.wesfarmers.com.au/our-businesses/wesfarmers-chemicals-energy-and-fertilisers",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "kitchen-warehouse",
    "company": "Kitchen Warehouse",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Kitchenware",
    "size": "~30 stores nationally; LinkedIn 166 staff",
    "whyTheyShip": "National store replenishment + large online parcel volume",
    "region": "Osborne Park / Bibra Lake WA",
    "website": "kitchenwarehouse.com.au",
    "evidenceUrl": "https://linkedin.com/company/kitchen-warehouse-australia",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers",
      "Power Retail #60",
      "Power Retail Top 200 #60"
    ]
  },
  {
    "id": "betts-group",
    "company": "Betts Group",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Footwear",
    "size": "National footwear chain (store count not found)",
    "whyTheyShip": "Store replenishment + online orders nationally",
    "region": "Osborne Park WA 6017",
    "website": "betts.com.au",
    "evidenceUrl": "https://www.betts.com.au/pages/privacy",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers",
      "Power Retail #244"
    ]
  },
  {
    "id": "retravision",
    "company": "Retravision",
    "aka": "Dorsett Retail",
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Electrical/appliances",
    "size": "19 stores across WA, NT, SA",
    "whyTheyShip": "Bulky whitegoods/electrical to stores and home delivery",
    "region": "Bunbury WA 6230",
    "website": "retravision.com.au",
    "evidenceUrl": "https://www.retravision.com.au/about-us",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers",
      "Power Retail #462"
    ]
  },
  {
    "id": "bedshed",
    "company": "Bedshed",
    "aka": "Joyce Corporation, ASX:JYC",
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Beds/furniture (franchise)",
    "size": "42 stores (36 franchised)",
    "whyTheyShip": "Bulky beds/mattresses/furniture to stores and customers",
    "region": "Osborne Park WA 6017",
    "website": "bedshed.com.au",
    "evidenceUrl": "https://joycegroup.com.au/bedshed/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers",
      "Power Retail #465"
    ]
  },
  {
    "id": "spudshed",
    "company": "Spudshed",
    "aka": "Galati Group",
    "vertical": "OTHER",
    "sector": "Retail & consumer",
    "onlineCategory": null,
    "size": "17 stores",
    "whyTheyShip": "Fresh produce/grocery distribution to WA stores",
    "region": "Jandakot WA",
    "website": null,
    "evidenceUrl": "https://www.spudshed.com.au/about-us/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "liquor-barons",
    "company": "Liquor Barons",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Retail & consumer",
    "onlineCategory": null,
    "size": "90+ stores across WA",
    "whyTheyShip": "Liquor distribution to member stores statewide incl. regional",
    "region": "Perth WA (co-op)",
    "website": null,
    "evidenceUrl": "https://www.liquorbarons.com.au/about-us/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "pharmacy-777",
    "company": "Pharmacy 777",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Pharmacy",
    "size": "Multi-store pharmacy chain (count not verified)",
    "whyTheyShip": "Pharmacy stock to stores + online orders",
    "region": "Osborne Park WA 6017",
    "website": "pharmacy777.com.au",
    "evidenceUrl": "https://pharmacy777.com.au/contact-us",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers"
    ]
  },
  {
    "id": "austin-computers",
    "company": "Austin Computers",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Computers/IT",
    "size": "Multiple Perth stores incl. Rockingham",
    "whyTheyShip": "IT hardware to stores, business customers, online",
    "region": "Perth WA",
    "website": "austin.net.au",
    "evidenceUrl": "https://austin.net.au/contact-us",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers"
    ]
  },
  {
    "id": "sea-to-summit",
    "company": "Sea to Summit",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Outdoor gear (brand, sells direct online)",
    "size": "Global outdoor-gear brand (size not found)",
    "whyTheyShip": "Wholesale to retailers nationally + DTC online",
    "region": "Perth WA (global HQ)",
    "website": "seatosummit.com.au",
    "evidenceUrl": "https://seatosummit.com.au/pages/general-faqs",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers"
    ]
  },
  {
    "id": "itechworld",
    "company": "iTechworld",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Portable power/electronics",
    "size": "Superstore + Burswood showroom (size not found)",
    "whyTheyShip": "Heavy batteries/power gear shipped nationally from Perth and QLD",
    "region": "Forrestdale WA 6112",
    "website": "itechworld.com.au",
    "evidenceUrl": "https://itechworld.com.au/pages/contact-us",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers"
    ]
  },
  {
    "id": "steel-blue",
    "company": "Steel Blue",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Retail & consumer",
    "onlineCategory": null,
    "size": "National safety-boot brand (size not found)",
    "whyTheyShip": "Wholesale to workwear/safety retailers nationally",
    "region": "Malaga WA 6090",
    "website": null,
    "evidenceUrl": "https://steelblue.com/au/customer-support/categories/features-technology/where-can-i-buy-steel-blue-boots",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "segals-outdoor-furniture",
    "company": "Segals Outdoor Furniture",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Retail & consumer",
    "onlineCategory": "Outdoor furniture",
    "size": "4 Perth superstores",
    "whyTheyShip": "Bulky furniture freight Australia-wide",
    "region": "Perth WA",
    "website": "segals.com.au",
    "evidenceUrl": "https://www.segals.com.au/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers"
    ]
  },
  {
    "id": "autoleague",
    "company": "Autoleague",
    "aka": "Swift Holdings Investments",
    "vertical": "OTHER",
    "sector": "Automotive",
    "onlineCategory": null,
    "size": "$3.4bn revenue; 66 dealerships (WA/VIC/QLD); 2,000+ staff",
    "whyTheyShip": "Parts and accessories between dealerships, workshops, inter-state",
    "region": "West Perth WA 6005",
    "website": null,
    "evidenceUrl": "https://www.autoleague.com.au/contact ; https://www.businessnews.com.au/article/WA-s-largest-private-businesses-revealed",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "regent-motors-group",
    "company": "Regent Motors Group",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Automotive",
    "onlineCategory": null,
    "size": "$1.2bn revenue (FY24); 20+ dealerships WA/NT; ~30,000 vehicles/yr",
    "whyTheyShip": "Parts distribution across dealership network incl. NT",
    "region": "Perth WA",
    "website": null,
    "evidenceUrl": "https://www.accc.gov.au/public-registers/mergers-and-acquisitions-registers/acquisitions-register/regent-motors-group-lane-groups-mandurah-dealerships ; https://www.businessnews.com.au/article/Regent-Motors-revs-up-sales",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "barbagallo-motor-group",
    "company": "Barbagallo Motor Group",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Automotive",
    "onlineCategory": null,
    "size": "Multi-franchise dealer group (size not found)",
    "whyTheyShip": "Parts/accessories movement across sites",
    "region": "Osborne Park WA",
    "website": null,
    "evidenceUrl": "https://www.barbagallo.com.au/about-us/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "john-hughes-group",
    "company": "John Hughes Group",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Automotive",
    "onlineCategory": null,
    "size": "Sites in Victoria Park, Wangara, Welshpool, Rockingham",
    "whyTheyShip": "Parts movement between sites",
    "region": "Victoria Park WA 6100",
    "website": null,
    "evidenceUrl": "https://www.johnhughes.com.au/contact",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "major-motors",
    "company": "Major Motors",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Automotive",
    "onlineCategory": null,
    "size": "Sites in Forrestfield, Bibra Lake, Malaga, Port Hedland",
    "whyTheyShip": "Truck parts to metro + Pilbara",
    "region": "Forrestfield WA (WA truck dealer)",
    "website": null,
    "evidenceUrl": "https://www.majormotors.com.au/about-us/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "westrac",
    "company": "WesTrac",
    "aka": "Seven Group subsidiary",
    "vertical": "MINING",
    "sector": "Mining/industrial supply & equipment",
    "onlineCategory": null,
    "size": "4,500+ staff nationally (~2,800 in WA); runs the nation's biggest parts distribution centre",
    "whyTheyShip": "Very large parts volume to WA branches and mine sites",
    "region": "South Guildford WA",
    "website": null,
    "evidenceUrl": "https://www.westrac.com.au/locations/perth-customer-service-centre ; https://www.westrac.com.au/our-business",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "statewide-bearings",
    "company": "Statewide Bearings",
    "aka": null,
    "vertical": "MINING",
    "sector": "Mining/industrial supply & equipment",
    "onlineCategory": null,
    "size": "40 branches nationally",
    "whyTheyShip": "Bearings/power transmission to branches and customers nationally",
    "region": "Kewdale WA 6105 (national HQ)",
    "website": null,
    "evidenceUrl": "https://www.statewidebearings.com.au/branch-locations/national-head-office-wa/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "integrated-industrial",
    "company": "Integrated Industrial",
    "aka": null,
    "vertical": "MINING",
    "sector": "Mining/industrial supply & equipment",
    "onlineCategory": null,
    "size": "Size not found",
    "whyTheyShip": "Mining/offshore consumables to WA mine sites",
    "region": "Kewdale WA 6105",
    "website": null,
    "evidenceUrl": "https://integratedindustrial.com.au/contact/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "westernex",
    "company": "Westernex",
    "aka": null,
    "vertical": "MINING",
    "sector": "Mining/industrial supply & equipment",
    "onlineCategory": null,
    "size": "Size not found",
    "whyTheyShip": "Exploration/mining consumables Perth to Goldfields and sites",
    "region": "Malaga WA 6090 (+ Kalgoorlie warehouse)",
    "website": null,
    "evidenceUrl": "https://westernex.com.au/addresses-contact/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "imdex-ltd",
    "company": "Imdex Ltd",
    "aka": "ASX:IMD",
    "vertical": "MINING",
    "sector": "Mining/industrial supply & equipment",
    "onlineCategory": null,
    "size": "ASX-listed global mining-tech/drilling fluids (size not checked)",
    "whyTheyShip": "Drilling consumables and tools shipped to sites",
    "region": "Osborne Park WA 6017",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: IMDEX LTD WA 6021",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "austal-ltd",
    "company": "Austal Ltd",
    "aka": "ASX:ASB",
    "vertical": "MINING",
    "sector": "Mining/industrial supply & equipment",
    "onlineCategory": null,
    "size": "ASX-listed shipbuilder (size not checked)",
    "whyTheyShip": "Inbound components/materials to Henderson yard",
    "region": "Henderson WA 6166",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: AUSTAL LIMITED WA 6166",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "civmec-ltd",
    "company": "Civmec Ltd",
    "aka": null,
    "vertical": "MINING",
    "sector": "Mining/industrial supply & equipment",
    "onlineCategory": null,
    "size": "ASX-listed fabricator/constructor (size not checked)",
    "whyTheyShip": "Heavy/oversize fabricated steel to projects, inbound materials",
    "region": "Henderson WA 6166",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: CIVMEC LIMITED WA 6166",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "matrix-composites-engineering",
    "company": "Matrix Composites & Engineering",
    "aka": null,
    "vertical": "MINING",
    "sector": "Mining/industrial supply & equipment",
    "onlineCategory": null,
    "size": "ASX-listed (size not checked)",
    "whyTheyShip": "Manufactured buoyancy/composite products, export and domestic",
    "region": "Henderson WA 6166",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: MATRIX COMPOSITES & ENGINEERING LTD WA 6166",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "bgc-incl-midland-brick-brikmakers",
    "company": "BGC incl. Midland Brick/Brikmakers",
    "aka": "Australia",
    "vertical": "OTHER",
    "sector": "Building materials & hardware",
    "onlineCategory": null,
    "size": "Large private group; was in WA top-10 private companies until displaced by Regent Motors (Business News, Sep 2024)",
    "whyTheyShip": "Bricks, plasterboard, concrete products to building sites statewide",
    "region": "Osborne Park WA 6017",
    "website": null,
    "evidenceUrl": "https://www.bgc.com.au/bgc-completes-transaction-to-acquire-midland-brick/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "galvins-plumbing-supplies",
    "company": "Galvins Plumbing Supplies",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Building materials & hardware",
    "onlineCategory": null,
    "size": "25 branches across WA and NT; family-owned",
    "whyTheyShip": "Plumbing/HVAC stock to branches and trade sites incl. regional",
    "region": "Osborne Park WA 6017",
    "website": null,
    "evidenceUrl": "https://galvins.com.au/about-galvins",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "wesbeam",
    "company": "Wesbeam",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Building materials & hardware",
    "onlineCategory": null,
    "size": "LVL manufacturing plant + HQ",
    "whyTheyShip": "Engineered timber to builders/merchants nationally",
    "region": "Neerabup WA 6031",
    "website": null,
    "evidenceUrl": "https://wesbeam.com/about",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "cockburn-cement",
    "company": "Cockburn Cement",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Building materials & hardware",
    "onlineCategory": null,
    "size": "Size not found (owned by Adbri, now under CRH)",
    "whyTheyShip": "Bagged/bulk cement and lime (bulk mostly, some packaged)",
    "region": "Munster WA 6166 (production moving to Kwinana)",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup + search result re Munster site",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "alltools-wa",
    "company": "Alltools WA",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Building materials & hardware",
    "onlineCategory": "Tools",
    "size": "Single store + online (smaller)",
    "whyTheyShip": "Tools to trade and industrial customers Australia-wide",
    "region": "Bayswater WA 6053",
    "website": "alltools.com.au",
    "evidenceUrl": "https://www.alltools.com.au/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers",
      "WA online retailers"
    ]
  },
  {
    "id": "wescef",
    "company": "WesCEF",
    "aka": "CSBP, Kleenheat, AGR",
    "vertical": "OTHER",
    "sector": "Chemicals, fertiliser & energy",
    "onlineCategory": null,
    "size": "1,300-1,500+ employees",
    "whyTheyShip": "Fertiliser, chemicals, LPG cylinders to farms and industry statewide",
    "region": "Perth HQ; operations Kwinana WA 6167",
    "website": null,
    "evidenceUrl": "https://wescef.com.au/work-with-us/why-choose-wescef/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "coogee-chemicals",
    "company": "Coogee Chemicals",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Chemicals, fertiliser & energy",
    "onlineCategory": null,
    "size": "~400 direct Australian employees; sites WA, QLD, VIC",
    "whyTheyShip": "Packaged and bulk chemicals (dangerous goods) nationally",
    "region": "Kwinana WA",
    "website": null,
    "evidenceUrl": "https://www.coogee.com.au/contact/ ; https://modernslaveryregister.gov.au/statements/cBwuyDVRRkrdFmF/pdf/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "cbh-group",
    "company": "CBH Group",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "$5.8bn revenue; handles ~90% of WA grain",
    "whyTheyShip": "Mostly bulk grain (note); also inputs and network supplies",
    "region": "Perth WA 6000",
    "website": null,
    "evidenceUrl": "https://www.businessnews.com.au/article/WA-s-largest-private-businesses-revealed",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": true,
    "lowPriorityReason": "Mostly bulk freight; Parcel fit is borderline",
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "craig-mostyn-group",
    "company": "Craig Mostyn Group",
    "aka": "incl. Linley Valley Pork, V&V Walsh",
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "1,300 direct employees; IBISWorld est. ~$696m revenue (2025)",
    "whyTheyShip": "Chilled/frozen meat, protein meal, seafood to domestic and export",
    "region": "Fremantle WA",
    "website": null,
    "evidenceUrl": "https://www.craigmostyn.com.au/contact/ ; https://modernslaveryregister.gov.au/statements/yrBHZXIQelbBff9/pdf/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "brownes-dairy",
    "company": "Brownes Dairy",
    "aka": "Brownes Foods",
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "317 staff at Balcatta (Dec 2025); second site Brunswick Junction",
    "whyTheyShip": "Chilled dairy to retailers statewide",
    "region": "Balcatta WA",
    "website": null,
    "evidenceUrl": "https://brownesdairy.com.au/wp-content/uploads/2026/06/Brownes-Modern-Human-Slavery-Report-2025.pdf",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "harvey-beef",
    "company": "Harvey Beef",
    "aka": "Harvest Road",
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Size not found",
    "whyTheyShip": "Chilled/frozen beef domestic and export",
    "region": "Harvey WA 6220 (plant); Harvest Road group Perth",
    "website": null,
    "evidenceUrl": "https://www.harveybeef.com.au/contact-us",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "milne-agrigroup",
    "company": "Milne AgriGroup",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Feed mill 300,000 t/yr capacity",
    "whyTheyShip": "Bagged stockfeed, pet food, nuts/grain to retailers and farms",
    "region": "Welshpool WA",
    "website": null,
    "evidenceUrl": "https://www.graincentral.com/news/new-milne-mill-enables-market-product-expansion/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "mrs-mac-s",
    "company": "Mrs Mac's",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "330+ employees",
    "whyTheyShip": "Frozen pies and pastries to retail and foodservice nationally",
    "region": "Morley WA (head office and factory)",
    "website": null,
    "evidenceUrl": "https://mrsmacs.com.au/our-story/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "golden-egg-farms",
    "company": "Golden Egg Farms",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "200+ WA employees",
    "whyTheyShip": "Eggs to retailers statewide",
    "region": "Perth WA",
    "website": null,
    "evidenceUrl": "https://www.buywesteatbest.org.au/members/golden-egg-farms/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "mt-barker-free-range-chicken",
    "company": "Mt Barker Free Range Chicken",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Size not found",
    "whyTheyShip": "Chilled poultry to retailers",
    "region": "Mount Barker WA (ABN 6168)",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup",
    "confidence": "low-medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "m-g-kailis-group",
    "company": "M.G. Kailis Group",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Seafood group (size not found)",
    "whyTheyShip": "Seafood domestic/export",
    "region": "Perth WA 6008",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: M G KAILIS PTY LTD WA 6008",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "kailis-bros",
    "company": "Kailis Bros",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Fish markets plus wholesale (size not found)",
    "whyTheyShip": "Seafood wholesale and retail",
    "region": "Perth WA",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: KAILIS BROS WA 6155",
    "confidence": "low-medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "austral-fisheries",
    "company": "Austral Fisheries",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Size not found",
    "whyTheyShip": "Frozen seafood to domestic/export",
    "region": "Perth WA 6007",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: AUSTRAL FISHERIES PTY LTD WA 6007",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "geraldton-fishermen-s-co-operative",
    "company": "Geraldton Fishermen's Co-operative",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Size not found",
    "whyTheyShip": "Rock lobster exports (live/frozen)",
    "region": "Geraldton WA 6530",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "good-drinks-australia",
    "company": "Good Drinks Australia",
    "aka": "formerly Gage Roads",
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "240+ employees; main brewery in Palmyra",
    "whyTheyShip": "Packaged beer to retailers and venues nationally",
    "region": "Palmyra WA",
    "website": null,
    "evidenceUrl": "https://gooddrinks.com.au/about/who-we-are/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "vasse-felix",
    "company": "Vasse Felix",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Size not found",
    "whyTheyShip": "Packaged wine nationally and export",
    "region": "Margaret River region WA 6284",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: VASSE FELIX PTY LTD WA 6284",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "bannister-downs-dairy",
    "company": "Bannister Downs Dairy",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Agriculture, food & beverage",
    "onlineCategory": null,
    "size": "Smaller (size not found)",
    "whyTheyShip": "Chilled dairy to Perth and retailers",
    "region": "Northcliffe WA 6262",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup",
    "confidence": "low-medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "st-john-of-god-health-care",
    "company": "St John of God Health Care",
    "aka": null,
    "vertical": "MEDICAL",
    "sector": "Healthcare",
    "onlineCategory": null,
    "size": "National hospital group (size not checked)",
    "whyTheyShip": "Medical consumables between hospitals, linen, pathology",
    "region": "Subiaco/Perth WA",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: ST JOHN OF GOD HEALTH CARE INC WA 6000",
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "tronox",
    "company": "Tronox",
    "aka": "Australian ops",
    "vertical": "OTHER",
    "sector": "Industrial (note: mineral processors with general freight)",
    "onlineCategory": null,
    "size": "Global TiO2 producer",
    "whyTheyShip": "Mainly bulk mineral sands/pigment; some packaged pigment (borderline)",
    "region": "Kwinana WA 6167",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup: Tronox Limited WA 6167",
    "confidence": "medium",
    "lowPriority": true,
    "lowPriorityReason": "Mostly bulk freight; Parcel fit is borderline",
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "simcoa-operations",
    "company": "Simcoa Operations",
    "aka": null,
    "vertical": "OTHER",
    "sector": "Industrial (note: mineral processors with general freight)",
    "onlineCategory": null,
    "size": "Silicon smelter",
    "whyTheyShip": "Mainly bulk/export silicon; inbound consumables (borderline)",
    "region": "Kemerton WA 6233",
    "website": null,
    "evidenceUrl": null,
    "evidenceNote": "ABN Lookup",
    "confidence": "medium",
    "lowPriority": true,
    "lowPriorityReason": "Mostly bulk freight; Parcel fit is borderline",
    "sources": [
      "WA large shippers"
    ]
  },
  {
    "id": "golfbox",
    "company": "GolfBox",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Golf",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Joondalup WA 6027",
    "website": "golfbox.com.au",
    "evidenceUrl": "https://www.golfbox.com.au/website-competition-terms/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers",
      "Power Retail #124",
      "Power Retail Top 200 #124"
    ]
  },
  {
    "id": "running-warehouse-australia",
    "company": "Running Warehouse Australia",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Running/sports",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (ABN business name WA 6009 Nedlands; stores Myaree & Osborne Park)",
    "website": "runningwarehouse.com.au",
    "evidenceUrl": "https://www.runningwarehouse.com.au/custservice/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers",
      "Power Retail #202"
    ]
  },
  {
    "id": "tennis-only",
    "company": "Tennis Only",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Tennis/sports",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Nedlands WA 6009 (ABN WA 6009)",
    "website": "tennisonly.com.au",
    "evidenceUrl": "https://www.tennisonly.com.au/custserv/retailstores.html",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers",
      "Power Retail #298"
    ]
  },
  {
    "id": "morrison",
    "company": "Morrison",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Fashion",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Fremantle WA 6160 (1 Howard St); ABN trading name WA 6162",
    "website": "morrisonshop.com",
    "evidenceUrl": "https://morrisonshop.com/pages/contact",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers",
      "Power Retail #504"
    ]
  },
  {
    "id": "directly2u",
    "company": "Directly2U",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Furniture/homewares/renovation",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Welshpool WA (head office)",
    "website": "directly2u.com.au",
    "evidenceUrl": "https://www.directly2u.com.au/about-us/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "tacklewest",
    "company": "TackleWest",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Fishing tackle",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (WA-owned, 4 WA stores, online Australia-wide)",
    "website": "tacklewest.com.au",
    "evidenceUrl": "https://www.tacklewest.com.au/pages/about-us",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "natalie-rolt",
    "company": "Natalie Rolt",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Jewellery",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Subiaco WA 6008; ABN WA",
    "website": "natalierolt.com",
    "evidenceUrl": "https://natalierolt.com/pages/contact",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "sodashi",
    "company": "Sodashi",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Skincare",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "North Fremantle WA; ABN SODASHI PTY LTD WA 6159",
    "website": "sodashi.com.au",
    "evidenceUrl": "https://sodashi.com.au/pages/contact",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "the-perth-mint",
    "company": "The Perth Mint",
    "aka": "shop",
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Coins/bullion/collectibles (govt-owned Gold Corporation)",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth WA 6004 (ABN WA 6004)",
    "website": "perthmint.com",
    "evidenceUrl": "https://www.brandnav.io/reports/countries/australia/",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "adultshop",
    "company": "AdultShop",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Adult products",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (operated from Perth offices; ABN ADULTSHOP.COM WA)",
    "website": "adultshop.com.au",
    "evidenceUrl": "https://www.adultshop.com.au/pages/about-us",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "windsor-mail",
    "company": "Windsor Mail",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Jewellery/giftware mail order",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Wangara WA (HQ; warehouse Melbourne); ABN WA 6059",
    "website": "windsormail.com.au",
    "evidenceUrl": "https://windsormail.com.au/pages/about-us",
    "evidenceNote": null,
    "confidence": "high",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "ergolink",
    "company": "Ergolink",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Ergonomic furniture",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (ABN WA 6021)",
    "website": "ergolink.com.au",
    "evidenceUrl": "https://linkedin.com/company/ergolink",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "games-world",
    "company": "Games World",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Toys & games",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (GAMES WORLD PTY LTD ABN WA 6021)",
    "website": "gamesworld.com.au",
    "evidenceUrl": "https://pwd.com.au/our-work/games-world/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "mega-music",
    "company": "Mega Music",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Musical instruments",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (MEGA MUSIC AUSTRALIA PTY LTD ABN WA 6154)",
    "website": "megamusiconline.com.au",
    "evidenceUrl": null,
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "twotags",
    "company": "TwoTags",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Activewear",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (TWOTAGS PTY LTD ABN WA 6163)",
    "website": "twotags.com.au",
    "evidenceUrl": "https://www.lethal.com.au/perths-fashion-ecommerce-scene-the-activewear-brands-that-are-leading-the-pack/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "hyperluxe",
    "company": "Hyperluxe",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Activewear",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (ABN business name WA 6090)",
    "website": "hyperluxe.com.au",
    "evidenceUrl": "https://www.lethal.com.au/perths-fashion-ecommerce-scene-the-activewear-brands-that-are-leading-the-pack/",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "loleia-swim",
    "company": "Loleia Swim",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Swimwear",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (ABN business name WA 6100)",
    "website": "loleiaswim.com",
    "evidenceUrl": "https://thewest.com.au/lifestyle/local-fashion-brands-and-retailers-on-the-rise-in-2026-c-21086254",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "hair-online",
    "company": "Hair Online",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Haircare",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Fremantle (HAIR ONLINE PTY LTD ABN WA 6158)",
    "website": "hair-online.com.au",
    "evidenceUrl": "https://www.okmg.com/work/hair-online",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "scents-the-perfume-specialists",
    "company": "Scents The Perfume Specialists",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Perfume",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (ABN WA 6060; 7 Perth stores + online)",
    "website": "scents.com.au",
    "evidenceUrl": "https://www.outre.com.au/case-study/scents",
    "evidenceNote": null,
    "confidence": "medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  },
  {
    "id": "kitchenware-direct",
    "company": "Kitchenware Direct",
    "aka": null,
    "vertical": "ECOMMERCE",
    "sector": "Online retail – Kitchenware",
    "onlineCategory": null,
    "size": null,
    "whyTheyShip": "Ships online orders direct to customers Australia-wide (parcels/satchels)",
    "region": "Perth (ABN business name WA 6163)",
    "website": "kitchenwaredirect.com.au",
    "evidenceUrl": "https://aeroleads.com/list/top-e-commerce-companies-in-perth",
    "evidenceNote": null,
    "confidence": "low-medium",
    "lowPriority": false,
    "lowPriorityReason": null,
    "sources": [
      "WA online retailers"
    ]
  }
];
