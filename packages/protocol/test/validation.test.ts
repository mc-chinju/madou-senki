import { describe, expect, it } from 'vitest';
import { parseGameCommand, parseCommandEnvelope } from '../src/index.js';
import type { ServerMessage } from '../src/index.js';

// @ts-expect-error arbitrary strings are not safe public server error codes
const unsafeError: ServerMessage<unknown> = { type: 'error', code: 'secret-card-id:a2-p01-r1c1' };
void unsafeError;

const envelope = () => ({
  protocolVersion: 1,
  commandId: 'command-123',
  expectedRevision: 12,
  command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: 'a2-p18-r3c1' },
});

describe('untrusted command envelopes', () => {
  it('accepts a setup command and returns a detached normalized value', () => {
    const input = envelope();
    const result = parseCommandEnvelope(input);
    expect(result).toEqual({ ok: true, value: input });
    if (!result.ok) throw new Error('Expected valid envelope');
    expect(result.value).not.toBe(input);
    expect(result.value.command).not.toBe(input.command);
  });

  it.each(['PASS_SETUP', 'REVEAL_CHARACTER', 'PASS_ACTION_THROUGH', 'CANCEL_PASS_THROUGH'])('accepts %s without unrelated payload', (type) => {
    expect(parseCommandEnvelope({ ...envelope(), command: { type } }).ok).toBe(true);
    expect(parseCommandEnvelope({ ...envelope(), command: { type, cardInstanceId: 'secret' } }).ok).toBe(false);
  });

  it('accepts a complete window identity and rejects half of one', () => {
    expect(parseCommandEnvelope({ ...envelope(), windowId: 'window-1', windowRevision: 0 }).ok).toBe(true);
    expect(parseCommandEnvelope({ ...envelope(), windowId: 'window-1' }).ok).toBe(false);
    expect(parseCommandEnvelope({ ...envelope(), windowRevision: 0 }).ok).toBe(false);
  });

  it('strictly validates reaction and reaction-cancellation commands',()=>{
    expect(parseCommandEnvelope({...envelope(),command:{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:'a-1'}}).ok).toBe(true);
    expect(parseCommandEnvelope({...envelope(),command:{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'unknown',targetActionId:'a-1'}}).ok).toBe(false);
    expect(parseCommandEnvelope({...envelope(),command:{type:'CANCEL_REACTION',targetActionId:'a-2'}}).ok).toBe(true);
    expect(parseCommandEnvelope({...envelope(),command:{type:'CANCEL_REACTION',targetActionId:'a-2',cardInstanceId:'secret'}}).ok).toBe(false);
  });

  it('strictly validates distance exchange commands',()=>{
    for(const command of [{type:'APPROACH',targetId:'B',cardInstanceId:'a2-p23-r1c2'},{type:'WITHDRAW',targetId:'B',cardInstanceId:'a2-p06-r1c3'},{type:'PLAY_MAAI',cardInstanceId:'a2-p06-r1c3'},{type:'PLAY_ADVANCE',cardInstanceId:'a2-p23-r1c2'}])expect(parseCommandEnvelope({...envelope(),command}).ok).toBe(true);
    expect(parseCommandEnvelope({...envelope(),command:{type:'APPROACH',targetIds:['B'],cardInstanceId:'a2-p23-r1c2'}}).ok).toBe(false);
    expect(parseCommandEnvelope({...envelope(),command:{type:'PLAY_MAAI',cardInstanceId:'a2-p06-r1c3',targetId:'B'}}).ok).toBe(false);
  });

  it('strictly validates bounded turn-card and phase-pass commands',()=>{expect(parseCommandEnvelope({...envelope(),command:{type:'PLAY_TURN_CARD',cardInstanceIds:['a2-p04-r2c3']}}).ok).toBe(true);expect(parseCommandEnvelope({...envelope(),command:{type:'PLAY_TURN_CARD',cardInstanceIds:[]}}).ok).toBe(false);for(const type of ['PASS_ACTION','PASS_WITHDRAWAL'])expect(parseCommandEnvelope({...envelope(),command:{type}}).ok).toBe(true);});

  it('accepts backwards-compatible chant commands with an optional explicit dedicated selection', () => {
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'CHANT', cardInstanceId: 'a2-p10-r2c3' } }).ok).toBe(true);
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'CHANT', cardInstanceId: 'a2-p11-r1c1', dedicated: true } }).ok).toBe(true);
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'CHANT', cardInstanceId: 'a2-p11-r1c1', dedicated: 'yes' } }).ok).toBe(false);
  });

  it('strictly validates optional printed attack technique variants', () => {
    for (const techniqueVariant of ['one-hit', 'two-hit', 'lancelot-1', 'lancelot-2']) {
      expect(parseCommandEnvelope({ ...envelope(), command: { type: 'ATTACK', cardInstanceId: 'a2-p10-r3c2', targetIds: ['B'], dedicated: true, techniqueVariant } }).ok).toBe(true);
    }
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'ATTACK', cardInstanceId: 'a2-p10-r3c2', targetIds: ['B'], dedicated: true } }).ok).toBe(true);
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'ATTACK', cardInstanceId: 'a2-p10-r3c2', targetIds: ['B'], dedicated: true, techniqueVariant: 'three-hit' } }).ok).toBe(false);
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'ATTACK', cardInstanceId: 'a2-p10-r3c2', targetIds: ['B'], dedicated: true, techniqueVariant: 'one-hit', hitCount: 1 } }).ok).toBe(false);
  });

  it('strictly validates the explicit follower-bypass choice', () => {
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'CHOOSE_FOLLOWER_BYPASS', ignore: true } }).ok).toBe(true);
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'CHOOSE_FOLLOWER_BYPASS', ignore: false } }).ok).toBe(true);
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'CHOOSE_FOLLOWER_BYPASS', ignore: 'yes' } }).ok).toBe(false);
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'CHOOSE_FOLLOWER_BYPASS', ignore: true, targetId: 'B' } }).ok).toBe(false);
  });

  it.each([
    null, [], 'PASS_SETUP', { ...envelope(), protocolVersion: 2 },
    { ...envelope(), expectedRevision: -1 }, { ...envelope(), expectedRevision: 1.2 },
    { ...envelope(), expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...envelope(), commandId: '' }, { ...envelope(), commandId: 'x'.repeat(129) },
    { ...envelope(), command: { type: 'ARBITRARY_STATE_EDIT' } },
    { ...envelope(), command: { type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId: 123 } },
    { ...envelope(), command: { type: 'PLACE_INITIAL_FOLLOWER' } },
  ])('rejects malformed data %#', (value) => {
    expect(parseCommandEnvelope(value).ok).toBe(false);
  });

  it('rejects actor impersonation at either level', () => {
    expect(parseCommandEnvelope({ ...envelope(), actorId: 'another-player' }).ok).toBe(false);
    expect(parseCommandEnvelope({ ...envelope(), command: { ...envelope().command, actorId: 'another-player' } }).ok).toBe(false);
  });

  it('does not echo untrusted values in validation errors', () => {
    expect(parseCommandEnvelope({ ...envelope(), command: { type: 'secret-token-content' } }))
      .toEqual({ ok: false, code: 'INVALID_COMMAND' });
  });

  it('rejects inherited required fields and custom prototypes', () => {
    expect(parseCommandEnvelope(Object.create(envelope())).ok).toBe(false);
    const command = Object.assign(Object.create({ type: 'PASS_SETUP' }), {});
    expect(parseCommandEnvelope({ ...envelope(), command }).ok).toBe(false);
    const custom = Object.assign(Object.create({ custom: true }), envelope());
    expect(parseCommandEnvelope(custom).ok).toBe(false);
  });

  it('accepts plain null-prototype JSON-shaped records', () => {
    const command = Object.assign(Object.create(null), { type: 'PASS_SETUP' });
    const input = Object.assign(Object.create(null), { ...envelope(), command });
    expect(parseCommandEnvelope(input)).toEqual({ ok: true, value: { ...envelope(), command: { type: 'PASS_SETUP' } } });
  });

  it('rejects symbol and non-enumerable extra properties', () => {
    const symbolInput = envelope() as Record<PropertyKey, unknown>;
    symbolInput[Symbol('actor')] = 'another-player';
    expect(parseCommandEnvelope(symbolInput).ok).toBe(false);

    const hiddenActor = envelope();
    Object.defineProperty(hiddenActor, 'actorId', { value: 'another-player', enumerable: false });
    expect(parseCommandEnvelope(hiddenActor).ok).toBe(false);
  });

  it('rejects accessors without executing them', () => {
    let reads = 0;
    const command = {};
    Object.defineProperty(command, 'type', { enumerable: true, get: () => { reads += 1; return 'PASS_SETUP'; } });
    expect(parseCommandEnvelope({ ...envelope(), command }).ok).toBe(false);
    expect(reads).toBe(0);

    const input = envelope();
    Object.defineProperty(input, 'actorId', { enumerable: true, get: () => { reads += 1; return 'another-player'; } });
    expect(parseCommandEnvelope(input).ok).toBe(false);
    expect(reads).toBe(0);
  });
});

it.each(['reroll','force-fail'] as const)('accepts only the explicit roll target shape for %s',mode=>{
  const command={type:'PLAY_REACTION',cardInstanceId:mode==='reroll'?'a2-p02-r1c3':'a2-p02-r2c3',mode,targetRollId:'roll-123'};
  expect(parseGameCommand(command)).toEqual({ok:true,value:command});
  for(const extra of [{targetActionId:'a-1'},{dedicated:false},{actorId:'another-player'}])expect(parseGameCommand({...command,...extra}).ok).toBe(false);
  expect(parseGameCommand({...command,targetRollId:''}).ok).toBe(false);
  expect(parseGameCommand({...command,targetRollId:123}).ok).toBe(false);
});
it('rejects reroll action aliases and action-only modes with a roll target',()=>{
  expect(parseGameCommand({type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetActionId:'a-1'}).ok).toBe(false);
  for(const mode of ['cancel','effect-plus'])expect(parseGameCommand({type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode,targetRollId:'roll-1'}).ok).toBe(false);
});
