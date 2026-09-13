import {getCharacter} from '@madou/catalog';
import {transition, type Entropy, type GameState} from '../index.js';
import {techniqueFor} from '../effects/registry.js';
import {viewFor, type PlayerView} from '../view.js';
import {legalCommands, type Command} from './legal-commands.js';

const MANDATORY = new Set([
  'CHOOSE_WISH',
  'CHOOSE_WISH_CAPACITY',
  'CHOOSE_INSPECTION',
  'CHOOSE_REVIVAL',
  'START_TURN',
  'CHOOSE_DRAW',
  'CHOOSE_DAMAGE_DOUBLE',
  'PAY_HIT_ADVANCES',
  'CHOOSE_LIFETIME_EFFECT',
  'CHOOSE_BEAST_CAPTURE',
  'CHOOSE_FOLLOWER_BYPASS',
  'DISCARD_HIT_CHANTS',
  'CHOOSE_DARK_SAINT_IGNORE',
  'PAY_SHADOW_JUMP',
  'CHOOSE_RECLAIM',
]);

const PASS_TYPES = new Set(['PASS', 'PASS_SETUP', 'PASS_WITHDRAWAL']);

function tiebreak(command: Command, seed: number): number {
  const text = JSON.stringify(command);
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 2654435761);
  return hash >>> 0;
}

function attackScore(view: PlayerView, command: Command): number {
  if (command.type !== 'ATTACK') return -1;
  const name = getCharacter(view.self.characterId)?.name;
  const technique = techniqueFor(command.cardInstanceId, name, command.dedicated, command.techniqueVariant);
  const damage = technique?.damage;
  const numeric = typeof damage === 'number' ? damage : 4;
  const formula = technique?.damageFormula ? 6 : 0;
  return numeric + formula + command.targetIds.length;
}

function pickFirst(commands: Command[], types: Set<string>): Command | undefined {
  return commands.find(command => types.has(command.type));
}

/** Deterministic: mandatory, then max-damage reachable attack, then pass windows, then end turn. */
export function choose(view: PlayerView, seed: number): Command {
  const commands = legalCommands(view);
  if (!commands.length) throw new Error(`NO_LEGAL_COMMANDS seat=${view.self.id} phase=${view.phase} window=${view.activeWindow?.kind ?? 'none'}`);
  const mandatory = pickFirst(commands, MANDATORY);
  if (mandatory) return mandatory;
  const attacks = commands.filter(command => command.type === 'ATTACK');
  if (attacks.length) {
    attacks.sort((a, b) => {
      const delta = attackScore(view, b) - attackScore(view, a);
      return delta !== 0 ? delta : tiebreak(a, seed) - tiebreak(b, seed);
    });
    return attacks[0]!;
  }
  const approach = commands.find(command => command.type === 'APPROACH');
  if (approach) return approach;
  const virtual = commands.find(command => command.type === 'DECLARE_VIRTUAL_BLADE');
  if (virtual) return virtual;
  const pass = pickFirst(commands, PASS_TYPES);
  if (pass) return pass;
  const passAction = commands.find(command => command.type === 'PASS_ACTION');
  if (passAction) return passAction;
  const endTurn = commands.find(command => command.type === 'END_TURN');
  if (endTurn) return endTurn;
  const startFollowers = commands.find(command => command.type === 'START_FOLLOWERS');
  if (startFollowers) return startFollowers;
  const withoutReveal = commands.filter(command => command.type !== 'REVEAL_CHARACTER');
  const pool = withoutReveal.length ? withoutReveal : commands;
  pool.sort((a, b) => tiebreak(a, seed) - tiebreak(b, seed));
  return pool[0]!;
}

function actingActor(state: GameState): string | undefined {
  const withCommands = state.seatOrder.filter(id => legalCommands(viewFor(state, id)).length);
  if (!withCommands.length) return;
  const pending = state.windows?.at(-1)?.participants[state.windows.at(-1)!.cursor];
  if (pending && withCommands.includes(pending)) return pending;
  const turn = state.seatOrder[state.turnSeat];
  if (turn && withCommands.includes(turn)) return turn;
  const setup = state.pending?.actorId;
  if (setup && withCommands.includes(setup)) return setup;
  return withCommands[0];
}

export function playOneStep(state: GameState, entropy: Entropy, seed = 0): GameState {
  const actorId = actingActor(state);
  if (!actorId) {
    if (state.outcome) return state;
    throw new Error(`NO_ACTING_SEAT phase=${state.phase} window=${state.windows?.at(-1)?.kind ?? 'none'}`);
  }
  const view = viewFor(state, actorId);
  const command = choose(view, seed);
  const result = transition(state, {actorId, command}, entropy);
  if (!result.ok) {
    throw new Error(`INVALID_ACTION actor=${actorId} code=${result.code} command=${JSON.stringify(command)} choices=${JSON.stringify(view.legalChoices)}`);
  }
  return result.state;
}

export function playToOutcome(state: GameState, entropy: Entropy, seed: number, maxSteps = 5000): {state: GameState; steps: number} {
  let steps = 0;
  while (!state.outcome && steps < maxSteps) {
    state = playOneStep(state, entropy, seed);
    steps++;
  }
  return {state, steps};
}
