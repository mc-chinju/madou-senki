export interface Session { id: string; name: string }
export interface ListedRoom { roomId: string; revision: number; title: string; capacity: number; occupied: number; rulesetId: string }

export const UNAUTHENTICATED_MESSAGE = 'ログインしてください';
const errorMessages: Record<number, string> = { 400: '入力内容を確認してください', 401: UNAUTHENTICATED_MESSAGE, 403: 'この操作は許可されていません', 404: '卓が見つかりません', 409: '卓の状態が更新されました。もう一度お試しください', 413: '入力が長すぎます', 415: '送信形式が正しくありません', 500: 'サーバーで問題が発生しました' };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const request: RequestInit = { ...init };
  if (init?.body) { const headers = new Headers(init.headers); headers.set('content-type', 'application/json'); request.headers = headers; }
  const response = await fetch(path, request);
  if (!response.ok) throw new Error(errorMessages[response.status] ?? `通信に失敗しました (${response.status})`);
  return response.json() as Promise<T>;
}

export const getCurrentSession = () => api<Session>('/api/sessions/current');
export const getRooms = () => api<{ rooms: ListedRoom[] }>('/api/rooms');
