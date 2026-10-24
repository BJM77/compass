import { describe, test, expect } from 'vitest';
import { getNavigationForUser } from '@/lib/navigation';

const views = (role: any, leader: boolean) => getNavigationForUser(role, leader).flatMap(g => g.items.map(i => i.view));

describe('NWA navigation', () => {
  test('every team member gets the NWA form', () => {
    expect(views('BDM', false)).toContain('FRIDAY_FW');
    expect(views('ACCOUNT_MANAGER', false)).toContain('FRIDAY_FW');
  });
  test('team meeting view is leaders only', () => {
    expect(views('BDM', false)).not.toContain('NWA_MEETING');
    expect(views('ACCOUNT_MANAGER', false)).not.toContain('NWA_MEETING');
    expect(views('LEADER', true)).toContain('NWA_MEETING');
    expect(views('GUEST', false)).not.toContain('NWA_MEETING');
  });
});
