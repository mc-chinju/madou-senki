export interface Snapshot<State> { revision: number; state: State }
export interface StoredEvent<Event> { id: number; revision: number; event: Event }
export interface OutboxItem<Projection> {
  revision: number;
  projection: Projection;
  attempts: number;
  nextAttemptAt: number;
}
export interface CommandIdentity {
  actorId: string;
  commandId: string;
  /** Canonical, validated command envelope. Never log this private payload. */
  request: string;
  expectedRevision: number;
}
export interface CommitInput<State, Event, Projection> extends CommandIdentity {
  state: State;
  events: Event[];
  projection?: Projection;
}
export type CommitResult =
  | { ok: true; revision: number; replayed: boolean }
  | { ok: false; code: 'COMMAND_ID_REUSED' | 'STALE_REVISION' | 'NOT_INITIALIZED' };

/** Internal storage only. The room must project snapshots/events before sending them. */
export class RoomStorage<State, Event, Projection> {
  constructor(private readonly storage: DurableObjectStorage) {
    storage.transactionSync(() => {
      storage.sql.exec(`CREATE TABLE IF NOT EXISTS room_snapshot (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1), revision INTEGER NOT NULL, value TEXT NOT NULL)`);
      storage.sql.exec(`CREATE TABLE IF NOT EXISTS room_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, revision INTEGER NOT NULL, value TEXT NOT NULL)`);
      storage.sql.exec(`CREATE TABLE IF NOT EXISTS room_commands (
        actor_id TEXT NOT NULL, command_id TEXT NOT NULL, request TEXT NOT NULL,
        revision INTEGER NOT NULL, PRIMARY KEY (actor_id, command_id))`);
      storage.sql.exec(`CREATE TABLE IF NOT EXISTS room_outbox (
        revision INTEGER PRIMARY KEY, value TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL DEFAULT 0)`);
    });
  }

  initialize(state: State): boolean {
    return this.storage.transactionSync(() => {
      if (this.snapshot() !== null) return false;
      this.storage.sql.exec('INSERT INTO room_snapshot VALUES (1, 0, ?)', encode(state));
      return true;
    });
  }

  snapshot(): Snapshot<State> | null {
    const row = this.storage.sql.exec<{ revision: number; value: string }>(
      'SELECT revision, value FROM room_snapshot WHERE singleton = 1',
    ).toArray()[0];
    return row ? { revision: row.revision, state: JSON.parse(row.value) as State } : null;
  }

  /** Call before running the engine: a retry may no longer be legal in the new state. */
  receipt(input: CommandIdentity): CommitResult | null {
    const prior = this.storage.sql.exec<{ request: string; revision: number }>(
      'SELECT request, revision FROM room_commands WHERE actor_id = ? AND command_id = ?',
      input.actorId, input.commandId,
    ).toArray()[0];
    if (!prior) return null;
    return prior.request === commandIdentity(input)
      ? { ok: true, revision: prior.revision, replayed: true }
      : { ok: false, code: 'COMMAND_ID_REUSED' };
  }

  commit(input: CommitInput<State, Event, Projection>): CommitResult {
    return this.storage.transactionSync(() => {
      const prior = this.receipt(input);
      if (prior) return prior;
      const current = this.snapshot();
      if (!current) return { ok: false, code: 'NOT_INITIALIZED' };
      if (current.revision !== input.expectedRevision) return { ok: false, code: 'STALE_REVISION' };
      const revision = current.revision + 1;
      if (!Number.isSafeInteger(revision)) throw new Error('ROOM_REVISION_EXHAUSTED');
      this.storage.sql.exec('UPDATE room_snapshot SET revision = ?, value = ? WHERE singleton = 1',
        revision, encode(input.state));
      for (const event of input.events) {
        this.storage.sql.exec('INSERT INTO room_events (revision, value) VALUES (?, ?)', revision, encode(event));
      }
      this.storage.sql.exec('INSERT INTO room_commands VALUES (?, ?, ?, ?)',
        input.actorId, input.commandId, commandIdentity(input), revision);
      if (input.projection !== undefined) {
        this.storage.sql.exec('INSERT INTO room_outbox (revision, value) VALUES (?, ?)', revision, encode(input.projection));
      }
      return { ok: true, revision, replayed: false };
    });
  }

  eventsAfter(id: number): StoredEvent<Event>[] {
    return this.storage.sql.exec<{ id: number; revision: number; value: string }>(
      'SELECT id, revision, value FROM room_events WHERE id > ? ORDER BY id LIMIT 1000', id,
    ).toArray().map((row) => ({ id: row.id, revision: row.revision, event: JSON.parse(row.value) as Event }));
  }

  pendingOutbox(now: number): OutboxItem<Projection>[] {
    return this.storage.sql.exec<{ revision: number; value: string; attempts: number; next_attempt_at: number }>(
      'SELECT revision, value, attempts, next_attempt_at FROM room_outbox WHERE next_attempt_at <= ? ORDER BY revision LIMIT 100', now,
    ).toArray().map((row) => ({
      revision: row.revision, projection: JSON.parse(row.value) as Projection,
      attempts: row.attempts, nextAttemptAt: row.next_attempt_at,
    }));
  }

  acknowledgeOutbox(revision: number): void {
    this.storage.sql.exec('DELETE FROM room_outbox WHERE revision = ?', revision);
  }

  nextOutboxAt(): number | null {
    return this.storage.sql.exec<{ next_at: number | null }>(
      'SELECT MIN(next_attempt_at) AS next_at FROM room_outbox',
    ).one().next_at;
  }

  retryOutbox(revision: number, nextAttemptAt: number): void {
    this.storage.sql.exec('UPDATE room_outbox SET attempts = attempts + 1, next_attempt_at = ? WHERE revision = ?',
      nextAttemptAt, revision);
  }
}

function commandIdentity(input: CommandIdentity): string {
  return encode({ expectedRevision: input.expectedRevision, request: input.request });
}

function encode(value: unknown): string {
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error('INVALID_STORED_VALUE');
  return result;
}
