import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand,type GameState} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
import {CanonicalRoom} from './fixtures/canonical-room.js';
afterEach(async()=>{await reset();});
async function setup(name:'canonical-S09'|'canonical-S10'){
 const room=await openTestRoom(name);let seq=0;const state=async()=>(await room.stored()).state.game!;
 async function act(s:GameState,actorId:string,command:GameCommand,dice=[1,1]){const before=await room.stored();expect(before.state.game).toEqual(s);await runInDurableObject(room.room,i=>(i as CanonicalRoom).setNextEntropy({now:1000,dice,random:Array(4096).fill(0.5)}));const envelope={protocolVersion:1 as const,commandId:`defense-${seq++}`,expectedRevision:before.revision,...activeWindowRef(s),command},ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);return saved.state.game!;}
 async function pass(s:GameState,dice=[1,1]){const w=s.windows!.at(-1)!;return act(s,w.participants[w.cursor]!,{type:'PASS'},dice);}
 async function until(s:GameState,kind:string){for(let n=0;n<300;n++){if(s.windows?.at(-1)?.kind===kind)return s;s=await pass(s);}throw Error('CANONICAL_DEFENSE_WINDOW');}
 async function finish(s:GameState){for(let n=0;n<300;n++){if(!s.windows?.length)return s;s=await pass(s);}throw Error('CANONICAL_DEFENSE_FINISH');}
 return {state,act,pass,until,finish};
}
it('S09 Ramba dedicated Death Axe6 versus Shin checked parry6 cancels B and keeps C damage10',async()=>{
 const f=await setup('canonical-S09'),{act,pass,until,finish}=f;let s=await f.state();const incoming=Object.values(s.actions!).find(a=>a.kind==='attack')!;expect(incoming.technique).toMatchObject({effectLevel:6,damage:10,noChecks:true});
 s=await act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p12-r1c3',dedicated:false});const defense=Object.values(s.actions!).find(a=>a.kind==='defense')!;expect(defense.technique.effectLevel).toBe(6);expect(defense.checks).toHaveLength(1);
 s=await until(s,'normal-defense');expect(s.windows!.at(-1)!.continuation).toMatchObject({targetId:'C'});const group=Object.values(s.groups!)[0]!;expect(group.targets[0]!.hits[0]!.defended).toBe(true);expect(group.targets[1]!.hits[0]).toMatchObject({defended:false,damage:10});
 s=await finish(s);expect([s.players.A!.damage,s.players.B!.damage,s.players.C!.damage]).toEqual([0,0,10]);
});
it('S10 Arnes ordinary Black Bow5 versus Lancelot dedicated sword6 plus real prayer1 blocks at far without return',async()=>{
 const f=await setup('canonical-S10'),{act,pass,until,finish}=f;let s=await f.state();expect(s.distances.A!.B).toBe('far');expect(Object.values(s.actions!).find(a=>a.kind==='attack')!.technique.effectLevel).toBe(5);
 s=await act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:'a2-p11-r1c2',dedicated:true});const defense=Object.values(s.actions!).find(a=>a.kind==='defense')!;expect(defense.technique).toMatchObject({effectLevel:6,counterNoChecks:true,range:'near'});
 expect(defense.checks).toHaveLength(0);s=await until(s,'effect-level');while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=await pass(s);
 s=await act(s,'B',{type:'PLAY_REACTION',cardInstanceId:'a2-p05-r2c3',mode:'effect-plus',targetActionId:defense.id});
 for(let n=0;!(s.windows?.at(-1)?.kind==='damage'&&s.windows.at(-1)!.continuation.id===defense.id)&&n<300;n++)s=await pass(s,[1]);
 expect(s.actions![defense.id]!.technique.effectLevel).toBe(7);s=await finish(s);expect([s.players.A!.damage,s.players.B!.damage]).toEqual([0,0]);expect(s.distances.A!.B).toBe('far');
});
