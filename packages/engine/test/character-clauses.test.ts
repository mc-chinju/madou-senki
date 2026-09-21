import {describe,expect,it} from 'vitest';
import {actionCards,characters,getAction,getCharacter} from '@madou/catalog';
import {allowedFactions,factionObjective,initialProtection,protectedDead,currentDefeatCondition,replaceAllegiance} from '../src/lifecycle/objectives.js';
import {act,finish,ready} from './combat-helpers.js';
import {gameStats,techniqueFor, discardIds } from '../src/index.js';
import {makeOwnedReclaimTable,playOwnedCardToDiscard,currentReclaimWindow,nextOwnAction} from './owned-reclaim-helpers.js';
import {character,handCard,handCards} from './fixtures.js';
import {printedTechniqueAllowed} from '../src/combat/printed-restrictions.js';
import {ownsAbility} from '../src/abilities/ownership.js';
import {canonicalOwnedNames} from '../src/reclaim-names.js';
import type {Faction} from '../src/lifecycle/types.js';

const CHARACTER_CASES: [string,string][] = [
  [
    "白魔術師シェリム",
    "c2-p01-r1c1"
  ],
  [
    "大神官ジル",
    "c2-p01-r1c2"
  ],
  [
    "侍大将のシン",
    "c2-p01-r2c1"
  ],
  [
    "小妖精のチャム",
    "c2-p01-r2c2"
  ],
  [
    "有翼人のティア",
    "c2-p02-r1c1"
  ],
  [
    "妖精王フューリー",
    "c2-p02-r1c2"
  ],
  [
    "早駆けのランカスター",
    "c2-p02-r2c1"
  ],
  [
    "聖騎士ランスロット",
    "c2-p02-r2c2"
  ],
  [
    "小人のランバ",
    "c2-p03-r1c1"
  ],
  [
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "吟遊詩人のレスター",
    "c2-p03-r2c1"
  ],
  [
    "黒妖精のアーネス",
    "c2-p03-r2c2"
  ],
  [
    "凍気のアイエル",
    "c2-p04-r1c1"
  ],
  [
    "竜皇子アスフェルト",
    "c2-p04-r1c2"
  ],
  [
    "占星術師のアルセイル",
    "c2-p04-r2c1"
  ],
  [
    "忍びのイダ",
    "c2-p04-r2c2"
  ],
  [
    "邪祭ウーノス",
    "c2-p05-r1c1"
  ],
  [
    "獣使いのウパニシャット",
    "c2-p05-r1c2"
  ],
  [
    "黒騎士ガーウィン",
    "c2-p05-r2c1"
  ],
  [
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "不死王ガドューラ",
    "c2-p06-r1c1"
  ],
  [
    "魔聖母ディア",
    "c2-p06-r1c2"
  ],
  [
    "爆炎のフレイアード",
    "c2-p06-r2c1"
  ],
  [
    "餓狼ヨーツルム",
    "c2-p06-r2c2"
  ],
  [
    "聖騎士ランスロット2",
    "c2-p07-r1c1"
  ],
  [
    "破壊神ヴァンミール",
    "c2-p07-r1c2"
  ]
];
const ALL_FACTIONS: Faction[]=['GOOD','EVIL','ヴァンミール'];
function printedAllowed(id:string):Faction[]{
 const text=getCharacter(id)!.allegiance_text;
 if(!text.includes('常に'))return [...ALL_FACTIONS];
 return ALL_FACTIONS.filter(f=>text.includes(f));
}

