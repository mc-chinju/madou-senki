// Measures how large the public record and one player snapshot grow over a full bot game.
// Run: node --experimental-transform-types --no-warnings --import ./scripts/ts-resolve-hook.mjs scripts/measure_public_record.ts [seats...]
import {createGame, viewFor, type Entropy, type GameState} from '../packages/engine/src/index.js';
import {playOneStep} from '../packages/engine/src/bot/index.js';

// Same tape as packages/engine/test/fixtures.ts seededEntropy, so results match bot-full-game.test.ts.
function seededEntropy(seed: number): Entropy {
  let t = seed >>> 0;
  const next = () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const random: number[] = [];
  const dice: number[] = [];
  for (let i = 0; i < 8192; i++) {
    random.push(next());
    dice.push(1 + Math.floor(next() * 6));
  }
  return {now: 1000, dice, random};
}

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));

function measure(seats: number) {
  const seed = seats + 11;
  const entropy = seededEntropy(seed);
  let state: GameState = createGame(Array.from({length: seats}, (_, i) => ({id: `P${i}`, name: `P${i}`})), entropy);
  let steps = 0;
  let maxSnapshotBytes = 0;
  while (!state.outcome && steps < 5000) {
    state = playOneStep(state, entropy, seed);
    steps++;
    // Every seat receives a snapshot after each commit; the largest one bounds the transfer.
    for (const id of state.seatOrder) maxSnapshotBytes = Math.max(maxSnapshotBytes, bytes(viewFor(state, id)));
  }
  const final = viewFor(state, state.seatOrder[0]!);
  return {
    seats,
    seed,
    steps,
    finished: Boolean(state.outcome),
    publicEvents: state.events.filter(event => event.audience === 'public').length,
    publicLogBytes: bytes(final.logs),
    finalSnapshotBytes: bytes(final),
    maxSnapshotBytes,
  };
}

const seats = process.argv.slice(2).map(Number);
const results = (seats.length ? seats : [4, 10]).map(measure);
console.log(JSON.stringify({thresholds: {publicLogBytes: 100_000, snapshotBytes: 200_000}, results}, null, 2));
