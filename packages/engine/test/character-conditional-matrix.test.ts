import {conditionalStatAdditions} from '../src/abilities/conditional-stats.js';
import type {StatProvenance} from '../src/abilities/stat-context.js';
import {cleanConditionalSelections} from '../src/abilities/conditional-selection.js';
import {ownsAbility} from '../src/abilities/ownership.js';
import type {ConditionalAbilityId} from '@madou/protocol';
import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {makeOwnedReclaimTable,nextOwnAction,killOwnedLifetimePlayer} from './owned-reclaim-helpers.js';
import {transition,viewFor, discardIds } from '../src/index.js';
import {act,finish,pass,ready,until,closeWindow} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
const CONDITIONAL_CASES: [string,ConditionalAbilityId][] = [
  [
    "有翼人のティア",
    "c2-p02-r1c1-ab04"
  ],
  [
    "リーア姫",
    "c2-p03-r1c2-ab03"
  ],
  [
    "黒妖精のアーネス",
    "c2-p03-r2c2-ab04"
  ],
  [
    "竜皇子アスフェルト",
    "c2-p04-r1c2-ab03"
  ],
  [
    "竜皇子アスフェルト",
    "c2-p04-r1c2-ab05"
  ],
  [
    "獣使いのウパニシャット",
    "c2-p05-r1c2-ab01"
  ],
  [
    "黒騎士ガーウィン",
    "c2-p05-r2c1-ab05"
  ],
  [
    "魔聖母ディア",
    "c2-p06-r1c2-ab02"
  ]
];
it.each(CONDITIONAL_CASES)('%s %s default-off-explicit-cancelable-election',(name,id)=>{
 let s=ready();character(s,'A',name);const fate=handCard(s,'B','命運凶変');
 const setting=()=>viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId===id)!;
 expect(setting()).toMatchObject({enabled:false,active:false,canActivate:true});
 const before=structuredClone(s.players.A!.conditionalSelections??[]),stats=viewFor(s,'A').self.stats;
 const command={type:'SET_CONDITIONAL_ABILITY' as const,abilityId:id,targetEventId:setting().targetEventId!,enabled:true,...(id==='c2-p03-r1c2-ab03'?{targetIds:[]}: {})};
 s=act(s,'A',command);expect(s.players.A!.conditionalSelections??[]).toEqual(before);
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='B')s=pass(s);
 s=finish(act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'B').reactionTargetAbilityId!}));
 expect(setting()).toMatchObject({enabled:false,active:false,canActivate:false});expect(viewFor(s,'A').self.stats).toEqual(stats);
 const saved=JSON.stringify(s);expect(transition(s,{actorId:'A',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(saved);
 s=act(s,'A',{type:'PASS_ACTION'});expect(setting().canActivate).toBe(true);
 s=finish(act(s,'A',{...command,targetEventId:setting().targetEventId}));
 s=JSON.parse(JSON.stringify(s));expect(setting()).toMatchObject({enabled:true,active:true,canActivate:false,canDeactivate:true});
 expect(s.players.A!.conditionalSelections).toContainEqual({abilityId:id,sourceCharacterId:id.split('-ab')[0],targetIds:[]});
 s=act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:setting().targetEventId,enabled:false});
 expect(setting()).toMatchObject({enabled:false,active:false,canActivate:false});
});

