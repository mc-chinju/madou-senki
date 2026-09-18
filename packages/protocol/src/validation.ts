import type { CommandEnvelope, GameCommand, ParseResult, TechniqueVariant } from './messages.js';

function plainDataRecord(value: unknown, allowed: readonly string[]): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const normalized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !allowed.includes(key)) return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !('value' in descriptor)) return undefined;
      normalized[key] = descriptor.value;
    }
    return normalized;
  } catch {
    return undefined;
  }
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function revision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function parseGameCommand(value: unknown): ParseResult<GameCommand> {
  const invalid = { ok: false, code: 'INVALID_COMMAND' } as const;
  const command = plainDataRecord(value, ['additionalCardInstanceIds','abilityEventId','advanceCardInstanceId','followerCardInstanceId','combinationCardInstanceIds','source','followerIds','chantIds','dispel','hitIndex','claimId','enabled','decisionId','declarationAbilityIds','windowId','abilityEffectIds','sources','followerTransfer','dedicatedCardInstanceIds','coSource','advanceCardInstanceIds','actionId','groupId','attempt','abilityId','targetEventId','costCardInstanceId','conceal','targetAbilityId','choice','convertTargetIds','revive','ability','giftCardInstanceId','position','type', 'cardInstanceId', 'cardInstanceIds', 'discardIds', 'draw', 'discard', 'ignore', 'targetIds', 'targetId', 'dedicated', 'techniqueVariant', 'mode', 'targetActionId', 'targetRollId']);
  if (!command) return invalid;
  if(Object.hasOwn(command,'combinationCardInstanceIds')){
    const ids=command.combinationCardInstanceIds;
    if(!['ATTACK','PLAY_DEFENSE'].includes(command.type as string)||!Array.isArray(ids)||ids.length>2||new Set(ids).size!==ids.length||!ids.every(id=>['a2-p05-r1c3','a2-p05-r2c1'].includes(id)))return invalid;
    const {combinationCardInstanceIds:ignored,...ordinary}=command;const parsed=parseGameCommand(ordinary);if(!parsed.ok)return invalid;
    return {ok:true,value:{...parsed.value,combinationCardInstanceIds:[...ids]} as GameCommand};
  }
  if (Object.hasOwn(command, 'declarationAbilityIds')) {
    if (!['ATTACK','PLAY_DEFENSE','PLAY_TURN_TECHNIQUE','PLAY_GROUP_DEFENSE'].includes(command.type as string)) return invalid;
    const ids = command.declarationAbilityIds;
    const allowed: string[] = ["c2-p01-r1c1-ab03", "c2-p01-r1c1-ab04", "c2-p01-r1c2-ab01", "c2-p01-r1c2-ab03", "c2-p01-r2c1-ab01", "c2-p01-r2c1-ab02", "c2-p02-r1c2-ab04", "c2-p05-r2c1-ab03", "c2-p05-r2c1-ab04", "c2-p05-r2c2-ab03", "c2-p05-r2c2-ab04", "c2-p06-r2c2-ab02", "c2-p07-r1c2-ab02"];
    if (!Array.isArray(ids) || ids.length > 13 || new Set(ids).size !== ids.length || !Array.from(ids).every(id => typeof id === 'string' && allowed.includes(id))) return invalid;
    const {declarationAbilityIds: ignored, ...ordinary} = command;
    const parsed = parseGameCommand(ordinary);
    if (!parsed.ok) return invalid;
    return {ok:true, value:{...parsed.value, declarationAbilityIds:[...ids]} as GameCommand};
  }
  switch (command.type) {
    case 'CHOOSE_WISH': {
      if(!exactKeys(command,['type','decisionId','source'])||!identifier(command.decisionId))return invalid;
      const source=plainDataRecord(command.source,['kind','ownerId','cardName','cardInstanceId']);if(!source)return invalid;
      if(source.kind==='hand'&&exactKeys(source,['kind','ownerId'])&&identifier(source.ownerId))return {ok:true,value:{type:command.type,decisionId:command.decisionId,source:{kind:'hand',ownerId:source.ownerId}}};
      if(source.kind==='deck'&&exactKeys(source,['kind','cardName'])&&typeof source.cardName==='string'&&source.cardName.length>0&&source.cardName.length<=128)return {ok:true,value:{type:command.type,decisionId:command.decisionId,source:{kind:'deck',cardName:source.cardName}}};
      if(source.kind==='public'&&exactKeys(source,['kind','cardInstanceId'])&&identifier(source.cardInstanceId))return {ok:true,value:{type:command.type,decisionId:command.decisionId,source:{kind:'public',cardInstanceId:source.cardInstanceId}}};
      return invalid;
    }
    case 'CHOOSE_WISH_CAPACITY': {
      if(!exactKeys(command,['type','decisionId','followerIds','chantIds'])||!identifier(command.decisionId))return invalid;
      for(const ids of [command.followerIds,command.chantIds])if(!Array.isArray(ids)||ids.length>220||!ids.every(identifier)||new Set(ids).size!==ids.length)return invalid;
      return {ok:true,value:{type:command.type,decisionId:command.decisionId,followerIds:[...command.followerIds as string[]],chantIds:[...command.chantIds as string[]]}};
    }
    case 'PLAY_ANYTIME_CARD': {
      const ids=['a2-p01-r2c3','a2-p01-r3c1','a2-p01-r3c2','a2-p01-r3c3','a2-p02-r1c1','a2-p02-r1c2','a2-p02-r2c1','a2-p02-r2c2','a2-p02-r3c1'];
      if(!ids.includes(command.cardInstanceId as string)||!identifier(command.targetEventId))return invalid;
      const optional=['targetId','groupId','hitIndex'].filter(k=>Object.hasOwn(command,k));
      if(!exactKeys(command,['type','cardInstanceId','targetEventId',...optional])||optional.some(k=>k==='hitIndex'?!revision(command[k]):!identifier(command[k])))return invalid;
      return {ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId as string,targetEventId:command.targetEventId,...(command.targetId?{targetId:command.targetId as string}:{}),...(command.groupId?{groupId:command.groupId as string}:{}),...(command.hitIndex!==undefined?{hitIndex:command.hitIndex as number}:{})}};
    }
    case 'CHOOSE_RECLAIM': {
      if(!identifier(command.decisionId))return invalid;
      if(command.choice==='decline')return exactKeys(command,['type','decisionId','choice'])?{ok:true,value:{type:command.type,decisionId:command.decisionId,choice:'decline'}}:invalid;
      return (command.choice==='take'||command.choice==='request-check')&&identifier(command.claimId)&&exactKeys(command,['type','decisionId','choice','claimId'])?{ok:true,value:{type:command.type,decisionId:command.decisionId,choice:command.choice,claimId:command.claimId}}:invalid;
    }
    case 'CHOOSE_INSPECTION': {
      const one=command.choice==='discard-one';
      return exactKeys(command,['type','decisionId','choice',...(one?['cardInstanceId']:[])])&&identifier(command.decisionId)&&['finish','discard-one','discard-all'].includes(command.choice as string)&&(!one||identifier(command.cardInstanceId))?{ok:true,value:{type:command.type,decisionId:command.decisionId,choice:command.choice as 'finish'|'discard-one'|'discard-all',...(one?{cardInstanceId:command.cardInstanceId as string}:{})}}:invalid;
    }
    case 'CHOOSE_BEAST_CAPTURE': {
      const ids=command.cardInstanceIds;
      return exactKeys(command,['type','groupId','windowId','cardInstanceIds'])&&identifier(command.groupId)&&identifier(command.windowId)&&Array.isArray(ids)&&ids.length<=220&&ids.every(identifier)?{ok:true,value:{type:command.type,groupId:command.groupId,windowId:command.windowId,cardInstanceIds:[...ids]}}:invalid;
    }
    case 'CHOOSE_DAMAGE_DOUBLE':
      return exactKeys(command,['type','actionId','attempt'])&&identifier(command.actionId)&&typeof command.attempt==='boolean'?{ok:true,value:{type:command.type,actionId:command.actionId,attempt:command.attempt}}:invalid;
    case 'PAY_SHADOW_JUMP': return exactKeys(command,['type','abilityEventId','advanceCardInstanceId'])&&identifier(command.abilityEventId)&&identifier(command.advanceCardInstanceId)?{ok:true,value:{type:command.type,abilityEventId:command.abilityEventId,advanceCardInstanceId:command.advanceCardInstanceId}}:invalid;
    case 'PAY_HIT_ADVANCES': {
      const ids=command.cardInstanceIds;
      return exactKeys(command,['type','groupId','cardInstanceIds'])&&identifier(command.groupId)&&Array.isArray(ids)&&ids.length<=220&&ids.every(identifier)&&new Set(ids).size===ids.length?{ok:true,value:{type:command.type,groupId:command.groupId,cardInstanceIds:[...ids]}}:invalid;
    }
    case 'PLAY_GROUP_DEFENSE':
      return exactKeys(command,['type','cardInstanceId','groupId','dedicated'])&&identifier(command.cardInstanceId)&&identifier(command.groupId)&&command.dedicated===true?{ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,groupId:command.groupId,dedicated:true}}:invalid;
    case 'USE_FOLLOWER_ATTACK': {
      if(!exactKeys(command,['type','abilityId','targetEventId','sources'])||!['c2-p05-r1c2-ab02','c2-p06-r1c2-ab04'].includes(command.abilityId as string)||!identifier(command.targetEventId)||!Array.isArray(command.sources)||!command.sources.length||command.sources.length>220)return invalid;
      const sources:import('./messages.js').FollowerAttackSourceChoice[]=[];
      for(const raw of command.sources){const v=plainDataRecord(raw,['cardInstanceId','dedicated','targetIds']);if(!v||!exactKeys(v,['cardInstanceId','dedicated','targetIds'])||!identifier(v.cardInstanceId)||typeof v.dedicated!=='boolean'||!Array.isArray(v.targetIds)||!v.targetIds.length||v.targetIds.length>10||!v.targetIds.every(identifier)||new Set(v.targetIds).size!==v.targetIds.length)return invalid;sources.push({cardInstanceId:v.cardInstanceId,dedicated:v.dedicated,targetIds:[...v.targetIds]});}
      if(new Set(sources.map(v=>v.cardInstanceId)).size!==sources.length)return invalid;
      return {ok:true,value:{type:command.type,abilityId:command.abilityId as import('./messages.js').FollowerAbilityId,targetEventId:command.targetEventId,sources}};
    }
    case 'SET_CONDITIONAL_ABILITY': {
      const ids=['c2-p02-r1c1-ab04','c2-p03-r1c2-ab03','c2-p03-r2c2-ab04','c2-p04-r1c2-ab03','c2-p04-r1c2-ab05','c2-p05-r1c2-ab01','c2-p05-r2c1-ab05','c2-p06-r1c2-ab02'];
      const subset=command.abilityId==='c2-p03-r1c2-ab03'&&command.enabled===true;
      if(!exactKeys(command,['type','abilityId','targetEventId','enabled',...(subset?['targetIds']:[])])||!ids.includes(command.abilityId as string)||!identifier(command.targetEventId)||typeof command.enabled!=='boolean')return invalid;
      const targets=command.targetIds;
      if(subset&&(!Array.isArray(targets)||targets.length>9||![...targets].every(identifier)||new Set(targets).size!==targets.length))return invalid;
      return {ok:true,value:{type:command.type,abilityId:command.abilityId as import('./messages.js').ConditionalAbilityId,targetEventId:command.targetEventId,enabled:command.enabled,...(subset?{targetIds:[...targets as string[]]}:{})}};
    }
    case 'USE_ABILITY': {
      if(command.abilityId==='c2-p05-r1c2-ab05'){
        if(!identifier(command.targetEventId))return invalid;
        if(command.mode==='aura')return exactKeys(command,['type','abilityId','targetEventId','mode','enabled'])&&typeof command.enabled==='boolean'?{ok:true,value:{type:command.type,abilityId:command.abilityId,targetEventId:command.targetEventId,mode:'aura',enabled:command.enabled}}:invalid;
        return command.mode==='substitute'&&exactKeys(command,['type','abilityId','targetEventId','mode','targetId','groupId','hitIndex'])&&identifier(command.targetId)&&identifier(command.groupId)&&Number.isInteger(command.hitIndex)&&Number(command.hitIndex)>=0&&Number(command.hitIndex)<6?{ok:true,value:{type:command.type,abilityId:command.abilityId,targetEventId:command.targetEventId,mode:'substitute',targetId:command.targetId,groupId:command.groupId,hitIndex:Number(command.hitIndex)}}:invalid;
      }
      if(command.abilityId==='c2-p07-r1c2-ab03'){
        const targets=command.targetIds;
        if(!exactKeys(command,['type','abilityId','targetEventId','targetIds'])||!identifier(command.targetEventId)
          ||!Array.isArray(targets)||!targets.length||targets.length>10||!Array.from(targets).every(identifier)
          ||new Set(targets).size!==targets.length)return invalid;
        return {ok:true,value:{type:command.type,abilityId:command.abilityId,targetEventId:command.targetEventId,targetIds:[...targets]}};
      }
      if(command.abilityId==='c2-p03-r1c2-ab04'){
        return exactKeys(command,['type','abilityId','targetEventId','targetId'])&&identifier(command.targetEventId)&&identifier(command.targetId)
          ?{ok:true,value:{type:command.type,abilityId:command.abilityId,targetEventId:command.targetEventId,targetId:command.targetId}}:invalid;
      }
      const targetRequired=['c2-p01-r2c2-ab03','c2-p03-r1c2-ab02','c2-p03-r2c1-ab03','c2-p04-r2c1-ab02','c2-p05-r1c1-ab01','c2-p04-r1c1-ab04','c2-p06-r2c1-ab04'].includes(command.abilityId as string);
      if(Object.hasOwn(command,'targetId')!==targetRequired)return invalid;
      const keys=['type','abilityId','targetEventId',...(Object.hasOwn(command,'targetId')?['targetId']:[]),...(Object.hasOwn(command,'abilityEffectIds')?['abilityEffectIds']:[]),...(Object.hasOwn(command,'costCardInstanceId')?['costCardInstanceId']:[]),...(Object.hasOwn(command,'conceal')?['conceal']:[])];
      if(!exactKeys(command,keys)||!identifier(command.abilityId)||!identifier(command.targetEventId)||Object.hasOwn(command,'targetId')&&!identifier(command.targetId)||Object.hasOwn(command,'costCardInstanceId')&&!identifier(command.costCardInstanceId)||Object.hasOwn(command,'conceal')&&typeof command.conceal!=='boolean')return invalid;
      const effects=command.abilityEffectIds;
      if(command.abilityId==='c2-p03-r2c1-ab02'){
        if(!Array.isArray(effects)||!effects.length||effects.length>3||new Set(effects).size!==effects.length||!effects.every(id=>['spirit-conversion','human-invalidation','arnes-suppression'].includes(id as string)))return invalid;
      }else if(Object.hasOwn(command,'abilityEffectIds'))return invalid;
      return {ok:true,value:{type:command.type,abilityId:command.abilityId,targetEventId:command.targetEventId,...(typeof command.targetId==='string'?{targetId:command.targetId}:{}),...(Array.isArray(effects)?{abilityEffectIds:[...effects] as import('./messages.js').AbilityEffectId[]}:{}),...(typeof command.costCardInstanceId==='string'?{costCardInstanceId:command.costCardInstanceId}:{}),...(typeof command.conceal==='boolean'?{conceal:command.conceal}:{})}};
    }
    case 'CHOOSE_LIFETIME_EFFECT':
      return exactKeys(command,['type','choice'])&&(command.choice==='apply'||command.choice==='decline')?{ok:true,value:{type:command.type,choice:command.choice}}:invalid;
    case 'PLAY_TURN_TECHNIQUE': {
      const targets=command.targetIds;const convert=command.convertTargetIds;
      if(!exactKeys(command,['type','cardInstanceId','targetIds','dedicated',...['convertTargetIds','followerTransfer'].filter(k=>Object.hasOwn(command,k))])||!identifier(command.cardInstanceId)||typeof command.dedicated!=='boolean'||!Array.isArray(targets)||!targets.length||targets.length>10||!targets.every(identifier)||new Set(targets).size!==targets.length)return invalid;
      if(Object.hasOwn(command,'convertTargetIds')&&(!Array.isArray(convert)||convert.length>10||!convert.every(identifier)||new Set(convert).size!==convert.length||convert.some(id=>!targets.includes(id))))return invalid;
      let followerTransfer:Extract<GameCommand,{type:'PLAY_TURN_TECHNIQUE'}>['followerTransfer'];
      if(Object.hasOwn(command,'followerTransfer')){
        const transfer=plainDataRecord(command.followerTransfer,['targetPosition','destinationPosition','replacementCardInstanceId']);
        if(!transfer||!exactKeys(transfer,['targetPosition','destinationPosition',...(Object.hasOwn(transfer,'replacementCardInstanceId')?['replacementCardInstanceId']:[])])||!revision(transfer.targetPosition)||transfer.targetPosition>=220||!revision(transfer.destinationPosition)||transfer.destinationPosition>=220||Object.hasOwn(transfer,'replacementCardInstanceId')&&!identifier(transfer.replacementCardInstanceId))return invalid;
        followerTransfer={targetPosition:transfer.targetPosition,destinationPosition:transfer.destinationPosition,...(typeof transfer.replacementCardInstanceId==='string'?{replacementCardInstanceId:transfer.replacementCardInstanceId}:{})};
      }
      return {ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,targetIds:[...targets],dedicated:command.dedicated,...(Array.isArray(convert)?{convertTargetIds:[...convert]}:{}),...(followerTransfer?{followerTransfer}:{})}};
    }
    case 'CHAM_DEATH_GIFT':
      return exactKeys(command,['type','decisionId','cardInstanceId','targetId'])&&identifier(command.decisionId)&&identifier(command.cardInstanceId)&&identifier(command.targetId)?{ok:true,value:{type:command.type,decisionId:command.decisionId,cardInstanceId:command.cardInstanceId,targetId:command.targetId}}:invalid;
    case 'PLAY_DEATH_GIFT':
      return exactKeys(command,['type','cardInstanceId','giftCardInstanceId','targetId'])&&identifier(command.cardInstanceId)&&identifier(command.giftCardInstanceId)&&identifier(command.targetId)?{ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,giftCardInstanceId:command.giftCardInstanceId,targetId:command.targetId}}:invalid;
    case 'CHOOSE_REVIVAL':
      return exactKeys(command,['type','revive'])&&typeof command.revive==='boolean'?{ok:true,value:{type:command.type,revive:command.revive}}:invalid;
    case 'USE_LIFECYCLE_ABILITY':
      return exactKeys(command,['type','ability'])&&['lancelot-transform','vanmil-subordinates','arseil-conspiracy'].includes(command.ability as string)?{ok:true,value:{type:command.type,ability:command.ability as 'lancelot-transform'|'vanmil-subordinates'|'arseil-conspiracy'}}:invalid;
    case 'TRANSFER_RITUAL':
      return exactKeys(command,['type','targetId'])&&identifier(command.targetId)?{ok:true,value:{type:command.type,targetId:command.targetId}}:invalid;
    case 'USE_REVIVAL_RITUAL':
      return exactKeys(command,['type'])?{ok:true,value:{type:command.type}}:invalid;

    case 'DISCARD_HIT_CHANTS':
      return exactKeys(command, ['type', 'discard']) && typeof command.discard === 'boolean' ? { ok: true, value: { type: command.type, discard: command.discard } } : invalid;
    case 'CHOOSE_DARK_SAINT_IGNORE':
    case 'CHOOSE_FOLLOWER_BYPASS':
      return exactKeys(command,['type','ignore'])&&typeof command.ignore==='boolean'?{ok:true,value:{type:command.type,ignore:command.ignore}}:invalid;
    case 'START_FOLLOWERS': {
      const ids=command.dedicatedCardInstanceIds;
      if(!Object.hasOwn(command,'dedicatedCardInstanceIds'))return exactKeys(command,['type'])?{ok:true,value:{type:command.type}}:invalid;
      return exactKeys(command,['type','dedicatedCardInstanceIds'])&&Array.isArray(ids)&&ids.length<=220&&ids.every(identifier)&&new Set(ids).size===ids.length?{ok:true,value:{type:command.type,dedicatedCardInstanceIds:[...ids]}}:invalid;
    }
    case 'PASS':
    case 'PASS_ACTION_THROUGH':
    case 'CANCEL_PASS_THROUGH':
    case 'START_TURN':
    case 'PASS_ACTION':
    case 'PASS_WITHDRAWAL':
    case 'PASS_SETUP':
      return exactKeys(command, ['type']) ? { ok: true, value: { type: command.type } } : invalid;
    case 'CHANT':
      if ((!exactKeys(command, ['type', 'cardInstanceId']) && !exactKeys(command, ['type', 'cardInstanceId', 'dedicated'])) || !identifier(command.cardInstanceId) || (Object.hasOwn(command, 'dedicated') && typeof command.dedicated !== 'boolean')) return invalid;
      return { ok: true, value: { type: command.type, cardInstanceId: command.cardInstanceId, ...(Object.hasOwn(command, 'dedicated') ? { dedicated: command.dedicated as boolean } : {}) } };
    case 'PLACE_INITIAL_FOLLOWER': {
      if ((!exactKeys(command, ['type', 'cardInstanceId']) && !exactKeys(command, ['type', 'cardInstanceId', 'position'])) || !identifier(command.cardInstanceId)) return invalid;
      const position = command.position;
      if (Object.hasOwn(command, 'position') && position !== 'front' && position !== 'back') return invalid;
      return { ok: true, value: { type: command.type, cardInstanceId: command.cardInstanceId, ...(Object.hasOwn(command, 'position') ? { position: position as 'front' | 'back' } : {}) } };
    }
    case 'PLAY_ALL_ARMY': {
      const ids=command.targetIds;
      if(!exactKeys(command,['type','cardInstanceId','followerCardInstanceId','targetIds'])||command.cardInstanceId!=='a2-p05-r2c2'||!identifier(command.followerCardInstanceId)||!Array.isArray(ids)||!ids.length||ids.length>10||!ids.every(identifier)||new Set(ids).size!==ids.length)return invalid;
      return {ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,followerCardInstanceId:command.followerCardInstanceId,targetIds:[...ids]}};
    }
    case 'DECLARE_VIRTUAL_BLADE': {
      if(!exactKeys(command,['type','abilityId','targetIds',...(command.targetEventId!==undefined?['targetEventId']:[])])||!['c2-p04-r1c1-ab02','c2-p06-r2c1-ab02'].includes(command.abilityId as string)||!Array.isArray(command.targetIds)||command.targetIds.length!==1||!command.targetIds.every(identifier)||command.targetEventId!==undefined&&!identifier(command.targetEventId))return invalid;
      return {ok:true,value:{type:command.type,abilityId:command.abilityId as 'c2-p04-r1c1-ab02'|'c2-p06-r2c1-ab02',targetIds:[...command.targetIds],...(command.targetEventId!==undefined?{targetEventId:command.targetEventId}:{})}};
    }
    case 'ATTACK': {
      const optional=['dispel','techniqueVariant','coSource','advanceCardInstanceIds'].filter(key=>Object.hasOwn(command,key));
      if(!exactKeys(command,['type','cardInstanceId','targetIds','dedicated',...optional])||!identifier(command.cardInstanceId)||typeof command.dedicated!=='boolean'||!Array.isArray(command.targetIds)||!command.targetIds.length||command.targetIds.length>10||!command.targetIds.every(identifier)||new Set(command.targetIds).size!==command.targetIds.length)return invalid;
      if(Object.hasOwn(command,'techniqueVariant')&&!['one-hit','two-hit','lancelot-1','lancelot-2'].includes(command.techniqueVariant as string))return invalid;
      let coSource:Extract<GameCommand,{type:'ATTACK'}>['coSource'];
      if(Object.hasOwn(command,'coSource')){
        const co=plainDataRecord(command.coSource,['cardInstanceId','dedicated','techniqueVariant']);
        if(!co||!exactKeys(co,['cardInstanceId','dedicated',...(Object.hasOwn(co,'techniqueVariant')?['techniqueVariant']:[])])||!identifier(co.cardInstanceId)||typeof co.dedicated!=='boolean'||Object.hasOwn(co,'techniqueVariant')&&!['one-hit','two-hit','lancelot-1','lancelot-2'].includes(co.techniqueVariant as string))return invalid;
        coSource={cardInstanceId:co.cardInstanceId,dedicated:co.dedicated,...(Object.hasOwn(co,'techniqueVariant')?{techniqueVariant:co.techniqueVariant as TechniqueVariant}:{})};
      }
      let dispel:Extract<GameCommand,{type:'ATTACK'}>['dispel'];
      if(Object.hasOwn(command,'dispel')){
        const d=plainDataRecord(command.dispel,['cardInstanceId','targetId']);
        if(!d||!exactKeys(d,['cardInstanceId','targetId'])||d.cardInstanceId!=='a2-p02-r3c1'||!identifier(d.targetId))return invalid;
        dispel={cardInstanceId:d.cardInstanceId,targetId:d.targetId};
      }
      const advances=command.advanceCardInstanceIds;
      if(Object.hasOwn(command,'advanceCardInstanceIds')&&(!Array.isArray(advances)||advances.length>220||!advances.every(identifier)||new Set(advances).size!==advances.length))return invalid;
      return {ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,targetIds:[...command.targetIds],dedicated:command.dedicated,...(dispel?{dispel}:{}),...(coSource?{coSource}:{}),...(Array.isArray(advances)?{advanceCardInstanceIds:[...advances]}:{}),...(Object.hasOwn(command,'techniqueVariant')?{techniqueVariant:command.techniqueVariant as TechniqueVariant}:{})}};
    }
    case 'PLAY_DEFENSE': {
      if(!exactKeys(command,['type','cardInstanceId','dedicated',...(Object.hasOwn(command,'coSource')?['coSource']:[])])||!identifier(command.cardInstanceId)||typeof command.dedicated!=='boolean')return invalid;
      if(!Object.hasOwn(command,'coSource'))return {ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,dedicated:command.dedicated}};
      const co=plainDataRecord(command.coSource,['cardInstanceId','dedicated','techniqueVariant']);
      if(!co||!exactKeys(co,['cardInstanceId','dedicated',...(Object.hasOwn(co,'techniqueVariant')?['techniqueVariant']:[])])||!identifier(co.cardInstanceId)||typeof co.dedicated!=='boolean'||Object.hasOwn(co,'techniqueVariant')&&!['one-hit','two-hit','lancelot-1','lancelot-2'].includes(co.techniqueVariant as string))return invalid;
      return {ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,dedicated:command.dedicated,coSource:{cardInstanceId:co.cardInstanceId,dedicated:co.dedicated,...(Object.hasOwn(co,'techniqueVariant')?{techniqueVariant:co.techniqueVariant as TechniqueVariant}:{})}}};
    }
    case 'PLAY_REACTION':
      if(command.mode==='cancel-ability')return exactKeys(command,['type','cardInstanceId','mode','targetAbilityId'])&&identifier(command.cardInstanceId)&&identifier(command.targetAbilityId)?{ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,mode:command.mode,targetAbilityId:command.targetAbilityId}}:invalid;
      if (Object.hasOwn(command,'targetRollId')) return exactKeys(command,['type','cardInstanceId','mode','targetRollId']) && identifier(command.cardInstanceId) && identifier(command.targetRollId) && (command.mode==='reroll'||command.mode==='force-fail') ? {ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,mode:command.mode,targetRollId:command.targetRollId}} : invalid;
      if ((!exactKeys(command,['type','cardInstanceId','mode','targetActionId'])&&!exactKeys(command,['type','cardInstanceId','mode','targetActionId','dedicated'])) || !identifier(command.cardInstanceId) || !identifier(command.targetActionId) || !['cancel','force-fail','effect-plus'].includes(command.mode as string)||Object.hasOwn(command,'dedicated')&&typeof command.dedicated!=='boolean') return invalid;
      return { ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId,mode:command.mode as 'cancel'|'force-fail'|'effect-plus',targetActionId:command.targetActionId,...(Object.hasOwn(command,'dedicated')?{dedicated:command.dedicated as boolean}:{})} };
    case 'CANCEL_REACTION':
      if(!exactKeys(command,['type','targetActionId'])||!identifier(command.targetActionId))return invalid;
      return {ok:true,value:{type:command.type,targetActionId:command.targetActionId}};
    case 'WITHDRAW':
      if(!exactKeys(command,['type','targetId','cardInstanceId',...(Object.hasOwn(command,'abilityId')?['abilityId']:[])])||!identifier(command.targetId)||!identifier(command.cardInstanceId)||Object.hasOwn(command,'abilityId')&&!['c2-p01-r2c2-ab01','c2-p02-r1c1-ab01'].includes(command.abilityId as string))return invalid;
      return {ok:true,value:{type:'WITHDRAW',targetId:command.targetId,cardInstanceId:command.cardInstanceId,...(command.abilityId?{abilityId:command.abilityId}:{})} as GameCommand};
    case 'APPROACH':
      if(!exactKeys(command,['type','targetId','cardInstanceId'])||!identifier(command.targetId)||!identifier(command.cardInstanceId))return invalid;
      return {ok:true,value:{type:command.type,targetId:command.targetId,cardInstanceId:command.cardInstanceId}};
    case 'PLAY_MAAI': {
      const additional=command.additionalCardInstanceIds,hasAdditional=Object.hasOwn(command,'additionalCardInstanceIds');
      if(!exactKeys(command,['type','cardInstanceId',...(hasAdditional?['additionalCardInstanceIds']:[]),...(Object.hasOwn(command,'abilityId')?['abilityId']:[])])||!identifier(command.cardInstanceId)||Object.hasOwn(command,'abilityId')&&!['c2-p01-r2c2-ab01','c2-p02-r1c1-ab01','c2-p02-r2c1-ab03'].includes(command.abilityId as string))return invalid;
      if(hasAdditional&&(!Array.isArray(additional)||!additional.length||additional.length>219||!additional.every(identifier)||new Set([command.cardInstanceId,...additional]).size!==additional.length+1))return invalid;
      return {ok:true,value:{type:'PLAY_MAAI',cardInstanceId:command.cardInstanceId,...(hasAdditional?{additionalCardInstanceIds:[...additional as string[]]}:{}),...(command.abilityId?{abilityId:command.abilityId}: {})} as GameCommand};
    }
    case 'PLAY_ADVANCE':
      if(!exactKeys(command,['type','cardInstanceId'])||!identifier(command.cardInstanceId))return invalid;
      return {ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId}};
    case 'REVEAL_CHARACTER':
      return exactKeys(command,['type',...(Object.hasOwn(command,'abilityId')?['abilityId']:[])])&&(!Object.hasOwn(command,'abilityId')||command.abilityId==='c2-p04-r2c1-ab03')?{ok:true,value:{type:command.type,...(command.abilityId?{abilityId:command.abilityId as 'c2-p04-r2c1-ab03'}:{})}}:invalid;
    case 'CHOOSE_DRAW':
      return exactKeys(command,['type','draw',...(Object.hasOwn(command,'abilityId')?['abilityId']:[])])&&typeof command.draw==='boolean'&&(!Object.hasOwn(command,'abilityId')||command.draw===true&&['c2-p01-r2c2-ab02','c2-p07-r1c1-ab03'].includes(command.abilityId as string))?{ok:true,value:{type:command.type,draw:command.draw,...(typeof command.abilityId==='string'?{abilityId:command.abilityId}:{})}}:invalid;
    case 'PLAY_TURN_CARD':
      if(command.mode==='wish')return exactKeys(command,['type','cardInstanceId','mode'])&&['a2-p04-r3c2','a2-p04-r3c3'].includes(command.cardInstanceId as string)?{ok:true,value:{type:command.type,cardInstanceId:command.cardInstanceId as 'a2-p04-r3c2'|'a2-p04-r3c3',mode:'wish'}}:invalid;
      if(Object.hasOwn(command,'targetId')){
        if(!exactKeys(command,['type','cardInstanceId','targetId',...(Object.hasOwn(command,'mode')?['mode']:[])])||!['a2-p04-r1c1','a2-p04-r1c2','a2-p04-r1c3','a2-p04-r2c2','a2-p05-r1c2'].includes(command.cardInstanceId as string)||!identifier(command.targetId)||Object.hasOwn(command,'mode')&&!['ordinary','astrology'].includes(command.mode as string))return invalid;
        return {ok:true,value:{type:'PLAY_TURN_CARD',cardInstanceId:command.cardInstanceId,targetId:command.targetId,...(command.mode?{mode:command.mode}:{})} as GameCommand};
      }
      if(command.cardInstanceId!==undefined){
        if(!exactKeys(command,['type','cardInstanceId',...(Object.hasOwn(command,'mode')?['mode']:[])])||!['a2-p03-r1c1','a2-p03-r1c2','a2-p03-r1c3','a2-p03-r2c2','a2-p03-r2c3','a2-p04-r2c1'].includes(command.cardInstanceId as string)||Object.hasOwn(command,'mode')&&!['ordinary','dedicated'].includes(command.mode as string))return invalid;
        return {ok:true,value:{type:'PLAY_TURN_CARD',cardInstanceId:command.cardInstanceId,...(command.mode?{mode:command.mode}:{})} as GameCommand};
      }
      if(!exactKeys(command,['type','cardInstanceIds'])||!Array.isArray(command.cardInstanceIds)||!command.cardInstanceIds.length||command.cardInstanceIds.length>220||!command.cardInstanceIds.every(identifier)||new Set(command.cardInstanceIds).size!==command.cardInstanceIds.length)return invalid;
      return {ok:true,value:{type:'PLAY_TURN_CARD',cardInstanceIds:[...command.cardInstanceIds]}};
    case 'ARRANGE_FOLLOWERS':
    case 'REST':
    case 'END_TURN': {
      const key = command.type !== 'END_TURN' ? 'cardInstanceIds' : 'discardIds';
      const ids = command[key];
      if (!exactKeys(command, ['type', key]) || !Array.isArray(ids) || ids.length > 220 || !ids.every(identifier) || new Set(ids).size !== ids.length || (command.type === 'REST' && !ids.length)) return invalid;
      return command.type !== 'END_TURN' ? { ok: true, value: { type: command.type, cardInstanceIds: [...ids] } } : { ok: true, value: { type: command.type, discardIds: [...ids] } };
    }
    default:
      return invalid;
  }
}

