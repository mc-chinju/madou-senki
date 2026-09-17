import {describe, expect, it} from 'vitest';
import {allCardInstanceIds, createGame} from '../src/index.js';
import {playToOutcome} from '../src/bot/index.js';
import {seededEntropy} from './fixtures.js';

describe('full-game bot', () => {
  it.each([4, 6, 8, 10])('%i seats preserve 220 physical cards at outcome', count => {
    const players = Array.from({length: count}, (_, i) => ({id: `P${i}`, name: `P${i}`}));
    const {state, steps} = playToOutcome(createGame(players, seededEntropy(count + 11)), seededEntropy(count + 11), count + 11);
    expect(state.outcome).toBeDefined();
    expect(steps).toBeLessThan(5000);
    const ids = allCardInstanceIds(state);
    expect(ids).toHaveLength(220);
    expect(new Set(ids).size).toBe(220);
  });
});
