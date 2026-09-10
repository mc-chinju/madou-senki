import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,until,closeWindow,passReclaims} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeMountainBreakerScenario,mountainBreakerMode,type MountainBreakerScenario} from '../../../apps/worker/test/fixtures/mountain-breaker-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=['mountain-base','mountain-lia','mountain-lancelot','mountain-lancelot-ii','breaker-base'] as const;
function command(name:MountainBreakerScenario){const m=mountainBreakerMode(name);return {type:'ATTACK' as const,cardInstanceId:m.card,targetIds:['B'],dedicated:m.dedicated};}
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it.each(rows)('%s actual physical profile and use4 boundary keep the printed ordinary or selected owner package',scenario=>{
 const m=mountainBreakerMode(scenario);for(const level of [3,4]){let s=act(makeMountainBreakerScenario(scenario,players,{level}),'A',command(scenario));const f=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!;expect(f.technique).toMatchObject({school:'warrior',range:m.far?'far':'near',useLevel:4,effectLevel:m.effect,damage:m.damage,attributes:m.far?['戦','剣']:['戦','剣','白'],chant:false,noChecks:m.dedicated,target:'one'});expect(f.technique.destroyFollowerAttributesAtOrBelowEffectLevel).toEqual(m.far?undefined:['黒','死']);expect(f.checkSpecs).toHaveLength(m.dedicated?0:4-level);s=finish(s);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([m.damage,0]);expect(s.discard.filter(id=>id===m.card)).toHaveLength(1);}
});
it.each([
 ['mountain-base','小悪魔',0,'attribute-destroyed',4],['mountain-base','ゾンビー',0,'attribute-destroyed',4],['mountain-base','ワイト',0,'blocked',0],['mountain-base','悪魔',0,'blocked',0],['mountain-base','ワイト',1,'attribute-destroyed',4],['mountain-base','悪魔',2,'attribute-destroyed',4],['mountain-base','メタルゴーレム',2,'equal-destroyed',0],['mountain-lia','ワイト',1,'attribute-destroyed',5],['mountain-lancelot','ワイト',0,'attribute-destroyed',6],['mountain-lancelot','悪魔',0,'blocked',0],['mountain-lancelot','悪魔',1,'attribute-destroyed',6],['mountain-lancelot-ii','ワイト',0,'attribute-destroyed',6],['breaker-base','小悪魔',0,'equal-destroyed',0],['breaker-base','悪魔',2,'equal-destroyed',0],
] as const)('%s actual %s Prayer%s resolves %s and body%s using attribute plus current effect level',(scenario,follower,bonus,outcome,damage)=>{
 const m=mountainBreakerMode(scenario);let s=makeMountainBreakerScenario(scenario,players,{follower});const guard=s.players.B!.followers[0]!.cardInstanceId;s=act(s,'A',command(scenario));const id=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!.id;if(bonus){s=until(s,'effect-level');s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:'a2-p05-r2c3',mode:'effect-plus',targetActionId:id});}for(let n=0;n<300&&s.windows?.at(-1)?.kind!=='follower-start';n++)s=pass(s,[bonus||1]);expect(s.actions![id]!.technique).toMatchObject({effectLevel:m.effect+bonus,useLevel:4,damage:m.damage});s=closeWindow(s);for(let n=0;n<100&&!Object.values(s.groups!)[0]!.targets[0]!.followerDefense![0]!.hits[0];n++)s=pass(s);const snap=Object.values(s.groups!)[0]!.targets[0]!.followerDefense![0]!;expect(snap.hits[0]!.outcome).toBe(outcome);s=finish(s);expect(s.players.B!.damage).toBe(damage);expect(s.players.B!.followers.some(f=>f.cardInstanceId===guard)).toBe(outcome==='blocked');
});
it.each(rows)('%s actual Fate cancellation pays its source without damage or extra effects',scenario=>{
 const m=mountainBreakerMode(scenario);let s=act(makeMountainBreakerScenario(scenario,players),'A',command(scenario));const id=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!.id;s=pass(s);s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.discard.filter(id=>id===m.card)).toHaveLength(1);expect(s.phase).toBe('withdrawal');
});
it.each(rows)('%s actual single-card maai prevents its one selected hit',scenario=>{
 let s=until(act(makeMountainBreakerScenario(scenario,players),'A',command(scenario)),'normal-defense');s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'}));s=finish(s);expect(s.players.B!.damage).toBe(0);
});
it.each(['mountain-base','mountain-lia','mountain-lancelot','mountain-lancelot-ii'] as const)('%s rejects far until actual approach and refuses foreign or mixed dedicated packages',scenario=>{
 let s=makeMountainBreakerScenario(scenario,players,{prepared:false});reject(s,'A',command(scenario));s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:'a2-p24-r1c2'}));reject(s,'A',{...command(scenario),targetIds:['B','C']});reject(s,'A',{...command(scenario),dedicated:true,techniqueVariant:'lancelot-1'});const foreign=makeMountainBreakerScenario(scenario,players,{owner:'侍大将のシン'});reject(foreign,'A',{...command(scenario),dedicated:true});s=finish(act(s,'A',command(scenario)));expect(s.players.B!.damage).toBe(mountainBreakerMode(scenario).damage);
});
it('Breaker has no printed dedicated mode or additional target and keeps actual ordinary use available',()=>{
 const s=makeMountainBreakerScenario('breaker-base',players);reject(s,'A',{...command('breaker-base'),dedicated:true});reject(s,'A',{...command('breaker-base'),targetIds:['B','C']});expect(finish(act(s,'A',command('breaker-base'))).players.B!.damage).toBe(5);
});
it.each(['聖騎士ランスロット','聖騎士ランスロット2'] as const)('Initial %s may decline the dedicated Mountain package and retain ordinary effect4 damage4',owner=>{
 let s=act(makeMountainBreakerScenario('mountain-base',players,{owner,level:3}),'A',command('mountain-base'));const f=Object.values(s.actions!).find(a=>a.cardInstanceId==='a2-p12-r1c1')!;expect(f.technique).toMatchObject({useLevel:4,effectLevel:4,damage:4,noChecks:false});expect(f.checkSpecs).toHaveLength(1);s=finish(s);expect(s.players.B!.damage).toBe(4);
});
