import {expect,it,describe} from 'vitest';
import {parseGameCommand} from '../src/index.js';

describe('placed followers and transfers',()=>{
  it.each([{}, { dedicatedCardInstanceIds: [] }, { dedicatedCardInstanceIds: ['a2-p21-r1c2'] }])('accepts exact optional placed defense choices %j', extra => { const value = { type: 'START_FOLLOWERS', ...extra }; expect(parseGameCommand(value)).toEqual({ ok: true, value }); });
  it.each([{ dedicatedCardInstanceIds: ['x', 'x'] }, { dedicatedCardInstanceIds: 'x' }, { dedicatedCardInstanceIds: [null] }, { dedicatedCardInstanceIds: undefined }, { cardInstanceId: 'x' }, { dedicated: true }])('rejects malformed placed defense choice %j', extra => { expect(parseGameCommand({ type: 'START_FOLLOWERS', ...extra }).ok).toBe(false); });
  const base = { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: 'a2-p17-r3c3', targetIds: ['B'], dedicated: false };
  it.each([{ targetPosition: 0, destinationPosition: 0 }, { targetPosition: 3, destinationPosition: 2, replacementCardInstanceId: 'a2-p19-r1c1' }])('accepts public integer transfer slots %j', followerTransfer => { const value = { ...base, followerTransfer }; expect(parseGameCommand(value)).toEqual({ ok: true, value }); });
  it.each([{ targetPosition: -1, destinationPosition: 0 }, { targetPosition: 0.5, destinationPosition: 0 }, { targetPosition: 220, destinationPosition: 0 }, { targetPosition: 0, destinationPosition: NaN }, { targetPosition: 0, destinationPosition: 0, cardInstanceId: 'secret' }, { targetPosition: 0, destinationPosition: 0, replacementCardInstanceId: null }, { targetPosition: 0 }, { targetPosition: 0, destinationPosition: 0, replacementCardInstanceId: undefined }])('rejects malformed or identity-based transfer %j', followerTransfer => { expect(parseGameCommand({ ...base, followerTransfer }).ok).toBe(false); });
  it('rejects a nested getter without evaluating it', () => { let calls = 0; const transfer = { targetPosition: 0, get destinationPosition() { calls++; return 0; } }; expect(parseGameCommand({ ...base, followerTransfer: transfer }).ok).toBe(false); expect(calls).toBe(0); });
});

describe('follower attack bundles',()=>{
  const source={cardInstanceId:'a2-p20-r3c1',dedicated:false,targetIds:['B']};
  const valid={type:'USE_FOLLOWER_ATTACK',abilityId:'c2-p05-r1c2-ab02',targetEventId:'turn-0-A-action',sources:[source]};
  it.each(['c2-p05-r1c2-ab02','c2-p06-r1c2-ab04'])('accepts exact %s command and clones source/target arrays',abilityId=>{const input={...valid,abilityId};const parsed=parseGameCommand(input);expect(parsed).toEqual({ok:true,value:input});if(parsed.ok&&parsed.value.type==='USE_FOLLOWER_ATTACK'){expect(parsed.value.sources).not.toBe(input.sources);expect(parsed.value.sources[0]!.targetIds).not.toBe(source.targetIds);}});
  it.each([{sources:[]},{sources:[source,source]},{sources:[{...source,targetIds:[]}]},{sources:[{...source,targetIds:['B','B']}]},{sources:[{...source,origin:'followers'}]},{sources:[{...source,noChecks:true}]},{sources:[{...source,dedicated:'true'}]},{sources:[{...source,targetIds:['B'],useLevel:0}]},{abilityId:'c2-p05-r1c2-ab01'},{targetEventId:''},{capability:true},{sources:undefined}])('rejects malformed or forged bundle %j',extra=>{expect(parseGameCommand({...valid,...extra})).toEqual({ok:false,code:'INVALID_COMMAND'});});
  it('rejects accessor source records without executing getters',()=>{let read=false;const v={...source};Object.defineProperty(v,'dedicated',{enumerable:true,get(){read=true;return false;}});expect(parseGameCommand({...valid,sources:[v]})).toEqual({ok:false,code:'INVALID_COMMAND'});expect(read).toBe(false);});
  it('ordinary ATTACK and USE_ABILITY cannot smuggle a bundle payload',()=>{expect(parseGameCommand({type:'ATTACK',...source,sources:[source]}).ok).toBe(false);expect(parseGameCommand({...valid,type:'USE_ABILITY'}).ok).toBe(false);});
});

describe('follower entry abilities',()=>{
  const base={type:'USE_ABILITY',abilityId:'c2-p03-r2c1-ab02',targetEventId:'g-1'};
  it('accepts only explicit nonempty unique Lester branch subsets',()=>{
   for(const abilityEffectIds of [['spirit-conversion'],['human-invalidation','arnes-suppression'],['spirit-conversion','human-invalidation','arnes-suppression']]){const c={...base,abilityEffectIds};expect(parseGameCommand(c)).toEqual({ok:true,value:c});}
   for(const extra of [{},{abilityEffectIds:[]},{abilityEffectIds:['human-invalidation','human-invalidation']},{abilityEffectIds:['invented']},{abilityEffectIds:['arnes-suppression'],abilityId:'c2-p03-r2c2-ab02'}])expect(parseGameCommand({...base,...extra}).ok).toBe(false);
  });
});