it.each(CONDITIONAL_CASES)('%s %s absence-retains-death-clears',(name,id)=>{
 const table=makeOwnedReclaimTable(name,'a2-p23-r1c2',[],true);let s=table.state;
 s.players.B!.permanent={...s.players.B!.permanent,magic_level:20,spirit:20};
 const rift=handCard(s,'B','裂界'),fate=handCard(s,'F','命運凶変'),advance=handCard(s,'E','踏み込み／弓');
 const dawn='a2-p01-r1c2';s.deck=s.deck.filter(c=>c!==dawn);s.discard = s.discard.filter(entry => entry.cardInstanceId !== dawn);
 for(const p of Object.values(s.players)){p.hand=p.hand.filter(c=>c!==dawn);p.open=p.open.filter(c=>c!==dawn);}s.deck.push(dawn);
 const setting=()=>viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId===id)!;
 s=finish(act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:setting().targetEventId,enabled:true,...(id==='c2-p03-r1c2-ab03'?{targetIds:[]}: {})}));
 const saved=structuredClone(s.players.A!.conditionalSelections);expect(saved).toHaveLength(1);
 s=nextOwnAction({state:s,ownerId:'B'},rift);s=act(s,'B',{type:'CHANT',cardInstanceId:rift});s=nextOwnAction({state:s,ownerId:'B'},rift);
 s=act(s,'B',{type:'ATTACK',cardInstanceId:rift,targetIds:['A'],dedicated:false});
 let forced=false;
 for(let n=0;n<500&&s.windows?.length;n++){
  const w=s.windows.at(-1)!,roll=s.rolls?.find(r=>r.id===w.continuation.id);
  if(!forced&&w.kind==='after-roll'&&roll?.purpose==='status-resistance'&&roll.rollerId==='A'&&w.participants[w.cursor]==='F'){
   s=act(s,'F',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:roll.id});forced=true;
  }else s=pass(s);
 }
 expect(forced).toBe(true);expect(s.players.A!.presence).toBe('otherworld');expect(s.players.A!.conditionalSelections).toEqual(saved);
 expect(setting()).toMatchObject({enabled:true,active:false});s=JSON.parse(JSON.stringify(s));
 const wish=s.players.F!.hand.find(c=>getAction(c)!.name==='祈願')!;
 s=nextOwnAction({state:s,ownerId:'F'},wish);s=until(act(s,'F',{type:'PLAY_TURN_CARD',cardInstanceId:wish,mode:'wish'}),'wish');
 s=finish(act(s,'F',{type:'CHOOSE_WISH',decisionId:viewFor(s,'F').wish!.decisionId,source:{kind:'deck',cardName:getAction(dawn)!.name}}));
 expect(s.players.A!.presence).toBe('active');expect(s.players.A!.conditionalSelections).toEqual(saved);expect(setting().enabled).toBe(true);
 const protectedSeat=s.seatOrder.find(seat=>seat!=='A'&&s.players.A!.protection?.characterIds.includes(s.players[seat]!.characterId));
 const otherTarget=protectedSeat??'D';
 let absent=nextOwnAction({state:JSON.parse(JSON.stringify(s)),ownerId:'E'},advance);
 absent=finish(act(absent,'E',{type:'APPROACH',targetId:otherTarget,cardInstanceId:advance}));
 absent=killOwnedLifetimePlayer(absent,otherTarget);
 expect(absent.players[otherTarget]!.presence).toBe('dead');
 expect(absent.players.A!.presence).toBe(protectedSeat?'wandering':'active');
 expect(absent.players.A!.conditionalSelections).toEqual(saved);
 s=nextOwnAction({state:s,ownerId:'E'},advance);
 s=finish(act(s,'E',{type:'APPROACH',targetId:'A',cardInstanceId:advance}));
 s=killOwnedLifetimePlayer(s,'A');expect(s.players.A!.presence).toBe('dead');expect(s.players.A!.conditionalSelections??[]).toEqual([]);
});

