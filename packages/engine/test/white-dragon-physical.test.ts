import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,until,closeWindow,passReclaims} from './combat-helpers.js';
import {entropy} from './fixtures.js';
import {makeWhiteDragonScenario,whiteDragonMode,type WhiteDragonScenario} from '../../../apps/worker/test/fixtures/white-dragon-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=['white-sword-ordinary','white-sword-first','white-sword-inherited','white-sword-full','white-slash-ordinary','white-slash-first','white-slash-inherited','white-slash-full'] as const;
function command(name:WhiteDragonScenario){const m=whiteDragonMode(name);return {type:'ATTACK' as const,cardInstanceId:m.card,targetIds:name.startsWith('white-slash')&&m.dedicated?['B','C']:['B'],dedicated:m.dedicated,...(m.variant?{techniqueVariant:m.variant}:{})};}
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function toDefense(s:GameState){for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind==='normal-defense')return s;s=pass(s,[2,3,4,5]);}throw Error('WHITE_DRAGON_DEFENSE');}
it.each(rows)('%s exact elected package preserves printed use level, full profile, real chant and one shared damage',(scenario)=>{
 const m=whiteDragonMode(scenario),slash=scenario.startsWith('white-slash'),numeric=slash&&m.dedicated&&m.variant==='lancelot-1';for(const level of [m.use-1,m.use]){let s=makeWhiteDragonScenario(scenario,players,{level});if(m.chant){expect(s.players.A!.chants).toEqual([{cardInstanceId:m.card,revealed:false}]);for(const id of ['B','C','D'])expect(viewFor(s,id).players.A!.chants).toEqual([{position:0,face:'back'}]);}s=act(s,'A',command(scenario));const f=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!;expect(f.technique).toMatchObject({school:'warrior',range:slash?'far':'near',useLevel:m.use,effectLevel:m.effect,damage:numeric?null:m.damage,attributes:slash?['戦','剣','白','詠']:['戦','剣','白'],chant:m.chant,noChecks:m.dedicated,destroyFollowerAttributes:['黒','死'],target:slash&&m.dedicated?'all':'one'});expect(f.fromChant??false).toBe(m.chant);expect(f.checkSpecs).toHaveLength(m.dedicated?0:m.use-level);s=toDefense(s);if(numeric){const rolls=s.rolls!.filter(r=>r.purpose==='attack-damage');expect(rolls).toHaveLength(1);expect(rolls[0]).toMatchObject({formula:'4d6+1',faces:[2,3,4,5],total:15});}expect(Object.values(s.groups!)[0]!.targets.map(t=>t.hits[0]!.damage)).toEqual(Array(slash&&m.dedicated?2:1).fill(m.damage));s=finish(s);expect([s.players.B!.damage,s.players.C!.damage,s.players.D!.damage]).toEqual([m.damage,slash&&m.dedicated?m.damage:0,0]);expect(s.discard.filter(id=>id===m.card)).toHaveLength(1);expect(s.players.A!.chants).toEqual([]);}
});
it.each(rows)('%s actual Fate cancels the elected package without damage dice and pays its source once',scenario=>{
 const m=whiteDragonMode(scenario);let s=act(makeWhiteDragonScenario(scenario,players),'A',command(scenario));const id=Object.values(s.actions!).find(a=>a.cardInstanceId===m.card)!.id;s=pass(s);s=pass(s);s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});s=finish(s);expect([s.players.B!.damage,s.players.C!.damage]).toEqual([0,0]);expect(s.rolls??[]).toEqual([]);expect(s.discard.filter(id=>id===m.card)).toHaveLength(1);expect(s.players.A!.chants).toEqual([]);
});
it.each(['white-sword-ordinary','white-sword-first','white-sword-inherited','white-sword-full'] as const)('%s actual per-hit maai uses one ordinary or two dedicated physical cards',scenario=>{
 const m=whiteDragonMode(scenario),required=m.dedicated?2:1;for(const count of [1,2]){let s=toDefense(act(makeWhiteDragonScenario(scenario,players),'A',command(scenario)));s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'}));reject(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c1'});if(required===2&&count===2)s=passReclaims(act(s,'B',{type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2'}));s=finish(s);expect(s.players.B!.damage).toBe(count>=required?0:m.damage);}
});
it.each([['white-sword-ordinary','小悪魔'],['white-sword-ordinary','スケルトン'],['white-slash-ordinary','小悪魔'],['white-slash-ordinary','スケルトン']] as const)('%s destroys actual initial %s by black or dead attribute before follower HP', (scenario,follower)=>{
 let s=makeWhiteDragonScenario(scenario,players,{follower});const guard=s.players.B!.followers[0]!.cardInstanceId;s=until(act(s,'A',command(scenario)),'follower-start');s=closeWindow(s);expect(Object.values(s.groups!)[0]!.targets[0]!.followerDefense![0]!.hits[0]!.outcome).toBe('attribute-destroyed');s=finish(s);expect(s.players.B!.damage).toBe(whiteDragonMode(scenario).damage);expect(s.discard.filter(id=>id===guard)).toHaveLength(1);
});
it.each(['white-slash-ordinary','white-slash-first','white-slash-inherited'] as const)('%s requires actual chant and cannot borrow the later package exemption',scenario=>{
 const s=makeWhiteDragonScenario(scenario,players,{prepared:false});reject(s,'A',command(scenario));
});
it.each(['white-sword-ordinary','white-slash-ordinary'] as const)('%s rejects foreign ownership, invalid partial packages and first-owner later variant',scenario=>{
 const m=whiteDragonMode(scenario),s=makeWhiteDragonScenario(scenario,players),foreign=makeWhiteDragonScenario(scenario,players,{owner:'侍大将のシン'});reject(s,'A',{...command(scenario),dedicated:true,techniqueVariant:'lancelot-2'});reject(s,'A',{...command(scenario),techniqueVariant:'lancelot-1'});reject(s,'A',{...command(scenario),dedicated:true,techniqueVariant:'one-hit'});reject(foreign,'A',{...command(scenario),dedicated:true,techniqueVariant:'lancelot-1'});reject(s,'A',{...command(scenario),targetIds:['B','C']});expect(s.players.A!.hand.includes(m.card)||s.players.A!.chants.some(c=>c.cardInstanceId===m.card)).toBe(true);
});
it.each(['white-sword-ordinary','white-slash-ordinary'] as const)('%s initial Lancelot II can elect ordinary effects without either dedicated package',scenario=>{
 let s=makeWhiteDragonScenario(scenario,players,{owner:'聖騎士ランスロット2'});s=finish(act(s,'A',command(scenario)));expect(s.players.B!.damage).toBe(whiteDragonMode(scenario).damage);
});
it('White Sword far declaration rejects before an actual separate approach enables the near attack',()=>{
 let s=makeWhiteDragonScenario('white-sword-full',players,{prepared:false});reject(s,'A',command('white-sword-full'));s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:'a2-p24-r1c2'}));s=finish(act(s,'A',command('white-sword-full')));expect(s.players.B!.damage).toBe(15);
});
