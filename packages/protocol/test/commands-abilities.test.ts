import {it,expect,describe} from 'vitest';
import {parseGameCommand} from '../src/index.js';

describe('saved ability events and costs',()=>{
  it('parses exact saved ability event/cost selection and distinct Fate ability target',()=>{for(const c of [{type:'USE_ABILITY',abilityId:'c2-p04-r2c2-ab04',targetEventId:'turn-0',costCardInstanceId:'a2-p03-r2c2',conceal:true},{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:'ability-3'}])expect(parseGameCommand(c)).toEqual({ok:true,value:c});});
  it('rejects missing ability events, mixed Fate targets and invented numeric choice/cost payloads',()=>{for(const c of [{type:'USE_ABILITY',abilityId:'c2-p04-r2c2-ab04'},{type:'USE_ABILITY',abilityId:'x',targetEventId:'y',conceal:1},{type:'USE_ABILITY',abilityId:'x',targetEventId:'y',roll:[1,1]},{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetActionId:'a-3'},{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r2c3',mode:'cancel-ability',targetAbilityId:'ability-3',targetActionId:'a-3'}])expect(parseGameCommand(c).ok).toBe(false);});
});

describe('conditional stat abilities',()=>{
  const ids=['c2-p02-r1c1-ab04','c2-p03-r1c2-ab03','c2-p03-r2c2-ab04','c2-p04-r1c2-ab03','c2-p04-r1c2-ab05','c2-p05-r1c2-ab01','c2-p05-r2c1-ab05','c2-p06-r1c2-ab02'];
  it.each(ids)('finite conditional source %s ON/OFF strict round-trip',abilityId=>{for(const enabled of [true,false]){const c={type:'SET_CONDITIONAL_ABILITY',abilityId,targetEventId:'conditional-w-42',enabled,...(enabled&&abilityId===ids[1]?{targetIds:[]}:{} )};expect(parseGameCommand(c)).toEqual({ok:true,value:c});}});
  const base={type:'SET_CONDITIONAL_ABILITY',abilityId:ids[0],targetEventId:'event',enabled:true};
  it.each([{...base,abilityId:'unknown'},{...base,enabled:'true'},{...base,targetIds:[]},{...base,targetEventId:''},{...base,amount:2},{...base,sourceCharacterId:'c2-p02-r1c1'},{...base,active:true},{...base,modifier:2},{...base,abilityId:ids[1]},{...base,abilityId:ids[1],targetIds:['B','B']},{...base,abilityId:ids[1],targetIds:['B',,'C']},{...base,abilityId:ids[1],enabled:false,targetIds:[]},{...base,abilityId:ids[1],targetIds:Array(10).fill('B').map((x,i)=>x+i)}])('rejects malformed/forged conditional command %#',c=>expect(parseGameCommand(c)).toEqual({ok:false,code:'INVALID_COMMAND'}));
});

describe('declaration modifiers',()=>{
  const ability = 'c2-p01-r1c1-ab03';
  const commands = [
      { type: 'ATTACK', cardInstanceId: 'source', targetIds: ['B'], dedicated: false },
      { type: 'PLAY_DEFENSE', cardInstanceId: 'source', dedicated: false },
      { type: 'PLAY_TURN_TECHNIQUE', cardInstanceId: 'source', targetIds: ['A'], dedicated: false },
      { type: 'PLAY_GROUP_DEFENSE', cardInstanceId: 'source', groupId: 'group', dedicated: true },
  ];
  describe('strict optional declaration selections', () => {
      it.each(commands)('round-trips selections on $type without mutating the input', command => {
          const input = { ...command, declarationAbilityIds: [ability] };
          const parsed = parseGameCommand(input);
          expect(parsed).toEqual({ ok: true, value: input });
          if (parsed.ok) {
              expect((parsed.value as any).declarationAbilityIds).not.toBe(input.declarationAbilityIds);
          }
      });
      it.each([undefined, null, 'ability', [ability, ability], ['invented'], ['c2-p01-r1c1-ab02'], Array(14).fill(ability), Array(1)])('rejects malformed, unrelated or duplicate IDs (%j)', ids => {
          expect(parseGameCommand({ ...commands[0], declarationAbilityIds: ids })).toEqual({ ok: false, code: 'INVALID_COMMAND' });
      });
      it.each([
          { type: 'CHANT', cardInstanceId: 'source' },
          { type: 'PASS' },
          { type: 'USE_ABILITY', abilityId: ability, targetEventId: 'event' },
      ])('does not admit a declaration field on $type', command => {
          expect(parseGameCommand({ ...command, declarationAbilityIds: [] })).toEqual({ ok: false, code: 'INVALID_COMMAND' });
      });
      it('rejects private state, accessor properties and nested forged IDs', () => {
          for (const extra of [{ declaration: { committed: true } }, { ownerId: 'A' }, { declarationSelection: {} }, { abilities: [] }]) {
              expect(parseGameCommand({ ...commands[0], declarationAbilityIds: [ability], ...extra }).ok).toBe(false);
          }
          const accessor = Object.defineProperty({ ...commands[0] }, 'declarationAbilityIds', { enumerable: true, get() { throw Error('must not invoke'); } });
          expect(parseGameCommand(accessor).ok).toBe(false);
          expect(parseGameCommand({ ...commands[0], declarationAbilityIds: [ability], coSource: { cardInstanceId: 'component', dedicated: false, declarationAbilityIds: [ability] } }).ok).toBe(false);
      });
  });
});

describe('suppression and blessing',()=>{
  const ban = {type:'USE_ABILITY', abilityId:'c2-p07-r1c2-ab03', targetEventId:'opportunity', targetIds:['B','C']};
  const blessing = {type:'USE_ABILITY', abilityId:'c2-p03-r1c2-ab04', targetEventId:'opportunity', targetId:'B'};
  it.each([ban, blessing])('C16 strict round trip %#', command => expect(parseGameCommand(command)).toEqual({ok:true, value:command}));
  it.each([
    {...ban, targetIds:[]}, {...ban, targetIds:['B','B']}, {...ban, targetIds:['B',,'C']},
    {...ban, targetId:'B'}, {...ban, targetIds:Array.from({length:11}, (_, i) => `P${i}`)},
    {...ban, costCardInstanceId:'card'}, {...ban, conceal:true}, {...ban, abilityEffectIds:[]},
    {...blessing, targetIds:['B']}, {...blessing, targetId:undefined}, {...blessing, costCardInstanceId:'card'},
    {...ban, abilityId:'c2-p01-r2c1-ab03'},
  ])('C16 malformed target/foreign fields fail %#', command => expect(parseGameCommand(command)).toEqual({ok:false, code:'INVALID_COMMAND'}));
});

describe('Cham death gift',()=>{
  it('Cham gift requires exactly one bound decision, physical hand card and recipient',()=>{const c={type:'CHAM_DEATH_GIFT',decisionId:'death-1',cardInstanceId:'a2-p03-r1c1',targetId:'B'};expect(parseGameCommand(c)).toEqual({ok:true,value:c});for(const bad of [{...c,decisionId:''},{...c,cardInstanceId:[]},{...c,targetId:null},{...c,giftCardInstanceId:'x'},{...c,cardInstanceIds:['x']},{...c,refill:true}])expect(parseGameCommand(bad).ok).toBe(false);});
});

describe('lifecycle commands',()=>{
  describe('strict lifecycle commands',()=>{
   const valid=[
    {type:'PLAY_DEATH_GIFT',cardInstanceId:'a2-p02-r3c2',giftCardInstanceId:'a2-p03-r1c1',targetId:'B'},
    {type:'CHOOSE_REVIVAL',revive:true},{type:'CHOOSE_REVIVAL',revive:false},
    ...['lancelot-transform','vanmil-subordinates','arseil-conspiracy'].map(ability=>({type:'USE_LIFECYCLE_ABILITY',ability})),
    {type:'TRANSFER_RITUAL',targetId:'B'},{type:'USE_REVIVAL_RITUAL'},
   ];
   it.each(valid)('accepts the exact saved wire shape $type',command=>{expect(parseGameCommand(command)).toEqual({ok:true,value:command});});
   it.each(valid)('rejects identity, result, and arbitrary payload injection for $type',command=>{for(const field of ['actorId','presence','outcome','winnerIds','sourceCardInstanceId','extra'])expect(parseGameCommand({...command,[field]:'forged'})).toEqual({ok:false,code:'INVALID_COMMAND'});});
   it.each([{type:'CHOOSE_REVIVAL',revive:1},{type:'USE_LIFECYCLE_ABILITY',ability:'unknown'},{type:'TRANSFER_RITUAL',targetId:''},{type:'PLAY_DEATH_GIFT',cardInstanceId:'a2-p02-r3c2',targetId:'B'},{type:'PLAY_DEATH_GIFT',cardInstanceId:'a2-p02-r3c2',giftCardInstanceId:[],targetId:'B'}])('rejects malformed lifecycle inputs',command=>{expect(parseGameCommand(command)).toEqual({ok:false,code:'INVALID_COMMAND'});});
  });
});

describe('lifetime techniques',()=>{
  it('normalizes explicit targeted turn techniques and private lifetime choices',()=>{for(const command of [{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:'a2-p13-r3c1',targetIds:['B','C'],dedicated:true,convertTargetIds:['C']},{type:'CHOOSE_LIFETIME_EFFECT',choice:'apply'},{type:'CHOOSE_LIFETIME_EFFECT',choice:'decline'}])expect(parseGameCommand(command)).toEqual({ok:true,value:command});});
  it('rejects malformed, extra, duplicate, empty, foreign conversion and forged authority fields',()=>{const base={type:'PLAY_TURN_TECHNIQUE',cardInstanceId:'a2-p13-r3c1',targetIds:['B'],dedicated:true};for(const command of [{...base,targetIds:[]},{...base,targetIds:['B','B']},{...base,convertTargetIds:['C']},{...base,convertTargetIds:['B','B']},{...base,dedicated:'true'},{...base,actorId:'C'},{type:'CHOOSE_LIFETIME_EFFECT',choice:'kill'},{type:'CHOOSE_LIFETIME_EFFECT',choice:'apply',targetId:'C'}])expect(parseGameCommand(command)).toEqual({ok:false,code:'INVALID_COMMAND'});});
});

describe('turn and information commands',()=>{
  const draw='c2-p01-r2c2-ab02',truePower='c2-p04-r2c1-ab03';
  it.each([
   {type:'USE_ABILITY',abilityId:'c2-p01-r2c2-ab03',targetEventId:'turn-1',targetId:'B'},
   {type:'CHOOSE_DRAW',draw:true,abilityId:draw},
   {type:'CHOOSE_DRAW',draw:true,abilityId:'c2-p07-r1c1-ab03'},
   {type:'REVEAL_CHARACTER',abilityId:truePower},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'finish'},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-one',cardInstanceId:'a2-p01-r1c1'},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-all'},
  ])('strict turn command round trips $type',command=>{expect(parseGameCommand(command)).toEqual({ok:true,value:command});});
  it.each([
   {type:'CHOOSE_DRAW',draw:false,abilityId:draw},
   {type:'CHOOSE_DRAW',draw:true,abilityId:truePower},
   {type:'CHOOSE_DRAW',draw:true,abilityId:undefined},
   {type:'REVEAL_CHARACTER',abilityId:draw},
   {type:'REVEAL_CHARACTER',abilityId:null},
   {type:'REVEAL_CHARACTER',abilityId:undefined},
   {type:'PASS',abilityId:truePower},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-one'},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-one',cardInstanceIds:['a2-p01-r1c1']},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-all',cardInstanceId:'a2-p01-r1c1'},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'finish',cardInstanceId:undefined},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'finish',targetId:'B'},
   {type:'CHOOSE_INSPECTION',decisionId:'bad id',choice:'finish'},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'discard-one',cardInstanceId:5},
   {type:'CHOOSE_INSPECTION',decisionId:'inspection-1',choice:'finish',actorId:'B'},
   {type:'USE_ABILITY',abilityId:draw,targetEventId:'x',targetId:null},
  ])('rejects misplaced or forged turn payload %#',command=>{expect(parseGameCommand(command)).toEqual({ok:false,code:'INVALID_COMMAND'});});
  it('does not invoke hostile inspection accessors',()=>{let called=false;const value={type:'CHOOSE_INSPECTION',decisionId:'inspection-1',get choice(){called=true;return 'finish';}};expect(parseGameCommand(value).ok).toBe(false);expect(called).toBe(false);});
});

describe('sad love',()=>{
  it('Sad love accepts only explicit aura state or a bound substitution hit',()=>{
   const common={type:'USE_ABILITY',abilityId:'c2-p05-r1c2-ab05',targetEventId:'a-1'},aura={...common,mode:'aura',enabled:true},sub={...common,mode:'substitute',targetId:'B',groupId:'g-1',hitIndex:0};
   expect(parseGameCommand(aura).ok).toBe(true);expect(parseGameCommand({...aura,enabled:false}).ok).toBe(true);expect(parseGameCommand(sub).ok).toBe(true);
   for(const c of [common,{...aura,enabled:undefined},{...aura,targetId:'B'},{...sub,hitIndex:-1},{...sub,hitIndex:6},{...sub,hitIndex:0.5},{...sub,enabled:true},{...sub,damage:10},{...sub,sourceLifeId:'fake'},{...aura,abilityId:'c2-p04-r1c2-ab02'}])expect(parseGameCommand(c).ok).toBe(false);
  });
});

describe('wish',()=>{
  it.each(['a2-p04-r3c2','a2-p04-r3c3'])('accepts only the explicit physical %s Wish mode',cardInstanceId=>{expect(parseGameCommand({type:'PLAY_TURN_CARD',cardInstanceId,mode:'wish'}).ok).toBe(true);expect(parseGameCommand({type:'PLAY_TURN_CARD',cardInstanceId}).ok).toBe(false);});
  it.each([{kind:'hand',ownerId:'B'},{kind:'deck',cardName:'魔導書'},{kind:'public',cardInstanceId:'wish-4-slot-1-chants-0'}])('copies finite Wish source %j',source=>{const command={type:'CHOOSE_WISH',decisionId:'wish-4',source},r=parseGameCommand(command);expect(r).toEqual({ok:true,value:command});if(r.ok&&r.value.type==='CHOOSE_WISH')expect(r.value.source).not.toBe(source);});
  it.each([null,{},[],{kind:'hand',ownerId:'B',cardInstanceId:'card'},{kind:'deck',cardName:'魔導書',index:4},{kind:'discard',cardInstanceId:'card'},{kind:'public',cardInstanceId:'card',ownerId:'B'}])('rejects malformed Wish source %j',source=>expect(parseGameCommand({type:'CHOOSE_WISH',decisionId:'wish-1',source}).ok).toBe(false));
  it('rejects accessor sources without execution and invalid capacity arrays',()=>{let called=false;expect(parseGameCommand({type:'CHOOSE_WISH',decisionId:'wish-1',source:{kind:'deck',get cardName(){called=true;return '魔導書';}}}).ok).toBe(false);expect(called).toBe(false);for(const followerIds of [['same','same'],['bad:id'],[1]])expect(parseGameCommand({type:'CHOOSE_WISH_CAPACITY',decisionId:'wish-1',followerIds,chantIds:[]}).ok).toBe(false);});
});

describe('dispel',()=>{
  const attack={type:'ATTACK',cardInstanceId:'a2-p05-r3c1',targetIds:['B'],dedicated:false,dispel:{cardInstanceId:'a2-p02-r3c1',targetId:'B'}};
  it('copies the finite pre-attack Dispel choice and retains declaration selections',()=>{
   const command={...attack,declarationAbilityIds:['c2-p01-r1c1-ab03']},r=parseGameCommand(command);expect(r).toEqual({ok:true,value:command});if(r.ok&&r.value.type==='ATTACK')expect(r.value.dispel).not.toBe(command.dispel);
  });
  it.each([null,{},'a2-p02-r3c1',{cardInstanceId:'a2-p02-r1c1',targetId:'B'},{...attack.dispel,targetId:4},{...attack.dispel,targets:['B']},{...attack.dispel,refill:true}])('rejects malformed or extended Dispel %j',dispel=>expect(parseGameCommand({...attack,dispel}).ok).toBe(false));
  it('rejects nested accessors without executing them',()=>{let called=false;expect(parseGameCommand({...attack,dispel:{get cardInstanceId(){called=true;return 'a2-p02-r3c1';},targetId:'B'}}).ok).toBe(false);expect(called).toBe(false);});
});

describe('reclaim',()=>{
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
});
