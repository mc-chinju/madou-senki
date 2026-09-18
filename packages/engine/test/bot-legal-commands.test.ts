import {describe, expect, it} from 'vitest';
import {allCardInstanceIds, createGame} from '../src/index.js';
import {transition} from '../src/transition.js';
import {viewFor} from '../src/view.js';
import {legalCommands, playOneStep, playToOutcome} from '../src/bot/index.js';
import {seededEntropy} from './fixtures.js';

describe('legal command enumeration', () => {
  it('every enumerated command is accepted by transition for every seat across a seeded game', () => {
    const entropy = seededEntropy(7);
    let state = createGame([{id: 'A', name: 'A'}, {id: 'B', name: 'B'}, {id: 'C', name: 'C'}, {id: 'D', name: 'D'}], entropy);
    for (let step = 0; step < 300 && !state.outcome; step++) {
      for (const actorId of Object.keys(state.players)) {
        for (const command of legalCommands(viewFor(state, actorId))) {
          const result = transition(state, {actorId, command}, entropy);
          expect(result.ok, `${actorId} ${JSON.stringify(command)} ${result.ok ? '' : result.code}`).toBe(true);
        }
      }
      const next = playOneStep(state, entropy);
      state = next;
    }
  });
});

describe('deterministic play', () => {
  it.each([4, 6, 8, 10])('%i seats reach an outcome within the step budget', count => {
    const players = Array.from({length: count}, (_, i) => ({id: `P${i}`, name: `P${i}`}));
    const {state, steps} = playToOutcome(createGame(players, seededEntropy(count)), seededEntropy(count), count);
    expect(state.outcome).toBeDefined();
    expect(steps).toBeLessThan(5000);
    const ids = allCardInstanceIds(state);
    expect(ids).toHaveLength(220);
    expect(new Set(ids).size).toBe(220);
  }, 60000); // 検証は手数上限。壁時計は負荷の高い環境でも既定の 5 秒に縛られないようにする
});
