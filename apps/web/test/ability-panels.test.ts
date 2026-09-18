import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlayerView } from '@madou/engine';
import { expect, test } from 'vitest';
import { AbilityPanel } from '../src/game/AbilityPanel.js';
import { ActionSummary } from '../src/game/ActionSummary.js';
import { DispelFields, withDispel } from '../src/game/DispelFields.js';
import { SadLovePanel } from '../src/game/SadLovePanel.js';
import { techniqueFor } from '../../../packages/engine/src/effects/registry.js';

const render = (view: Partial<PlayerView>) => renderToStaticMarkup(createElement(AbilityPanel, { view: view as PlayerView, disabled: false, send: () => true }));
test('targeted turn ability shows offered public names and main action cost before submission', () => {
  const html = render({ self: { id: 'A', hand: [], chants: [], followers: [] }, players: { B: { name: '楓', presence: 'active' }, C: { name: '凛', presence: 'active' } }, activeWindow: null,
    legalChoices: ['USE_ABILITY'], abilityOptions: [{ abilityId: 'c2-p04-r1c1-ab04', name: '双子', targetEventId: 'turn-9', targetIds: ['B'], actionCost: 'main', description: '手札全体を交換します。' }] } as unknown as PlayerView);
  expect(html).toContain('能力の対象');
  expect(html).toContain('<option value="B">楓</option>');
  expect(html).not.toContain('<option value="C">');
  expect(html).toContain('通常の行動を使います');
  expect(html).toMatch(/<button disabled="">双子を使う/);
});
test('ability controls use only offered private options and never duplicate lifecycle adapters', () => {
  const view = { self: { id: 'A', hand: [], chants: [], followers: [] }, players: {}, activeWindow: null, currentAction: null,
    legalChoices: ['USE_ABILITY'], abilityOptions: [{ abilityId: 'c2-p04-r2c2-ab03', name: '必殺', targetEventId: 'hit-3' }] } as unknown as PlayerView;
  const html = render(view);
  expect(html).toContain('必殺を使う'); expect(html).toContain('1と6は連続に含みません');
  expect(html).not.toContain('USE_ABILITY'); expect(html).not.toContain('影分身');
  expect(render({ ...view, abilityOptions: [] })).toBe('');
  expect(render({ ...view, legalChoices: ['USE_ABILITY', 'USE_LIFECYCLE_ABILITY'], abilityOptions: [{ abilityId: 'c2-p02-r2c2-ab05', name: '姫への愛', targetEventId: 'event-3' }] })).toBe('');
});
test('own-action hiding requires an explicit cost choice and does not preselect concealment', () => {
  const html = render({ self: { id: 'A', hand: ['a2-p07-r3c1'], chants: [], followers: [] }, players: {}, activeWindow: null, currentAction: null, legalChoices: ['USE_ABILITY'],
    abilityOptions: [{ abilityId: 'c2-p04-r2c2-ab04', name: '隠行', targetEventId: 'turn-3', costCardInstanceIds: ['a2-p07-r3c1'], canConceal: true }] } as unknown as PlayerView);
  expect(html).toContain('消費する間合い'); expect(html).toContain('正体を裏に戻す');
  expect(html).toContain('disabled=""'); expect(html).not.toContain('checked=""');
});
test('additional attack renders honest grant provenance and only authoritative source modes', () => {
  const base = {
    self: { id: 'A', characterId: 'c2-p04-r2c2', hand: ['a2-p08-r1c1', 'a2-p08-r3c1'], chants: [], followers: [] },
    players: { A: { name: '葵', presence: 'active' }, B: { name: '楓', presence: 'active' } },
    activeWindow: { kind: 'ability-attack', pendingActorId: 'A' }, currentAction: null,
    legalChoices: ['ATTACK', 'PASS'], abilityOptions: [], combinationOptions: [], advanceCostOptions: [],
    additionalAttack: { source: 'card' as const, actorId: 'A', targetId: 'B', sourceCardInstanceId: 'a2-p08-r3c2' },
    additionalAttackOptions: [{ cardInstanceId: 'a2-p08-r1c1', dedicated: false }],
  } as unknown as PlayerView;
  const printed = render(base);
  expect(printed).toContain('aria-label="影分身による追加攻撃"');
  expect(printed).toContain('影分身による追加攻撃を選ぶ');
  expect(printed).toContain('黒翼飛翔剣');
  expect(printed).not.toContain('裏天空剣');
  expect(printed).toContain('専用技として使う');
  expect(printed).toMatch(/専用技として使う<\/label>/);
  expect(printed).toMatch(/type="checkbox" disabled=""/);

  const placed = render({ ...base, self: { ...base.self, hand: [], followers: [{ cardInstanceId: 'a2-p20-r3c1', revealed: false }] }, additionalAttackOptions: [{ cardInstanceId: 'a2-p20-r3c1', dedicated: true }] });
  expect(placed).toContain('グリフォン（配置中）');
  expect(placed).not.toContain('checked');
  const ability = render({ ...base, additionalAttack: { source: 'ability' as const, actorId: 'A', targetId: 'B' } });
  expect(ability).toContain('aria-label="能力による追加攻撃"');
  expect(ability).not.toContain('影分身による追加攻撃');

  const empty = render({ ...base, additionalAttackOptions: [] });
  expect(empty).not.toContain('黒翼飛翔剣');
  expect(empty).not.toContain('裏天空剣');
  expect(empty).toMatch(/<button disabled="">追加攻撃を行う<\/button>/);
});
test('concealed ability summary trusts only the projected generic label and omits physical technique fields', () => {
  const html = renderToStaticMarkup(createElement(ActionSummary, { action: { source: 'ability', kind: 'ability', actionId: 'opaque-use-4', actorId: 'A', targetIds: ['B'], stage: 'declaration', label: '特殊能力' }, names: { A: '葵', B: '楓' } }));
  expect(html).toContain('特殊能力'); expect(html).toContain('楓');
  expect(html).not.toContain('射程'); expect(html).not.toContain('使用値'); expect(html).not.toContain('イダ');
});

