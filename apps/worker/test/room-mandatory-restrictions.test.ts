import {reset} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {openTestRoom} from './fixtures/recovery-room.js';
afterEach(async()=>{await reset();});
it.each(['attack','chant','counter'] as const)('Fury black %s rejection survives real DO restart without payment or revision',async route=>{
 const room=await openTestRoom(route==='counter'?'mandatory-fury-counter':'mandatory-fury'),actorId=route==='counter'?'B':'A';
 const command:GameCommand=route==='chant'?{type:'CHANT',cardInstanceId:'a2-p13-r3c2'}:route==='counter'?{type:'PLAY_DEFENSE',cardInstanceId:'a2-p17-r3c1',dedicated:false}:{type:'ATTACK',cardInstanceId:'a2-p16-r2c1',targetIds:['B'],dedicated:false};
 const before=await room.stored(),envelope={protocolVersion:1 as const,commandId:`mandatory-${route}`,expectedRevision:before.revision,...activeWindowRef(before.state.game!),command};const reply=await room.command(actorId,envelope);expect(reply).toMatchObject({type:'error',code:'INVALID_ACTION'});expect(await room.stored()).toEqual(before);await room.restart();expect(await room.command(actorId,envelope)).toEqual(reply);expect(await room.stored()).toEqual(before);expect(new Set(allCardInstanceIds(before.state.game!)).size).toBe(220);
 if(route==='attack'){const positive={...envelope,commandId:'mandatory-positive',command:{type:'ATTACK' as const,cardInstanceId:'a2-p08-r1c1',targetIds:['B'],dedicated:false}};const ack=await room.command(actorId,positive);expect(ack).toMatchObject({type:'ack'});const saved=await room.stored();await room.restart();expect(await room.command(actorId,positive)).toEqual(ack);expect(await room.stored()).toEqual(saved);}
});
