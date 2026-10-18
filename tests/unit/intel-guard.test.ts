import { describe, it, expect, vi } from 'vitest';

const verifyIdToken = vi.fn();
const roles: Record<string, string> = { bdm: 'BDM', am: 'ACCOUNT_MANAGER', guest: 'GUEST', boss: 'GM' };
vi.mock('@/lib/server/admin', () => ({
  adminAuth: () => ({ verifyIdToken }),
  adminDb: () => ({ doc: (p: string) => ({ get: async () => ({ get: (k: string) => (k === 'role' ? roles[p.split('/')[1]] : '') }) }) }),
}));
import { requireStaff, perthDay } from '@/lib/server/intel-guard';

const req = (auth?: string) => new Request('http://x/api/intel/pain', { method: 'POST', headers: auth ? { authorization: auth } : {} });
const TOKEN = 'Bearer ' + 'a'.repeat(40);

describe('requireStaff', () => {
  it('rejects missing/invalid tokens', async () => {
    await expect(requireStaff(req())).rejects.toMatchObject({ status: 401 });
    verifyIdToken.mockRejectedValueOnce(new Error('bad'));
    await expect(requireStaff(req(TOKEN))).rejects.toMatchObject({ status: 401 });
  });
  it('allows BDM/AM/admin, rejects guests', async () => {
    for (const uid of ['bdm', 'am', 'boss']) {
      verifyIdToken.mockResolvedValueOnce({ uid });
      await expect(requireStaff(req(TOKEN))).resolves.toMatchObject({ uid });
    }
    verifyIdToken.mockResolvedValueOnce({ uid: 'guest' });
    await expect(requireStaff(req(TOKEN))).rejects.toMatchObject({ status: 403 });
  });
  it('rate-limit day is the Perth calendar day', () => {
    expect(perthDay(Date.UTC(2026, 9, 17, 16, 30))).toBe('20261018'); // 00:30 Perth
  });
});