test('numeric before-roll renders no reaction card action while retaining pass and legal later modes', async () => {
  const { ReactionPanel } = await import('../src/game/ReactionPanel.js');
  const renderReaction = (windowKind: 'before-roll' | 'after-roll', rollKind: 'numeric' | 'check') => {
    const view = { self: { id: 'A', characterId: 'c2-p04-r2c2', hand: ['a2-p02-r2c3', 'a2-p02-r1c3'], chants: [], followers: [] },
      players: { A: { name: '葵', statuses: [] } }, activeWindow: { windowId: 'reaction-window', kind: windowKind, pendingActorId: 'A', reason: windowKind },
      currentRoll: { kind: rollKind }, currentAttack: null, lifecycleDecision: null, lifetimeDecision: null,
      reactionTargetRollId: 'roll-7', reactionTargetAbilityId: null, reactionTargetActionId: null,
      legalChoices: ['PASS', 'PLAY_REACTION'] } as unknown as PlayerView;
    return renderToStaticMarkup(createElement(ReactionPanel, { view, disabled: false, send: () => true }));
  };
  const before = renderReaction('before-roll', 'numeric');
  expect(before).toContain('パス');
  expect(before).not.toContain('割り込みを使う');
  expect(before).not.toContain('使うカード');
  expect(before).not.toContain('PLAY_REACTION');
  const after = renderReaction('after-roll', 'numeric');
  expect(after).toContain('割り込みを使う');
  expect(after).toContain('神性介入');
  expect(after).not.toContain('命運凶変');
  const check = renderReaction('before-roll', 'check');
  expect(check).toContain('割り込みを使う');
  expect(check).toContain('命運凶変');
  expect(check).toContain('強制失敗');
  expect(check).not.toContain('神性介入');
});

