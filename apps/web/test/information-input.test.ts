import { expect, test } from 'vitest';
import { drawCommand, inspectionCommand, revealCommand, type InspectionInputView } from '../src/game/information-input.js';

test('draw selection attaches only an offered whole ability to the actual draw', () => {
  const abilityId = 'c2-p01-r2c2-ab02';
  const view = { legalChoices: ['CHOOSE_DRAW'], drawAbilityOptions: [{ abilityId, name: 'なになに' }] };
  expect(drawCommand(view, true, abilityId)).toEqual({ type: 'CHOOSE_DRAW', draw: true, abilityId });
  expect(drawCommand(view, true)).toEqual({ type: 'CHOOSE_DRAW', draw: true });
  expect(drawCommand(view, false)).toEqual({ type: 'CHOOSE_DRAW', draw: false });
  expect(drawCommand(view, false, abilityId)).toBeNull();
  expect(drawCommand(view, true, 'c2-p07-r1c1-ab03')).toBeNull();
  expect(drawCommand({ ...view, legalChoices: [] }, true, abilityId)).toBeNull();
});
test('voluntary reveal can omit its benefit and rejects a stale or foreign optional source', () => {
  const abilityId = 'c2-p04-r2c1-ab03';
  const view = { legalChoices: ['REVEAL_CHARACTER'], revealAbilityOptions: [{ abilityId, name: '本当の力' }] };
  expect(revealCommand(view, abilityId)).toEqual({ type: 'REVEAL_CHARACTER', abilityId });
  expect(revealCommand(view)).toEqual({ type: 'REVEAL_CHARACTER' });
  expect(revealCommand({ ...view, revealAbilityOptions: [] }, abilityId)).toBeNull();
  expect(revealCommand(view, 'c2-p01-r2c2-ab02')).toBeNull();
  expect(revealCommand({ ...view, legalChoices: [] })).toBeNull();
});
function inspection(): InspectionInputView {
  return { self: { id: 'A' }, legalChoices: ['CHOOSE_INSPECTION', 'PASS'], activeWindow: { kind: 'private-inspection', pendingActorId: 'A' },
    inspection: { decisionId: 'inspection-9', actorId: 'A', targetId: 'B', zone: 'hand', cards: [{ position: 0, cardInstanceId: 'a2-p14-r1c2' }], discardMode: 'one', choices: ['finish', 'discard-one'] } };
}
test('inspection consumes the saved decision and only a card in its private offered snapshot', () => {
  const view = inspection();
  expect(inspectionCommand(view, 'discard-one', 'a2-p14-r1c2')).toEqual({ type: 'CHOOSE_INSPECTION', decisionId: 'inspection-9', choice: 'discard-one', cardInstanceId: 'a2-p14-r1c2' });
  expect(inspectionCommand(view, 'finish')).toEqual({ type: 'CHOOSE_INSPECTION', decisionId: 'inspection-9', choice: 'finish' });
  expect(inspectionCommand(view, 'discard-one')).toBeNull();
  expect(inspectionCommand(view, 'discard-one', 'a2-p06-r1c1')).toBeNull();
  expect(inspectionCommand(view, 'discard-all')).toBeNull();
  expect(inspectionCommand(view, 'finish', 'a2-p14-r1c2')).toBeNull();
  expect(inspectionCommand({ ...view, self: { id: 'B' } }, 'finish')).toBeNull();
  expect(inspectionCommand({ ...view, activeWindow: { kind: 'declaration', pendingActorId: 'A' } }, 'finish')).toBeNull();
  expect(inspectionCommand({ ...view, legalChoices: [] }, 'finish')).toBeNull();
  const all = { ...view, inspection: { ...view.inspection!, discardMode: 'all' as const, choices: ['finish', 'discard-all'] as const } };
  expect(inspectionCommand({ ...all, inspection: { ...all.inspection, choices: [...all.inspection.choices] } }, 'discard-all')).toEqual({ type: 'CHOOSE_INSPECTION', decisionId: 'inspection-9', choice: 'discard-all' });
});