export function parseCommandEnvelope(value: unknown): ParseResult<CommandEnvelope> {
  const invalid = { ok: false, code: 'INVALID_ENVELOPE' } as const;
  const envelopeValue = plainDataRecord(value, [
    'protocolVersion', 'commandId', 'expectedRevision', 'windowId', 'windowRevision', 'command',
  ]);
  if (!envelopeValue || envelopeValue.protocolVersion !== 1 || !identifier(envelopeValue.commandId) || !revision(envelopeValue.expectedRevision)) {
    return invalid;
  }
  const hasWindowId = Object.hasOwn(envelopeValue, 'windowId');
  const hasWindowRevision = Object.hasOwn(envelopeValue, 'windowRevision');
  if (hasWindowId !== hasWindowRevision ||
      (hasWindowId && (!identifier(envelopeValue.windowId) || !revision(envelopeValue.windowRevision)))) return invalid;
  const command = parseGameCommand(envelopeValue.command);
  if (!command.ok) return command;
  const envelope: CommandEnvelope = {
    protocolVersion: 1,
    commandId: envelopeValue.commandId,
    expectedRevision: envelopeValue.expectedRevision,
    command: command.value,
  };
  if (hasWindowId) {
    envelope.windowId = envelopeValue.windowId as string;
    envelope.windowRevision = envelopeValue.windowRevision as number;
  }
  return { ok: true, value: envelope };
}