test('normal defense options do not borrow a declaration candidate from dedicated mode', async () => {
  const { ReactionPanel } = await import('../src/game/ReactionPanel.js');
  const cardInstanceId = 'a2-p14-r1c2';
  const incomingTechnique = { ...techniqueFor('a2-p10-r1c1')!, effectLevel: 5 };
  const view = {
    self: { id: 'B', characterId: 'c2-p01-r1c1', hand: [cardInstanceId], chants: [], followers: [] },
    players: { B: { name: '楓', statuses: [] } },
    activeWindow: { windowId: 'defense-window', kind: 'normal-defense', pendingActorId: 'B', reason: 'normal-defense' },
    currentRoll: null,
    currentAttack: { technique: incomingTechnique, defenseRestrictions: { maaiProhibited: false, evadeProhibited: false, counterProhibited: false } },
    lifecycleDecision: null, lifetimeDecision: null, techniqueDecision: null,
    reactionTargetRollId: null, reactionTargetAbilityId: null, reactionTargetActionId: null,
    legalChoices: ['PASS', 'PLAY_DEFENSE'],
    declarationCandidates: [{
      kind: 'defense', choice: { cardInstanceId, dedicated: true }, sourceZone: 'hand', fromChant: false,
      technique: techniqueFor(cardInstanceId, '白魔術師シェリム', true)!, incomingTechnique,
      abilities: [{ abilityId: 'c2-p01-r1c1-ab03', name: '大魔術師', effects: { waiveChant: true } }],
      targetIds: [], nearTargetIds: [],
    }],
  } as unknown as PlayerView;
  const html = renderToStaticMarkup(createElement(ReactionPanel, { view, disabled: false, send: () => true }));
  expect(html).not.toContain(`value="${cardInstanceId}"`);
});

test('each ability without an offered description falls back to its own printed explanation', () => {
  const fallbacks: Record<string, string> = {
    'c2-p04-r1c2-ab02': 'ダメージ2倍', 'c2-p04-r2c2-ab01': 'この攻撃を無効にし',
    'c2-p04-r2c2-ab02': 'この格闘技で従者を無視します。', 'c2-p06-r2c2-ab01': '精神力−2の判定に成功すると',
  };
  for (const [abilityId, fragment] of Object.entries(fallbacks)) {
    const html = render({ self: { id: 'A', hand: [], chants: [], followers: [] }, players: {}, activeWindow: null, currentAction: null,
      legalChoices: ['USE_ABILITY'], abilityOptions: [{ abilityId, name: '能力', targetEventId: 'hit-2' }] } as unknown as PlayerView);
    expect(html).toContain(fragment);
    expect(html).not.toContain('この能力の使用を宣言します。');
  }
  const offered = render({ self: { id: 'A', hand: [], chants: [], followers: [] }, players: {}, activeWindow: null, currentAction: null,
    legalChoices: ['USE_ABILITY'], abilityOptions: [{ abilityId: 'c2-p04-r2c2-ab02', name: '忍び', targetEventId: 'hit-2', description: '公開された説明' }] } as unknown as PlayerView);
  expect(offered).toContain('公開された説明');
  expect(offered).not.toContain('この格闘技で従者を無視します。');
});

test('printed component and All-Army parents replace the technique lines with their own confirmation notice', () => {
  const summary = (cardInstanceId: string) => renderToStaticMarkup(createElement(ActionSummary, {
    action: { source: 'card', kind: 'attack', actionId: 'act-1', actorId: 'A', targetIds: ['B'], stage: 'declaration', cardInstanceId,
      technique: { school: 'warrior', attributes: ['近', '戦'], range: 'near', useLevel: 3, effectLevel: 3, damage: 4 } } as never,
    names: { A: '葵', B: '楓' },
  }));
  expect(summary('a2-p05-r2c2')).toContain('全軍突撃の使用を確認しています。');
  for (const component of ['a2-p05-r1c3', 'a2-p05-r2c1']) {
    expect(summary(component)).toContain('複合札の使用を確認しています。');
    expect(summary(component)).not.toContain('全軍突撃');
  }
  for (const cardInstanceId of ['a2-p05-r2c2', 'a2-p05-r1c3', 'a2-p05-r2c1']) expect(summary(cardInstanceId)).not.toContain('使用値 3');
  expect(summary('a2-p10-r1c1')).toContain('使用値 3');
});

