import { DurableObject } from 'cloudflare:workers';
import { RoomStorage, type CommitInput } from '../../src/rooms/storage.js';
export { CanonicalRoom as Room } from './canonical-room.js';

export interface ProbeState { count: number; secret: string }
export interface ProbeEvent { type: string; privateValue: string }
export interface ProbeProjection { roomId: string; occupied: number }
export type ProbeCommit = CommitInput<ProbeState, ProbeEvent, ProbeProjection>;

/** Test-only entrypoint, never exported by the application Worker. */
export class RoomStoreProbe extends DurableObject {
  private readonly store: RoomStorage<ProbeState, ProbeEvent, ProbeProjection>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new RoomStorage(ctx.storage);
  }
  initialize() { return this.store.initialize({ count: 0, secret: 'initial-secret' }); }
  commit(input: ProbeCommit) {
    try { return this.store.commit(input); }
    catch { return { ok: false, code: 'INTERNAL_ERROR' } as const; }
  }
  snapshot() { return this.store.snapshot(); }
  receipt(input: ProbeCommit) { return this.store.receipt(input); }
  events() { return this.store.eventsAfter(0); }
  pending() { return this.store.pendingOutbox(1000); }
  delivered(revision: number) { this.store.acknowledgeOutbox(revision); }
  retry(revision: number, nextAt: number) { this.store.retryOutbox(revision, nextAt); }
  failEventWrite() {
    this.ctx.storage.sql.exec(`CREATE TRIGGER reject_event BEFORE INSERT ON room_events
      BEGIN SELECT RAISE(ABORT, 'injected write failure'); END`);
  }
  clearFailure() { this.ctx.storage.sql.exec('DROP TRIGGER reject_event'); }
}

export default { fetch() { return new Response(null, { status: 404 }); } };
