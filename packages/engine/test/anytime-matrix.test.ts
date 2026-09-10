import {expect,it} from 'vitest';
import {getAction} from '@madou/catalog';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
const TRAGEDY='a2-p01-r2c3',KEIL='a2-p01-r3c1',AMULET='a2-p01-r3c2',COURAGE='a2-p01-r3c3',PEACE='a2-p02-r1c1',REVELATION='a2-p02-r1c2',SUBSTITUTE='a2-p02-r2c1',HOSTAGE='a2-p02-r2c2';
const cards=[TRAGEDY,KEIL,AMULET,COURAGE,PEACE,REVELATION,SUBSTITUTE,HOSTAGE];
function priority(s:GameState,actorId:string){for(let n=0;n<100;n++){const w=s.windows!.at(-1)!;if(w.participants[w.cursor]===actorId)return s;s=pass(s);}throw Error('NO_PRIORITY');}
function opportunity(id:string){
 let s=ready();character(s,'A',id===TRAGEDY||id===KEIL?'魔導王ガイナス':'侍大将のシン');character(s,'B',id===KEIL?'聖騎士ランスロット':id===AMULET||id===COURAGE?'魔聖母ディア':'黒騎士ガーウィン');character(s,'C',id===HOSTAGE?'黒騎士ガーウィン':'大神官ジル');character(s,'D','忍びのイダ');
 s.players.A!.revealed=true;s.players.B!.revealed=id===KEIL;for(const p of Object.values(s.players))p.permanent={endurance:100};handCard(s,'C',getAction(id)!.name);const attack=handCard(s,'A','踏み込み／弓');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,id===AMULET||id===COURAGE?'normal-defense':'attack-abilities');
 if(id===AMULET||id===COURAGE){const o=viewFor(s,'B').abilityOptions.find(o=>o.abilityId==='c2-p06-r1c2-ab01')!;s=act(s,'B',{type:'USE_ABILITY',abilityId:o.abilityId,targetEventId:o.targetEventId});}
 s=priority(s,'C');const o=viewFor(s,'C').anytimeCardOptions.find(o=>o.cardInstanceId===id&&(!o.targetId||o.targetId==='B'))!;expect(o).toBeDefined();
 const command={type:'PLAY_ANYTIME_CARD' as const,cardInstanceId:id,targetEventId:o.targetEventId,...(o.targetId?{targetId:o.targetId}:{}),...(o.groupId?{groupId:o.groupId}:{}),...(o.hitIndex!==undefined?{hitIndex:o.hitIndex}:{})};return {s,command};
}
it.each(cards)('declining physical %s leaves it unspent and performs no replacement draw',id=>{
 let {s}=opportunity(id);const before=s.players.C!.hand.length,draws=s.events.filter(e=>e.actorId==='C'&&e.type==='CARD_DRAWN').length;s=finish(s);expect(s.players.C!.hand).toContain(id);expect(s.players.C!.hand).toHaveLength(before);expect(s.events.filter(e=>e.actorId==='C'&&e.type==='CARD_DRAWN')).toHaveLength(draws);expect(s.players.B!.permanent?.spirit??0).toBe(0);expect(viewFor(s,'C').inspectionHistory).toEqual([]);
});
it.each(cards)('Fate cancels physical %s after its actual Dawn OPEN and refill, then resumes the identical saved parent once',id=>{
 let {s,command}=opportunity(id);const parent=s.windows!.at(-1)!.id,hand=s.players.C!.hand.length,spirit=gameStats(s,'B').spirit;
 const fate=handCard(s,'D','命運凶変'),dawn=handCard(s,'D',getAction('a2-p01-r1c2')!.name);s.players.D!.hand=s.players.D!.hand.filter(x=>x!==dawn);s.deck.unshift(dawn);s.players.D!.presence='otherworld';
 s=act(s,'C',command);const child=Object.values(s.actions!).find(a=>a.cardInstanceId===id)!;expect(child).toBeDefined();expect(s.players.C!.hand).toHaveLength(hand);expect(s.players.C!.open).toContain(dawn);expect(s.players.D!.presence).toBe('active');
 s=priority(s,'D');s=act(s,'D',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:child.id});
 for(let n=0;n<150&&s.actions?.[child.id];n++)s=pass(s);expect(s.actions?.[child.id]).toBeUndefined();expect(s.windows!.at(-1)!.id).toBe(parent);expect(s.discard).toContain(id);expect(s.players.C!.hand).toHaveLength(hand);
 expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId===dawn)).toHaveLength(1);expect(s.events.filter(e=>e.type==='PLAYER_RETURNED'&&e.actorId==='D')).toHaveLength(1);expect(s.players.B!.permanent?.spirit??0).toBe(0);expect(gameStats(s,'B').spirit).toBe(spirit);expect(s.inspections??[]).toHaveLength(0);expect(Object.values(s.groups??{}).some(g=>g.substituteOrigin)).toBe(false);
 if(id===AMULET||id===COURAGE)expect(s.abilities![command.targetEventId]!.canceled).toBe(false);else if(id===TRAGEDY||id===KEIL||id===HOSTAGE||id===SUBSTITUTE){const g=Object.values(s.groups!)[0]!;expect(g.targets[0]!.hits[0]!.defended).toBe(false);}
 s=finish(s);expect(s.players.C!.open).toContain(dawn);expect(s.events.filter(e=>e.type==='OPEN'&&e.cardInstanceId===dawn)).toHaveLength(1);
});
it.each(cards)('foreign physical %s is rejected with a valid offered event and correct priority',id=>{
 const {s,command}=opportunity(id);s.players.C!.hand=s.players.C!.hand.filter(x=>x!==id);s.players.D!.hand.push(id);const before=JSON.stringify(s);expect(transition(s,{actorId:'C',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
});
it.each([TRAGEDY,KEIL,HOSTAGE])('resolved physical attack event rejects %s without cost',id=>{
 let {s,command}=opportunity(id);s=finish(s);const before=JSON.stringify(s);expect(transition(s,{actorId:'C',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.players.C!.hand).toContain(id);
});
it.each([[TRAGEDY,'hidden-source'],[KEIL,'hidden-target'],[HOSTAGE,'wrong-user'],[HOSTAGE,'wrong-attacker'],[COURAGE,'wrong-user'],[PEACE,'wrong-user']] as const)('%s rejects %s with its actual card in hand and otherwise valid current event',(id,change)=>{
 const {s,command}=opportunity(id);if(change==='hidden-source')s.players.A!.revealed=false;else if(change==='hidden-target')s.players.B!.revealed=false;else if(change==='wrong-attacker')character(s,'A','魔導王ガイナス');else character(s,'C',id===HOSTAGE?'大神官ジル':'黒騎士ガーウィン');
 const before=JSON.stringify(s);expect(transition(s,{actorId:'C',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.players.C!.hand).toContain(id);
});

it('a concealed Cham card-specific candidate changes no third-party view during actual Hostage declaration',()=>{
 const base=opportunity(HOSTAGE),alternate=structuredClone(base.s);character(alternate,'B','小妖精のチャム');alternate.players.B!.revealed=false;
 const ordinary=act(base.s,'C',base.command),cham=act(alternate,'C',base.command);
 for(const observer of ['A','C','D'])expect(viewFor(cham,observer)).toEqual(viewFor(ordinary,observer));
 expect(viewFor(cham,'B').abilityOptions.some(o=>o.name==='人質を中止する')).toBe(false);
});
