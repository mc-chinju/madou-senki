import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,until,pass,closeWindow,passReclaims,ready} from './combat-helpers.js';
import {entropy,handCard} from './fixtures.js';
import {makeReflectLimitScenario} from '../../../apps/worker/test/fixtures/reflect-limit-scenarios.js';
const players=['A','B','C','D'].map(id=>({id,name:id}));
const rows=[['reflect-limit-mirror','a2-p11-r1c3',false,'warrior',6,5],['reflect-limit-mirror','a2-p11-r1c3',true,'warrior',7,6],['reflect-limit-god','a2-p17-r3c2',false,'magic',6,-1]] as const;
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
it.each(rows)('%s physical %s dedicated=%s printed %s profile keeps magic%s warrior%s limits and required checks',(scenario,card,dedicated,school,magic,warrior)=>{
 for(const level of [4,5]){let s=makeReflectLimitScenario(scenario,players,{level});s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});const defense=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!;expect(defense.technique).toMatchObject({school,range:'none',useLevel:5,effectLevel:5,damage:null,attributes:school==='warrior'?['戦','盾','反']:['魔','反'],counter:true,chant:false,noChecks:false,reflectMagicLimit:magic,blockWarriorLimit:warrior});expect(defense.checkSpecs).toHaveLength(5-level);s=finish(s);expect(s.rolls?.filter(r=>r.purpose==='excess-level').length??0).toBe(5-level);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([5,0]);expect(s.discard.filter(id=>id===card)).toHaveLength(1);}
});
it.each(rows)('%s physical %s dedicated=%s uses actual boosted attacks at %s magic%s warrior%s boundaries',(scenario,card,dedicated,_school,magic,warrior)=>{
 for(const school of ['magic','warrior'] as const)for(const bonus of [0,1,2]){let s=makeReflectLimitScenario(scenario,players,{school,bonus});const effect=(school==='magic'?6:5)+bonus;expect(viewFor(s,'B').currentAttack!.technique.effectLevel).toBe(effect);const allowed=effect<=(school==='magic'?magic:warrior);if(!allowed){reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});expect(s.players.B!.hand).toContain(card);}else{s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated}));expect([s.players.A!.damage,s.players.B!.damage]).toEqual(school==='magic'?[5,0]:[0,0]);expect(s.discard.filter(id=>id===card)).toHaveLength(1);}}
});
it.each(rows)('%s physical %s dedicated=%s actual Prayer distinguishes relative %s magic%s warrior%s limits',(scenario,card,dedicated,_school,magic,warrior)=>{
 let s=makeReflectLimitScenario(scenario,players);s=until(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated}),'effect-level');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);const id=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!.id;s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:'a2-p05-r2c3',mode:'effect-plus',targetActionId:id});for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind==='damage'&&s.windows.at(-1)!.continuation.id===id)break;s=pass(s,[2]);}
 const relative=scenario==='reflect-limit-mirror';expect(s.actions![id]!.technique).toMatchObject({useLevel:5,effectLevel:7,reflectMagicLimit:relative?magic+2:6,blockWarriorLimit:relative?warrior+2:-1});s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([5,0]);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});
it.each(rows)('%s physical %s dedicated=%s retains payment after actual %s check failure or Fate cancellation magic%s warrior%s',(scenario,card,dedicated)=>{
 for(const cancel of [false,true]){let s=makeReflectLimitScenario(scenario,players,{level:4});s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});if(cancel){const id=Object.values(s.actions!).find(a=>a.cardInstanceId===card)!.id;s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel',targetActionId:id});}else{s=until(s,'before-roll');s=passReclaims(closeWindow(s,[6,6]));expect(s.rolls!.at(-1)!.success).toBe(false);}s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,5]);expect(s.players.B!.hand).not.toContain(card);expect(s.discard.filter(id=>id===card)).toHaveLength(1);}
});
it.each(rows)('%s physical %s dedicated=%s refuses root attack and actual %s counter prohibition magic%s warrior%s',(scenario,card,dedicated)=>{
 let s=ready();handCard(s,'A',card==='a2-p11-r1c3'?'ミラーシールド':'神王界');reject(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=makeReflectLimitScenario(scenario,players,{prohibited:true});expect(viewFor(s,'B').currentAttack!.defenseRestrictions.counterProhibited).toBe(true);reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});
});
it.each(['聖騎士ランスロット','聖騎士ランスロット2'])('Physical Mirror dedicated owner %s alone raises the same incoming magic7 boundary',owner=>{
 let s=makeReflectLimitScenario('reflect-limit-mirror',players,{bonus:1,owner});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p11-r1c3',dedicated:false});s=finish(act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p11-r1c3',dedicated:true}));expect([s.players.A!.damage,s.players.B!.damage]).toEqual([5,0]);
});
it('Physical Mirror foreign dedicated owner and God King invented dedicated option reject before paying',()=>{
 for(const [scenario,card] of [['reflect-limit-mirror','a2-p11-r1c3'],['reflect-limit-god','a2-p17-r3c2']] as const){const s=makeReflectLimitScenario(scenario,players,{owner:'黒騎士ガーウィン'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:true});expect(s.players.B!.hand).toContain(card);}
});
it.each(rows)('%s physical %s dedicated=%s can be declined and closes after follower start for %s magic%s warrior%s',(scenario,card,dedicated)=>{
 for(const followers of [false,true]){let s=makeReflectLimitScenario(scenario,players);if(followers){s=act(s,'B',{type:'START_FOLLOWERS'});reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated});}s=finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,5]);expect(s.players.B!.hand).toContain(card);expect(s.discard).not.toContain(card);}
});
