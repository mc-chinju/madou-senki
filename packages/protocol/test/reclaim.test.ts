import {expect,it} from 'vitest';
import {parseGameCommand} from '../src/index.js';
it('sword turn declaration has one finite physical source and cannot be confused with arrange or a batch',()=>{
  const command={type:'PLAY_TURN_CARD',cardInstanceId:'a2-p04-r2c1'};expect(parseGameCommand(command)).toEqual({ok:true,value:command});
  for(const bad of [{...command,type:'ARRANGE_FOLLOWERS'},{...command,cardInstanceId:'a2-p04-r2c2'},{...command,cardInstanceIds:[]},{...command,targetId:'B'}])expect(parseGameCommand(bad).ok).toBe(false);
});
it('accepts targeted anytime cards and rejects unknown physical IDs and target fields',()=>{
  const command={type:'PLAY_ANYTIME_CARD',cardInstanceId:'a2-p01-r3c3',targetEventId:'ability-10'};
  expect(parseGameCommand(command)).toEqual({ok:true,value:command});
  for(const bad of [{...command,cardInstanceId:'a2-p02-r2c3'},{...command,targetEventId:''},{...command,hitIndex:-1},{...command,hitIndex:1.5},{...command,beneficiaryId:'A'},{...command,cancellationSucceeded:true}])expect(parseGameCommand(bad).ok).toBe(false);
});
it.each(['take','request-check'] as const)('accepts finite recovery %s with one server-issued claim',choice=>{
  const command={type:'CHOOSE_RECLAIM',decisionId:'reclaim-10',choice,claimId:'claim-10-A-base'};
  expect(parseGameCommand(command)).toEqual({ok:true,value:command});
});
it('accepts decline without a claim and rejects malformed or over-specified recovery',()=>{
  const command={type:'CHOOSE_RECLAIM',decisionId:'reclaim-10',choice:'decline'};
  expect(parseGameCommand(command)).toEqual({ok:true,value:command});
  for(const bad of [{...command,claimId:'forged'},{...command,decisionId:''},{...command,choice:'take'},{...command,choice:'cancel'},{...command,actorId:'B'},{...command,choice:'take',claimId:'x'.repeat(129)}])
    expect(parseGameCommand(bad).ok).toBe(false);
});
it.each(['a2-p03-r1c1','a2-p03-r1c2','a2-p03-r1c3','a2-p03-r2c2','a2-p03-r2c3'])('accepts finite early-turn source %s with bounded selected mode',cardInstanceId=>{
 for(const mode of ['ordinary','dedicated'])expect(parseGameCommand({type:'PLAY_TURN_CARD',cardInstanceId,mode}).ok).toBe(true);
 for(const extra of [{mode:'automatic'},{mode:undefined},{targetId:'B'},{cardInstanceIds:[]}])expect(parseGameCommand({type:'PLAY_TURN_CARD',cardInstanceId,...extra}).ok).toBe(false);
});
it.each(['a2-p04-r1c1','a2-p04-r1c2','a2-p04-r1c3','a2-p04-r2c2','a2-p05-r1c2'])('accepts targeted physical turn card %s and rejects unsupported payloads',cardInstanceId=>{
 const command={type:'PLAY_TURN_CARD',cardInstanceId,targetId:'B'};expect(parseGameCommand(command)).toEqual({ok:true,value:command});
 for(const extra of [{targetId:''},{mode:'dedicated'},{mode:undefined},{cardInstanceIds:[]},{inspectionId:'x'},{success:true},{cardInstanceId:'a2-p03-r1c1'}])expect(parseGameCommand({...command,...extra}).ok).toBe(false);
});
