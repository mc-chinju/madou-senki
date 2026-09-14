import {getAction, getCharacter} from '@madou/catalog';
import type {GameCommand} from '@madou/protocol';
import {canSelectDedicated} from '../combat/legality.js';
import {printedTechniqueAllowed} from '../combat/printed-restrictions.js';
import {techniqueFor} from '../effects/registry.js';
import type {PlayerView} from '../view.js';

export type Command = GameCommand;

function hasStatus(view: PlayerView, kind: string): boolean {
  return view.players[view.self.id]?.statuses.some(status => status.kind === kind) === true;
}

function activeOpponents(view: PlayerView): string[] {
  return view.seatOrder.filter(id => {
    if (id === view.self.id) return false;
    const player = view.players[id];
    if (!player || player.presence !== 'active') return false;
    if (player.revealed && player.characterId) {
      const faction = getCharacter(player.characterId)?.initial_faction;
      if (faction && faction === view.self.faction) return false;
    }
    return true;
  });
}

function reachableTargets(view: PlayerView, range: string | undefined): string[] {
  if (range === 'none' || !range) return [];
  return activeOpponents(view).filter(id => range === 'far' || view.distances[view.self.id]?.[id] === 'near');
}

function attackTargets(view: PlayerView, technique: {target?: string; mandatoryAll?: boolean; range?: string}): string[][] {
  const ids = reachableTargets(view, technique.range);
  if (!ids.length) return [];
  if (technique.mandatoryAll || technique.target === 'all') return [ids];
  return ids.map(id => [id]);
}

function grantedAttackTarget(view: PlayerView): string | undefined {
  return view.additionalAttack?.targetId ?? (view.activeWindow?.kind === 'ability-attack' ? view.currentAction?.targetIds[0] : undefined);
}

function pushUnique(commands: Command[], command: Command): void {
  const key = JSON.stringify(command);
  if (commands.some(existing => JSON.stringify(existing) === key)) return;
  commands.push(command);
}

function enumerateAttacks(view: PlayerView, commands: Command[]): void {
  const granted = grantedAttackTarget(view);
  for (const option of view.followerAttackOptions) {
    const ids = granted ? option.legalTargetIds.filter(id => id === granted) : option.legalTargetIds;
    if (!ids.length) continue;
    if (option.targetMode === 'one') {
      for (const id of ids) pushUnique(commands, {type: 'ATTACK', cardInstanceId: option.cardInstanceId, dedicated: true, targetIds: [id]});
    } else {
      pushUnique(commands, {type: 'ATTACK', cardInstanceId: option.cardInstanceId, dedicated: true, targetIds: [...ids]});
      if (option.targetMode === 'selected-all') {
        for (const id of ids) pushUnique(commands, {type: 'ATTACK', cardInstanceId: option.cardInstanceId, dedicated: true, targetIds: [id]});
      }
    }
  }
  for (const option of view.additionalAttackOptions) {
    const targetId = view.additionalAttack?.targetId ?? granted;
    if (!targetId) continue;
    pushUnique(commands, {
      type: 'ATTACK',
      cardInstanceId: option.cardInstanceId,
      dedicated: option.dedicated,
      targetIds: [targetId],
      ...(option.techniqueVariant ? {techniqueVariant: option.techniqueVariant} : {}),
      ...(option.coSource ? {coSource: option.coSource} : {}),
      ...(option.declarationAbilityIds ? {declarationAbilityIds: [...option.declarationAbilityIds]} : {}),
    });
  }
  if (view.activeWindow && view.activeWindow.kind !== 'ability-attack') return;
  const characterName = getCharacter(view.self.characterId)?.name;
  const silenced = hasStatus(view, 'silenced');
  const sources = [...view.self.hand, ...view.self.chants.map(card => card.cardInstanceId)];
  for (const cardInstanceId of sources) {
    for (const dedicated of [false, true]) {
      if (dedicated && !canSelectDedicated(cardInstanceId, characterName)) continue;
      const technique = techniqueFor(cardInstanceId, characterName, dedicated);
      if (!technique || technique.range === 'none') continue;
      if (technique.chant && !view.self.chants.some(card => card.cardInstanceId === cardInstanceId)) continue;
      if (silenced && technique.school === 'magic') continue;
      if (!printedTechniqueAllowed({characterId: view.self.characterId, faction: view.self.faction}, technique)) continue;
      const sets = granted ? (reachableTargets(view, technique.range).includes(granted) || technique.range === 'far' || view.distances[view.self.id]?.[granted] === 'near' ? [[granted]] : []) : attackTargets(view, technique);
      for (const targetIds of sets) {
        if (granted && (targetIds.length !== 1 || targetIds[0] !== granted)) continue;
        pushUnique(commands, {type: 'ATTACK', cardInstanceId, dedicated, targetIds});
      }
    }
  }
}

