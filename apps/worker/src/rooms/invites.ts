import { hashToken, randomToken } from '../auth.js';
import { timingSafeEqual } from 'node:crypto';

export async function newInvitation(): Promise<{ token: string; hash: string }> {
  const token = randomToken();
  return { token, hash: await hashToken(token) };
}
export function matchesInvitation(stored: string | null, supplied: string | null): boolean {
  if (!stored || !supplied || !/^[a-f0-9]{64}$/.test(stored) || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return timingSafeEqual(new TextEncoder().encode(stored), new TextEncoder().encode(supplied));
}
