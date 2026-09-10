import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each([['evade-physical-1','a2-p05-r3c1'],['evade-physical-2','a2-p05-r3c2'],['evade-physical-3','a2-p05-r3c3']] as const)('%s saves physical %s defense and applies only the other two actual hits',async(scenario,card)=>{
 const room=await openTestRoom(scenario);let seq=0;
 async function send(actorId:string,command:GameCommand){const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`evade-${seq++}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored(),ids=allCardInstanceIds(saved.state.game!);expect(ids).toHaveLength(220);expect(new Set(ids).size).toBe(220);await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
 const initial=(await room.stored()).state.game!;expect(Object.values(initial.groups!)[0]!.targets[0]!.hits.map(h=>h.damage)).toEqual([7,7,7]);
 for(const viewer of ['A','C','D']){const v=(await room.snapshotFor(viewer)).game!;expect(v.players.B).not.toHaveProperty('hand');expect(JSON.stringify(v)).not.toContain(card);}
 await send('B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});expect((await room.stored()).state.game!.resolution).toContain(card);
 for(const viewer of ['A','B','C','D'])expect((await room.snapshotFor(viewer)).game!.currentAction).toMatchObject({cardInstanceId:card,kind:'defense'});
 for(let n=0;n<300;n++){const s=(await room.stored()).state.game!,w=s.windows?.at(-1);if(!w)break;await send(w.participants[w.cursor]!,{type:'PASS'});}
 const done=(await room.stored()).state.game!;expect(done.windows).toEqual([]);expect(done.players.B!.damage).toBe(14);expect(done.players.C!.damage).toBe(0);expect(done.discard.filter(id=>id===card)).toHaveLength(1);expect(done.players.B!.hand).not.toContain(card);expect(done.phase).toBe('withdrawal');
});
