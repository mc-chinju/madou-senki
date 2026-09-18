import {isRevealBoundaryScenario,makeRevealBoundaryScenario,type RevealBoundaryScenario} from './reveal-boundary-scenarios.js';
import {isCanonicalScenario,makeCanonicalScenario,type CanonicalScenario} from './canonical-scenarios.js';
import {isAmuletPhysicalScenario,makeAmuletPhysicalScenario,type AmuletPhysicalScenario} from './amulet-physical-scenarios.js';
import {makeFairyFolkPhysicalScenario} from './fairy-folk-physical-scenarios.js';
import {makeSmallAngelPhysicalScenario,isSmallAngelPhysicalScenario,type SmallAngelPhysicalScenario} from './small-angel-physical-scenarios.js';
import {makeR6Scenario,isR6Scenario,type R6ScenarioName} from './r6-scenarios.js';
import {makeSharedReclaimScenario,isSharedReclaimScenario,type SharedReclaimScenario} from './shared-reclaim-scenarios.js';
import {makeSadLoveScenario,type SadLoveScenario} from './sad-love-scenarios.js';
import {isVirtualBladeScenario,makeVirtualBladeScenario,type VirtualBladeScenarioName} from './virtual-blade-scenarios.js';
import { isReclaimScenario, makeReclaimScenario, type ReclaimScenarioName } from './reclaim-scenarios.js';
import { isSuppressionScenario, makeSuppressionScenario, type SuppressionScenarioName } from './suppression-scenarios.js';
import { isConditionalScenario, makeConditionalScenario, type ConditionalScenarioName } from './conditional-ability-scenarios.js';
import { isTurnInformationScenario, makeTurnInformationScenario, type TurnInformationScenarioName } from './turn-information-scenarios.js';
import { isBeastCaptureScenario, makeBeastCaptureScenario, type BeastCaptureScenarioName } from './beast-capture-scenarios.js';
import { isFollowerAttackScenario, makeFollowerAttackScenario, type FollowerAttackScenarioName } from './follower-attack-scenarios.js';
import { isFollowerScenario, makeFollowerScenario, type FollowerScenarioName } from './follower-scenarios.js';
import { isCombinationScenario, makeCombinationScenario, type CombinationScenarioName } from './combination-scenarios.js';
import { isAbilityScenario, makeAbilityScenario, type AbilityScenarioName } from './ability-scenarios.js';
import { isLifetimeScenario, makeLifetimeScenario, type LifetimeScenarioName } from './lifetime-scenarios.js';
import { isLifecycleScenario, makeLifecycleScenario, type LifecycleScenarioName } from './lifecycle-scenarios.js';
import { entropy, takeCard, trimHand, assignCharacter } from './scenario-tools.js';
import { allCardInstanceIds, createGame, derivedStats, transition, type GameCommand, type GameState } from '@madou/engine';

export type ScenarioName = 'fury-royal-reflection' | RevealBoundaryScenario | CanonicalScenario | AmuletPhysicalScenario | SmallAngelPhysicalScenario | R6ScenarioName | SharedReclaimScenario | SadLoveScenario | VirtualBladeScenarioName | ReclaimScenarioName | SuppressionScenarioName | ConditionalScenarioName | TurnInformationScenarioName | BeastCaptureScenarioName | FollowerAttackScenarioName | FollowerScenarioName | CombinationScenarioName | AbilityScenarioName | LifetimeScenarioName | LifecycleScenarioName | 'setup' | 'combat' | 'combat-ready' | 'chanted-ready' | 'dedicated-defense' | 'optional-chant-ready' | 'lance-variant-ready' | 'lancelot-variant-ready' | 'dedicated-chant-defense' | 'magic-bypass' | 'magic-dedicated-defense' | 'magic-restricted-defense' | 'roll-check' | 'roll-recovery' | 'roll-damage' | 'nightmare-damage' | 'stopped-defense' | 'stopped-reveal' | 'silenced-chant' | 'reflected-stop-withdrawal' | 'ability-disabled-defense' | 'third-party-interrupt' | 'prayer-effect-level' | 'follower-defense-started' | 'multi-target-multi-hit';

