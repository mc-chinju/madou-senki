import {recordCardPlayed} from '../public-record.js';
import type {GameCommand} from '@madou/protocol';
import type {GameState} from '../state.js';
import type {ActionFrame} from '../reactions/continuations.js';
import {openWindow,participants} from '../reactions/windows.js';
import {lifeIdentity} from '../abilities/suppression-state.js';
import {isActive} from '../lifecycle/objectives.js';
import {followerFor} from './follower-descriptors.js';
import {reclaimEventId} from '../reclaim.js';
import {appendEvent} from '../setup.js';
import {techniqueFor} from './registry.js';
export const DISPEL='a2-p02-r3c1';
type Attack=Extract<GameCommand,{type:'ATTACK'}>;
export function validDispel(s:GameState,actorId:string,c:Attack):boolean {
 const d=c.dispel;if(!d)return true;
 return d.cardInstanceId===DISPEL&&s.players[actorId]!.hand.includes(DISPEL)&&c.cardInstanceId!==DISPEL&&c.coSource?.cardInstanceId!==DISPEL&&!c.advanceCardInstanceIds?.includes(DISPEL)&&c.targetIds.includes(d.targetId)&&d.targetId!==actorId;
}
/** Both cards are committed atomically; this child resolves before the saved attack declaration. */
export function beginDispel(s:GameState,attack:ActionFrame,targetId:string):void {
 const p=s.players[attack.actorId]!,w=s.windows!.at(-1)!;
 p.hand.splice(p.hand.indexOf(DISPEL),1);s.resolution.push(DISPEL);recordCardPlayed(s,p.id,DISPEL,'anytime',[targetId]);(s.used??=[]).push(`${attack.eventId}:${p.id}:${DISPEL}`);
 const id=`a-${s.nextEventId++}`;attack.preAttackPending=id;
 s.actions![id]={id,eventId:attack.eventId,parentWindowId:w.id,actorId:p.id,cardInstanceId:DISPEL,kind:'reaction',targetIds:[targetId],technique:techniqueFor('a2-p05-r3c1')!,groupId:null,stage:'declaration',checks:[],roll:null,canceled:false,
  reclaimOwnerLifeId:lifeIdentity(p),preAttack:{attackId:attack.id,targetLifeId:lifeIdentity(s.players[targetId]!),destroyed:[]}};
 openWindow(s,'declaration',attack.eventId,{kind:'action',id},participants(s,(s.seatOrder.indexOf(p.id)+1)%s.seatOrder.length));
}
export function resolveDispel(s:GameState,a:ActionFrame):void {
 const saved=a.preAttack!,attack=s.actions?.[saved.attackId],p=s.players[a.actorId]!,target=s.players[a.targetIds[0]!]!;
 if(!attack||!isActive(p)||lifeIdentity(p)!==a.reclaimOwnerLifeId||!isActive(target)||lifeIdentity(target)!==saved.targetLifeId)return;
 for(const placed of [...target.followers]){
  if(!followerFor(placed.cardInstanceId)?.attributes.includes('ゴ'))continue;
  target.followers=target.followers.filter(f=>f.cardInstanceId!==placed.cardInstanceId);s.resolution.push(placed.cardInstanceId);
  const sourceActorId=placed.placedById??target.id;
  saved.destroyed.push({kind:'ordinary-disposition',fromZone:'resolution',eventId:reclaimEventId(s,a),sourceId:`${a.id}-${placed.cardInstanceId}`,sourceActorId,sourceLifeId:placed.placedLifeId??lifeIdentity(s.players[sourceActorId]!),cardInstanceId:placed.cardInstanceId,trigger:'follower-died'});
  appendEvent(s,s.events.at(-1)?.at??0,{type:'FOLLOWER_DESTROYED',actorId:a.actorId,targetId:target.id,cardInstanceId:placed.cardInstanceId,audience:'public'});
 }
}
