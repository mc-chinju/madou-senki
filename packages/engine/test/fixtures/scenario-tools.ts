import { actionCards, characters } from '@madou/catalog';
import { initialProtection, factionObjective, pendingSetupSeats, type GameState } from '@madou/engine';

/** Ready every remaining seat through the concurrent setup rounds (G10) and leave setup. */
export function readySetup(current: () => GameState, pass: (actorId: string) => void): void {
  for (let round = 0; round < 6 && current().pending; round++) for (const id of pendingSetupSeats(current())) pass(id);
}
/** Same, for fixtures whose command helper is asynchronous. */
export async function readySetupAsync(current: () => Promise<GameState>, pass: (actorId: string) => Promise<unknown>): Promise<void> {
  for (let round = 0; round < 6 && (await current()).pending; round++) for (const id of pendingSetupSeats(await current())) await pass(id);
}

export const entropy = () => ({ now: 1000, dice: Array(100).fill(1) as number[], random: Array.from({ length: 4096 }, (_, i) => ((i * 193 + 17) % 997) / 997) });

export function takeCard(state: GameState, owner: string, reference: string): string {
  const card = actionCards.find(entry => entry.name === reference || entry.id === reference); if (!card) throw Error('FIXTURE_UNKNOWN_CARD');
  const id = card.id;
  state.deck = state.deck.filter(value => value !== id); state.discard = state.discard.filter(value => value !== id);
  for (const player of Object.values(state.players)) {
    player.hand = player.hand.filter(value => value !== id); player.open = player.open.filter(value => value !== id);
  }
  state.players[owner]!.hand.push(id); return id;
}
export function trimHand(state: GameState, owner: string, ...keep: string[]): void {
  const hand = state.players[owner]!.hand;
  while (hand.length > 5) { const index = hand.findIndex(id => !keep.includes(id)); state.deck.push(hand.splice(index, 1)[0]!); }
}
export function assignCharacter(state: GameState, owner: string, name: string): void {
  const desired = characters.find(entry => entry.name === name)!;
  const actor = state.players[owner]!;
  const other = Object.values(state.players).find(player => player.id !== owner && player.characterId === desired.id);
  if (other) { const old = characters.find(entry => entry.id === actor.characterId)!; other.characterId = old.id; other.faction = old.initial_faction; other.objective = old.objective; other.protection = initialProtection(old.id); other.currentObjective = factionObjective(old.initial_faction); other.abilityCharacterIds = [old.id]; }
  actor.characterId = desired.id; actor.faction = desired.initial_faction; actor.objective = desired.objective; actor.protection = initialProtection(desired.id); actor.currentObjective = factionObjective(desired.initial_faction); actor.abilityCharacterIds = [desired.id];
  state.initialFactions = state.seatOrder.map(id => state.players[id]!.faction);
}
