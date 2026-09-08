import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { FollowerBundlePanel, FollowerBundleSourceFields } from '../src/game/FollowerBundlePanel.js';
import { FollowerBundleSummary } from '../src/game/FollowerBundleSummary.js';
import type { FollowerBundleSource } from '../src/game/follower-bundle-input.js';

const source: FollowerBundleSource = { cardInstanceId: 'a2-p20-r3c1', dedicated: false, sourceZone: 'followers', targetMode: 'one', legalTargetIds: ['B', 'C'],
  range: 'far', school: 'warrior', attributes: ['遠', '戦', '格'], useLevel: 5, effectLevel: 5, damage: 8, hitCount: 2, noChecks: false };
const names = { A: '葵', B: '楓', C: '凛' };
test('multiple follower attack begins without an ability or any paid card selected', () => {
  const view = { self: { id: 'A', hand: [], followers: [{ cardInstanceId: source.cardInstanceId }] }, legalChoices: ['USE_FOLLOWER_ATTACK'], activeWindow: null,
    followerBundleOptions: [{ abilityId: 'c2-p05-r1c2-ab02' as const, name: '獣使い', targetEventId: 'turn-1', sources: [source] }], players: { A: { name: '葵' }, B: { name: '楓' }, C: { name: '凛' } } };
  const html = renderToStaticMarkup(createElement(FollowerBundlePanel, { view, disabled: false, send: () => true }));
  expect(html).toContain('能力を選択'); expect(html).not.toContain('checked');
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>選んだ従者で攻撃する<\/button>/);
  expect(html).toContain('取り消されても');
});
test('each source owns a separate target radio group and dedication starts off', () => {
  const render = (id: string) => renderToStaticMarkup(createElement(FollowerBundleSourceFields, { option: { ...source, cardInstanceId: id }, choice: { cardInstanceId: id, dedicated: false, targetIds: [] },
    dedicatedAvailable: true, names, disabled: false, change: () => {} }));
  const first = render(source.cardInstanceId); const second = render('a2-p18-r3c3');
  expect(first).toContain(`name="follower-bundle-target-${source.cardInstanceId}"`); expect(second).toContain('name="follower-bundle-target-a2-p18-r3c3"');
  expect(first).toContain('グリフォン（配置中）'); expect(first).toContain('専用効果を使う'); expect(first).not.toContain('checked');
});
test('bundle summary preserves public technique values for preparing, failed and resolved sources', () => {
  const preparing = { ...source, targetIds: ['B'], stage: 'effect-level' as const,
    technique: { range: 'far', school: 'warrior', attributes: ['遠', '戦', '格'], useLevel: 5, effectLevel: 5, damage: null, hitCount: 3,
      calculation: { effectLevel: 'pending' as const, damage: 'pending' as const } } };
  const failed = { ...source, cardInstanceId: 'a2-p21-r2c1', sourceZone: 'hand' as const, targetIds: ['C'], stage: 'failed' as const,
    technique: { range: 'near', school: 'magic', attributes: ['近', '魔', '冷'], useLevel: 4, effectLevel: 7, damage: 2, hitCount: 2,
      calculation: { effectLevel: 'final' as const, damage: 'pending' as const } } };
  const resolved = { ...source, cardInstanceId: 'a2-p22-r2c2', sourceZone: 'hand' as const, targetIds: ['B', 'C'], stage: 'resolve' as const,
    technique: { range: 'far', school: 'magic', attributes: ['遠', '魔', '炎'], useLevel: 6, effectLevel: 8, damage: null, hitCount: 1,
      calculation: { effectLevel: 'final' as const, damage: 'final' as const } } };
  const html = renderToStaticMarkup(createElement(FollowerBundleSummary, { bundle: {
    bundleId: 'bundle-1', actorId: 'A', stage: 'prepare', currentSourceIndex: 0, sources: [preparing, failed, resolved],
  }, names }));
  const sourceHtml = (name: string) => html.split('<li').find(item => item.includes(`<strong>${name}</strong>`)) ?? '';
  const preparingHtml = sourceHtml('グリフォン');
  const failedHtml = sourceHtml('闇の聖女');
  const resolvedHtml = sourceHtml('炎竜');

  expect(preparingHtml).toContain('aria-current="step"'); expect(preparingHtml).toContain('現在の技');
  expect(preparingHtml).toMatch(/遠距離[^]*武技[^]*属性 遠・戦・格[^]*使用Lv 5[^]*効果Lv 5（計算中）[^]*ダメージ 未確定（計算中）[^]*3回攻撃[^]*確定値ではありません/);
  expect(failedHtml).toMatch(/近距離[^]*魔法[^]*属性 近・魔・冷[^]*使用Lv 4[^]*効果Lv 7（確定）[^]*ダメージ 2（計算中）[^]*2回攻撃/);
  expect(resolvedHtml).toMatch(/遠距離[^]*魔法[^]*属性 遠・魔・炎[^]*使用Lv 6[^]*効果Lv 8（確定）[^]*ダメージ なし（確定）[^]*1回攻撃/);
  expect(resolvedHtml).not.toContain('ダメージ 0');
  expect(html).toContain('不成立'); expect(html).toContain('楓、凛');
});
