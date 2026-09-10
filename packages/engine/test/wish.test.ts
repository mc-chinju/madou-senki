import {expect,it} from 'vitest';
import {getAction,getCharacter} from '@madou/catalog';
import {allCardInstanceIds,gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,closeWindow,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
const wishes=['a2-p04-r3c2','a2-p04-r3c3'] as const;
function take(s:GameState,owner:string,id:string){
 s.deck=s.deck.filter(x=>x!==id);s.discard=s.discard.filter(x=>x!==id);
 for(const p of Object.values(s.players)){for(const z of ['hand','open','attachments'] as const)p[z]=p[z].filter(x=>x!==id);for(const z of ['followers','chants'] as const)p[z]=p[z].filter(x=>x.cardInstanceId!==id);}
 s.players[owner]!.hand.push(id);return id;
}
function start(id:typeof wishes[number]){const s=ready();take(s,'A',id);return s;}
function play(s:GameState,id:typeof wishes[number]){return act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:id,mode:'wish'});}
function choose(s:GameState,source:unknown,random=entropy().random){
 const command={type:'CHOOSE_WISH',decisionId:viewFor(s,'A').wish!.decisionId,source};const e={...entropy(),random};
 const r=transition(s,{actorId:'A',command} as any,e);expect(r).toEqual(transition(JSON.parse(JSON.stringify(s)),{actorId:'A',command} as any,e));if(!r.ok)throw Error(r.code);expect(allCardInstanceIds(r.state).sort()).toEqual(allCardInstanceIds(s).sort());return r.state;
}
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s);expect(transition(s,{actorId,command} as any,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
function nextOwn(s:GameState,middle=(s:GameState,owner:string)=>act(s,owner,{type:'PASS_ACTION'})){
 for(let n=0;n<4;n++){const p=s.seatOrder[s.turnSeat]!,excess=Math.max(0,s.players[p]!.hand.length-gameStats(s,p).handLimit);s=act(s,p,{type:'END_TURN',discardIds:s.players[p]!.hand.filter(x=>!wishes.includes(x as any)).slice(0,excess)});s=act(s,s.seatOrder[s.turnSeat]!,{type:'START_TURN'});s=act(s,s.seatOrder[s.turnSeat]!,{type:'CHOOSE_DRAW',draw:false});if(n<3)s=middle(s,s.seatOrder[s.turnSeat]!);}return s;
}
it.each(wishes)('%s has a cancellable physical payment and no catalog until the declaration resolves',id=>{
 let s=start(id),before=[...s.players.A!.hand];s=act(s,'A',{type:'PASS_ACTION'});expect(s.players.A!.hand).toEqual(before);expect(viewFor(s,'A').wish).toBeNull();
 s=start(id);const fate=handCard(s,'B','命運凶変');s=play(s,id);expect(s.resolution).toContain(id);expect(viewFor(s,'A').wish).toBeNull();const targetActionId=viewFor(s,'A').reactionTargetActionId!;s=pass(s);s=finish(act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId}));expect(s.discard).toContain(id);expect(s.wishes??[]).toEqual([]);expect(s.events.some(e=>e.type==='WISH_ACQUIRED')).toBe(false);expect(s.phase).toBe('hand-adjustment');
});
it.each(wishes)('%s privately searches by name, randomly selects a duplicate and shuffles once',id=>{
 let s=start(id);const first=take(s,'D','a2-p04-r3c2'===id?'a2-p04-r3c3':'a2-p04-r3c2');s.players.D!.hand=s.players.D!.hand.filter(x=>x!==first);s.deck.unshift(first);
 s=until(play(s,id),'wish');const d=viewFor(s,'A').wish!;expect(d.deckNames).toEqual([...d.deckNames].sort((a,b)=>a.cardName.localeCompare(b.cardName,'ja')));expect(d).not.toHaveProperty('deck');for(const p of ['B','C','D'])expect(viewFor(s,p).wish).toBeNull();
 const names=new Map<string,string[]>();for(const card of s.deck){const name=getAction(card)!.name;names.set(name,[...(names.get(name)??[]),card]);}const [name,copies]=[...names].find(([,ids])=>ids.length>1&&getAction(ids[0]!)!.category!=='open')!;
 const previous=[...s.deck],low=finish(choose(s,{kind:'deck',cardName:name},Array(2000).fill(0))),high=finish(choose(s,{kind:'deck',cardName:name},Array(2000).fill(.999)));
 expect(low.players.A!.hand).toContain(copies[0]);expect(high.players.A!.hand).toContain(copies.at(-1));expect(low.deck).not.toEqual(previous.filter(x=>x!==copies[0]));expect(high.deck).toEqual(previous.filter(x=>x!==copies.at(-1)));
 expect(low.events.filter(e=>e.type==='WISH_ACQUIRED'&&e.audience!=='public')).toHaveLength(1);expect(viewFor(low,'C').logs.filter(e=>e.type==='WISH_ACQUIRED').every(e=>!e.cardInstanceId)).toBe(true);expect(low.discard).toContain(id);expect(low.phase).toBe('hand-adjustment');
});
it.each(wishes)('%s retains the same private decision on absent name, forged source, stale ID, foreign actor or attempted pass',id=>{
 let s=until(play(start(id),id),'wish'),d=viewFor(s,'A').wish!;
 for(const source of [{kind:'deck',cardName:'存在しない札'},{kind:'deck',cardName:'祈願',deckIndex:0},{kind:'hand',ownerId:'B',cardInstanceId:s.players.B!.hand[0]},{kind:'public',cardInstanceId:id},{kind:'public',cardInstanceId:s.players.B!.characterId}])reject(s,'A',{type:'CHOOSE_WISH',decisionId:d.decisionId,source});
 reject(s,'B',{type:'CHOOSE_WISH',decisionId:d.decisionId,source:{kind:'hand',ownerId:'A'}});reject(s,'A',{type:'CHOOSE_WISH',decisionId:'stale',source:{kind:'hand',ownerId:'B'}});reject(s,'A',{type:'PASS'});expect(viewFor(s,'A').wish!.decisionId).toBe(d.decisionId);
 s=finish(choose(s,{kind:'deck',cardName:d.deckNames.find(n=>n.cardName!=='祈願'&&!n.cardName.includes('伏線'))!.cardName}));expect(s.phase).toBe('hand-adjustment');
});
it.each(wishes)('%s takes a uniform random hand card with identity private to only both owners',id=>{
 const s=until(play(start(id),id),'wish'),old=s.players.B!.hand;
 for(const [value,index] of [[0,0],[.999,old.length-1]]){
  const done=finish(choose(s,{kind:'hand',ownerId:'B'},Array(2000).fill(value))),card=old[index!]!;expect(done.players.A!.hand).toContain(card);expect(done.players.B!.hand).toEqual(old.filter(x=>x!==card));
  for(const viewer of ['A','B'])expect(viewFor(done,viewer).privateLogs.filter(e=>e.type==='WISH_ACQUIRED').map(e=>e.cardInstanceId)).toEqual([card]);
  for(const viewer of ['C','D'])expect(viewFor(done,viewer).privateLogs.filter(e=>e.type==='WISH_ACQUIRED')).toEqual([]);
 }
});
it.each(wishes)('%s moves an attachment and own follower into hand without retaining installed state',id=>{
 let s=start(id);const book=handCard(s,'A','魔導書');s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[book]}));const boosted=gameStats(s,'A').magic_level;
 // A complete real seat cycle gives the already-installed card a later Wish action.
 for(let n=0;n<4;n++){const p=s.seatOrder[s.turnSeat]!,excess=Math.max(0,s.players[p]!.hand.length-gameStats(s,p).handLimit);s=act(s,p,{type:'END_TURN',discardIds:s.players[p]!.hand.filter(x=>x!==id).slice(0,excess)});s=act(s,s.seatOrder[s.turnSeat]!,{type:'START_TURN'});s=act(s,s.seatOrder[s.turnSeat]!,{type:'CHOOSE_DRAW',draw:false});if(n<3)s=act(s,s.seatOrder[s.turnSeat]!,{type:'PASS_ACTION'});}
 s=until(play(s,id),'wish');s=finish(choose(s,{kind:'public',cardInstanceId:book}));expect(s.players.A!.hand).toContain(book);expect(s.players.A!.attachments).not.toContain(book);expect(gameStats(s,'A').magic_level).toBe(boosted-1);
 let f=start(id);const follower=handCard(f,'A','ウッドゴーレム');f=act(f,'A',{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[follower]});
 for(let n=0;n<4;n++){const p=f.seatOrder[f.turnSeat]!,excess=Math.max(0,f.players[p]!.hand.length-gameStats(f,p).handLimit);f=act(f,p,{type:'END_TURN',discardIds:f.players[p]!.hand.filter(x=>x!==id).slice(0,excess)});f=act(f,f.seatOrder[f.turnSeat]!,{type:'START_TURN'});f=act(f,f.seatOrder[f.turnSeat]!,{type:'CHOOSE_DRAW',draw:false});if(n<3)f=act(f,f.seatOrder[f.turnSeat]!,{type:'PASS_ACTION'});}
 f=finish(choose(until(play(f,id),'wish'),{kind:'public',cardInstanceId:follower}));expect(f.players.A!.followers).toEqual([]);expect(f.players.A!.hand).toContain(follower);expect(viewFor(f,'C').logs.filter(e=>e.type==='WISH_ACQUIRED').every(e=>!e.cardInstanceId)).toBe(true);
});
it.each(wishes)('%s selects a concealed chant by an opaque saved slot without leaking its identity',id=>{
 let s=start(id);const chant=take(s,'B','a2-p11-r3c2');s.players.B!.hand=s.players.B!.hand.filter(x=>x!==chant);s.players.B!.chants.push({cardInstanceId:chant,revealed:false});s=until(play(s,id),'wish');
 const o=viewFor(s,'A').wish!.publicSources.find(o=>o.ownerId==='B'&&o.zone==='chants')!;expect(o.cardInstanceId).not.toBe(chant);expect(o.name).toBeUndefined();expect(JSON.stringify(o)).not.toContain(chant);
 const alternative=structuredClone(s),other=alternative.deck.find(x=>getAction(x)!.category==='technique')!;alternative.deck[alternative.deck.indexOf(other)]=chant;alternative.players.B!.chants[0]!.cardInstanceId=other;
 expect(viewFor(alternative,'A').wish!.publicSources).toEqual(viewFor(s,'A').wish!.publicSources);expect(viewFor(alternative,'C')).toEqual(viewFor(s,'C'));
 reject(s,'A',{type:'CHOOSE_WISH',decisionId:viewFor(s,'A').wish!.decisionId,source:{kind:'public',cardInstanceId:chant}});
 s=finish(choose(s,{kind:'public',cardInstanceId:o.cardInstanceId}));expect(s.players.A!.hand).toContain(chant);expect(s.players.B!.chants).toEqual([]);expect(viewFor(s,'C').logs.filter(e=>e.type==='WISH_ACQUIRED').every(e=>!e.cardInstanceId)).toBe(true);
});
it.each(wishes)('%s excludes otherworld possessions and all forbidden physical zones',id=>{
 let s=start(id);const assigned=['a2-p03-r1c2','a2-p03-r1c3','a2-p19-r2c3','a2-p11-r3c2','a2-p01-r2c2'];
 for(const card of assigned)take(s,'B',card);s.players.B!.hand=s.players.B!.hand.filter(x=>!assigned.includes(x));s.players.B!.attachments.push(assigned[0]!);s.players.B!.hand.push(assigned[1]!);s.players.B!.followers.push({cardInstanceId:assigned[2]!,revealed:true});s.players.B!.chants.push({cardInstanceId:assigned[3]!,revealed:true});s.players.B!.open.push(assigned[4]!);s.players.B!.presence='otherworld';
 const follower=take(s,'C','a2-p19-r3c1');s.players.C!.hand=s.players.C!.hand.filter(x=>x!==follower);s.players.C!.followers.push({cardInstanceId:follower,revealed:true});
 const disc=take(s,'D','a2-p04-r2c1'),reserved=take(s,'D','a2-p05-r3c1'),marker=take(s,'D','a2-p05-r3c2');s.players.D!.hand=s.players.D!.hand.filter(x=>![disc,reserved,marker].includes(x));s.discard.push(disc);s.reclaimReservations.push(reserved);s.distanceMarkers={prior:{a:'C',b:'D',ownerId:'D',cardInstanceId:marker}};
 s=until(play(s,id),'wish');const d=viewFor(s,'A').wish!;expect(d.handOwners.some(o=>o.ownerId==='B')).toBe(false);expect(d.publicSources.some(o=>o.ownerId==='B')).toBe(false);
 for(const cardInstanceId of [...assigned,follower,disc,reserved,marker,id,'virtual-follower'])reject(s,'A',{type:'CHOOSE_WISH',decisionId:d.decisionId,source:{kind:'public',cardInstanceId}});
 reject(s,'A',{type:'CHOOSE_WISH',decisionId:d.decisionId,source:{kind:'hand',ownerId:'B'}});
});
it.each(wishes)('%s first publishes a deck Fusen once and preserves its selected result through OPEN revival',id=>{
 let s=start(id);character(s,'D','忍びのイダ');const open=take(s,'D','a2-p01-r1c1');s.players.D!.hand=s.players.D!.hand.filter(x=>x!==open);s.deck.unshift(open);s.discard.push(...s.players.D!.hand);s.players.D!.hand=[];s.players.D!.presence='dead';s=until(play(s,id),'wish');const decisionId=viewFor(s,'A').wish!.decisionId;
 s=choose(s,{kind:'deck',cardName:getAction(open)!.name});expect(s.windows!.at(-1)!.kind).toBe('before-roll');expect(s.wishes!.find(d=>d.id===decisionId)!.acquisition!.cardInstanceId).toBe(open);expect(s.players.A!.open).toContain(open);expect(s.players.A!.hand).not.toContain(open);
 s=until(s,'revival');s=act(s,'D',{type:'CHOOSE_REVIVAL',revive:false});s=finish(s);expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId===open)).toHaveLength(1);expect(s.phase).toBe('hand-adjustment');reject(s,'A',{type:'CHOOSE_WISH',decisionId,source:{kind:'deck',cardName:getAction(open)!.name}});
});
it.each(wishes)('%s transfers each already-public OPEN without rerunning its first-publication effect',id=>{
 for(const open of ['a2-p01-r1c1','a2-p01-r1c2','a2-p01-r1c3','a2-p01-r2c1','a2-p01-r2c2']){
  let s=start(id);take(s,'B',open);s.players.B!.hand=s.players.B!.hand.filter(x=>x!==open);s.players.B!.open.push(open);s.players.D!.presence='otherworld';const before=gameStats(s,'B'),aBefore=gameStats(s,'A');
  s=finish(choose(until(play(s,id),'wish'),{kind:'public',cardInstanceId:open}));expect(s.players.A!.open).toContain(open);expect(s.players.B!.open).not.toContain(open);expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId===open)).toHaveLength(0);expect(s.players.D!.presence).toBe('otherworld');
  if(getAction(open)!.name==='神々の血'){expect(gameStats(s,'B').warrior_level).toBe(before.warrior_level-1);expect(gameStats(s,'A').warrior_level).toBe(aBefore.warrior_level+1);}
 }
});
it.each(wishes)('%s applies capacity loss immediately, excludes irremovable followers, and saves the owners discard choice',id=>{
 let s=start(id);character(s,'B','黒騎士ガーウィン');const blessing=handCard(s,'B','祝福');s.players.B!.hand=s.players.B!.hand.filter(x=>x!==blessing);s.players.B!.open.push(blessing);
 const fs=['a2-p19-r2c3','a2-p19-r3c1','a2-p21-r2c1'].map(card=>take(s,'B',card));s=nextOwn(act(s,'A',{type:'PASS_ACTION'}),(s,owner)=>act(s,owner,owner==='B'?{type:'ARRANGE_FOLLOWERS',cardInstanceIds:fs}:{type:'PASS_ACTION'}));
 s=choose(until(play(s,id),'wish'),{kind:'public',cardInstanceId:blessing});expect(gameStats(s,'B').followerLimit).toBe(2);expect(gameStats(s,'A').followerLimit).toBe(3);expect(s.windows!.at(-1)!.kind).toBe('wish-capacity');expect(viewFor(s,'A').wishCapacity).toBeNull();const d=viewFor(s,'B').wishCapacity!;expect(d.followerCount).toBe(1);expect(d.followerIds).not.toContain(fs[2]);expect(viewFor(s,'C').players.B!.followers.every(f=>f.face==='back')).toBe(true);
 reject(s,'B',{type:'CHOOSE_WISH_CAPACITY',decisionId:d.decisionId,followerIds:[fs[2]],chantIds:[]});reject(s,'A',{type:'CHOOSE_WISH_CAPACITY',decisionId:d.decisionId,followerIds:[fs[0]],chantIds:[]});
 s=act(s,'B',{type:'CHOOSE_WISH_CAPACITY',decisionId:d.decisionId,followerIds:[fs[0]],chantIds:[]});s=finish(s);expect(s.players.B!.followers.map(f=>f.cardInstanceId)).toEqual(fs.slice(1));expect(s.discard).toContain(fs[0]);expect(s.phase).toBe('hand-adjustment');
});
it.each(wishes)('%s chooses excess chants after Haja loss but retains an excess hand until that owners turn end',id=>{
 let s=start(id);const haja=handCard(s,'B','賢者ハジャ');s.players.B!.hand=s.players.B!.hand.filter(x=>x!==haja);s.players.B!.open.push(haja);
 const chants=[take(s,'B','a2-p11-r3c2'),take(s,'B','a2-p12-r1c1')];s.players.B!.hand=s.players.B!.hand.filter(x=>!chants.includes(x));s.players.B!.chants=chants.map(cardInstanceId=>({cardInstanceId,revealed:false}));while(s.players.B!.hand.length<6)s.players.B!.hand.push(s.deck.shift()!);const before=[...s.players.B!.hand];
 s=choose(until(play(s,id),'wish'),{kind:'public',cardInstanceId:haja});const d=viewFor(s,'B').wishCapacity!;expect(d).toMatchObject({followerCount:0,chantCount:1});expect(s.players.B!.hand).toEqual(before);expect(gameStats(s,'B').handLimit).toBe(5);
 s=finish(act(s,'B',{type:'CHOOSE_WISH_CAPACITY',decisionId:d.decisionId,followerIds:[],chantIds:[chants[1]]}));expect(s.players.B!.chants.map(c=>c.cardInstanceId)).toEqual([chants[0]]);expect(s.players.B!.hand).toEqual(before);
});
it.each(wishes)('%s removes actual crown/crystal spell modifiers as soon as the installed card becomes a hand card',id=>{
 for(const [attachment,spell,bonus] of [['a2-p03-r1c2','氷矢',1],['a2-p03-r1c3','魔詩',2]] as const){
  let s=start(id);character(s,'A','大神官ジル');take(s,'A',attachment);s=nextOwn(finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:attachment})));const card=handCard(s,'A',spell),base=gameStats(s,'A').magic_level;
  const equipped=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),beforeAction=Object.values(equipped.actions!)[0]!;expect(gameStats(equipped,'A',{provenance:{kind:'action',id:beforeAction.id}}).magic_level).toBe(base+bonus);
  s=nextOwn(finish(choose(until(play(s,id),'wish'),{kind:'public',cardInstanceId:attachment})));s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});const afterAction=Object.values(s.actions!)[0]!;expect(gameStats(s,'A',{provenance:{kind:'action',id:afterAction.id}}).magic_level).toBe(base);
 }
});
it.each(wishes)('%s removes the actual Fairy Sword full-damage permission without discarding or reinstalling it',id=>{
 let s=start(id);character(s,'A','小妖精のチャム');const sword=take(s,'A','a2-p04-r2c1');s=nextOwn(finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:sword})));const card=handCard(s,'A','踏み込み／弓');
 const full=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'attack-abilities');expect(Object.values(full.groups!)[0]!.targets[0]!.hits[0]!.damage).toBe(4);
 s=nextOwn(finish(choose(until(play(s,id),'wish'),{kind:'public',cardInstanceId:sword})));expect(s.players.A!.attachments).not.toContain(sword);expect(s.discardOccurrences??[]).toEqual([]);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'attack-abilities');expect(Object.values(s.groups!)[0]!.targets[0]!.hits[0]!.damage).toBe(2);
});
it.each(wishes)('%s steals an actual Mother Truth attachment while its completed allegiance and objective remain',id=>{
 let s=start(id);character(s,'B',getCharacter('c2-p04-r1c2')!.name);s.players.B!.revealed=true;const mother=take(s,'A','a2-p05-r1c2');s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:mother,targetId:'B'}));const changed=structuredClone(s.players.B!);expect(changed.faction).toBe('GOOD');s=nextOwn(s);
 s=finish(choose(until(play(s,id),'wish'),{kind:'public',cardInstanceId:mother}));expect(s.players.A!.hand).toContain(mother);expect(s.players.B!.attachments).not.toContain(mother);expect(s.players.B!).toMatchObject({faction:changed.faction,objective:changed.objective,currentObjective:changed.currentObjective,protection:changed.protection});
});
it.each(wishes)('%s theft leaves the independent spirit growth from an actual successful Keil protection',id=>{
 let s=ready();character(s,'A','魔導王ガイナス');character(s,'B','聖騎士ランスロット');s.players.B!.revealed=true;character(s,'C','忍びのイダ');take(s,'C',id);const keil=take(s,'B','a2-p01-r3c1'),crystal=take(s,'B','a2-p03-r1c3'),attack=handCard(s,'A','踏み込み／弓');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});for(let n=0;n<20&&!viewFor(s,'B').anytimeCardOptions.some(o=>o.cardInstanceId===keil);n++)s=pass(s);const o=viewFor(s,'B').anytimeCardOptions.find(o=>o.cardInstanceId===keil)!;s=finish(act(s,'B',{type:'PLAY_ANYTIME_CARD',cardInstanceId:keil,targetEventId:o.targetEventId,targetId:'B'}));expect(s.players.B!.permanent!.spirit).toBe(1);const spirit=gameStats(s,'B').spirit;
 s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(gameStats(s,'A').handLimit)});s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});s=finish(act(s,'B',{type:'PLAY_TURN_CARD',cardInstanceId:crystal}));s=act(s,'B',{type:'END_TURN',discardIds:s.players.B!.hand.slice(gameStats(s,'B').handLimit)});s=act(s,'C',{type:'START_TURN'});s=act(s,'C',{type:'CHOOSE_DRAW',draw:false});
 s=until(act(s,'C',{type:'PLAY_TURN_CARD',cardInstanceId:id,mode:'wish'}),'wish');const d=viewFor(s,'C').wish!;s=finish(act(s,'C',{type:'CHOOSE_WISH',decisionId:d.decisionId,source:{kind:'public',cardInstanceId:crystal}}));expect(s.players.C!.hand).toContain(crystal);expect(s.players.B!.attachments).not.toContain(crystal);expect(s.players.B!.permanent!.spirit).toBe(1);expect(gameStats(s,'B').spirit).toBe(spirit);
});
it.each(wishes)('%s first publishes a deck Dawn and returns otherworld owners once while its source stays paid',id=>{
 let s=start(id);const dawn=take(s,'D','a2-p01-r1c2');s.players.D!.hand=s.players.D!.hand.filter(x=>x!==dawn);s.deck.unshift(dawn);s.players.B!.presence='otherworld';s=until(play(s,id),'wish');
 s=choose(s,{kind:'deck',cardName:getAction(dawn)!.name});expect(s.players.B!.presence).toBe('active');expect(s.players.A!.open).toContain(dawn);expect(s.deck).not.toContain(id);expect(s.resolution).toContain(id);expect(s.discard).toEqual([]);
 s=finish(s);expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId===dawn)).toHaveLength(1);expect(s.events.filter(e=>e.type==='PLAYER_RETURNED'&&e.actorId==='B')).toHaveLength(1);expect(s.discard).toContain(id);
});
