import { describe, test, expect } from 'vitest';
import { getSalesforceSearchUrl } from '@/lib/utils';
import { isClaimExpired, canBdmClaim, scoreOf, perthWeekStart, mapsSearchUrl, LEAD_SOURCES, templatesFor, VERTICALS } from '@/lib/verticals';

const D = 86400000;
const base: any = { id: 'x', company: 'Acme', sfStatus: 'NOT_IN_SF', ownerUid: null, lastActivityAt: Date.now(), claimedAt: null };

describe('verticals', () => {
  test('Salesforce search URL reuses the org base + unified search', () => {
    expect(getSalesforceSearchUrl('Acme Mining (Kewdale) - WA')).toBe('https://teamglobalexp.lightning.force.com/_ui/search/ui/UnifiedSearchResults?searchType=2&str=Acme%20Mining');
    expect(getSalesforceSearchUrl('')).toBe('#');
  });
  test('claims lapse after 30 days without activity', () => {
    const now = Date.now();
    expect(isClaimExpired({ ...base, ownerUid: 'u', lastActivityAt: now - 31 * D }, now)).toBe(true);
    expect(isClaimExpired({ ...base, ownerUid: 'u', lastActivityAt: now - 29 * D }, now)).toBe(false);
    expect(isClaimExpired({ ...base, ownerUid: null, lastActivityAt: now - 99 * D }, now)).toBe(false);
  });
  test('claim requires SF check and is blocked for existing customers', () => {
    expect(canBdmClaim({ ...base, sfStatus: 'UNCHECKED' })).toBe(false);
    expect(canBdmClaim({ ...base, sfStatus: 'EXISTING_AM' })).toBe(false);
    expect(canBdmClaim({ ...base, sfStatus: 'LOST_DORMANT' })).toBe(true);
  });
  test('score + week start + links', () => {
    expect(scoreOf({ frequency: true, growth: true, freightFit: false })).toBe(2);
    // Fri 16 Oct 2026 18:00 Perth → Mon 12 Oct 00:00 Perth
    expect(perthWeekStart(Date.UTC(2026, 9, 16, 10))).toBe(Date.UTC(2026, 9, 11, 16));
    expect(mapsSearchUrl('medical supplies', "O'Connor")).toContain('google.com/maps/search/');
    for (const v of VERTICALS) {
      LEAD_SOURCES[v.id].forEach(s => expect(s.url).toMatch(/^https:\/\//));
      expect(templatesFor(v.id).length).toBe(5);
      expect(JSON.stringify(templatesFor(v.id)).toLowerCase()).not.toMatch(/fcl|lcl|freight business/);
    }
  });
});
