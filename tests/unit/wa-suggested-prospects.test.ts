import { describe, test, expect } from 'vitest';
import { WA_SUGGESTED_PROSPECTS as D } from '@/data/wa-suggested-prospects';
import { normaliseCompany, guessBelt, VERTICALS } from '@/lib/verticals';

describe('WA suggested prospects', () => {
  test('71 unique companies after de-dupe, valid verticals', () => {
    expect(D.length).toBe(71);
    expect(new Set(D.map(d => normaliseCompany(d.company))).size).toBe(D.length);
    const ids = VERTICALS.map(v => v.id);
    D.forEach(d => expect(ids).toContain(d.vertical));
  });
  test('merged duplicates carry all sources', () => {
    const kw = D.find(d => d.company === 'Kitchen Warehouse')!;
    expect(kw.vertical).toBe('ECOMMERCE');
    expect(kw.sources).toEqual(expect.arrayContaining(['WA large shippers', 'WA online retailers', 'Power Retail Top 200 #60']));
    expect(normaliseCompany('Betts Group')).toBe(normaliseCompany('Betts'));
    expect(normaliseCompany('Retravision (Dorsett Retail)')).toBe(normaliseCompany('Retravision'));
    expect(normaliseCompany('Golf Box')).toBe(normaliseCompany('GolfBox'));
  });
  test('bulk shippers flagged low priority; no personal contact data', () => {
    expect(D.filter(d => d.lowPriority).map(d => d.company).sort()).toEqual(['CBH Group', 'Simcoa Operations', 'Tronox']);
    const blob = JSON.stringify(D);
    expect(blob).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
    expect(blob).not.toMatch(/\b04\d{2}\s?\d{3}\s?\d{3}\b|\+61/);
    D.forEach(d => { if (d.evidenceUrl) expect(d.evidenceUrl).toMatch(/^https?:\/\//); });
  });
  test('belt guess', () => {
    expect(guessBelt('Kewdale WA 6105')).toBe('EAST');
    expect(guessBelt('Osborne Park WA 6017')).toBe('NORTH');
    expect(guessBelt('Henderson WA 6166')).toBe('SOUTH');
    expect(guessBelt('Bunbury WA 6230')).toBe('REGIONAL_WA');
    expect(guessBelt('Perth WA 6000')).toBe('CENTRAL');
  });
});