/** Test-only reproducible production states, shared by real DO and browser fixtures. */
export function makeScenario(name: ScenarioName, players: { id: string; name: string }[]): GameState {
  if(isRevealBoundaryScenario(name))return makeRevealBoundaryScenario(name,players);
  if(isCanonicalScenario(name))return makeCanonicalScenario(name,players);
  if(isAmuletPhysicalScenario(name))return makeAmuletPhysicalScenario(name,players);
  if(name==='fury-royal-reflection')return makeFairyFolkPhysicalScenario('fairy-grant-hand',players,{defender:'妖精王フューリー',royal:true});
  if (isSmallAngelPhysicalScenario(name)) return makeSmallAngelPhysicalScenario(name,players);
  if (isR6Scenario(name)) return makeR6Scenario(name,players);
  if (isSharedReclaimScenario(name)) return makeSharedReclaimScenario(name,players);
  if (name==='sad-love'||name==='sad-love-lethal'||name==='sad-love-aura') return makeSadLoveScenario(name,players);
  if (isVirtualBladeScenario(name)) return makeVirtualBladeScenario(name,players);
  if (isReclaimScenario(name)) return makeReclaimScenario(name, players);
  if (isSuppressionScenario(name)) return makeSuppressionScenario(name, players);
  if (isConditionalScenario(name)) return makeConditionalScenario(name, players);
  if (isTurnInformationScenario(name)) return makeTurnInformationScenario(name, players);
  if (isBeastCaptureScenario(name)) return makeBeastCaptureScenario(name, players);
  if (isFollowerAttackScenario(name)) return makeFollowerAttackScenario(name, players);
  if (isFollowerScenario(name)) return makeFollowerScenario(name, players);
  if (isCombinationScenario(name)) return makeCombinationScenario(name, players);
  if (isAbilityScenario(name)) return makeAbilityScenario(name, players);
  if (isLifetimeScenario(name)) return makeLifetimeScenario(name, players);
  if (isLifecycleScenario(name)) return makeLifecycleScenario(name, players);
  let state = createGame(players, entropy(), { startingSeat: 0 });
  const [a, b, c] = players.map(player => player.id) as [string, string, string];
  const act = (actorId: string, command: GameCommand, dice = entropy().dice) => {
    const outcome = transition(state, { actorId, command }, { ...entropy(), dice });
    if (!outcome.ok) throw Error(`FIXTURE_${outcome.code}`);
    state = outcome.state;
    if (allCardInstanceIds(state).length !== 220 || new Set(allCardInstanceIds(state)).size !== 220) throw Error('FIXTURE_CARD_CONSERVATION');
  };
  if (name === 'setup') return state;
  for (const player of players) act(player.id, { type: 'PASS_SETUP' });
  act(a, { type: 'START_TURN' }); act(a, { type: 'CHOOSE_DRAW', draw: false });
  assignCharacter(state, a, '侍大将のシン'); assignCharacter(state, b, '黒騎士ガーウィン');
  if (name === 'reflected-stop-withdrawal') {
    const attack = takeCard(state, a, '狂王陣');
    const reflect = takeCard(state, b, '神王界');
    const distance = takeCard(state, a, '間合い／休息');
    trimHand(state, a, attack, distance);
    state.distances[a]![b] = state.distances[b]![a] = 'near';
    state.events = [];
    act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: [b], dedicated: false });
    for (let i = 0; state.windows?.at(-1)?.kind !== 'normal-defense' && i < 200; i++) {
      const window = state.windows?.at(-1); if (!window) throw Error('FIXTURE_MISSING_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    act(b, { type: 'PLAY_DEFENSE', cardInstanceId: reflect, dedicated: false });
    for (let i = 0; state.windows?.length && i < 200; i++) {
      const window = state.windows.at(-1)!;
      const resistance = state.rolls?.at(-1)?.purpose === 'status-resistance';
      act(window.participants[window.cursor]!, { type: 'PASS' }, Array(100).fill(resistance ? 6 : 1));
    }
    if (state.phase !== 'withdrawal' || !state.players[a]!.statuses?.some(status => status.kind === 'stopped')) throw Error('FIXTURE_REFLECTED_STOP_MISSING');
    return state;
  }
  // Stored-state precondition for reveal availability; the separate stopped-defense fixture proves infliction.
  if (name === 'stopped-reveal') {
    state.players[b]!.statuses = [{ id: 'fixture-prior-stop', kind: 'stopped', modifiers: [-1], nextCheck: 1 }];
    const follower = takeCard(state, b, '兵士');
    state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== follower);
    state.players[b]!.followers.push({ cardInstanceId: follower, revealed: false });
  }
  if (name === 'stopped-defense' || name === 'ability-disabled-defense' || name === 'silenced-chant') {
    const silenced = name === 'silenced-chant';
    const stopped = name === 'stopped-defense';
    assignCharacter(state, a, stopped ? '魔聖母ディア' : silenced ? '白魔術師シェリム' : '占星術師のアルセイル');
    assignCharacter(state, b, silenced ? '侍大将のシン' : '白魔術師シェリム'); assignCharacter(state, c, '黒騎士ガーウィン');
    const source = takeCard(state, a, stopped ? '悪夢' : silenced ? '沈黙' : '錯乱');
    takeCard(state, b, '白光'); takeCard(state, b, '神性介入'); takeCard(state, b, '転移');
    if (stopped) {
      const follower = takeCard(state, b, '兵士');
      state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== follower);
      state.players[b]!.followers.push({ cardInstanceId: follower, revealed: false });
    }
    if (silenced) { takeCard(state, b, '氷狼乱舞陣'); takeCard(state, b, '天地百撃斬'); }
    const bow = takeCard(state, c, '踏み込み／弓');
    state.events = [];
    act(a, { type: 'ATTACK', cardInstanceId: source, targetIds: [b], dedicated: !stopped && !silenced });
    for (let i = 0; state.windows?.length && i < 200; i++) {
      const window = state.windows.at(-1)!;
      const resistance = state.rolls?.at(-1)?.purpose === 'status-resistance';
      act(window.participants[window.cursor]!, { type: 'PASS' }, Array(100).fill(resistance ? 6 : 1));
    }
    if (!state.players[b]!.statuses?.some(status => status.kind === (stopped ? 'stopped' : silenced ? 'silenced' : 'ability-disabled'))) throw Error('FIXTURE_STATUS_NOT_APPLIED');
    act(a, { type: 'PASS_WITHDRAWAL' });
    const end = (id: string) => act(id, { type: 'END_TURN', discardIds: state.players[id]!.hand.slice(0, Math.max(0, state.players[id]!.hand.length - derivedStats(state.players[id]!).handLimit)) });
    end(a); act(b, { type: 'START_TURN' });
    for (let i = 0; state.windows?.length && i < 200; i++) {
      const window = state.windows.at(-1)!;
      act(window.participants[window.cursor]!, { type: 'PASS' }, Array(100).fill(6));
    }
    if (silenced) { act(b, { type: 'CHOOSE_DRAW', draw: false }); return state; }
    if (!stopped) { act(b, { type: 'CHOOSE_DRAW', draw: false }); act(b, { type: 'PASS_ACTION' }); end(b); }
    act(c, { type: 'START_TURN' }); act(c, { type: 'CHOOSE_DRAW', draw: false });
    act(c, { type: 'ATTACK', cardInstanceId: bow, targetIds: [b], dedicated: false });
    for (let i = 0; state.windows?.at(-1)?.kind !== 'normal-defense' && i < 200; i++) {
      const window = state.windows?.at(-1); if (!window) throw Error('FIXTURE_MISSING_WINDOW');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    if (state.windows?.at(-1)?.kind !== 'normal-defense') throw Error('FIXTURE_DID_NOT_CONVERGE');
    return state;
  }
  if (name === 'dedicated-defense') { assignCharacter(state, b, '忍びのイダ'); takeCard(state, b, '手裏剣'); }
  if (name === 'optional-chant-ready') { assignCharacter(state, a, '早駆けのランカスター'); takeCard(state, a, '竜殺天空槍'); }
  if (name === 'lance-variant-ready') { assignCharacter(state, a, '早駆けのランカスター'); takeCard(state, a, '連槍撃'); }
  if (name === 'lancelot-variant-ready') {
    assignCharacter(state, a, '聖騎士ランスロット2');
    const card = takeCard(state, a, '光竜破山剣');
    state.players[a]!.hand = state.players[a]!.hand.filter(id => id !== card);
    state.players[a]!.chants.push({ cardInstanceId: card, revealed: false });
  }
  if (name === 'dedicated-chant-defense') {
    assignCharacter(state, b, '侍大将のシン');
    const card = takeCard(state, b, '天地爆砕剣');
    state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== card);
    state.players[b]!.chants.push({ cardInstanceId: card, revealed: false });
  }
  if (name === 'magic-bypass') {
    assignCharacter(state, a, '凍気のアイエル');
    for (const [owner, followerName] of [[b, 'ゴブリン'], [c, '兵士']] as const) {
      const card = takeCard(state, owner, followerName);
      state.players[owner]!.hand = state.players[owner]!.hand.filter(id => id !== card);
      state.players[owner]!.followers.push({ cardInstanceId: card, revealed: false });
    }
  }
  if (name === 'magic-dedicated-defense') { assignCharacter(state, b, '白魔術師シェリム'); takeCard(state, b, '白光'); }
  if (name === 'magic-restricted-defense') {
    assignCharacter(state, a, '吟遊詩人のレスター'); assignCharacter(state, b, '白魔術師シェリム');
    for (const card of ['見切る', '手裏剣', '転移', '白光']) takeCard(state, b, card);
  }
  if (name === 'roll-damage') { assignCharacter(state, a, '吟遊詩人のレスター'); takeCard(state, a, '神性介入'); }
  if (name === 'nightmare-damage') { assignCharacter(state, a, '魔聖母ディア'); takeCard(state, a, '神性介入'); }
  if (name === 'roll-recovery') {
    state.players[a]!.statuses = [{ id: 'fixture-silence', kind: 'silenced', modifiers: [-2, -1], nextCheck: 1 }];
    state.phase = 'turn-start'; state.events = []; act(a, { type: 'START_TURN' }); return state;
  }
  const attack = takeCard(state, a, name === 'nightmare-damage' ? '悪夢' : name === 'roll-check' ? '炎流' : name === 'magic-restricted-defense' || name === 'roll-damage' ? '呪歌' : name === 'magic-bypass' ? '凍流' : name === 'multi-target-multi-hit' || name === 'chanted-ready' ? '天地百撃斬' : '踏み込み／弓');
  if (name === 'roll-check') {
    const intervention = takeCard(state, a, '神性介入'); trimHand(state, a, attack, intervention);
    const fate = takeCard(state, c, '命運凶変'); trimHand(state, c, fate);
    const blessing = takeCard(state, a, '神々の血');
    state.players[a]!.hand = state.players[a]!.hand.filter(id => id !== blessing); state.deck.unshift(blessing);
  }
  let prayer: string | undefined;
  if (name === 'third-party-interrupt') {
    const reaction = takeCard(state, c, '命運凶変'); trimHand(state, c, reaction);
    const blessing = takeCard(state, c, '祝福');
    state.players[c]!.hand = state.players[c]!.hand.filter(id => id !== blessing); state.deck.unshift(blessing);
  }
  if (name === 'prayer-effect-level') { prayer = takeCard(state, a, '必勝の祈り'); trimHand(state, a, prayer, attack); }
  if (name === 'follower-defense-started' || name === 'multi-target-multi-hit') {
    const follower = takeCard(state, b, '兵士');
    state.players[b]!.hand = state.players[b]!.hand.filter(id => id !== follower);
    state.players[b]!.followers.push({ cardInstanceId: follower, revealed: false });
  }
  if (name === 'follower-defense-started' || name === 'combat') takeCard(state, b, '見切る');
  if (name === 'multi-target-multi-hit' || name === 'chanted-ready') {
    state.players[a]!.hand = state.players[a]!.hand.filter(id => id !== attack);
    state.players[a]!.chants.push({ cardInstanceId: attack, revealed: false });
  }
  // Fixture rearrangement is not an actual deal; discard obsolete private assignment/draw associations.
  state.events = [];
  if (name === 'combat-ready' || name === 'chanted-ready' || name === 'optional-chant-ready' || name === 'lance-variant-ready' || name === 'lancelot-variant-ready') return state;
  act(a, { type: 'ATTACK', cardInstanceId: attack, targetIds: name === 'multi-target-multi-hit' || name === 'magic-bypass' ? [b, c] : [b], dedicated: name === 'multi-target-multi-hit' || name === 'magic-bypass' || name === 'magic-restricted-defense' || name === 'roll-damage' || name === 'nightmare-damage' }, [3]);
  if (name === 'third-party-interrupt') { act(a, { type: 'PASS' }); act(b, { type: 'PASS' }); return state; }
  const desired = name === 'roll-check' || name === 'roll-damage' || name === 'nightmare-damage' ? 'after-roll' : prayer ? 'effect-level' : name === 'magic-bypass' ? 'follower-bypass-choice' : 'normal-defense';
  for (let i = 0; i < 200 && state.windows?.at(-1)?.kind !== desired; i++) {
    const window = state.windows?.at(-1); if (!window) throw Error('FIXTURE_MISSING_WINDOW');
    act(window.participants[window.cursor]!, { type: 'PASS' }, name === 'roll-check' ? [6, 6] : name === 'multi-target-multi-hit' ? Array(100).fill(3) : entropy().dice);
  }
  if (state.windows?.at(-1)?.kind !== desired) throw Error('FIXTURE_DID_NOT_CONVERGE');
  if (name === 'follower-defense-started') {
    act(b, { type: 'START_FOLLOWERS' });
    for (let i = 0; i < 100 && state.windows?.at(-1)?.kind !== 'follower-start'; i++) {
      const window = state.windows?.at(-1); if (!window) throw Error('FIXTURE_MISSING_FOLLOWER_ENTRY');
      act(window.participants[window.cursor]!, { type: 'PASS' });
    }
    if (state.windows?.at(-1)?.kind !== 'follower-start') throw Error('FIXTURE_FOLLOWER_ENTRY_NOT_CLOSED');
  }
  return state;
}
