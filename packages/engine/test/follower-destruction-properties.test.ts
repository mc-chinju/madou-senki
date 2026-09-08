/** Pure property/heterogeneous helpers: no current canonical owner produces these synthetic mixed groups. */
import {it,expect} from 'vitest';
import {destructionTechnique,fixedReflectedTechnique,destructionEffects} from '../src/abilities/follower-destruction.js';
import {techniqueFor} from '../src/effects/registry.js';
import type {ActionFrame,AttackGroup,AttackTarget} from '../src/reactions/continuations.js';
import {ready} from './combat-helpers.js';
import {character} from './fixtures.js';
it('helper mixed-hit provenance follows its actual action and technique, never first-group fallback',()=>{
 const s=ready();character(s,'A','早駆けのランカスター');const warrior=techniqueFor('a2-p05-r3c1')!,magic={...warrior,school:'magic' as const};
 const a=(id:string,technique:typeof warrior):ActionFrame=>({id,eventId:id,actorId:'A',cardInstanceId:'a2-p05-r3c1',kind:'attack',parentWindowId:null,targetIds:['B'],technique,groupId:null,stage:'resolve',checks:[],roll:null,canceled:false});
 s.actions={warrior:a('warrior',warrior),magic:a('magic',magic)};
 const hit=(index:number,sourceActionId:string,technique:typeof warrior):AttackTarget['hits'][number]=>({index,sourceActionId,technique,defended:false,damage:4,hit:false,lineage:[]});
 const target:AttackTarget={actorId:'B',followerStarted:false,normalDefenseClosed:false,followerSnapshot:null,hits:[hit(0,'warrior',warrior),hit(1,'magic',magic),hit(2,'missing',warrior)]};
 const g:AttackGroup={id:'helper',actionId:'warrior',attackerId:'A',technique:warrior,destructionModifiers:[{actorId:'A',abilityId:'c2-p02-r2c1-ab02'}],targets:[target],hitIndices:[0,1,2],targetCursor:0,hitCursor:0,stage:'defense',maai:null};
 expect(target.hits.map(h=>destructionTechnique(s,g,target,h,h.technique!).destroyFollowerAttributes)).toEqual([['竜'],undefined,undefined]);
 s.actions.magic!.actorId='B';target.hits[1]!.technique=warrior;expect(destructionTechnique(s,g,target,target.hits[1]!,warrior).destroyFollowerAttributes).toBeUndefined();
});
it('helper fixed copied target damage strips named multiplier without dropping intrinsic properties',()=>{
 const original={...techniqueFor('a2-p05-r3c1')!,damage:8,destroyFollowerAttributes:['人'],characterDamageMultipliers:[{characterNames:['不死王ガドューラ'],multiplier:2}]};
 const copy=fixedReflectedTechnique(original,16);expect(copy).toMatchObject({damage:16,hitCount:1,destroyFollowerAttributes:['人']});expect(copy.characterDamageMultipliers).toBeUndefined();expect(original.characterDamageMultipliers).toHaveLength(1);expect(destructionEffects(copy)).toEqual(['人属性の従者を破壊']);
});