describe('character allegiance clauses',()=>{
 it.each(CHARACTER_CASES)('%s (%s) printed faction allowance',(name,id)=>{
  const s=ready();character(s,'A',name);const original=structuredClone(s.players.A!);
  expect(allowedFactions(id)).toEqual(printedAllowed(id));
  for(const faction of ALL_FACTIONS){
   const player=structuredClone(original),before=structuredClone(player);
   const objective=factionObjective(faction),protection=initialProtection('c2-p06-r1c1');
   const accepted=replaceAllegiance(player,faction,objective,protection);
   expect(accepted).toBe(printedAllowed(id).includes(faction));
   if(accepted){
    expect(player.faction).toBe(faction);expect(player.currentObjective).toEqual(objective);expect(player.protection).toEqual(protection);
    objective.enemyFactions.splice(0);protection.characterIds.splice(0);
    expect(player.currentObjective).toEqual(factionObjective(faction));expect(player.protection).toEqual(initialProtection('c2-p06-r1c1'));
   }else expect(player).toEqual(before);
  }
  const copy=allowedFactions(id);copy.splice(0);expect(allowedFactions(id)).toEqual(printedAllowed(id));
 });
 it.each(CHARACTER_CASES)('%s (%s) fixed allegiance is not an optional ability',(name,id)=>{
  const s=ready();character(s,'A',name);
  for(const faction of ALL_FACTIONS){
   const p=structuredClone(s.players.A!);p.conditionalSelections=[];
   p.statuses=[{id:'disabled-fixture',kind:'ability-disabled',sourceActorId:'B',modifiers:[0],nextCheck:0}];
   const before=structuredClone(p);
   const accepted=replaceAllegiance(p,faction,factionObjective(faction),initialProtection(id));
   expect(accepted).toBe(printedAllowed(id).includes(faction));
   if(!accepted)expect(p).toEqual(before);
   else expect(p.faction).toBe(faction);
  }
 });
 it.each(CHARACTER_CASES)('%s (%s) unrelated allegiance changes preserve this objective',(name,id)=>{
  const s=ready();character(s,'A',name);character(s,'B','大神官ジル');
  const original=structuredClone(s.players.A!);
  for(const faction of ALL_FACTIONS){
   expect(replaceAllegiance(s.players.B!,faction,factionObjective(faction),initialProtection('c2-p06-r1c1'))).toBe(true);
   expect(s.players.A).toEqual(original);
  }
 });
});


describe('character objective clauses',()=>{
 it.each(CHARACTER_CASES)('%s (%s) actual extinction completes the printed objective',(name,id)=>{
  let s=ready();character(s,'A',name);
  const faction=getCharacter(id)!.initial_faction;
  character(s,'B',faction==='EVIL'?'魔導王ガイナス':'リーア姫');
  character(s,'C',faction==='GOOD'?'魔導王ガイナス':'リーア姫');
  character(s,'D',faction==='GOOD'?'魔聖母ディア':'白魔術師シェリム');
  if(faction==='ヴァンミール')character(s,'C','魔導王ガイナス');
  const targets=faction==='ヴァンミール'?['B','C','D']:['C','D'];
  for(const p of Object.values(s.players))p.permanent={spirit:20,magic_level:20,endurance:100};
  for(const target of targets)s.players[target]!.damage=gameStats(s,target).endurance-4;
  const card=handCard(s,'A',id==='c2-p06-r1c1'?getAction('a2-p09-r3c1')!.name:'裂界');
  const original=structuredClone(s.players.A!.currentObjective),protection=structuredClone(s.players.A!.protection);
  expect(getCharacter(id)!.objective).toBe(faction==='ヴァンミール'?'自陣営以外の全滅':`${faction==='GOOD'?'EVIL':'GOOD'}の全滅`);
  expect(original).toEqual(factionObjective(faction));
  expect(s.outcome).toBeUndefined();
  s=act(s,'A',{type:'CHANT',cardInstanceId:card});
  s=nextOwnAction({state:s,ownerId:'A'},card);
  s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:targets,dedicated:id==='c2-p06-r1c1'}));
  for(const target of targets){expect(s.players[target]!.presence).toBe('dead');expect(s.events.some(e=>e.type==='PLAYER_DIED'&&e.actorId===target)).toBe(true);}
  expect(s.players.A!.presence).toBe('active');expect(s.outcome?.kind).toBe('victory');expect(s.outcome?.winnerIds).toContain('A');
  expect(s.players.A!.currentObjective).toEqual(original);expect(s.players.A!.protection).toEqual(protection);
 });
});

