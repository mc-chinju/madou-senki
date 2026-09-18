import {it,expect,describe} from 'vitest';
import {parseGameCommand} from '../src/index.js';

describe('attack property abilities',()=>{
  it.each(['c2-p02-r2c1-ab01','c2-p03-r2c2-ab03'])('plain %s package uses existing strict command; no invented split or property payload',abilityId=>{
   const c={type:'USE_ABILITY',abilityId,targetEventId:'a-1'};expect(parseGameCommand(c)).toEqual({ok:true,value:c});
   for(const patch of [{abilityEffectIds:['spirit-conversion']},{abilityEffectIds:[]},{maaiRequired:3},{evadeProhibited:true},{damage:2},{actorId:'B'}])expect(parseGameCommand({...c,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
  });
});

describe('combination sources',()=>{
  describe('Task7i bounded wire choices', () => {
      const attack = { type: 'ATTACK', cardInstanceId: 'a2-p09-r1c1', targetIds: ['B'], dedicated: true, coSource: { cardInstanceId: 'a2-p08-r3c3', dedicated: false }, advanceCardInstanceIds: [] };
      it.each([attack, { type: 'CHOOSE_DAMAGE_DOUBLE', actionId: 'a-1', attempt: true }, { type: 'PAY_HIT_ADVANCES', groupId: 'g-1', cardInstanceIds: [] }, { type: 'PLAY_GROUP_DEFENSE', groupId: 'g-1', cardInstanceId: 'a2-p16-r3c3', dedicated: true }])('parses a detached exact choice %o', command => {
          const result = parseGameCommand(command);
          expect(result).toEqual({ ok: true, value: command });
          if (result.ok && result.value.type === 'ATTACK')
              expect(result.value.coSource).not.toBe(attack.coSource);
      });
      it.each([{ ...attack, coSource: { ...attack.coSource, actorId: 'forged' } }, { ...attack, coSource: { ...attack.coSource, dedicated: 1 } }, { ...attack, advanceCardInstanceIds: ['a', 'a'] }, { type: 'CHOOSE_DAMAGE_DOUBLE', actionId: 'a-1', attempt: 'true' }, { type: 'PAY_HIT_ADVANCES', groupId: 'g-1', cardInstanceIds: ['a', 'a'] }, { type: 'PLAY_GROUP_DEFENSE', groupId: 'g-1', cardInstanceId: 'a', dedicated: false }, { type: 'PLAY_GROUP_DEFENSE', groupId: 'g-1', cardInstanceId: 'a', dedicated: true, targetIds: ['B'] }])('rejects malformed or selective choices %o', command => expect(parseGameCommand(command).ok).toBe(false));
      it('rejects nested accessors without executing them', () => { let invoked = false; const coSource = { get cardInstanceId() { invoked = true; return 'a'; }, dedicated: false }; expect(parseGameCommand({ ...attack, coSource }).ok).toBe(false); expect(invoked).toBe(false); });
  });
  it('parses a composed defense as two independently selected physical sources', () => {
      const command = { type: 'PLAY_DEFENSE', cardInstanceId: 'a2-p09-r1c1', dedicated: true, coSource: { cardInstanceId: 'a2-p08-r2c3', dedicated: false } };
      expect(parseGameCommand(command)).toEqual({ ok: true, value: command });
      expect(parseGameCommand({ ...command, coSource: { ...command.coSource, unexpected: true } }).ok).toBe(false);
  });
});

describe('printed combinations',()=>{
  it.each(['ATTACK','PLAY_DEFENSE'])('%s copies finite printed components with declaration modifiers',type=>{
   const command={type,cardInstanceId:'a2-p17-r1c1',dedicated:false,...(type==='ATTACK'?{targetIds:['B']}:{}),combinationCardInstanceIds:['a2-p05-r1c3','a2-p05-r2c1'],declarationAbilityIds:['c2-p01-r1c1-ab03']},r=parseGameCommand(command);expect(r).toEqual({ok:true,value:command});if(r.ok&&'combinationCardInstanceIds' in r.value)expect(r.value.combinationCardInstanceIds).not.toBe(command.combinationCardInstanceIds);
  });
  it.each([null,['a2-p05-r1c3','a2-p05-r1c3'],['a2-p05-r2c2'],['a2-p05-r2c1','extra'],{}])('rejects invalid printed components %j',combinationCardInstanceIds=>expect(parseGameCommand({type:'ATTACK',cardInstanceId:'a2-p17-r1c1',dedicated:false,targetIds:['B'],combinationCardInstanceIds}).ok).toBe(false));
  it('cannot add a combination to a past roll, reaction, approach or standalone turn card',()=>{for(const command of [{type:'PLAY_REACTION',cardInstanceId:'fate',mode:'force-fail',targetRollId:'roll'},{type:'APPROACH',cardInstanceId:'step',targetId:'B'},{type:'PLAY_TURN_CARD',cardInstanceIds:['a2-p05-r1c3']}])expect(parseGameCommand({...command,combinationCardInstanceIds:['a2-p05-r1c3']}).ok).toBe(false);});
});

describe('received defense abilities',()=>{
  it.each(['c2-p03-r1c1-ab02','c2-p03-r1c2-ab01','c2-p07-r1c1-ab01','c2-p05-r2c2-ab02','c2-p01-r1c1-ab01','c2-p02-r1c2-ab01','c2-p02-r1c2-ab02','c2-p02-r2c2-ab01','c2-p03-r1c1-ab01','c2-p03-r2c2-ab01','c2-p04-r1c1-ab01','c2-p05-r2c1-ab01','c2-p05-r2c2-ab01','c2-p06-r2c1-ab01','c2-p07-r1c2-ab01'])('received package %s uses strict plain command without forged outcome or split effects',abilityId=>{
   const command={type:'USE_ABILITY',abilityId,targetEventId:'g-42-1'};expect(parseGameCommand(command)).toEqual({ok:true,value:command});
   for(const patch of [{abilityEffectIds:[]},{abilityEffectIds:['spirit-conversion']},{effectLevel:3},{reduction:1},{defended:true},{targetId:'C'},{hitIndex:1},{bodyDamage:{directDamage:2,resistanceDamage:0,total:2}},{reflection:{source:'ability'}},{rollResult:6},{checkSuccess:true}])expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
  });
});

describe('mental protection',()=>{
  const ids=['c2-p01-r1c2-ab04','c2-p01-r2c1-ab04','c2-p01-r2c2-ab04','c2-p02-r1c1-ab03','c2-p02-r2c2-ab03','c2-p05-r1c1-ab03','c2-p05-r2c1-ab02','c2-p06-r1c1-ab02'];
  it.each(ids)('%s uses ordinary strict declaration without client-selected protection clause',abilityId=>{
   const command={type:'USE_ABILITY',abilityId,targetEventId:'ability-42'};
   expect(parseGameCommand(command)).toEqual({ok:true,value:command});
   for(const patch of [{sourceAbilityId:'ability-7'},{rollId:'roll-7'},{mentalGuards:[]},{mentalStopReserved:true},{context:{kind:'mental-guard'}},{clause:'technique'},{description:'forged'},{success:true},{faces:[6,6]},{targetId:'B'}])expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
  });
});

describe('mental received defenses',()=>{
  it.each(['c2-p03-r2c1-ab01','c2-p06-r1c1-ab01','c2-p06-r1c2-ab01'])('mental defense %s uses one strict plain declaration',abilityId=>{
   const command={type:'USE_ABILITY',abilityId,targetEventId:'g-42-1'};
   expect(parseGameCommand(command)).toEqual({ok:true,value:command});
   for(const patch of [{abilityEffectIds:[]},{faces:[6,6]},{success:false},{pendingFatal:true},{targetId:'C'},
    {sourceActorId:'C'},{expiresOnActorId:'B'},{currentObjective:{kind:'extinction',enemyFactions:[]}},
    {defeatCondition:'なし'},{protection:{characterIds:[]}}]){
    expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
   }
  });
});

describe('named ability responses',()=>{
  it.each(['c2-p01-r2c1-ab05','c2-p07-r1c1-ab02'])('%s accepts an opaque exact source target and rejects client-created cancellation state',abilityId=>{
   const command={type:'USE_ABILITY',abilityId,targetEventId:'ability-42'};
   expect(parseGameCommand(command)).toEqual({ok:true,value:command});
   for(const patch of [{abilityEffectIds:[]},{abilityEffectIds:['spirit-conversion']},{targetAbilityId:'ability-43'},{sourceAbilityId:'ability-43'},{canceled:true},{permanentBan:true},{context:{kind:'ability-response',sourceAbilityId:'ability-43'}}]){
    expect(parseGameCommand({...command,...patch})).toEqual({ok:false,code:'INVALID_COMMAND'});
   }
  });
});

describe('shadow jump payment',()=>{
  it('Shadow jump payment accepts only its saved ability event and physical advance',()=>{
   const c={type:'PAY_SHADOW_JUMP',abilityEventId:'ability-12',advanceCardInstanceId:'a2-p06-r3c1'};expect(parseGameCommand(c)).toEqual({ok:true,value:c});for(const extra of [{damage:7},{targetIds:['A']},{followerIgnore:true},{abilityEventId:''},{advanceCardInstanceId:4}])expect(parseGameCommand({...c,...extra}).ok).toBe(false);
  });
});

describe('virtual blades',()=>{
  it('virtual blade declaration accepts only two canonical sources and finite target binding',()=>{
   for(const abilityId of ['c2-p04-r1c1-ab02','c2-p06-r2c1-ab02']){const command={type:'DECLARE_VIRTUAL_BLADE',abilityId,targetIds:['B']};expect(parseGameCommand(command)).toEqual({ok:true,value:command});for(const extra of [{damage:100},{cardInstanceId:'invented'},{source:{kind:'ability'}},{targetIds:[]},{targetIds:['B','B']},{abilityId:'c2-p01-r1c1-ab01'}])expect(parseGameCommand({...command,...extra}).ok).toBe(false);}
  });
});

describe('Zan',()=>{
  it('Zan uses the server-bound ability command without client damage or maai history',()=>{const c={type:'USE_ABILITY',abilityId:'c2-p04-r1c2-ab02',targetEventId:'g-10-B-follower-entry'};expect(parseGameCommand(c)).toEqual({ok:true,value:c});for(const extra of [{damage:10},{multiplier:2},{maaiWasSubmitted:false},{hitIndex:0}])expect(parseGameCommand({...c,...extra}).ok).toBe(false);});
});

describe('combat card commands',()=>{
  it('Tia flight uses the existing server-bound ability command',()=>{
   const command={type:'USE_ABILITY',abilityId:'c2-p02-r1c1-ab01',targetEventId:'g-10-0'};
   expect(parseGameCommand(command)).toEqual({ok:true,value:command});
   for(const extra of [{immune:true},{school:'magic'},{element:'地'},{hitIndex:0},{damage:0}])expect(parseGameCommand({...command,...extra}).ok).toBe(false);
  });
  it('Initial withdrawal accepts only optional Cham or Tia maai ability',()=>{
   for(const abilityId of ['c2-p01-r2c2-ab01','c2-p02-r1c1-ab01']){const c={type:'WITHDRAW',targetId:'B',cardInstanceId:'maai',abilityId};expect(parseGameCommand(c)).toEqual({ok:true,value:c});}
   expect(parseGameCommand({type:'WITHDRAW',targetId:'B',cardInstanceId:'maai',abilityId:'c2-p02-r2c1-ab03'}).ok).toBe(false);
   expect(parseGameCommand({type:'APPROACH',targetId:'B',cardInstanceId:'advance',abilityId:'c2-p01-r2c2-ab01'}).ok).toBe(false);
  });
  it('maai accepts only the three canonical optional distance abilities',()=>{
   for(const abilityId of ['c2-p01-r2c2-ab01','c2-p02-r1c1-ab01','c2-p02-r2c1-ab03']){const command={type:'PLAY_MAAI',cardInstanceId:'a2-p05-r3c1',abilityId};expect(parseGameCommand(command)).toEqual({ok:true,value:command});}
   for(const extra of [{abilityId:'c2-p02-r2c1-ab01'},{abilityId:''},{abilityId:'c2-p01-r2c2-ab01',requiredAdvances:2}])expect(parseGameCommand({type:'PLAY_MAAI',cardInstanceId:'a2-p05-r3c1',...extra}).ok).toBe(false);
  });
});
