// Server-only: Gemini with Google Search grounding via the fixed Gemini API host.
// The API key never leaves the server and is never logged.
import type { Grounded, SourceRef } from '@/lib/intel';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const REDIRECT_HOST = 'vertexaisearch.cloud.google.com';

export async function groundedGenerate(prompt: string, fetchImpl: typeof fetch = fetch): Promise<Grounded> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('Gemini key not configured');
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const j: any = await res.json();
  const c = j?.candidates?.[0] || {};
  const text = (c.content?.parts || []).map((p: any) => p.text || '').join('');
  const gm = c.groundingMetadata || {};
  return { text, chunks: gm.groundingChunks || [], supports: gm.groundingSupports || [] };
}

/**
 * Grounding chunk URIs are Google redirect links. We only ever follow the
 * fixed redirect host (one hop, no body read) to learn the real URL; nothing
 * user-supplied is fetched, so there's no SSRF surface.
 */
export async function resolveSources(g: Grounded, fetchImpl: typeof fetch = fetch): Promise<SourceRef[]> {
  return Promise.all(g.chunks.slice(0, 30).map(async ch => {
    const uri = ch.web?.uri || '';
    const title = (ch.web?.title || '').slice(0, 200);
    let url = uri;
    try {
      const u = new URL(uri);
      if (u.protocol === 'https:' && u.hostname === REDIRECT_HOST) {
        const r = await fetchImpl(uri, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000) });
        const loc = r.headers.get('location');
        if (loc && /^https:\/\//i.test(loc)) url = loc;
      }
    } catch { /* keep redirect URL */ }
    if (!/^https:\/\//i.test(url)) url = '';
    return { url, title };
  }));
}

/** DNS-only existence check (no HTTP fetch); rejects private/loopback answers. */
export async function domainResolves(host: string): Promise<boolean> {
  const dns = await import('node:dns');
  try {
    const addrs = await dns.promises.resolve4(host);
    return addrs.some(a => !/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a));
  } catch { return false; }
}
