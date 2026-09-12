import { allCardInstanceIds, createGame, gameStats, transition, viewFor, type GameCommand, type GameState } from '@madou/engine';
import { assignCharacter, entropy, takeCard, trimHand } from './scenario-tools.js';

export const suppressionScenarioNames = ['suppression-identity-boundary', 'suppression-blessing-confusion', 'suppression-blessing-hypnosis', 'suppression-blessing-paired', 'suppression-blessing-exempt', 'suppression-blessing-death', 'suppression-next-action', 'suppression-hidden-lia', 'suppression-hidden-ordinary', 'suppression-blessing', 'suppression-blessing-fail'] as const;
export type SuppressionScenarioName = typeof suppressionScenarioNames[number];
export function isSuppressionScenario(name: string): name is SuppressionScenarioName {
  return suppressionScenarioNames.some(value => value === name);
}
/** Initial deal/character assignment and stated prior spirit gains/losses are fixture inputs.
 * Ritual, transformation, turn progression and all suppression/lease effects use real commands.
 * No suppression designation, lease, ability frame or resolved roll is injected. */
export function makeSuppressionScenario(name: SuppressionScenarioName, players: { id: string; name: string }[]): GameState {
  if (name === 'suppression-identity-boundary') return makeIdentityBoundary(players);
  if (players.length !== 4) throw Error('SUPPRESSION_FIXTURE_FOUR_SEATS');
  let game = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c, d] = players.map(player => player.id) as [string, string, string, string];
  const blessing = name === 'suppression-blessing-confusion' || name === 'suppression-blessing-hypnosis' || name === 'suppression-blessing-paired' || name === 'suppression-blessing-exempt' || name === 'suppression-blessing-death' || name === 'suppression-blessing' || name === 'suppression-blessing-fail';
  assignCharacter(game, a, '邪祭ウーノス');
  assignCharacter(game, b, name === 'suppression-hidden-lia' ? 'リーア姫' : name === 'suppression-blessing-exempt' ? '聖騎士ランスロット2' : '侍大将のシン');
  assignCharacter(game, c, blessing ? 'リーア姫' : '大神官ジル');
  assignCharacter(game, d, '占星術師のアルセイル');
  if (blessing) game.players[c]!.permanent = { ...game.players[c]!.permanent, spirit: name === 'suppression-blessing-fail' ? -10 : 20 };
  const ritual = takeCard(game, a, '復活の儀式');
  const fate = takeCard(game, d, '命運凶変');
  const lethal=name==='suppression-blessing-death';const bow=lethal?takeCard(game,a,'踏み込み／弓'):undefined;
  if(lethal)game.players[c]!.damage=gameStats(game,c).endurance-1;
  const statusCard=name==='suppression-blessing-confusion'?takeCard(game,d,'錯乱'):name==='suppression-blessing-hypnosis'?takeCard(game,d,'催眠'):undefined;
  if(statusCard){game.players[b]!.permanent={...game.players[b]!.permanent,spirit:-20};game.players[d]!.permanent={...game.players[d]!.permanent,magic_level:20,spirit:20};}
  trimHand(game, a, ritual,...(bow?[bow]:[])); trimHand(game, d, fate,...(statusCard?[statusCard]:[]));
  function act(actorId: string, command: GameCommand) {
    const result = transition(game, { actorId, command }, entropy());
    if (!result.ok) throw Error(`SUPPRESSION_FIXTURE_${command.type}_${result.code}`);
    game = result.state;
    const ids = allCardInstanceIds(game);
    if (ids.length !== 220 || new Set(ids).size !== 220) throw Error('SUPPRESSION_FIXTURE_CARDS');
  }
  function settle() {
    for (let i = 0; i < 150; i++) {
      const window = game.windows?.at(-1); if (!window) return;
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    throw Error('SUPPRESSION_FIXTURE_WINDOW');
  }
  for (const id of [a, b, c, d]) act(id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); settle();
  act(a, { type: 'CHOOSE_DRAW', draw: false }); settle();
  act(a, { type: 'USE_REVIVAL_RITUAL' }); settle();
  if (game.players[a]!.characterId !== 'c2-p07-r1c2' || !game.players[a]!.revealed || game.players[a]!.abilityCharacterIds?.includes('c2-p05-r1c1')) throw Error('SUPPRESSION_FIXTURE_RITUAL');
  if (game.suppressionDesignations?.length || game.blessingLeases?.length) throw Error('SUPPRESSION_FIXTURE_INJECTED_EFFECT');
  if(name==='suppression-next-action'){
    for(const actor of [a,b,c,d]){
      if(game.phase==='turn-start'){act(actor,{type:'START_TURN'});settle();act(actor,{type:'CHOOSE_DRAW',draw:false});settle();}
      if(game.phase==='action')act(actor,{type:'PASS_ACTION'});
      if(game.phase==='withdrawal')act(actor,{type:'PASS_WITHDRAWAL'});
      act(actor,{type:'END_TURN',discardIds:game.players[actor]!.hand.slice(0,Math.max(0,game.players[actor]!.hand.length-gameStats(game,actor).handLimit))});settle();
    }
    act(a,{type:'START_TURN'});settle();act(a,{type:'CHOOSE_DRAW',draw:false});settle();
    if(game.phase!=='action'||game.seatOrder[game.turnSeat]!==a)throw Error('SUPPRESSION_FIXTURE_NEXT_ACTION');
  }
  return game;
}