function distanceCards(view: PlayerView, playMode: 'advance' | 'distance'): string[] {
  return view.self.hand.filter(id => getAction(id)?.modes?.some(mode => mode.playMode === playMode));
}

/** Enumerate commands this seat can send from its own projection. Secret zones of others are not read. */
export function legalCommands(view: PlayerView): Command[] {
  const commands: Command[] = [];
  const choices = new Set(view.legalChoices);
  const has = (type: string) => choices.has(type);
  if (has('PASS')) commands.push({type: 'PASS'});
  if (has('PASS_SETUP')) commands.push({type: 'PASS_SETUP'});
  if (has('PASS_ACTION')) commands.push({type: 'PASS_ACTION'});
  if (has('PASS_WITHDRAWAL')) commands.push({type: 'PASS_WITHDRAWAL'});
  if (has('START_TURN')) commands.push({type: 'START_TURN'});
  if (has('USE_REVIVAL_RITUAL')) commands.push({type: 'USE_REVIVAL_RITUAL'});
  if (has('START_FOLLOWERS')) commands.push({type: 'START_FOLLOWERS'});
  if (has('REVEAL_CHARACTER')) commands.push({type: 'REVEAL_CHARACTER'});
  if (has('CHOOSE_DRAW')) {
    commands.push({type: 'CHOOSE_DRAW', draw: true});
    commands.push({type: 'CHOOSE_DRAW', draw: false});
  }
  if (has('CHOOSE_REVIVAL')) {
    commands.push({type: 'CHOOSE_REVIVAL', revive: false});
    commands.push({type: 'CHOOSE_REVIVAL', revive: true});
  }
  if (has('DISCARD_HIT_CHANTS')) {
    commands.push({type: 'DISCARD_HIT_CHANTS', discard: false});
    commands.push({type: 'DISCARD_HIT_CHANTS', discard: true});
  }
  if (has('CHOOSE_FOLLOWER_BYPASS')) {
    commands.push({type: 'CHOOSE_FOLLOWER_BYPASS', ignore: false});
    commands.push({type: 'CHOOSE_FOLLOWER_BYPASS', ignore: true});
  }
  if (has('CHOOSE_DARK_SAINT_IGNORE')) {
    commands.push({type: 'CHOOSE_DARK_SAINT_IGNORE', ignore: false});
    commands.push({type: 'CHOOSE_DARK_SAINT_IGNORE', ignore: true});
  }
  if (has('CHOOSE_DAMAGE_DOUBLE') && view.techniqueDecision?.kind === 'damage-double') {
    commands.push({type: 'CHOOSE_DAMAGE_DOUBLE', actionId: view.techniqueDecision.actionId, attempt: false});
    commands.push({type: 'CHOOSE_DAMAGE_DOUBLE', actionId: view.techniqueDecision.actionId, attempt: true});
  }
  if (has('PAY_HIT_ADVANCES') && view.techniqueDecision?.kind === 'hit-advance') {
    const first = view.techniqueDecision.cardInstanceIds[0];
    commands.push({type: 'PAY_HIT_ADVANCES', groupId: view.techniqueDecision.groupId, cardInstanceIds: first ? [first] : []});
  }
  if (has('CHOOSE_LIFETIME_EFFECT') && view.lifetimeDecision) {
    for (const choice of view.lifetimeDecision.choices) commands.push({type: 'CHOOSE_LIFETIME_EFFECT', choice});
  }
  if (has('CHOOSE_INSPECTION') && view.inspection) {
    const {decisionId, choices: inspectionChoices, cards} = view.inspection;
    if (inspectionChoices.includes('finish')) commands.push({type: 'CHOOSE_INSPECTION', decisionId, choice: 'finish'});
    if (inspectionChoices.includes('discard-all')) commands.push({type: 'CHOOSE_INSPECTION', decisionId, choice: 'discard-all'});
    if (inspectionChoices.includes('discard-one')) {
      for (const card of cards) commands.push({type: 'CHOOSE_INSPECTION', decisionId, choice: 'discard-one', cardInstanceId: card.cardInstanceId});
    }
  }
  if (has('CHOOSE_WISH') && view.wish) {
    for (const source of view.wish.publicSources) commands.push({type: 'CHOOSE_WISH', decisionId: view.wish.decisionId, source: {kind: 'public', cardInstanceId: source.cardInstanceId}});
    for (const {ownerId} of view.wish.handOwners) commands.push({type: 'CHOOSE_WISH', decisionId: view.wish.decisionId, source: {kind: 'hand', ownerId}});
    for (const {cardName} of view.wish.deckNames) commands.push({type: 'CHOOSE_WISH', decisionId: view.wish.decisionId, source: {kind: 'deck', cardName}});
  }
  if (has('CHOOSE_WISH_CAPACITY') && view.wishCapacity) {
    commands.push({
      type: 'CHOOSE_WISH_CAPACITY',
      decisionId: view.wishCapacity.decisionId,
      followerIds: view.wishCapacity.followerIds.slice(0, view.wishCapacity.followerCount),
      chantIds: view.wishCapacity.chantIds.slice(0, view.wishCapacity.chantCount),
    });
  }
  if (has('CHOOSE_RECLAIM') && view.reclaim) {
    commands.push({type: 'CHOOSE_RECLAIM', decisionId: view.reclaim.decisionId, choice: 'decline'});
    for (const claim of view.reclaim.claims) {
      commands.push({type: 'CHOOSE_RECLAIM', decisionId: view.reclaim.decisionId, choice: claim.action, claimId: claim.claimId});
    }
  }
  if (has('CHOOSE_BEAST_CAPTURE') && view.beastCapture) {
    commands.push({type: 'CHOOSE_BEAST_CAPTURE', groupId: view.beastCapture.groupId, windowId: view.beastCapture.windowId, cardInstanceIds: []});
  }
  if (has('PLACE_INITIAL_FOLLOWER')) {
    for (const cardInstanceId of view.followerPlacementOptions.placeableCardInstanceIds) {
      commands.push({type: 'PLACE_INITIAL_FOLLOWER', cardInstanceId});
    }
  }
  if (has('END_TURN')) {
    const extra = Math.max(0, view.self.hand.length - view.self.stats.handLimit);
    commands.push({type: 'END_TURN', discardIds: view.self.hand.slice(0, extra)});
  }
  if (has('ATTACK')) enumerateAttacks(view, commands);
  if (has('APPROACH')) {
    const cards = distanceCards(view, 'advance');
    for (const targetId of activeOpponents(view).filter(id => view.distances[view.self.id]?.[id] === 'far')) {
      for (const cardInstanceId of cards) commands.push({type: 'APPROACH', targetId, cardInstanceId});
    }
  }
  if (has('WITHDRAW')) {
    const cards = distanceCards(view, 'distance');
    for (const targetId of activeOpponents(view).filter(id => view.distances[view.self.id]?.[id] === 'near')) {
      for (const cardInstanceId of cards) commands.push({type: 'WITHDRAW', targetId, cardInstanceId});
    }
  }
  if (has('PLAY_ADVANCE')) {
    for (const cardInstanceId of distanceCards(view, 'advance')) commands.push({type: 'PLAY_ADVANCE', cardInstanceId});
  }
  if (has('PLAY_GROUP_DEFENSE')) {
    for (const option of view.groupDefenseOptions) {
      commands.push({type: 'PLAY_GROUP_DEFENSE', cardInstanceId: option.cardInstanceId, groupId: option.groupId, dedicated: true});
    }
  }
  if (has('PLAY_TURN_CARD')) {
    type RemainingTurnId = 'a2-p03-r1c1'|'a2-p03-r1c2'|'a2-p03-r1c3'|'a2-p03-r2c2'|'a2-p03-r2c3'|'a2-p04-r2c1';
    for (const option of view.turnCardOptions) {
      const cardInstanceId = option.cardInstanceId as RemainingTurnId;
      commands.push({type: 'PLAY_TURN_CARD', cardInstanceId, mode: option.canUseDedicated ? 'dedicated' : 'ordinary'});
    }
    for (const option of view.turnChoiceCardOptions) {
      for (const targetId of option.targetIds) {
        commands.push({type: 'PLAY_TURN_CARD', cardInstanceId: option.cardInstanceId, targetId});
        if (option.canUseAstrology) {
          commands.push({type: 'PLAY_TURN_CARD', cardInstanceId: option.cardInstanceId, targetId, mode: 'astrology'});
        }
      }
    }
    for (const cardInstanceId of view.wishOptions) {
      commands.push({type: 'PLAY_TURN_CARD', cardInstanceId, mode: 'wish'});
    }
  }
  if (has('PLAY_ANYTIME_CARD')) {
    for (const option of view.anytimeCardOptions) {
      commands.push({
        type: 'PLAY_ANYTIME_CARD',
        cardInstanceId: option.cardInstanceId,
        targetEventId: option.targetEventId,
        ...(option.targetId ? {targetId: option.targetId} : {}),
        ...(option.groupId ? {groupId: option.groupId} : {}),
        ...(option.hitIndex !== undefined ? {hitIndex: option.hitIndex} : {}),
      });
    }
  }
  if (has('PAY_SHADOW_JUMP') && view.shadowJumpCost) {
    for (const advanceCardInstanceId of view.shadowJumpCost.cardInstanceIds) {
      commands.push({type: 'PAY_SHADOW_JUMP', abilityEventId: view.shadowJumpCost.abilityEventId, advanceCardInstanceId});
    }
  }
  if (has('DECLARE_VIRTUAL_BLADE') || view.virtualBladeOptions.length) {
    for (const option of view.virtualBladeOptions) {
      for (const targetId of option.targetIds) {
        commands.push({type: 'DECLARE_VIRTUAL_BLADE', abilityId: option.abilityId, targetIds: [targetId]});
      }
    }
  }
  if (has('PLAY_ALL_ARMY')) {
    for (const option of view.allArmyOptions) {
      const ids = option.targetMode === 'one' ? option.legalTargetIds.slice(0, 1) : option.legalTargetIds;
      if (!ids.length) continue;
      commands.push({type: 'PLAY_ALL_ARMY', cardInstanceId: 'a2-p05-r2c2', followerCardInstanceId: option.followerCardInstanceId, targetIds: [...ids]});
    }
  }
  if (has('USE_LIFECYCLE_ABILITY')) {
    for (const ability of view.lifecycleAbilities) commands.push({type: 'USE_LIFECYCLE_ABILITY', ability});
  }
  if (has('TRANSFER_RITUAL')) {
    for (const id of view.seatOrder) {
      const player = view.players[id];
      if (player?.revealed && player.characterId === 'c2-p05-r1c1') commands.push({type: 'TRANSFER_RITUAL', targetId: id});
    }
  }
  if (has('CHAM_DEATH_GIFT') && view.lifecycleDecision?.chamGift) {
    const gift = view.lifecycleDecision.chamGift;
    const cardInstanceId = gift.cardInstanceIds[0];
    const targetId = gift.eligibleTargetIds[0];
    if (cardInstanceId && targetId) commands.push({type: 'CHAM_DEATH_GIFT', decisionId: gift.decisionId, cardInstanceId, targetId});
  }
  if (has('PLAY_DEATH_GIFT') && view.lifecycleDecision) {
    const cardInstanceId = view.self.faction === 'EVIL' ? 'a2-p02-r3c2' : view.self.faction === 'GOOD' ? 'a2-p02-r3c3' : '';
    const giftCardInstanceId = view.self.hand.find(id => id !== cardInstanceId);
    const targetId = view.lifecycleDecision.eligibleTargetIds[0];
    if (cardInstanceId && giftCardInstanceId && targetId && view.self.hand.includes(cardInstanceId)) {
      commands.push({type: 'PLAY_DEATH_GIFT', cardInstanceId, giftCardInstanceId, targetId});
    }
  }
  return commands;
}
