import { expect, it } from 'vitest';
import { act, ready, until, finish, closeWindow, pass } from './combat-helpers.js';
import { character, handCard, entropy } from './fixtures.js';
import { transition, viewFor, previewDeclarationCandidate, type GameState, discardIds } from '../src/index.js';
const GARWIN = 'c2-p05-r2c1-ab03', FURY = 'c2-p02-r1c2-ab04';
function priority(s: GameState, actor: string) { for (let n = 0; n < 25; n++) {
    const w = s.windows!.at(-1)!;
    if (w.participants[w.cursor] === actor)
        return s;
    s = pass(s);
} throw Error('PRIORITY'); }
function cancel(s: GameState, actor = 'B') {
    const fate = handCard(s, actor, '命運凶変');
    s = priority(s, actor);
    return act(s, actor, { type: 'PLAY_REACTION', cardInstanceId: fate, mode: 'cancel-ability', targetAbilityId: viewFor(s, actor).reactionTargetAbilityId! });
}
function source(s: GameState) { return Object.values(s.actions!).find(a => a.actorId === 'A' && a.declaration)!; }
function rejected(s: GameState, actorId: string, command: unknown, code: string) { const before = JSON.stringify(s); expect(transition(s, { actorId, command } as any, entropy())).toEqual({ ok: false, code }); expect(JSON.stringify(s)).toBe(before); }
it.each(['hand', 'followers'] as const)('actual Garwin DeathKnight %s source gets far, +1 effect and +2 before native double', zone => {
    let s = ready();
    character(s, 'A', '黒騎士ガーウィン');
    const card = handCard(s, 'A', '黒騎士団');
    if (zone === 'followers') {
        // The normal placement command is tested by the existing follower suites; only placement is arranged here.
        s.players.A!.hand = s.players.A!.hand.filter(id => id !== card);
        s.players.A!.followers.push({ cardInstanceId: card, revealed: false });
    }
    const candidate = viewFor(s, 'A').declarationCandidates.find(c => c.choice.cardInstanceId === card && c.choice.dedicated)!;
    expect(candidate).toMatchObject({ sourceZone: zone, abilities: [{ abilityId: GARWIN, effects: { far: true, effectAddition: 1, damageAddition: 2 } }] });
    expect(previewDeclarationCandidate(candidate, []).canDeclare).toBe(false);
    expect(previewDeclarationCandidate(candidate, [GARWIN])).toMatchObject({ canDeclare: true, legalTargetIds: ['B', 'C', 'D'], technique: { range: 'far', effectLevel: 6 } });
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: true, targetIds: ['B'], declarationAbilityIds: [GARWIN] });
    s = until(s, 'normal-defense');
    expect(viewFor(s, 'B').currentAttack!.technique).toMatchObject({ effectLevel: 6, damage: 14 });
    expect(source(s)).toMatchObject({ sourceZone: zone, cardInstanceId: card });
    s = finish(s);
    expect(discardIds(s).filter(id => id === card)).toHaveLength(1);
});
it('actual Fury fairy lower attack is warrior/bow and cannot select elemental magic package', () => {
    const s = ready();
    character(s, 'A', '妖精王フューリー');
    const card = handCard(s, 'A', '妖精族');
    rejected(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: true, targetIds: ['B'], declarationAbilityIds: [FURY] }, 'ABILITY_DISABLED');
    expect(viewFor(s, 'A').declarationCandidates.some(c => c.choice.cardInstanceId === card)).toBe(false);
});
it.each([
    ['白魔術師シェリム', 'c2-p01-r1c1-ab03'],
    ['魔導王ガイナス', 'c2-p05-r2c2-ab03'],
    ['妖精王フューリー', FURY],
    ['侍大将のシン', 'c2-p01-r2c1-ab02'],
] as const)('%s canceled chant waiver has no refund or later use window', (name, id) => {
    let s = ready();
    character(s, 'A', name);
    s.players.A!.permanent = { spirit: 10 };
    const card = handCard(s, 'A', id === 'c2-p01-r2c1-ab02' ? '天地百撃斬' : '烈火');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B'], declarationAbilityIds: [id] });
    s = closeWindow(s);
    s = cancel(s);
    s = finish(s);
    expect(discardIds(s)).toContain(card);
    expect(s.players.B!.damage).toBe(0);
    expect(s.phase).toBe('withdrawal');
});
it('Fury only offers its whole package on actual elemental magic, not elemental warrior or black magic', () => {
    let s = ready();
    character(s, 'A', '妖精王フューリー');
    for (const name of ['黒翼飛翔剣', '風斬剣', '呪殺']) {
        const card = handCard(s, 'A', name);
        expect(viewFor(s, 'A').declarationCandidates.some(c => c.choice.cardInstanceId === card && c.abilities.some(a => a.abilityId === FURY))).toBe(false);
    }
});
it('an accepted failed requisite still pays printed Apocalypse self-cost exactly once', () => {
    let s = ready();
    character(s, 'A', '白魔術師シェリム');
    s.players.A!.permanent = { endurance: 100 };
    const card = handCard(s, 'A', '滅界'), follower = handCard(s, 'A', '黒騎士団');
    s.players.A!.hand = s.players.A!.hand.filter(id => id !== follower);
    s.players.A!.followers.push({ cardInstanceId: follower, revealed: false });
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B'], declarationAbilityIds: ['c2-p01-r1c1-ab03'] });
    s = closeWindow(s);
    s = cancel(s);
    s = finish(s);
    expect(s.players.A!.damage).toBe(10);
    expect(s.players.A!.followers).toEqual([]);
    expect(discardIds(s).filter(id => id === follower)).toHaveLength(1);
    expect(discardIds(s).filter(id => id === card)).toHaveLength(1);
});
it('co-source waiver validates selected composed usage and preserves each source once', () => {
    let s = ready();
    character(s, 'A', '獣使いのウパニシャット');
    // Structural inheritance helper: no producer grants Upanishat these canonical source abilities.
    s.players.A!.abilityCharacterIds = ['c2-p05-r2c2'];
    s.players.A!.permanent = { warrior_level: 10, spirit: 10 };
    const card = handCard(s, 'A', '獣王剣'), component = handCard(s, 'A', '天地百撃斬');
    const command = { type: 'ATTACK', cardInstanceId: card, dedicated: true, targetIds: ['B'], coSource: { cardInstanceId: component, dedicated: false }, declarationAbilityIds: ['c2-p05-r2c2-ab03'] };
    const candidate = viewFor(s, 'A').declarationCandidates.find(c => c.choice.cardInstanceId === card && c.choice.coSource?.cardInstanceId === component)!;
    expect(candidate).toBeDefined();
    expect(previewDeclarationCandidate(candidate, ['c2-p05-r2c2-ab03']).canDeclare).toBe(true);
    s = act(s, 'A', command);
    s = until(s, 'normal-defense');
    expect(source(s)).toMatchObject({ fromChant: false, sourceZone: 'hand', coSource: { cardInstanceId: component, fromChant: false } });
    expect(viewFor(s, 'B').currentAttack!.technique).toMatchObject({ effectLevel: 6, damage: 17 });
    expect(s.rolls!.filter(r => r.purpose === 'activation')).toHaveLength(1);
    s = finish(s);
    for (const id of [card, component])
        expect(discardIds(s).filter(c => c === id)).toHaveLength(1);
});
it('a successful first Shin check cannot survive source disable before the second resolves', () => {
    let s = ready();
    character(s, 'B', '侍大将のシン');
    s.players.B!.permanent = { spirit: 10 };
    const card = handCard(s, 'B', '天地百撃斬'), incoming = handCard(s, 'A', '黒流弓');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
    s = until(s, 'normal-defense');
    s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: ['c2-p01-r2c1-ab01', 'c2-p01-r2c1-ab02'] });
    s = closeWindow(s);
    s = closeWindow(s);
    s = closeWindow(s, [1, 1]);
    s = closeWindow(s);
    expect(viewFor(s, 'B').declarationSelection!.abilities).toMatchObject([{ status: 'accepted' }, { status: 'resolving' }]);
    s.players.B!.statuses = [{ id: 'helper-disabled-between-checks', kind: 'ability-disabled', modifiers: [0], nextCheck: 0 }];
    s = finish(s);
    expect(s.players.B!.damage).toBe(10);
    expect(discardIds(s)).toContain(card);
});
it('Shin return retains converted-counter property and parent target provenance', () => {
    let s = ready();
    character(s, 'B', '侍大将のシン');
    s.players.B!.permanent = { spirit: 10 };
    const incoming = handCard(s, 'A', '黒流弓'), card = handCard(s, 'B', '天地百撃斬');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: false, targetIds: ['B'] });
    s = until(s, 'normal-defense');
    const parent = Object.values(s.groups!)[0]!.id;
    s = act(s, 'B', { type: 'PLAY_DEFENSE', cardInstanceId: card, dedicated: false, declarationAbilityIds: ['c2-p01-r2c1-ab01', 'c2-p01-r2c1-ab02'] });
    s = until(s, 'normal-defense');
    const returned = Object.values(s.groups!).find(g => g.attackerId === 'B')!;
    expect(returned).toMatchObject({ sourceCardInstanceIds: [card], technique: { counter: true, attributes: expect.arrayContaining(['反']) }, targets: [{ actorId: 'A' }] });
    expect(s.actions![returned.actionId]!.resume!.groupId).toBe(parent);
});
it('Vanmil magical turn techniques retain exact-ten numeric clause while target cardinality stays printed', () => {
    let s = ready();
    character(s, 'A', '破壊神ヴァンミール');
    const card = handCard(s, 'A', '封傷');
    s.players.A!.damage = 5;
    const candidate = viewFor(s, 'A').declarationCandidates.find(c => c.choice.cardInstanceId === card)!;
    expect(candidate).toMatchObject({ kind: 'turn-technique', abilities: [{ effects: { waiveChant: true, effectReplacement: 10 } }] });
    expect(candidate.abilities[0]!.effects.allTargets).toBeUndefined();
    rejected(s, 'A', { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: card, dedicated: false, targetIds: ['A', 'B'], declarationAbilityIds: ['c2-p07-r1c2-ab02'] }, 'INVALID_TARGET');
    s = act(s, 'A', { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: card, dedicated: false, targetIds: ['A'], declarationAbilityIds: ['c2-p07-r1c2-ab02'] });
    s = until(s, 'damage');
    expect(viewFor(s, 'A').actionCalculation).toMatchObject({ effectLevel: 10, damage: null });
    s = finish(s);
    expect(s.players.A!.damage).toBe(0);
});
it('actual Shelim unchanted revival selects waiver but cannot enlarge printed one-dead-target use', () => {
    let s = ready();
    character(s, 'A', '白魔術師シェリム');
    s.players.A!.permanent = { spirit: 10 };
    const card = handCard(s, 'A', '復活');
    // Dead recipients are structural fixtures; revival itself goes through the actual command/lifecycle.
    s.players.B!.presence = 'dead';
    s.players.C!.presence = 'dead';
    rejected(s, 'A', { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: card, dedicated: false, targetIds: ['B', 'C'], declarationAbilityIds: ['c2-p01-r1c1-ab03'] }, 'INVALID_TARGET');
    s = act(s, 'A', { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: card, dedicated: false, targetIds: ['B'], declarationAbilityIds: ['c2-p01-r1c1-ab03'] });
    s = finish(s);
    expect(s.players.B!.presence).toBe('wandering');
    expect(s.players.C!.presence).toBe('dead');
    expect(discardIds(s)).toContain(card);
});
it('Yotsurm reflected attack copies original fixed numeric values once without replaying declaration choices', () => {
    let s = ready();
    character(s, 'A', '餓狼ヨーツルム');
    character(s, 'B', '餓狼ヨーツルム');
    s.distances.A!.B = s.distances.B!.A = 'near';
    const card = handCard(s, 'A', '踏み込み／蹴る'), guard = handCard(s, 'B', '王立騎士団');
    s.players.B!.hand = s.players.B!.hand.filter(id => id !== guard);
    s.players.B!.followers.push({ cardInstanceId: guard, revealed: false });
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['B'], declarationAbilityIds: ['c2-p06-r2c2-ab02'] });
    s = until(s, 'follower-start');
    for (let n = 0; n < 80 && Object.keys(s.groups!).length < 2; n++)
        s = pass(s);
    const reflected = Object.values(s.groups!).find(g => g.attackerId === 'B')!;
    expect(reflected).toMatchObject({ sourceCardInstanceIds: [card], technique: { effectLevel: 2, damage: 3, range: 'near' } });
    expect(s.actions![reflected.actionId]).toMatchObject({ fixedReceivedEffect: true, cardInstanceId: guard, effectSourceCardInstanceId: card });
    expect(s.actions![reflected.actionId]!.declaration).toBeUndefined();
    for (const actor of ['A', 'B'])
        s.players[actor]!.statuses = [{ id: 'helper-after-reflect', kind: 'ability-disabled', modifiers: [0], nextCheck: 0 }];
    s = finish(s);
    expect(s.players.A!.damage).toBe(3);
    expect(s.players.B!.damage).toBe(0);
});
it('composed actual chant origin comes from component even when helper primary zone is chant', () => {
    const s = ready();
    character(s, 'A', '獣使いのウパニシャット');
    s.players.A!.abilityCharacterIds = ['c2-p05-r2c2'];
    s.players.A!.permanent = { warrior_level: 10 };
    const card = handCard(s, 'A', '獣王剣'), component = handCard(s, 'A', '天地百撃斬');
    // No primary BeastSword chant producer exists. This isolates source-zone provenance structurally.
    s.players.A!.hand = s.players.A!.hand.filter(id => id !== card);
    s.players.A!.chants.push({ cardInstanceId: card, revealed: false });
    const declared = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: true, targetIds: ['B'], coSource: { cardInstanceId: component, dedicated: false }, declarationAbilityIds: ['c2-p05-r2c2-ab03'] });
    expect(source(declared)).toMatchObject({ sourceZone: 'chant', fromChant: false, coSource: { cardInstanceId: component, fromChant: false } });
});
it('actual Shadow grant keeps one target even with helper-inherited all-target and waiver packages', () => {
    let s = ready();
    character(s, 'A', '黒妖精のアーネス');
    character(s, 'B', '忍びのイダ');
    s.players.B!.abilityCharacterIds = ['c2-p05-r2c2'];
    s.players.B!.permanent = { spirit: 10 };
    const incoming = handCard(s, 'A', '黒流弓'), card = handCard(s, 'B', '天地百撃斬');
    s = act(s, 'A', { type: 'ATTACK', cardInstanceId: incoming, dedicated: true, targetIds: ['B', 'C'] });
    s = until(s, 'normal-defense');
    const parent = Object.values(s.groups!)[0]!.id;
    const shadow = viewFor(s, 'B').abilityOptions.find(a => a.abilityId === 'c2-p04-r2c2-ab01')!;
    s = act(s, 'B', { type: 'USE_ABILITY', abilityId: shadow.abilityId, targetEventId: shadow.targetEventId });
    s = closeWindow(s);
    s = closeWindow(s, [1, 1]);
    s = closeWindow(s);
    s = closeWindow(s, [6, 6]);
    s = closeWindow(s);
    expect(s.windows!.at(-1)!.kind).toBe('ability-attack');
    s = act(s, 'B', { type: 'REVEAL_CHARACTER' });
    const ids = ['c2-p05-r2c2-ab03', 'c2-p05-r2c2-ab04'];
    const candidate = viewFor(s, 'B').declarationCandidates.find(c => c.choice.cardInstanceId === card && !c.choice.dedicated)!;
    expect(previewDeclarationCandidate(candidate, ids)).toMatchObject({ canDeclare: true, legalTargetIds: ['A'], technique: { target: 'all' } });
    rejected(s, 'B', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['A', 'C'], declarationAbilityIds: ids }, 'INVALID_TARGET');
    s = act(s, 'B', { type: 'ATTACK', cardInstanceId: card, dedicated: false, targetIds: ['A'], declarationAbilityIds: ids });
    s = until(s, 'normal-defense');
    const child = Object.values(s.groups!).find(g => g.attackerId === 'B')!;
    expect(child.targets.map(t => t.actorId)).toEqual(['A']);
    expect(s.groups![parent]!.targets[0]!.hits[0]!.defended).toBe(true);
    s = finish(s);
    expect(discardIds(s).filter(id => id === card)).toHaveLength(1);
});
it('selected Beast check waiver includes a composed native activation check but not character ability checks', () => {
    const s = ready();
    character(s, 'A', '獣使いのウパニシャット');
    s.players.A!.abilityCharacterIds = ['c2-p06-r2c2'];
    s.players.A!.permanent = { warrior_level: 10 };
    s.distances.A!.B = s.distances.B!.A = 'near';
    const card = handCard(s, 'A', '獣王剣'), component = handCard(s, 'A', '死鬼旋風脚');
    let declared = act(s, 'A', { type: 'ATTACK', cardInstanceId: card, dedicated: true, targetIds: ['B'], coSource: { cardInstanceId: component, dedicated: false }, declarationAbilityIds: ['c2-p06-r2c2-ab02'] });
    // Structural activation clause: no currently printed martial component carries this check.
    source(declared).declaration!.base.activationCheckModifier = -2;
    declared = until(declared, 'normal-defense');
    expect((declared.rolls ?? []).filter(r => r.purpose === 'activation' || r.purpose === 'excess-level')).toHaveLength(0);
});

it.each([['地槍','地',4],['風矢','風',4],['氷矢','水',4],['炎矢','炎',4]] as const)('Fury actual %s %s magic level %s permits the elemental election',(name,attribute,level)=>{
 for(const selected of [false,true]){
  let s=ready();character(s,'A','妖精王フューリー');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
  const card=handCard(s,'A',name);const candidate=viewFor(s,'A').declarationCandidates.find(c=>c.choice.cardInstanceId===card&&!c.choice.dedicated)!;
  expect(candidate.abilities.some(a=>a.abilityId===FURY)).toBe(true);
  s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false,declarationAbilityIds:selected?[FURY]:[]});s=until(s,'normal-defense');
  expect(Object.values(s.groups!)[0]!.technique).toMatchObject({school:'magic',attributes:expect.arrayContaining([attribute]),useLevel:level,effectLevel:level+(selected?1:0)});
  s=finish(s);expect(s.players.B!.damage).toBeGreaterThan(0);expect(discardIds(s).filter(id=>id===card)).toHaveLength(1);
 }
});