const PROTECTED_CASES: [string,string,string,string][] = [
  [
    "白魔術師シェリム",
    "c2-p01-r1c1",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "大神官ジル",
    "c2-p01-r1c2",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "侍大将のシン",
    "c2-p01-r2c1",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "小妖精のチャム",
    "c2-p01-r2c2",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "有翼人のティア",
    "c2-p02-r1c1",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "妖精王フューリー",
    "c2-p02-r1c2",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "妖精王フューリー",
    "c2-p02-r1c2",
    "白魔術師シェリム",
    "c2-p01-r1c1"
  ],
  [
    "早駆けのランカスター",
    "c2-p02-r2c1",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "聖騎士ランスロット",
    "c2-p02-r2c2",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "小人のランバ",
    "c2-p03-r1c1",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "吟遊詩人のレスター",
    "c2-p03-r2c1",
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "黒妖精のアーネス",
    "c2-p03-r2c2",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "凍気のアイエル",
    "c2-p04-r1c1",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "凍気のアイエル",
    "c2-p04-r1c1",
    "爆炎のフレイアード",
    "c2-p06-r2c1"
  ],
  [
    "竜皇子アスフェルト",
    "c2-p04-r1c2",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "竜皇子アスフェルト",
    "c2-p04-r1c2",
    "魔聖母ディア",
    "c2-p06-r1c2"
  ],
  [
    "占星術師のアルセイル",
    "c2-p04-r2c1",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "忍びのイダ",
    "c2-p04-r2c2",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "邪祭ウーノス",
    "c2-p05-r1c1",
    "魔聖母ディア",
    "c2-p06-r1c2"
  ],
  [
    "獣使いのウパニシャット",
    "c2-p05-r1c2",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "獣使いのウパニシャット",
    "c2-p05-r1c2",
    "黒妖精のアーネス",
    "c2-p03-r2c2"
  ],
  [
    "黒騎士ガーウィン",
    "c2-p05-r2c1",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "不死王ガドューラ",
    "c2-p06-r1c1",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "爆炎のフレイアード",
    "c2-p06-r2c1",
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "爆炎のフレイアード",
    "c2-p06-r2c1",
    "凍気のアイエル",
    "c2-p04-r1c1"
  ],
  [
    "餓狼ヨーツルム",
    "c2-p06-r2c2",
    "魔聖母ディア",
    "c2-p06-r1c2"
  ],
  [
    "聖騎士ランスロット2",
    "c2-p07-r1c1",
    "リーア姫",
    "c2-p03-r1c2"
  ]
];

describe('character defeat clauses',()=>{
 it.each(CHARACTER_CASES)('%s (%s) protection matches every printed death condition',(name,id)=>{
  const expected=['リーア姫','シェリム','ガイナス','ディア','フレイアード','アーネス','アイエル'].filter(token=>getCharacter(id)!.defeat_condition.includes(token)).map(token=>characters.find(c=>c.name.includes(token))!.id);
  expect(initialProtection(id).characterIds.sort()).toEqual(expected.sort());
  const s=ready();character(s,'A',name);
  expect(protectedDead(s,s.players.A!)).toBe(false);
  for(const target of expected)expect(currentDefeatCondition(s.players.A!)).toContain(getCharacter(target)!.name);
  if(!expected.length){expect(getCharacter(id)!.defeat_condition).toBe('なし');expect(currentDefeatCondition(s.players.A!)).toBe('なし');}
 });
 it.each(PROTECTED_CASES)('%s (%s) actual death of %s (%s) causes wandering then final loss',(name,id,protectedName,protectedId)=>{
  let s=ready();character(s,'A',name);character(s,'C',protectedName);
  const good=getCharacter(id)!.initial_faction==='GOOD';
  character(s,'B',good?'魔聖母ディア':'リーア姫');character(s,'D',good?'リーア姫':'魔導王ガイナス');
  for(const p of Object.values(s.players))p.permanent={spirit:20,warrior_level:20,magic_level:20,endurance:100};
  for(const target of ['C','D'])s.players[target]!.damage=gameStats(s,target).endurance-1;
  const [first,second]=handCards(s,['B','B'],'踏み込み／弓') as [string,string];
  s.deck=[...s.deck.filter(c=>getAction(c)!.category!=='open'),...s.deck.filter(c=>getAction(c)!.category==='open')];
  const original=structuredClone(s.players.A!.currentObjective),protection=structuredClone(s.players.A!.protection);
  expect(protectedDead(s,s.players.A!)).toBe(false);
  s=nextOwnAction({state:s,ownerId:'B'},second);
  s=finish(act(s,'B',{type:'ATTACK',cardInstanceId:first,targetIds:['C'],dedicated:false}));
  expect(s.players.C!.characterId).toBe(protectedId);expect(s.players.C!.presence).toBe('dead');
  expect(protectedDead(s,s.players.A!)).toBe(true);expect(s.players.A!.presence).toBe('wandering');
  expect(s.outcome).toBeUndefined();
  expect(s.events.some(e=>e.type==='PLAYER_WANDERING'&&e.actorId==='A')).toBe(true);
  expect(s.players.A!.currentObjective).toEqual(original);expect(s.players.A!.protection).toEqual(protection);
  s=nextOwnAction({state:JSON.parse(JSON.stringify(s)),ownerId:'B'},second);
  s=finish(act(s,'B',{type:'ATTACK',cardInstanceId:second,targetIds:['D'],dedicated:false}));
  expect(s.players.D!.presence).toBe('dead');expect(s.players.A!.presence).toBe('wandering');
  expect(s.outcome).toMatchObject({kind:'victory',results:{A:'lost',B:'won'}});
  expect(s.players.A!.currentObjective).toEqual(original);expect(s.players.A!.protection).toEqual(protection);
 });
});

