import { expect, it } from 'vitest';
import { actionCards } from '@madou/catalog';
import { transition, viewFor, type GameState } from '../src/index.js';
import { followerFor } from '../src/effects/registry.js';
import { act, ready, until, finish, pass, closeWindow } from './combat-helpers.js';
import { character, handCard, entropy } from './fixtures.js';
function place(s: GameState, owner: string, name: string) { const id = handCard(s, owner, name); s.players[owner]!.hand = s.players[owner]!.hand.filter(x => x !== id); s.players[owner]!.followers.push({ cardInstanceId: id, revealed: false }); return id; }
function attack(s: GameState, name = '踏み込み／弓', targets = ['B']) { const id = handCard(s, 'A', name); return until(act(s, 'A', { type: 'ATTACK', cardInstanceId: id, targetIds: targets, dedicated: false }, Array(30).fill(1)), 'normal-defense'); }
it('F31 forbids voluntary removal but allows reordering with exact physical conservation', () => { let s = ready(); const saint = place(s, 'A', '闇の聖女'); const soldier = place(s, 'A', '兵士'); expect(transition(s, { actorId: 'A', command: { type: 'ARRANGE_FOLLOWERS', cardInstanceIds: [soldier] } }, entropy())).toEqual({ ok: false, code: 'FOLLOWER_RESTRICTED' }); s = act(s, 'A', { type: 'ARRANGE_FOLLOWERS', cardInstanceIds: [soldier, saint] }); expect(s.players.A!.followers.map(f => f.cardInstanceId)).toEqual([soldier, saint]); });
it('explicit own griffon dedication waives morale, omitted choice does not', () => { for (const dedicated of [false, true]) {
    let s = ready();
    character(s, 'B', '獣使いのウパニシャット');
    const id = place(s, 'B', 'グリフォン');
    s = attack(s);
    s = act(s, 'B', { type: 'START_FOLLOWERS', ...(dedicated ? { dedicatedCardInstanceIds: [id] } : {}) });
    s = finish(s);
    expect(s.rolls?.filter(r => r.purpose === 'follower-morale').length ?? 0).toBe(dedicated ? 0 : 1);
} });
it.each([['有翼族', -1], ['小人族', -2], ['親衛隊', -2], ['デス・ナイト', -2], ['守護者', -1]] as const)('%s uses exact printed morale modifier %i', (name, modifier) => { let s = ready(); place(s, 'B', name); s = finish(attack(s)); expect(s.rolls!.find(r => r.purpose === 'follower-morale')!.modifier).toBe(modifier); });
it('Royal guard reflects a reached warrior hit without moving its physical source or recording paid use', () => { let s = ready(); const id = place(s, 'B', '王立騎士団'); s = attack(s); s = until(s, 'follower-start'); while (Object.keys(s.groups ?? {}).length < 2 && s.windows?.length)
    s = pass(s); expect(Object.keys(s.groups ?? {})).toHaveLength(2); for (const saved of [s, JSON.parse(JSON.stringify(s)) as GameState]) {
        expect(viewFor(saved, 'A').currentAction).toMatchObject({ source: 'follower', kind: 'follower-reflection', cardInstanceId: id, technique: { effectLevel: 3, damage: 4 } });
    } expect(s.players.B!.followers).toContainEqual({ cardInstanceId: id, revealed: true }); expect(s.resolution).not.toContain(id); expect(s.used?.some(k => k.endsWith(':' + id))).toBe(false); s = finish(s); expect(s.players.A!.damage).toBe(4); expect(s.players.B!.damage).toBe(0); });
