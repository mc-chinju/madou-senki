import type {GameState} from '../state.js';
/** Exact persisted producer, or explicit declaration opponents before an action exists. */
export type StatProvenance={kind:'action'|'roll'|'ability'|'window';id:string}|{kind:'group';id:string;targetId?:string|null}|{kind:'combat';attackerId:string;targetIds:string[]}|{kind:'none'};
export interface CombatStatContext {groupId?:string;attackerId:string;targetIds:string[];moraleFollowerCardInstanceId?:string}
export function combatStatContext(s:GameState,provenance?:StatProvenance):CombatStatContext|undefined {
 const seen=new Set<string>();
 function resolve(p:StatProvenance|undefined):CombatStatContext|undefined{
  if(!p||p.kind==='none')return;
  if(p.kind==='combat')return {attackerId:p.attackerId,targetIds:[...p.targetIds]};
  const key=`${p.kind}:${p.id}`;if(seen.has(key))return;seen.add(key);
  if(p.kind==='group'){const g=s.groups?.[p.id];return g?{groupId:g.id,attackerId:g.attackerId,targetIds:p.targetId?[p.targetId]:g.targets.map(t=>t.actorId)}:undefined;}
  if(p.kind==='roll'){
   const r=s.rolls?.find(r=>r.id===p.id);if(!r)return;const c=r.resume;
   if('groupId' in c){const context=resolve({kind:'group',id:c.groupId,targetId:c.targetId});return context&&{...context,...(c.kind==='follower'?{moraleFollowerCardInstanceId:c.cardInstanceId}:{})};}
   if('actionId' in c)return resolve({kind:'action',id:c.actionId});
   if(c.kind==='ability')return resolve({kind:'ability',id:c.abilityId});
   return;
  }
  if(p.kind==='action'){
   const a=s.actions?.[p.id];if(!a)return;
   if(['attack','follower-reflection','ability-reflection'].includes(a.kind))return {attackerId:a.actorId,targetIds:[...a.targetIds]};
   if(a.kind==='defense'&&a.technique.defense==='counter'){const g=s.groups?.[a.groupId!];if(g)return {attackerId:a.actorId,targetIds:[g.attackerId]};}
   if(a.kind==='defense'&&a.groupId)return resolve({kind:'group',id:a.groupId,targetId:a.actorId});
   return (a.targetRollId?resolve({kind:'roll',id:a.targetRollId}):undefined)
    ??(a.targetAbilityId?resolve({kind:'ability',id:a.targetAbilityId}):undefined)
    ??(a.targetActionId?resolve({kind:'action',id:a.targetActionId}):undefined)
    ??(a.parentWindowId?resolve({kind:'window',id:a.parentWindowId}):undefined);
  }
  if(p.kind==='ability'){
   const a=s.abilities?.[p.id];if(!a)return;const c=a.context;
   return ('groupId' in c?resolve({kind:'group',id:c.groupId,...('targetId' in c?{targetId:c.targetId}:{})}):undefined)
    ??('actionId' in c?resolve({kind:'action',id:c.actionId}):undefined)
    ??(c.kind==='mental-guard'?resolve({kind:'roll',id:c.rollId}):undefined)
    ??('sourceAbilityId' in c?resolve({kind:'ability',id:c.sourceAbilityId}):undefined)
    ??(a.parentWindowId?resolve({kind:'window',id:a.parentWindowId}):undefined);
  }
  const w=s.windows?.find(w=>w.id===p.id);if(!w)return;const c=w.continuation;
  return (c.kind==='action'||c.kind==='ability'||c.kind==='roll'||c.kind==='group'?resolve({kind:c.kind,id:c.id,...(c.kind==='group'?{targetId:c.targetId}:{})}):undefined)
   ??(w.parentId?resolve({kind:'window',id:w.parentId}):undefined);
 }
 return resolve(provenance??(s.windows?.at(-1)?{kind:'window',id:s.windows.at(-1)!.id}:undefined));
}