const UNINHERITED_CASES: [string,string][] = [
  [
    "白魔術師シェリム",
    "c2-p01-r1c1"
  ],
  [
    "大神官ジル",
    "c2-p01-r1c2"
  ],
  [
    "侍大将のシン",
    "c2-p01-r2c1"
  ],
  [
    "小妖精のチャム",
    "c2-p01-r2c2"
  ],
  [
    "有翼人のティア",
    "c2-p02-r1c1"
  ],
  [
    "妖精王フューリー",
    "c2-p02-r1c2"
  ],
  [
    "早駆けのランカスター",
    "c2-p02-r2c1"
  ],
  [
    "聖騎士ランスロット",
    "c2-p02-r2c2"
  ],
  [
    "小人のランバ",
    "c2-p03-r1c1"
  ],
  [
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "吟遊詩人のレスター",
    "c2-p03-r2c1"
  ],
  [
    "黒妖精のアーネス",
    "c2-p03-r2c2"
  ],
  [
    "凍気のアイエル",
    "c2-p04-r1c1"
  ],
  [
    "竜皇子アスフェルト",
    "c2-p04-r1c2"
  ],
  [
    "占星術師のアルセイル",
    "c2-p04-r2c1"
  ],
  [
    "忍びのイダ",
    "c2-p04-r2c2"
  ],
  [
    "邪祭ウーノス",
    "c2-p05-r1c1"
  ],
  [
    "獣使いのウパニシャット",
    "c2-p05-r1c2"
  ],
  [
    "黒騎士ガーウィン",
    "c2-p05-r2c1"
  ],
  [
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "不死王ガドューラ",
    "c2-p06-r1c1"
  ],
  [
    "魔聖母ディア",
    "c2-p06-r1c2"
  ],
  [
    "爆炎のフレイアード",
    "c2-p06-r2c1"
  ],
  [
    "餓狼ヨーツルム",
    "c2-p06-r2c2"
  ]
];

const EMPTY_OWNED_CASES: [string,string,'technique'|'follower'][] = [
  [
    "侍大将のシン",
    "c2-p01-r2c1",
    "follower"
  ],
  [
    "小妖精のチャム",
    "c2-p01-r2c2",
    "technique"
  ],
  [
    "小妖精のチャム",
    "c2-p01-r2c2",
    "follower"
  ],
  [
    "早駆けのランカスター",
    "c2-p02-r2c1",
    "follower"
  ],
  [
    "吟遊詩人のレスター",
    "c2-p03-r2c1",
    "follower"
  ],
  [
    "凍気のアイエル",
    "c2-p04-r1c1",
    "follower"
  ],
  [
    "占星術師のアルセイル",
    "c2-p04-r2c1",
    "follower"
  ],
  [
    "忍びのイダ",
    "c2-p04-r2c2",
    "follower"
  ],
  [
    "魔導王ガイナス",
    "c2-p05-r2c2",
    "follower"
  ],
  [
    "爆炎のフレイアード",
    "c2-p06-r2c1",
    "follower"
  ],
  [
    "餓狼ヨーツルム",
    "c2-p06-r2c2",
    "follower"
  ],
  [
    "破壊神ヴァンミール",
    "c2-p07-r1c2",
    "follower"
  ]
];

