import type { OutboxItem } from './storage.js';
import type { RoomProjection } from './types.js';

/** Delayed delivery cannot replace a newer projection, including an unlisted tombstone. */
export async function deliverProjection(db: D1Database, item: OutboxItem<RoomProjection>): Promise<void> {
  await db.prepare(`INSERT INTO room_directory (room_id, revision, listing) VALUES (?, ?, ?)
    ON CONFLICT(room_id) DO UPDATE SET revision = excluded.revision, listing = excluded.listing
    WHERE excluded.revision > room_directory.revision`)
    .bind(item.projection.roomId, item.revision, item.projection.listing === null ? null : JSON.stringify(item.projection.listing)).run();
}