it.each(CONDITIONAL_CASES)('%s %s cancel-update-retains-prior-selection-and-attempt',(name,id)=>{
 let s=ready();character(s,'A',name);s.players.B!.revealed=true;s.players.C!.revealed=true;
 const fate=handCard(s,'D','命運凶変'),lia=id==='c2-p03-r1c2-ab03';
 const setting=()=>viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId===id)!;
 s=finish(act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:setting().targetEventId,enabled:true,...(lia?{targetIds:['B']}: {})}));
 s=act(s,'A',{type:'PASS_ACTION'});
 const prior=structuredClone(s.players.A!.conditionalSelections),used=structuredClone(s.used),event=setting().targetEventId!;
 const command={type:'SET_CONDITIONAL_ABILITY' as const,abilityId:id,targetEventId:event,enabled:true,...(lia?{targetIds:['C']}: {})};
 if(!lia){
  // Only Lia has an updateable target set. Redundant ON is rejected without replacing the election or spending a new attempt.
  expect(setting().canActivate).toBe(false);const before=JSON.stringify(s);
  expect(transition(s,{actorId:'A',command},entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(before);expect(s.players.A!.conditionalSelections).toEqual(prior);expect(s.used).toEqual(used);
  return;
 }
 s=act(s,'A',command);expect(s.players.A!.conditionalSelections).toEqual(prior);
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='D')s=pass(s);
 s=finish(act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'D').reactionTargetAbilityId!}));
 s=JSON.parse(JSON.stringify(s));expect(s.players.A!.conditionalSelections).toEqual(prior);
 expect(setting()).toMatchObject({enabled:true,selectedTargetIds:['B'],canActivate:false});
 expect(s.used?.filter(key=>key===`${event}:A:${id}`)).toHaveLength(1);
 const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
});
it.each(CONDITIONAL_CASES)('%s %s structural inherited ownership retains exact source election',(name,id)=>{
 let s=ready();character(s,'A',name);s.players.B!.revealed=true;
 const setting=()=>viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId===id)!;
 s=finish(act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:setting().targetEventId,enabled:true,...(id==='c2-p03-r1c2-ab03'?{targetIds:['B']}: {})}));
 const elected=structuredClone(s.players.A!.conditionalSelections),source=id.split('-ab')[0]!;
 expect(elected).toEqual([{abilityId:id,sourceCharacterId:source,targetIds:id==='c2-p03-r1c2-ab03'?['B']:[]}]);
 // These sources have no printed transformation into Lancelot II. This is a direct ownership/cleanup boundary.
 s.players.A!.characterId='c2-p07-r1c1';s.players.A!.abilityCharacterIds=[source,'c2-p07-r1c1'];
 s=JSON.parse(JSON.stringify(s));cleanConditionalSelections(s);
 expect(ownsAbility(s.players.A!,id)).toBe(true);expect(s.players.A!.conditionalSelections).toEqual(elected);
 expect(setting()).toMatchObject({enabled:true,selectedTargetIds:id==='c2-p03-r1c2-ab03'?['B']:[]});
 s.players.A!.abilityCharacterIds=['c2-p07-r1c1'];cleanConditionalSelections(s);
 expect(ownsAbility(s.players.A!,id)).toBe(false);expect(s.players.A!.conditionalSelections).toEqual([]);
 expect(viewFor(s,'A').conditionalAbilities.some(o=>o.abilityId===id)).toBe(false);
});
it.each(CONDITIONAL_CASES)('%s %s structural condition loss suspends addition without erasing election',(name,id)=>{
 let s=ready();character(s,'A',name);character(s,'B',id==='c2-p02-r1c1-ab04'?'吟遊詩人のレスター':'聖騎士ランスロット');
 s.players.A!.revealed=true;s.players.B!.revealed=true;
 if(id==='c2-p04-r1c2-ab05')s.players.A!.faction='GOOD';
 const dragon=id==='c2-p04-r1c2-ab03';let attack:string|undefined;
 if(dragon){s.players.B!.permanent={magic_level:20};const follower=handCard(s,'A','飛竜');s.players.A!.hand=s.players.A!.hand.filter(c=>c!==follower);s.players.A!.followers.push({cardInstanceId:follower,revealed:false});attack=handCard(s,'B','風矢');s.turnSeat=1;}
 const option=viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId===id)!;
 s=finish(act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:option.targetEventId,enabled:true,...(id==='c2-p03-r1c2-ab03'?{targetIds:['B']}: {})}));
 let context:StatProvenance={kind:'combat',attackerId:'A',targetIds:['B']};
 if(dragon){s=until(act(s,'B',{type:'ATTACK',cardInstanceId:attack!,targetIds:['A'],dedicated:false}),'before-roll');expect(s.rolls!.at(-1)!.purpose).toBe('follower-morale');context={kind:'roll',id:s.rolls!.at(-1)!.id};}
 const saved=structuredClone(s.players.A!.conditionalSelections),originalContext=context;
 const additions=()=>conditionalStatAdditions(s,s.players.A!,context);
 const expected={spirit:dragon||id==='c2-p06-r1c2-ab02'?0:['c2-p03-r1c2-ab03','c2-p03-r2c2-ab04','c2-p05-r2c1-ab05'].includes(id)?2:1,handLimit:id==='c2-p06-r1c2-ab02'?2:0,moraleBonus:dragon?2:0};
 expect(additions()).toEqual(expected);
 // Explicit resolver boundaries: no fabricated concealment, allegiance change or combat producer.
 if(dragon||id==='c2-p05-r1c2-ab01')context={kind:'none'};
 else if(id==='c2-p06-r1c2-ab02')s.players.A!.revealed=false;
 else if(id==='c2-p04-r1c2-ab05')s.players.A!.faction='EVIL';
 else s.players.B!.revealed=false;
 cleanConditionalSelections(s);expect(additions()).toEqual({spirit:0,handLimit:0,moraleBonus:0});expect(s.players.A!.conditionalSelections).toEqual(saved);
 s=JSON.parse(JSON.stringify(s));context=originalContext;s.players.A!.revealed=true;s.players.B!.revealed=true;if(id==='c2-p04-r1c2-ab05')s.players.A!.faction='GOOD';
 expect(additions()).toEqual(expected);expect(s.players.A!.conditionalSelections).toEqual(saved);
});
const FROZEN_SPIRIT_CASES: [string,ConditionalAbilityId,number][] = [
 ['有翼人のティア','c2-p02-r1c1-ab04',1],['リーア姫','c2-p03-r1c2-ab03',2],
 ['黒妖精のアーネス','c2-p03-r2c2-ab04',2],['竜皇子アスフェルト','c2-p04-r1c2-ab05',1],
 ['獣使いのウパニシャット','c2-p05-r1c2-ab01',1],['黒騎士ガーウィン','c2-p05-r2c1-ab05',2],
];
it.each(FROZEN_SPIRIT_CASES)('%s %s actual OFF preserves frozen check with bonus %s',(name,id,bonus)=>{
 let s=ready();character(s,'A',name);character(s,'B',id==='c2-p02-r1c1-ab04'?'吟遊詩人のレスター':'聖騎士ランスロット');s.players.B!.revealed=true;
 s.players.A!.permanent={magic_level:-10};if(id==='c2-p04-r1c2-ab05')s.players.A!.faction='GOOD';
 character(s,'C',s.players.A!.faction==='GOOD'?'黒騎士ガーウィン':'侍大将のシン');s.players.C!.revealed=true;
 const attack=handCard(s,'A','風矢'),setting=()=>viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId===id)!;
 s=finish(act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:setting().targetEventId,enabled:true,...(id==='c2-p03-r1c2-ab03'?{targetIds:[]}: {})}));
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['C'],dedicated:false}),'before-roll');
 s=closeWindow(s,[2,2]);const rollId=s.rolls!.at(-1)!.id;
 const roll=()=>s.rolls!.find(r=>r.id===rollId)!;
 expect(roll()).toMatchObject({purpose:'excess-level',rollerId:'A',faces:[2,2],success:true});
 expect(conditionalStatAdditions(s,s.players.A!,{kind:'roll',id:rollId}).spirit).toBe(bonus);
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A')s=pass(s);
 const frozen=structuredClone(roll());s=act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:setting().targetEventId,enabled:false});
 s=JSON.parse(JSON.stringify(s));expect(roll()).toEqual(frozen);expect(setting().enabled).toBe(false);
 expect(conditionalStatAdditions(s,s.players.A!,{kind:'roll',id:rollId}).spirit).toBe(0);
 s=finish(s);expect(s.rolls!.find(r=>r.id===rollId)!.threshold).toBe(frozen.threshold);
});
it('Upa actual OFF leaves already frozen warrior damage unchanged',()=>{
 let s=ready();character(s,'A','獣使いのウパニシャット');s.players.A!.permanent={warrior_level:20};
 const attack=handCard(s,'A','黒翼飛翔剣'),id='c2-p05-r1c2-ab01' as const;
 const setting=()=>viewFor(s,'A').conditionalAbilities.find(o=>o.abilityId===id)!;
 s=finish(act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:setting().targetEventId,enabled:true}));
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'attack-abilities');
 const groupId=Object.keys(s.groups!)[0]!,saved=structuredClone(s.groups![groupId]!.targets[0]!.hits);
 expect(saved.map(h=>h.damage)).toEqual([8]);
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='A')s=pass(s);
 s=act(s,'A',{type:'SET_CONDITIONAL_ABILITY',abilityId:id,targetEventId:setting().targetEventId,enabled:false});
 expect(s.groups![groupId]!.targets[0]!.hits).toEqual(saved);s=finish(s);expect(s.players.B!.damage).toBe(8);
});