describe('character source clauses',()=>{
 it.each(UNINHERITED_CASES)('%s (%s) has no additional inherited ability source',(name,id)=>{
  const s=ready();character(s,'A',name);const p=s.players.A!;
  expect(getCharacter(id)!.inherits_abilities_from).toBeNull();expect(p.abilityCharacterIds??[]).toEqual([]);
  for(const source of characters)for(const ability of source.abilities)expect(ownsAbility(p,ability.id)).toBe(source.id===id);
  expect(ownsAbility(p,`${id}-ab999`)).toBe(false);
 });
 it.each(EMPTY_OWNED_CASES)('%s (%s) empty owned %s list grants no base recovery',(name,id,kind)=>{
  const cardId=kind==='technique'?'a2-p24-r1c2':'a2-p18-r3c3';
  const table=makeOwnedReclaimTable(name,cardId);
  expect(table.state.players.A!.characterId).toBe(id);expect(canonicalOwnedNames(table.state.players.A!,kind)).toEqual([]);
  let s=playOwnedCardToDiscard(table,cardId);const choice=currentReclaimWindow(s,'A')!;
  expect(choice.cardInstanceId).toBe(cardId);expect(choice.claims.some(c=>c.right==='base')).toBe(false);
  s=finish(s);expect(discardIds(s).filter(c=>c===cardId)).toHaveLength(1);
  expect(s.players.A!.reclaimUsage?.[getAction(cardId)!.name]?.baseSpent).not.toBe(true);
 });
});

const UNRESTRICTED_CASES: [string,string][] = [
  [
    "白魔術師シェリム",
    "c2-p01-r1c1"
  ],
  [
    "大神官ジル",
    "c2-p01-r1c2"
  ],
  [
    "侍大将のシン",
    "c2-p01-r2c1"
  ],
  [
    "有翼人のティア",
    "c2-p02-r1c1"
  ],
  [
    "早駆けのランカスター",
    "c2-p02-r2c1"
  ],
  [
    "聖騎士ランスロット",
    "c2-p02-r2c2"
  ],
  [
    "小人のランバ",
    "c2-p03-r1c1"
  ],
  [
    "リーア姫",
    "c2-p03-r1c2"
  ],
  [
    "吟遊詩人のレスター",
    "c2-p03-r2c1"
  ],
  [
    "黒妖精のアーネス",
    "c2-p03-r2c2"
  ],
  [
    "凍気のアイエル",
    "c2-p04-r1c1"
  ],
  [
    "竜皇子アスフェルト",
    "c2-p04-r1c2"
  ],
  [
    "占星術師のアルセイル",
    "c2-p04-r2c1"
  ],
  [
    "忍びのイダ",
    "c2-p04-r2c2"
  ],
  [
    "邪祭ウーノス",
    "c2-p05-r1c1"
  ],
  [
    "獣使いのウパニシャット",
    "c2-p05-r1c2"
  ],
  [
    "黒騎士ガーウィン",
    "c2-p05-r2c1"
  ],
  [
    "魔導王ガイナス",
    "c2-p05-r2c2"
  ],
  [
    "魔聖母ディア",
    "c2-p06-r1c2"
  ],
  [
    "爆炎のフレイアード",
    "c2-p06-r2c1"
  ],
  [
    "餓狼ヨーツルム",
    "c2-p06-r2c2"
  ],
  [
    "聖騎士ランスロット2",
    "c2-p07-r1c1"
  ],
  [
    "破壊神ヴァンミール",
    "c2-p07-r1c2"
  ]
];

describe('character printed restrictions',()=>{
 it.each(UNRESTRICTED_CASES)('%s (%s) has no additional printed technique restriction',(name,id)=>{
  expect(getCharacter(id)!.restrictions).toEqual([]);
  const table=makeOwnedReclaimTable(name,'a2-p24-r1c2'),p=table.state.players.A!;
  for(const card of actionCards){
   const profile=techniqueFor(card.id);if(!profile)continue;
   expect(printedTechniqueAllowed(p,profile)).toBe(!(profile.prohibitedFactions??[]).includes(p.faction as Faction));
  }
  const before=table.state.players.B!.damage,damage=techniqueFor('a2-p24-r1c2')!.damage;
  expect(typeof damage).toBe('number');
  const s=finish(playOwnedCardToDiscard(table,'a2-p24-r1c2'));
  expect(s.players.B!.damage-before).toBe(damage);
 });
});
