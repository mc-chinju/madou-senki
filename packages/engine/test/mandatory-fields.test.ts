import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats,viewFor,transition,type GameState} from '../src/index.js';
import {act,ready,until,finish,pass,closeWindow,passReclaims} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';
const GOOD='a2-p04-r1c1',PEACE='a2-p02-r1c1',BAN='c2-p07-r1c2-ab03';
function priority(s:GameState,actorId:string){for(let n=0;n<60;n++){const w=s.windows!.at(-1)!;if(w.participants[w.cursor]===actorId)return s;s=pass(s);}throw Error('MANDATORY_PRIORITY');}
function ban(s:GameState,targetId:string){s=priority(s,'C');const o=viewFor(s,'C').abilityOptions.find(o=>o.abilityId===BAN)!;expect(o).toBeDefined();return closeWindow(act(s,'C',{type:'USE_ABILITY',abilityId:BAN,targetEventId:o.targetEventId,targetIds:[targetId]}));}
it.each([['手裏剣',2,false],['妖獣',5,false],['手裏剣',2,true],['妖獣',5,true]] as const)('Actual Cham %s yields %i under real suppression=%s',(name,damage,suppressed)=>{
 let s=ready();character(s,'A','小妖精のチャム');character(s,'C','破壊神ヴァンミール');s.players.C!.revealed=true;for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};const card=handCard(s,'A',name);s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});if(suppressed)s=ban(s,'A');s=until(s,'attack-abilities');expect(Object.values(s.groups!)[0]!.technique.damage).toBe(damage);expect(finish(s).players.B!.damage).toBe(damage);
});
const REVIVE='a2-p13-r3c1',EVIL='a2-p04-r1c2';
function nextOwn(s:GameState,owner='A'){
 for(let n=0;n<32;n++){
  const actor=s.seatOrder[s.turnSeat]!;
  if(s.phase==='action'){if(actor===owner)return s;s=act(s,actor,{type:'PASS_ACTION'});}
  else if(s.phase==='withdrawal')s=act(s,actor,{type:'PASS_WITHDRAWAL'});
  else if(s.phase==='hand-adjustment')s=finish(act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.filter(id=>![REVIVE,GOOD,EVIL].includes(id)).slice(0,Math.max(0,s.players[actor]!.hand.length-gameStats(s,actor).handLimit))}));
  else if(s.phase==='turn-start')s=act(s,actor,{type:'START_TURN'});
  else if(s.phase==='draw')s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});
  else throw Error(`MANDATORY_TURN_${s.phase}`);
 }throw Error('MANDATORY_TURN_LIMIT');
}
function realRevival(name:string){
 let s=ready();character(s,'A','邪祭ウーノス');character(s,'B',name);character(s,'C','白魔術師シェリム');character(s,'D','侍大将のシン');s.players.B!.revealed=true;
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20};s.players.B!.permanent={};s.players.B!.damage=gameStats(s,'B').endurance-1;
 const lethal=handCard(s,'A','黒翼飛翔剣');for(const id of [REVIVE,GOOD,EVIL])handCard(s,'A',getAction(id)!.name);
 const rewards=['手裏剣','妖獣','踏み込み／弓','間合い／休息','狂王陣'].map(name=>handCard(s,'D',name));
 for(const p of Object.values(s.players)){p.hand=p.hand.filter(id=>!rewards.includes(id));while(p.hand.length>5){const at=p.hand.findIndex(id=>![REVIVE,GOOD,EVIL,lethal].includes(id));s.deck.push(p.hand.splice(at,1)[0]!);}while(p.hand.length<5){const at=s.deck.findIndex(id=>getAction(id)!.category!=='open');p.hand.push(s.deck.splice(at,1)[0]!);}}
 // Initial draw order only: one refill per preceding own action, then the real revival hand.
 const convertFirst=['竜皇子アスフェルト','黒騎士ガーウィン'].includes(name),prefix=s.deck.filter(id=>getAction(id)!.category!=='open').slice(0,convertFirst?2:1);s.deck=s.deck.filter(id=>!prefix.includes(id));s.deck=[...prefix,...rewards,...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 if(convertFirst){s=until(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:GOOD,targetId:'B'}),'before-roll');s=closeWindow(s,[6,6]);s=finish(s);expect(s.players.B!.faction).toBe('GOOD');s=nextOwn(s);}
 const life=s.players.B!.lifeId;s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:lethal,targetIds:['B'],dedicated:false}));expect(s.players.B!.presence).toBe('dead');expect(s.events.filter(e=>e.type==='PLAYER_DIED'&&e.actorId==='B')).toHaveLength(1);s=nextOwn(s);
 const rolls=s.rolls?.length??0;s=until(act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:REVIVE,targetIds:['B'],dedicated:true,...(name==='妖精王フューリー'?{}:{convertTargetIds:['B']})}),'re-setup');expect(s.rolls?.length??0).toBe(rolls);expect(s.players.B!.lifeId).not.toBe(life);expect(s.players.B!).toMatchObject({presence:'active',damage:0,faction:name==='妖精王フューリー'?'GOOD':'EVIL'});expect(s.players.B!.hand).toEqual(rewards);return finish(act(s,'B',{type:'PASS_SETUP'}));
}
it.each(['竜皇子アスフェルト','黒騎士ガーウィン'])('%s real death and no-check converting resurrection retain mandatory resistance',name=>{
 let s=realRevival(name);s=nextOwn(s);const spirit=gameStats(s,'B').spirit;s=until(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:EVIL,targetId:'B'}),'before-roll');s=closeWindow(s,[3,3]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'faction-change',threshold:spirit,modifier:-2});
});
it('Cham real death and no-check resurrection retain warrior half and magic damage',()=>{
 const revived=nextOwn(realRevival('小妖精のチャム'),'B');for(const [name,damage] of [['手裏剣',2],['妖獣',5]] as const){const card=revived.players.B!.hand.find(id=>getAction(id)!.name===name)!;const result=finish(act(revived,'B',{type:'ATTACK',cardInstanceId:card,targetIds:['C'],dedicated:false}));expect(result.players.C!.damage).toBe(damage);}
});
it('Fury real death and no-check resurrection retain black prohibition',()=>{
 const s=nextOwn(realRevival('妖精王フューリー'),'B'),before=JSON.stringify(s),command={type:'ATTACK',cardInstanceId:'a2-p16-r2c1',targetIds:['C'],dedicated:false} as const;expect(transition(s,{actorId:'B',command:{...command,targetIds:[...command.targetIds]}},entropy())).toEqual({ok:false,code:'UNSUPPORTED_CARD'});expect(JSON.stringify(s)).toBe(before);
});
function conversion(name:string){const s=ready();character(s,'B',name);s.players.B!.revealed=true;character(s,'C','破壊神ヴァンミール');s.players.C!.revealed=true;handCard(s,'A',getAction(GOOD)!.name);handCard(s,'D',getAction(PEACE)!.name);handCard(s,'D','神性介入');return s;}
it.each(['竜皇子アスフェルト','黒騎士ガーウィン'])('%s mandatory conversion resistance survives actual Vanmil suppression',name=>{
 let s=conversion(name);const spirit=gameStats(s,'B').spirit;s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:GOOD,targetId:'B'});s=ban(s,'B');s=until(s,'before-roll');s=closeWindow(s,[3,3]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'faction-change',rollerId:'B',modifier:-1,threshold:spirit+1});
});
it.each(['竜皇子アスフェルト','黒騎士ガーウィン'])('%s frozen conversion threshold survives real Peace and God reroll',name=>{
 let s=conversion(name);const spirit=gameStats(s,'B').spirit;s=until(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:GOOD,targetId:'B'}),'before-roll');s=closeWindow(s,[3,3]);const id=s.rolls!.at(-1)!.id;expect(s.rolls!.at(-1)!.threshold).toBe(spirit+1);s=priority(s,'D');const o=viewFor(s,'D').anytimeCardOptions.find(o=>o.cardInstanceId===PEACE&&o.targetId==='B')!;s=act(s,'D',{type:'PLAY_ANYTIME_CARD',cardInstanceId:PEACE,targetId:'B',targetEventId:o.targetEventId});s=passReclaims(closeWindow(s));expect(gameStats(s,'B').spirit).toBe(12);expect(s.rolls!.find(r=>r.id===id)!.threshold).toBe(spirit+1);
 s=priority(s,'D');s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:'a2-p02-r1c3',mode:'reroll',targetRollId:id});s=passReclaims(closeWindow(s,[6,6]));expect(s.rolls!.find(r=>r.id===id)).toMatchObject({threshold:spirit+1,faces:[6,6],success:false});expect(s.rolls!.find(r=>r.id===id)!.attempts).toHaveLength(2);s=finish(s);expect(s.players.B!.faction).toBe('GOOD');
});
it.each(['竜皇子アスフェルト','黒騎士ガーウィン'])('%s ordinary mental defense has no conversion bonus and conceals base and allegiance',name=>{
 let s=ready();character(s,'A',name);character(s,'B','吟遊詩人のレスター');s.players.B!.revealed=true;s.players.C!.permanent={endurance:100};const spirit=gameStats(s,'A').spirit,card=handCard(s,'A','妖獣');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'normal-defense');const abilityId='c2-p03-r2c1-ab01',o=viewFor(s,'B').abilityOptions.find(o=>o.abilityId===abilityId)!;expect(o).toBeDefined();s=closeWindow(act(s,'B',{type:'USE_ABILITY',abilityId,targetEventId:o.targetEventId}));s=closeWindow(s,[1,2]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'ability-check',rollerId:'A',threshold:spirit-1});expect(viewFor(s,'A').currentRoll!.threshold).toBe(spirit-1);
 for(const id of ['B','C','D']){const v=viewFor(s,id);expect(v.currentRoll).not.toHaveProperty('threshold');expect(v.currentRoll!.success).toBe(s.rolls!.at(-1)!.success);expect(v.players.A).not.toHaveProperty('characterId');expect(v.players.A).not.toHaveProperty('faction');expect(v.players.A).not.toHaveProperty('stats');expect(v.players.A).not.toHaveProperty('currentObjective');}
});
