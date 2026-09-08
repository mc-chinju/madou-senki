import type { ListedRoom } from './types.js';

export async function listRooms(db: D1Database) {
  const { results } = await db.prepare('SELECT room_id, revision, listing FROM room_directory WHERE listing IS NOT NULL ORDER BY room_id LIMIT 100')
    .all<{ room_id: string; revision: number; listing: string }>();
  return results.map(row => {
    const listing = JSON.parse(row.listing) as ListedRoom;
    return { roomId: row.room_id, revision: row.revision, title: listing.title, capacity: listing.capacity,
      occupied: listing.occupied, rulesetId: listing.rulesetId };
  });
}
