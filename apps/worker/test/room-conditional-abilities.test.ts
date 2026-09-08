import { allCardInstanceIds, viewFor } from '@madou/engine';
import { expect, it } from 'vitest';
import { conditionalScenarioNames, conditionalScenarioSpecs, makeConditionalScenario } from './fixtures/conditional-ability-scenarios.js';

it.each(conditionalScenarioNames)('%s conserves the actual deck and leaves all new conditional sources unselected', name => {
  const game = makeConditionalScenario(name, ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const ids = allCardInstanceIds(game); expect(ids).toHaveLength(220); expect(new Set(ids).size).toBe(220);
  const spec = conditionalScenarioSpecs[name]; const owner = 'ownerSeat' in spec ? 'B' : 'A';
  expect(viewFor(game, owner).conditionalAbilities.length).toBeGreaterThan(0);
  for (const setting of viewFor(game, owner).conditionalAbilities) expect(setting.enabled).toBe(false);
  if (name === 'conditional-asfelt-truth') expect(game.players.A!.faction).toBe('GOOD');
  if (name === 'conditional-lia-lance-ii') expect(game.players.B!.characterId).toBe('c2-p07-r1c1');
  if (name === 'conditional-asfelt-dragon') expect(game.players.B!.followers).toHaveLength(1);
});
