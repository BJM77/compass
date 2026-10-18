import { adminDb } from '@/lib/server/admin';
import { requireStaff, errorResponse } from '@/lib/server/intel-guard';
import { runFuelRefresh, type DbLike, type FetchLike } from '@/lib/fuel-surcharges';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Staff-only. Fetches ONLY the fixed carrier allow-list in src/lib/fuel-surcharges.ts
 * (no user-supplied URLs), 15s timeout per page, globally throttled to once per 10 minutes.
 */
export async function POST(req: Request) {
  try {
    const caller = await requireStaff(req);
    const summary = await runFuelRefresh(adminDb() as unknown as DbLike, fetch as unknown as FetchLike, Date.now(), { by: caller.uid });
    return Response.json(summary);
  } catch (e) { return errorResponse(e); }
}