/** Structural saved-state boundary, NOT a reachable Lia transformation.
 * Ban, blessing, reveals and turn progression are actual commands. Only the final
 * character replacement is injected; the original lease/life are left untouched
 * so the DO must project and clean the stale lease itself. */
function makeIdentityBoundary(players: {id: string; name: string}[]): GameState {
  let state = makeSuppressionScenario('suppression-blessing', players);
  const [a,b,c] = players.map(p => p.id) as [string,string,string,string];
  function act(actorId: string, command: GameCommand) {
    const result = transition(state, {actorId, command}, entropy());
    if (!result.ok) throw Error(`IDENTITY_BOUNDARY_${command.type}_${result.code}`);
    state = result.state;
  }
  function finish() {
    for (let n=0;n<300;n++) {
      const w=state.windows?.at(-1); if (!w) return;
      act(w.participants[w.cursor]!, {type:'PASS'});
    }
    throw Error('IDENTITY_BOUNDARY_WINDOW_LIMIT');
  }
  for (const id of [b,c]) { act(id,{type:'REVEAL_CHARACTER'}); finish(); }
  const ban=viewFor(state,a).abilityOptions.find(o=>o.abilityId==='c2-p07-r1c2-ab03')!;
  act(a,{type:'USE_ABILITY',abilityId:ban.abilityId,targetEventId:ban.targetEventId,targetIds:[b]}); finish();
  for (let n=0;n<100;n++) {
    if (state.windows?.length) {finish();continue;}
    const id=state.seatOrder[state.turnSeat]!;
    if (state.phase==='action'&&id===c) break;
    if (state.phase==='turn-start') act(id,{type:'START_TURN'});
    else if(state.phase==='draw') act(id,{type:'CHOOSE_DRAW',draw:false});
    else if(state.phase==='action') act(id,{type:'PASS_ACTION'});
    else if(state.phase==='withdrawal') act(id,{type:'PASS_WITHDRAWAL'});
    else if(state.phase==='hand-adjustment') act(id,{type:'END_TURN',discardIds:state.players[id]!.hand.slice(0,Math.max(0,state.players[id]!.hand.length-gameStats(state,id).handLimit))});
    else throw Error('IDENTITY_BOUNDARY_PHASE');
  }
  const blessing=viewFor(state,c).abilityOptions.find(o=>o.abilityId==='c2-p03-r1c2-ab04')!;
  act(c,{type:'USE_ABILITY',abilityId:blessing.abilityId,targetEventId:blessing.targetEventId,targetId:b}); finish();
  if(state.blessingLeases?.length!==1 || viewFor(state,b).suppressionTargets[0]?.applicability!=='relieved') throw Error('IDENTITY_BOUNDARY_NO_REAL_LEASE');
  const life=state.players[c]!.lifeId;
  // Deliberate structural input, not a lifecycle command or an asserted game route.
  assignCharacter(state,c,'大神官ジル');
  if(state.players[c]!.lifeId!==life || state.blessingLeases.length!==1) throw Error('IDENTITY_BOUNDARY_CHANGED_LIFE_OR_LEASE');
  return state;
}
