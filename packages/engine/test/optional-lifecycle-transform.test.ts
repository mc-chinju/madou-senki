import { expect, it } from 'vitest';
import { allCardInstanceIds, transition, viewFor, type GameCommand } from '../src/index.js';
import {act,finish,pass} from './combat-helpers.js';
import { entropy,handCard } from './fixtures.js';
import { makeLifecycleScenario } from './fixtures/lifecycle-scenarios.js';
it.each([false, true])('G09 hidden Lancelot elects transformation %s only after explicit choice', use => {
  let state = makeLifecycleScenario('lifecycle-transform-hidden', ['A', 'B', 'C', 'D'].map(id => ({ id, name: id })));
  const before = structuredClone(state), ability = 'c2-p02-r2c2-ab05';
  function send(actorId: string, command: GameCommand) {
    const input = { actorId, command }, random = entropy(), result = transition(state, input, random);
    expect(result).toEqual(transition(JSON.parse(JSON.stringify(state)), input, random));
    if (!result.ok) throw Error(result.code);
    state = result.state;
    expect(allCardInstanceIds(state)).toHaveLength(220);
    expect(new Set(allCardInstanceIds(state)).size).toBe(220);
  }
  function settle() {
    for (let n = 0; n < 200 && state.windows?.length; n++) {
      const w = state.windows.at(-1)!; send(w.participants[w.cursor]!, { type: 'PASS' });
    }
    expect(state.windows ?? []).toEqual([]);
  }
  send('B', { type: 'REVEAL_CHARACTER' }); settle();
  expect(state.players.A!.revealed).toBe(false);
  expect(viewFor(state, 'A').lifecycleAbilities).toContain('lancelot-transform');
  for (const actor of ['B', 'C', 'D']) {
    expect(viewFor(state, actor).players.A).not.toHaveProperty('characterId');
    expect(viewFor(state, actor).lifecycleAbilities).not.toContain('lancelot-transform');
  }
  if (use) { send('A', { type: 'USE_LIFECYCLE_ABILITY', ability: 'lancelot-transform' }); settle(); }
  else {
    send('A', { type: 'PASS_ACTION' });
    const excess = Math.max(0, state.players.A!.hand.length - viewFor(state, 'A').self.stats.handLimit);
    send('A', { type: 'END_TURN', discardIds: state.players.A!.hand.slice(0, excess) });
  }
  expect(state.players.A!.characterId).toBe(use ? 'c2-p07-r1c1' : 'c2-p02-r2c2');
  expect(state.players.A!.revealed).toBe(use);
  expect(state.used?.filter(key => key.includes(ability)) ?? []).toHaveLength(use ? 1 : 0);
  if (!use) {
    expect(state.used).toEqual(before.used);
    expect(state.abilities).toEqual(before.abilities);
    for (const actor of ['B', 'C', 'D']) expect(viewFor(state, actor).players.A).not.toHaveProperty('characterId');
  }
});

it.each([false,true])('Lancelot transformation attempt stays spent after actual cancellation=%s and phase change',cancel=>{
 let state=makeLifecycleScenario('lifecycle-transform-hidden',['A','B','C','D'].map(id=>({id,name:id})));
 const fate=handCard(state,'C','命運凶変');
 state=finish(act(state,'B',{type:'REVEAL_CHARACTER'}));
 state=act(state,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'});
 if(cancel){
  while(state.windows!.at(-1)!.participants[state.windows!.at(-1)!.cursor]!=='C')state=pass(state);
  state=act(state,'C',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(state,'C').reactionTargetAbilityId!});
 }
 state=finish(state);state=act(state,'A',{type:'PASS_ACTION'});state=JSON.parse(JSON.stringify(state));
 expect(state.players.A!.characterId).toBe(cancel?'c2-p02-r2c2':'c2-p07-r1c1');
 expect(state.used?.filter(k=>k==='A:lancelot-transform')).toHaveLength(1);
 expect(viewFor(state,'A').lifecycleAbilities).not.toContain('lancelot-transform');
 const before=JSON.stringify(state);expect(transition(state,{actorId:'A',command:{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'}},entropy()).ok).toBe(false);expect(JSON.stringify(state)).toBe(before);
});
it('Structural Lia concealment after actual Lancelot transformation does not revert identity or inherited abilities',()=>{
 let state=makeLifecycleScenario('lifecycle-transform-hidden',['A','B','C','D'].map(id=>({id,name:id})));
 state=finish(act(state,'B',{type:'REVEAL_CHARACTER'}));state=finish(act(state,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'}));
 expect(state.players.A!.characterId).toBe('c2-p07-r1c1');
 const inherited=[...state.players.A!.abilityCharacterIds!];expect(inherited).toEqual(['c2-p02-r2c2','c2-p07-r1c1']);
 // Lia has no legal self-concealment producer: exercise this explicit state boundary without inventing a card action.
 state.players.B!.revealed=false;state=JSON.parse(JSON.stringify(state));state=act(state,'A',{type:'PASS_ACTION'});
 expect(state.players.A!.characterId).toBe('c2-p07-r1c1');expect(state.players.A!.abilityCharacterIds).toEqual(inherited);
 expect(viewFor(state,'A').lifecycleAbilities).not.toContain('lancelot-transform');
});