test('the dispel source is attached only for a chosen owned target and is offered only while held', () => {
  const attack = { type: 'ATTACK' as const, cardInstanceId: 'a2-p10-r1c1', targetIds: ['B', 'C'], dedicated: false };
  expect(withDispel(attack, ['a2-p02-r3c1'], 'B')).toEqual({ ...attack, dispel: { cardInstanceId: 'a2-p02-r3c1', targetId: 'B' } });
  expect(withDispel(attack, ['a2-p02-r3c1'], 'D')).toEqual(attack);
  expect(withDispel(attack, ['a2-p02-r3c1'], '')).toEqual(attack);
  expect(withDispel(attack, [], 'B')).toEqual(attack);
  expect(withDispel(null, ['a2-p02-r3c1'], 'B')).toBeNull();
  const fields = (hand: string[]) => renderToStaticMarkup(createElement(DispelFields, { hand, targets: ['B'], names: { B: '楓' }, targetId: '', disabled: false, onChange: () => {} }));
  expect(fields(['a2-p02-r3c1'])).toContain('呪払の対象');
  expect(fields([])).toBe('');
});

function buttons(node: unknown, found: { label: string; onClick: (() => void) | undefined }[] = []): { label: string; onClick: (() => void) | undefined }[] {
  if (Array.isArray(node)) { for (const child of node) buttons(child, found); return found; }
  const element = node as { type?: unknown; props?: { children?: unknown; onClick?: () => void } } | null;
  if (!element || typeof element !== 'object' || !element.props) return found;
  if (element.type === 'button') found.push({ label: JSON.stringify(element.props.children), onClick: element.props.onClick });
  buttons(element.props.children, found);
  return found;
}

test('Sad Love sends its own ability id for both the continuous effect and one substitution', () => {
  const sent: { abilityId?: string; mode?: string; enabled?: boolean; hitIndex?: number }[] = [];
  const love = { auraEnabled: false, auraActive: false, canActivate: true, canDeactivate: false, targetEventId: 'turn-3', substitutionSpent: false,
    substitutions: [{ groupId: 'g1', targetId: 'B', hitIndex: 0 }] };
  const view = { sadLove: love, players: { B: { name: '楓' } } } as unknown as PlayerView;
  const html = renderToStaticMarkup(createElement(SadLovePanel, { view, disabled: false, send: () => true }));
  expect(html).toContain('悲しき愛の継続効果を使う');
  expect(html).toContain('楓への1発目を身代わりする');

  const controls = buttons(SadLovePanel({ view, disabled: false, send: command => sent.push(command as never) }));
  for (const control of controls) control.onClick?.();
  expect(sent).toEqual([
    { type: 'USE_ABILITY', abilityId: 'c2-p05-r1c2-ab05', mode: 'aura', enabled: true, targetEventId: 'turn-3' },
    { type: 'USE_ABILITY', abilityId: 'c2-p05-r1c2-ab05', mode: 'substitute', groupId: 'g1', targetId: 'B', hitIndex: 0 },
  ]);

  expect(renderToStaticMarkup(createElement(SadLovePanel, { view: { sadLove: null } as unknown as PlayerView, disabled: false, send: () => true }))).toBe('');
  expect(renderToStaticMarkup(createElement(SadLovePanel, { view: { ...view, sadLove: { ...love, substitutions: [] } } as unknown as PlayerView, disabled: false, send: () => true })))
    .not.toContain('身代わりする');
});