it('spirit passes wood golem without destroying it or spending its HP', () => { let s = ready(); character(s, 'A', '白魔術師シェリム'); const id = place(s, 'B', 'ウッドゴーレム'); s = finish(attack(s, actionCards.find(c => c.id === 'a2-p16-r2c1')!.name)); expect(s.players.B!.followers.map(f => f.cardInstanceId)).toContain(id); expect(s.players.B!.damage).toBeGreaterThan(0); });
it('skeleton revives at its equal-level upper-bound defense', () => { let s = ready(); const id = place(s, 'B', 'スケルトン'); s = finish(attack(s)); expect(s.players.B!.followers.map(f => f.cardInstanceId)).toContain(id); expect(s.players.B!.damage).toBe(0); });
it('Magic Gate spends declaration and inserts a hidden follower without leaking its bound identity', () => { let s = ready(); character(s, 'A', '白魔術師シェリム'); const id = place(s, 'B', '兵士'); const gate = handCard(s, 'A', '魔招門'); s = act(s, 'A', { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: gate, targetIds: ['B'], dedicated: false, followerTransfer: { targetPosition: 0, destinationPosition: 0 } }); expect(JSON.stringify(viewFor(s, 'A'))).not.toContain(id); s = finish(s); expect(s.players.A!.followers).toContainEqual({ cardInstanceId: id, revealed: false }); expect(s.players.B!.followers).toEqual([]); expect(s.discard).toContain(gate); expect(s.phase).toBe('hand-adjustment'); });
it.each(actionCards.filter(c => c.category === 'follower'))('all40 descriptor retains exact printed base stats for $name', card => { const d = followerFor(card.id)!; expect(d.level).toBe(card.stats!.follower_level); expect(d.hp).toBe(card.stats!.hp); expect(d.attributes).toEqual(card.stats!.attributes); });
it.each(actionCards.filter(c => c.category === 'follower'))('real final defense traverses $name using printed stats, morale and physical survival', card => {
    let s = ready();
    if (card.name === 'アルケミア城')
        s.players.B!.faction = 'GOOD';
    const id = place(s, 'B', card.name);
    s = finish(attack(s));
    const printed = card.stats!;
    const level = printed.follower_level as number;
    const hp = printed.hp as number;
    expect(s.players.B!.damage).toBe(level < 3 ? Math.max(0, 4 - hp) : 0);
    const survives = level > 3 || card.name === 'スケルトン';
    expect(s.players.B!.followers.some(f => f.cardInstanceId === id)).toBe(survives);
    expect(s.rolls?.filter(r => r.purpose === 'follower-morale').length ?? 0).toBe(card.printed_text.includes('攻撃を受けたとき精神力') ? 1 : 0);
});
it.each([
    ['小悪魔', '氷矢', 5], ['小天使', '氷矢', 5], ['闇の聖女', '氷矢', 6], ['妖精族', '氷矢', 6], ['天使', '氷矢', 7], ['地竜', '氷矢', 7],
    ['竜王教団', '白光', 7], ['竜王教団', '氷矢', 5], ['守護者', '妖獣', 8], ['守護者', '氷矢', 7], ['炎竜', '炎矢', 7], ['飛竜', '風矢', 7],
] as const)('%s freezes its exact conditional level against %s', (follower, technique, level) => { let s = ready(); character(s, 'A', '白魔術師シェリム'); place(s, 'B', follower); s = attack(s, technique); s = until(s, 'follower-start'); expect(Object.values(s.groups!)[0]!.targets[0]!.followerDefense![0]!.levels).toEqual([level]); s = finish(s); });
it.each([
    ['グリフォン', '獣使いのウパニシャット', 5], ['ガイナス城', '占星術師のアルセイル', 6], ['王立騎士団', 'リーア姫', 5], ['有翼族', '有翼人のティア', 7],
    ['女性親衛隊', '黒妖精のアーネス', 5], ['小人族', '小人のランバ', 5], ['竜王教団', '邪祭ウーノス', 6], ['悪魔', '邪祭ウーノス', 6],
    ['親衛隊', 'リーア姫', 6], ['天使', '白魔術師シェリム', 6], ['天使', 'リーア姫', 6], ['飛竜', '竜皇子アスフェルト', 6], ['デス・ナイト', '不死王ガドューラ', 7], ['守護者', 'リーア姫', 7],
] as const)('explicit %s package belongs to canonical %s', (follower, owner, level) => {
    let s = ready();
    character(s, 'B', owner);
    const id = place(s, 'B', follower);
    s = attack(s);
    expect(viewFor(s, 'B').followerDefenseOptions).toEqual([{ cardInstanceId: id }]);
    expect(viewFor(s, 'A').followerDefenseOptions).toEqual([]);
    s = act(s, 'B', { type: 'START_FOLLOWERS', dedicatedCardInstanceIds: [id] });
    s = until(s, 'follower-start');
    expect(Object.values(s.groups!)[0]!.targets[0]!.followerDefense![0]!.levels).toEqual([level]);
    s = finish(s);
    expect(s.rolls?.filter(r => r.purpose === 'follower-morale').length ?? 0).toBe(0);
});
it('Uonos white-magic seven overrides dedicated six before Blessing additive bonus', () => { let s = ready(); character(s, 'A', '白魔術師シェリム'); character(s, 'B', '邪祭ウーノス'); const f = place(s, 'B', '竜王教団'); const blessing = handCard(s, 'B', '祝福'); s.players.B!.hand = s.players.B!.hand.filter(id => id !== blessing); s.players.B!.open.push(blessing); s = attack(s, '白光'); s = act(s, 'B', { type: 'START_FOLLOWERS', dedicatedCardInstanceIds: [f] }); s = until(s, 'follower-start'); expect(Object.values(s.groups!)[0]!.targets[0]!.followerDefense![0]!.levels).toEqual([8]); s = finish(s); });
it('dedication rejects unsupported, stale, duplicate and foreign sources without changing state', () => { let s = ready(); character(s, 'B', 'リーア姫'); const f = place(s, 'B', '王立騎士団'); const rear = place(s, 'B', '兵士'); const foreign = place(s, 'C', '天使'); s = attack(s); for (const ids of [[f, f], [rear], [foreign], ['a2-p23-r1c1']]) {
    const before = JSON.stringify(s);
    expect(transition(s, { actorId: 'B', command: { type: 'START_FOLLOWERS', dedicatedCardInstanceIds: ids } }, entropy()).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
} });
it('stopped ability-disabled owner can use placed dedicated defense while hand defense stays prohibited', () => { let s = ready(); character(s, 'B', '有翼人のティア'); const id = place(s, 'B', '有翼族'); s.players.B!.statuses = [{ id: 'stop', kind: 'stopped', modifiers: [0], nextCheck: 0 }, { id: 'disable', kind: 'ability-disabled', modifiers: [0], nextCheck: 0 }]; s = attack(s); expect(viewFor(s, 'B').legalChoices).not.toContain('PLAY_DEFENSE'); s = act(s, 'B', { type: 'START_FOLLOWERS', dedicatedCardInstanceIds: [id] }); s = finish(s); expect(s.players.B!.damage).toBe(0); expect(s.rolls?.filter(r => r.purpose === 'follower-morale').length ?? 0).toBe(0); });
it.each(['歌う船', '有翼族'])('%s nullifies only its owner reached earth-magic hit', name => { let s = ready(); character(s, 'A', '白魔術師シェリム'); place(s, 'B', name); s = finish(attack(s, '地裂', ['B', 'C'])); expect(s.players.B!.damage).toBe(0); expect(s.players.C!.damage).toBe(8); });
it('rear ignore cancellation protects the entire column and caches one morale roll', () => { let s = ready(); const front = place(s, 'B', '砦'); const rear = place(s, 'B', '親衛隊'); s = attack(s, '気斬'); s = until(s, 'follower-start'); s = closeWindow(s); expect(s.players.B!.followers.find(f => f.cardInstanceId === rear)!.revealed).toBe(true); expect(s.players.B!.followers.find(f => f.cardInstanceId === front)!.revealed).toBe(false); s = finish(s); expect(s.players.B!.damage).toBe(0); expect(s.rolls!.filter(r => r.purpose === 'follower-morale')).toHaveLength(1); expect(s.discard).toContain(front); });
it('failed rear ignore source adds no HP reduction and cannot cancel bypass', () => { let s = ready(); const front = place(s, 'B', '砦'); const rear = place(s, 'B', '親衛隊'); s = until(attack(s, '気斬'), 'follower-start'); s = closeWindow(s); s = closeWindow(s, [6, 6]); s = closeWindow(s); s = finish(s); expect(s.players.B!.damage).toBe(8); expect(s.discard).toContain(rear); expect(s.players.B!.followers).toContainEqual({ cardInstanceId: front, revealed: false }); });
it.each([false, true])('Arnes women guard ignore cancellation is explicit selected=%s', selected => { let s = ready(); character(s, 'B', '黒妖精のアーネス'); const f = place(s, 'B', '女性親衛隊'); s = attack(s, '気斬'); s = act(s, 'B', { type: 'START_FOLLOWERS', dedicatedCardInstanceIds: selected ? [f] : [] }); s = finish(s); expect(s.players.B!.damage).toBe(selected ? 4 : 8); expect(s.players.B!.followers.some(card => card.cardInstanceId === f)).toBe(!selected); });
it('follower choice does not reveal unused dedicated rear IDs or create a morale roll', () => { let s = ready(); character(s, 'B', 'リーア姫'); place(s, 'B', '城'); const rear = place(s, 'B', '王立騎士団'); s = attack(s); s = act(s, 'B', { type: 'START_FOLLOWERS', dedicatedCardInstanceIds: [rear] }); s = finish(s); expect(JSON.stringify(viewFor(s, 'A'))).not.toContain(rear); expect(s.rolls?.filter(r => r.purpose === 'follower-morale').length ?? 0).toBe(0); });
it('real Uonos transformation immediately discards the now-incompatible Gainas castle',()=>{let s=ready();character(s,'A','邪祭ウーノス');const castle=place(s,'A','ガイナス城');handCard(s,'A','復活の儀式');s=act(s,'A',{type:'USE_REVIVAL_RITUAL'});s=closeWindow(s);expect(s.players.A!.faction).toBe('ヴァンミール');expect(s.players.A!.followers).toEqual([]);expect(s.discard).toContain(castle);});
it.each([['アルケミア城','白魔術師シェリム','ガイナス城'],['ガイナス城','黒騎士ガーウィン','アルケミア城']])('real FuSen revival re-setup applies the same %s placement predicate', (valid,owner,invalid)=>{
 let s=ready();character(s,'B',owner!);s.players.B!.presence='dead';s.phase='draw';const fusen=handCard(s,'A',actionCards.find(c=>c.id==='a2-p01-r1c1')!.name);s.players.A!.hand=s.players.A!.hand.filter(id=>id!==fusen);s.deck.unshift(fusen);s=act(s,'A',{type:'CHOOSE_DRAW',draw:true});s=closeWindow(s,[1]);s=closeWindow(s);s=act(s,'B',{type:'CHOOSE_REVIVAL',revive:true});expect(s.windows!.at(-1)!.kind).toBe('re-setup');const bad=handCard(s,'B',invalid!);expect(transition(s,{actorId:'B',command:{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:bad}},entropy())).toEqual({ok:false,code:'FOLLOWER_RESTRICTED'});const good=handCard(s,'B',valid!);s=act(s,'B',{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:good});expect(s.players.B!.followers.map(f=>f.cardInstanceId)).toContain(good);s=act(s,'B',{type:'PASS_SETUP'});
});
