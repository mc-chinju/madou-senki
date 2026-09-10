import { describe, expect, test } from 'vitest';
import { arrangeFollowers, buildCardCommand, discardRequirement, eligibleChantCards, eligibleReactionCards, moveFollower, toggleSelection } from '../src/game/commands.js';
test('Printed black chant prohibition stays mandatory in Fury selection UI',()=>{expect(eligibleChantCards(['a2-p13-r3c2','a2-p09-r2c3','a2-p10-r1c3'],'妖精王フューリー')).toEqual(['a2-p10-r1c3']);});

describe('game command input', () => {
  test('attack requires a card and at least one target before it builds a command', () => {
    expect(buildCardCommand('ATTACK', { cardId: 'a2-p01-r1c1', targetIds: [], dedicated: false })).toBeNull();
    expect(buildCardCommand('ATTACK', { cardId: 'a2-p01-r1c1', targetIds: ['p2'], dedicated: true })).toEqual({
      type: 'ATTACK', cardInstanceId: 'a2-p01-r1c1', targetIds: ['p2'], dedicated: true,
    });
  });

  test('reaction mode and projected target action are sent explicitly', () => {
    expect(buildCardCommand('PLAY_REACTION', {
      cardId: 'a2-p02-r2c3', targetActionId: 'action-7', reactionMode: 'force-fail', dedicated: false,
    })).toEqual({ type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', targetActionId: 'action-7', mode: 'force-fail', dedicated: false });
  });

  test('multi-card selection keeps physical IDs unique and toggles independently', () => {
    expect(toggleSelection(['card-a', 'card-b'], 'card-a')).toEqual(['card-b']);
    expect(toggleSelection(['card-b'], 'card-a')).toEqual(['card-b', 'card-a']);
  });

  test('follower arrangement explicitly adds, removes, and reorders a subset', () => {
    expect(arrangeFollowers(['front', 'rear'], 'reserve', 'add', 3)).toEqual(['front', 'rear', 'reserve']);
    expect(arrangeFollowers(['front', 'rear'], 'front', 'remove', 3)).toEqual(['rear']);
    expect(moveFollower(['front', 'middle', 'rear'], 'rear', -1)).toEqual(['front', 'rear', 'middle']);
    expect(arrangeFollowers(['front', 'rear'], 'reserve', 'add', 2)).toEqual(['front', 'rear']);
  });

  test('hand adjustment requires exactly the cards over the hand limit', () => {
    expect(discardRequirement(7, 5, ['one', 'two'])).toEqual({ required: 2, valid: true });
    expect(discardRequirement(7, 5, ['one'])).toEqual({ required: 2, valid: false });
    expect(discardRequirement(3, 5, [])).toEqual({ required: 0, valid: true });
  });

  test('reaction card guidance filters by printed mode and includes own chants for defense', () => {
    const hand = ['a2-p06-r3c3', 'a2-p02-r2c3', 'a2-p03-r1c1'];
    expect(eligibleReactionCards('PLAY_MAAI', hand, [])).toEqual(['a2-p06-r3c3']);
    expect(eligibleReactionCards('PLAY_REACTION', hand, [], 'force-fail')).toEqual(['a2-p02-r2c3']);
    expect(eligibleReactionCards('PLAY_DEFENSE', [], ['a2-p12-r1c3'])).toEqual(['a2-p12-r1c3']);
  });

  test('defense guidance includes returned counterattacks but excludes ordinary attacks', () => {
    expect(eligibleReactionCards(
      'PLAY_DEFENSE',
      ['a2-p08-r2c3', 'a2-p08-r1c3', 'a2-p06-r3c3'],
      ['a2-p10-r3c3'],
    )).toEqual(['a2-p08-r2c3', 'a2-p10-r3c3']);
  });

  test('chant guidance uses the public printed chant attribute', () => {
    expect(eligibleChantCards(['a2-p10-r1c3', 'a2-p12-r1c3'])).toEqual(['a2-p10-r1c3']);
  });
  test('optional chant needs the matching owner and an explicit dedicated choice', () => {
    const hand = ['a2-p11-r1c1', 'a2-p10-r1c3'];
    expect(eligibleChantCards(hand, '早駆けのランカスター', false)).toEqual(['a2-p10-r1c3']);
    expect(eligibleChantCards(hand, '黒騎士ガーウィン', true)).toEqual(['a2-p10-r1c3']);
    expect(eligibleChantCards(hand, '早駆けのランカスター', true)).toEqual(hand);
    expect(buildCardCommand('CHANT', { cardId: hand[0], dedicated: true })).toEqual({ type: 'CHANT', cardInstanceId: hand[0], dedicated: true });
    expect(buildCardCommand('CHANT', { cardId: hand[1] })).toEqual({ type: 'CHANT', cardInstanceId: hand[1] });
  });

  test('silence excludes new magic chanting but permits warrior chant preparation', () => {
    const hand = ['a2-p10-r1c3', 'a2-p13-r1c1'];
    expect(eligibleChantCards(hand, '白魔術師シェリム', false, true)).toEqual(['a2-p10-r1c3']);
    expect(eligibleChantCards(hand, '白魔術師シェリム', false, false)).toEqual(hand);
  });

  test('attack forwards an explicit dedicated variant but ordinary use omits it', () => {
    const input = { cardId: 'a2-p10-r3c2', targetIds: ['p2'], dedicated: true, techniqueVariant: 'one-hit' as const };
    expect(buildCardCommand('ATTACK', input)).toEqual({ type: 'ATTACK', cardInstanceId: input.cardId, targetIds: ['p2'], dedicated: true, techniqueVariant: 'one-hit' });
    expect(buildCardCommand('ATTACK', { ...input, dedicated: false })).toEqual({ type: 'ATTACK', cardInstanceId: input.cardId, targetIds: ['p2'], dedicated: false });
  });

  test('Shin must explicitly select the dedicated counter before his chant is offered for defense', () => {
    const chants = ['a2-p10-r2c1'];
    expect(eligibleReactionCards('PLAY_DEFENSE', [], chants, 'cancel', { characterName: '侍大将のシン', dedicated: false })).toEqual([]);
    expect(eligibleReactionCards('PLAY_DEFENSE', [], chants, 'cancel', { characterName: '黒騎士ガーウィン', dedicated: true })).toEqual([]);
    expect(eligibleReactionCards('PLAY_DEFENSE', [], chants, 'cancel', { characterName: '侍大将のシン', dedicated: true })).toEqual(chants);
  });

  test('Shelim can explicitly use his white-light counter without revealing opponents', () => {
    const hand = ['a2-p14-r1c2'];
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { characterName: '白魔術師シェリム', dedicated: false })).toEqual([]);
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { characterName: '侍大将のシン', dedicated: true })).toEqual([]);
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { characterName: '白魔術師シェリム', dedicated: true })).toEqual(hand);
  });

  test('public defense restrictions keep teleport available while removing prohibited evade and counter cards', () => {
    const context = { defenseRestrictions: { maaiProhibited: true, evadeProhibited: true, counterProhibited: true } };
    expect(eligibleReactionCards('PLAY_DEFENSE', ['a2-p05-r3c1', 'a2-p08-r2c3', 'a2-p06-r1c1'], [], 'cancel', context)).toEqual(['a2-p06-r1c1']);
    expect(eligibleReactionCards('PLAY_MAAI', ['a2-p06-r3c3'], [], 'cancel', context)).toEqual([]);
  });

  test('roll reactions use the explicit current roll target and never fall back to an action for reroll', () => {
    expect(buildCardCommand('PLAY_REACTION', { cardId: 'a2-p02-r1c3', reactionMode: 'reroll', targetRollId: 'roll-8', targetActionId: 'action-3', dedicated: true })).toEqual({ type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r1c3', mode: 'reroll', targetRollId: 'roll-8' });
    expect(buildCardCommand('PLAY_REACTION', { cardId: 'a2-p02-r2c3', reactionMode: 'force-fail', targetRollId: 'roll-8', dedicated: true })).toEqual({ type: 'PLAY_REACTION', cardInstanceId: 'a2-p02-r2c3', mode: 'force-fail', targetRollId: 'roll-8' });
    expect(buildCardCommand('PLAY_REACTION', { cardId: 'a2-p02-r1c3', reactionMode: 'reroll', targetActionId: 'action-3' })).toBeNull();
  });

  test('numeric roll guidance permits intervention but excludes check-only forced failure', () => {
    const hand = ['a2-p02-r1c3', 'a2-p02-r2c3'];
    expect(eligibleReactionCards('PLAY_REACTION', hand, [], 'reroll', { rollKind: 'numeric' })).toEqual(['a2-p02-r1c3']);
    expect(eligibleReactionCards('PLAY_REACTION', hand, [], 'force-fail', { rollKind: 'numeric' })).toEqual([]);
    expect(eligibleReactionCards('PLAY_REACTION', hand, [], 'force-fail', { rollKind: 'check' })).toEqual(['a2-p02-r2c3']);
  });

  test('magic-only defenses use the public incoming school and fixed reflection limit', () => {
    const hand = ['a2-p18-r2c2', 'a2-p18-r2c3', 'a2-p17-r3c2', 'a2-p08-r2c3'];
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { incomingAttributes: ['戦'], incomingEffectLevel: 4 })).toEqual(['a2-p08-r2c3']);
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { incomingAttributes: ['魔'], incomingEffectLevel: 6 })).toEqual(hand);
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { incomingAttributes: ['魔'], incomingEffectLevel: 7 })).toEqual(['a2-p18-r2c2', 'a2-p18-r2c3', 'a2-p08-r2c3']);
  });

  test('silence excludes magic defenses while ability suppression leaves dedicated card effects selectable', () => {
    const hand = ['a2-p14-r1c2', 'a2-p06-r1c1', 'a2-p08-r2c3'];
    const own = { characterName: '白魔術師シェリム', dedicated: true };
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { ...own, statusKinds: ['silenced'] })).toEqual(['a2-p06-r1c1', 'a2-p08-r2c3']);
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { ...own, statusKinds: ['ability-disabled'] })).toEqual(hand);
    expect(eligibleReactionCards('PLAY_DEFENSE', hand, [], 'cancel', { ...own, statusKinds: ['stopped'] })).toEqual([]);
  });

});

test('limited teleport/counter defenses exclude fixed barriers from Mekai choices', () => {
  expect(eligibleReactionCards('PLAY_DEFENSE', ['a2-p18-r2c2', 'a2-p06-r1c1'], [], 'cancel', {
    incomingAttributes: ['魔'], incomingEffectLevel: 10, limitedDefenses: ['teleport', 'counter'],
  })).toEqual(['a2-p06-r1c1']);
});

test.each([['侍大将のシン','GOOD',false],['侍大将のシン','EVIL',true],['黒騎士ガーウィン','GOOD',false],['黒騎士ガーウィン','EVIL',true]] as const)('Blood Flow chant uses current allegiance for %s faction%s eligible=%s',(name,faction,eligible)=>{
 const cards=eligibleChantCards(['a2-p09-r2c3','a2-p10-r1c3'],name,false,false,faction);
 expect(cards.includes('a2-p09-r2c3')).toBe(eligible);
 expect(cards).toContain('a2-p10-r1c3');
});
