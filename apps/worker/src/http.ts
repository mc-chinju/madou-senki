export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

export function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  const output = new Headers(headers);
  output.set('Cache-Control', 'no-store');
  output.set('X-Content-Type-Options', 'nosniff');
  return Response.json(value, { status, headers: output });
}

export function requireSameOrigin(request: Request): void {
  if (request.headers.get('Origin') !== new URL(request.url).origin) throw new HttpError(403, 'FORBIDDEN');
}

/** Read a bounded body, including chunked requests with no Content-Length. */
export async function readJson(request: Request, limit = 4096): Promise<Record<string, unknown>> {
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE');
  }
  if (Number(request.headers.get('Content-Length')) > limit) throw new HttpError(413, 'BODY_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_REQUEST');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, 'BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'INVALID_REQUEST'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'INVALID_REQUEST');
  return value as Record<string, unknown>;
}

export function displayText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const normalized = value.trim().normalize('NFC');
  return normalized && [...normalized].length <= max ? normalized : null;
}