describe('dedicated follower attacks',()=>{
  const base={type:'ATTACK',cardInstanceId:'a2-p20-r3c1',targetIds:['B','C'],dedicated:true};
  it('physical follower attacks retain existing exact ATTACK wire',()=>{expect(parseGameCommand(base)).toEqual({ok:true,value:base});});
  it('Beast physical follower co-source retains exact explicit dedication wire',()=>{const value={...base,cardInstanceId:'a2-p09-r1c1',coSource:{cardInstanceId:'a2-p20-r3c1',dedicated:true}};expect(parseGameCommand(value)).toEqual({ok:true,value});});
  it.each([{sourceZone:'followers'},{followerPosition:0},{targetMode:'mandatory-all'},{sourceActorId:'B'}])('rejects forged source/target mode assertions %j',extra=>{expect(parseGameCommand({...base,...extra}).ok).toBe(false);});
  it.each([{sourceZone:'followers'},{fromFollowers:true},{actorId:'B'}])('rejects forged co-source origin %j',extra=>{expect(parseGameCommand({...base,cardInstanceId:'a2-p09-r1c1',coSource:{cardInstanceId:'a2-p20-r3c1',dedicated:true,...extra}}).ok).toBe(false);});
});

describe('Dark Saint ignore',()=>{
  it('Dark Saint ignore accepts an explicit boolean only and never accepts caller-supplied hidden physical identity',()=>{
   for(const ignore of [false,true]){const c={type:'CHOOSE_DARK_SAINT_IGNORE',ignore};expect(parseGameCommand(c)).toEqual({ok:true,value:c});for(const extra of [{targetId:'A'},{cardInstanceId:'a2-p21-r2c1'},{actorId:'B'}])expect(parseGameCommand({...c,...extra}).ok).toBe(false);}
   for(const ignore of [undefined,null,0,'true'])expect(parseGameCommand({type:'CHOOSE_DARK_SAINT_IGNORE',ignore}).ok).toBe(false);
  });
});

describe('beast capture',()=>{
  const command={type:'CHOOSE_BEAST_CAPTURE',groupId:'g-1',windowId:'w-1',cardInstanceIds:['a2-p20-r3c1']};
  it('capture validates strict exact identity and copies bounded list; empty is explicit decline',()=>{
   for(const ids of [[],command.cardInstanceIds,['same','same']]){const c={...command,cardInstanceIds:ids};const r=parseGameCommand(c);expect(r).toEqual({ok:true,value:c});if(r.ok&&r.value.type==='CHOOSE_BEAST_CAPTURE')expect(r.value.cardInstanceIds).not.toBe(ids);}
   for(const patch of [{groupId:''},{windowId:''},{cardInstanceIds:['!']},{cardInstanceIds:Array(221).fill('x')},{cardInstanceIds:'all'},{actorId:'B'}])expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
   const {windowId,...missing}=command;expect(parseGameCommand(missing)).toEqual({ok:false,code:'INVALID_COMMAND'});
  });
});

describe('all army',()=>{
  const command={type:'PLAY_ALL_ARMY',cardInstanceId:'a2-p05-r2c2',followerCardInstanceId:'a2-p20-r3c1',targetIds:['B']};
  it('accepts exactly one physical follower and copies the target selection',()=>{const r=parseGameCommand(command);expect(r).toEqual({ok:true,value:command});if(r.ok&&r.value.type==='PLAY_ALL_ARMY')expect(r.value.targetIds).not.toBe(command.targetIds);});
  it.each([{cardInstanceId:'a2-p05-r2c1'},{followerCardInstanceId:null},{followerCardInstanceId:['a2-p20-r3c1']},{followerCardInstanceIds:['a2-p20-r3c1','a2-p21-r3c3']},{targetIds:[]},{targetIds:['B','B']},{profile:{damage:100}},{moraleRequired:false}])('rejects malformed or client-authored army input %j',change=>expect(parseGameCommand({...command,...change}).ok).toBe(false));
});

describe('maai bundles',()=>{
  it('atomic maai accepts distinct physical cards and preserves the optional elected ability',()=>{
   const command={type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2',additionalCardInstanceIds:['a2-p07-r1c3'],abilityId:'c2-p01-r2c2-ab01'};
   expect(parseGameCommand(command)).toEqual({ok:true,value:command});
   const single={type:'PLAY_MAAI',cardInstanceId:command.cardInstanceId};expect(parseGameCommand(single)).toEqual({ok:true,value:single});
  });
  it.each([undefined,null,[],['a2-p07-r1c2'],['a2-p07-r1c3','a2-p07-r1c3'],[''],[1],'a2-p07-r1c3'])('atomic maai rejects malformed or duplicate additional payment %j',additionalCardInstanceIds=>{
   expect(parseGameCommand({type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2',additionalCardInstanceIds})).toEqual({ok:false,code:'INVALID_COMMAND'});
  });
  it('atomic maai payload cannot override required count or attach to unrelated commands',()=>{
   const command={type:'PLAY_MAAI',cardInstanceId:'a2-p07-r1c2',additionalCardInstanceIds:['a2-p07-r1c3']};
   for(const patch of [{maaiRequired:1},{actorId:'C'},{type:'PLAY_ADVANCE'},{type:'APPROACH',targetId:'A'}])expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
  });
});
