import {reset,runInDurableObject} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import {activeWindowRef,allCardInstanceIds,viewFor,type GameCommand} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {openTestRoom} from './fixtures/recovery-room.js';
import type {CanonicalRoom} from './fixtures/canonical-room.js';
import {entropy} from './fixtures/scenario-tools.js';

afterEach(async()=>{await reset();});
it.each([
  'suppression-persist-ban-confusion',
  'suppression-persist-ban-hypnosis',
  'suppression-persist-ban-otherworld',
  'suppression-persist-source-confusion',
  'suppression-persist-source-hypnosis',
  'suppression-persist-source-otherworld',
  'suppression-persist-target-otherworld',
] as const)('%s retains established effects through actual hostile attack, eviction and replay',async scenario=>{
  const room=await openTestRoom(scenario),initial=await room.stored(),before=initial.state.game!;
  const target=scenario.includes('-ban-')?'A':scenario.includes('-target-')?'B':'C';
  const otherworld=scenario.endsWith('otherworld'),ban=scenario.includes('-ban-');
  const name=otherworld?'裂界':scenario.endsWith('confusion')?'錯乱':'催眠';
  const card=(otherworld?before.players.D!.chants.map(c=>c.cardInstanceId):before.players.D!.hand).find(id=>getAction(id)!.name===name)!;
  expect(card).toBeDefined();expect(before.suppressionDesignations).toHaveLength(1);
  expect(before.blessingLeases??[]).toHaveLength(ban?0:1);
  expect(before.players[target]!.presence??'active').toBe('active');
  expect(before.players[target]!.statuses??[]).toEqual([]);
  let seq=0;
  async function send(actorId:string,command:GameCommand){
    const current=await room.stored(),s=current.state.game!,roll=s.rolls?.at(-1);
    const e={...entropy(),dice:Array(100).fill(roll?.stage==='before-roll'&&roll.purpose==='status-resistance'?6:1)};
    await runInDurableObject(room.room,instance=>(instance as CanonicalRoom).setNextEntropy(e));
    const envelope={protocolVersion:1 as const,commandId:`persist-${seq++}`,expectedRevision:current.revision,...activeWindowRef(s),command};
    const ack=await room.command(actorId,envelope);expect(ack).toMatchObject({type:'ack'});
    const saved=await room.stored();await room.restart();expect(await room.command(actorId,envelope)).toEqual(ack);expect(await room.stored()).toEqual(saved);
    expect(allCardInstanceIds(saved.state.game!).sort()).toEqual(allCardInstanceIds(before).sort());
    for(const id of ['A','B','C','D'])expect((await room.snapshotFor(id)).game).toEqual(viewFor(saved.state.game!,id));
  }
  await send('D',{type:'ATTACK',cardInstanceId:card,targetIds:[target],dedicated:false});
  for(let n=0;n<300;n++){
    const s=(await room.stored()).state.game!,w=s.windows?.at(-1);if(!w)break;
    if(viewFor(s,'D').lifetimeDecision)await send('D',{type:'CHOOSE_LIFETIME_EFFECT',choice:'apply'});
    else await send(w.participants[w.cursor]!,{type:'PASS'});
  }
  const saved=await room.stored(),s=saved.state.game!;
  expect(s.windows??[]).toEqual([]);expect(s.outcome).toBeUndefined();
  if(otherworld){expect(s.players[target]!.presence).toBe('otherworld');expect(s.players[target]!.lifeId).toBe(before.players[target]!.lifeId);}
  else expect(s.players[target]!.statuses).toContainEqual(expect.objectContaining({kind:scenario.endsWith('confusion')?'ability-disabled':'stopped',sourceCardInstanceId:card}));
  expect(s.suppressionDesignations).toEqual(before.suppressionDesignations);
  expect(s.blessingLeases??[]).toEqual(before.blessingLeases??[]);
  for(const id of ['A','B','C','D'])expect(viewFor(s,id).suppressionTargets).toEqual([{targetId:'B',designated:true,applicability:ban?'suppressed':'relieved'}]);
  await room.restart();expect(await room.stored()).toEqual(saved);
},20000);
