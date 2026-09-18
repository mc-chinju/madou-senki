import {getAction,getCharacter} from '@madou/catalog';
import {allCardInstanceIds,createGame,gameStats,transition,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const deathGiftPhysicalScenarios=['death-gift-evil','death-gift-good','death-gift-evil-fate','death-gift-good-fate','death-gift-evil-decline','death-gift-good-decline','death-gift-evil-batch','death-gift-good-batch','death-gift-evil-protection','death-gift-good-protection','death-gift-good-ability-first','death-gift-good-printed-first','death-gift-evil-ability-first','death-gift-evil-printed-first','death-gift-good-converted'] as const;
export type DeathGiftPhysicalScenario=typeof deathGiftPhysicalScenarios[number];
export function isDeathGiftPhysicalScenario(name:string):name is DeathGiftPhysicalScenario{return (deathGiftPhysicalScenarios as readonly string[]).includes(name);}
export function deathGiftMode(name:DeathGiftPhysicalScenario){const evil=name.includes('-evil'),batch=name.endsWith('-batch'),protection=name.endsWith('-protection');return {evil,batch,protection,converted:evil&&name.endsWith('-first')||name.endsWith('-converted'),fate:name.endsWith('-fate'),decline:name.endsWith('-decline'),ability:name.endsWith('-first'),abilityFirst:name.endsWith('-ability-first'),card:evil?'a2-p02-r3c2':'a2-p02-r3c3',wrong:evil?'a2-p02-r3c3':'a2-p02-r3c2',gift:'a2-p03-r1c1',second:'a2-p24-r1c3',attack:batch?'a2-p10-r2c1':'a2-p24-r1c2'};}
/** Only initial deal/characters/training are arranged. Actual setup, CHANT/full turns,
 * attack and damage settlement produce the death window and its complete batch. */
export function makeDeathGiftPhysicalScenario(name:DeathGiftPhysicalScenario,players:{id:string;name:string}[],beforeAttack=false){
 const m=deathGiftMode(name);let s=createGame(players,entropy(),{startingSeat:m.converted?3:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 const names=['侍大将のシン',m.converted?m.evil?'小妖精のチャム':'黒騎士ガーウィン':m.evil?'魔導王ガイナス':m.protection?getCharacter('c2-p03-r1c2')!.name:'小妖精のチャム',m.protection?m.evil?'黒騎士ガーウィン':'大神官ジル':'大神官ジル',getCharacter('c2-p06-r1c2')!.name];
 if(m.converted&&!m.evil){names[0]=getCharacter('c2-p06-r1c2')!.name;names[3]='占星術師のアルセイル';}
 // Shin is the GOOD protection dependent; use Jill as attacker in that case.
 if(m.protection&&!m.evil){names[0]='大神官ジル';names[2]='侍大将のシン';}
 for(const [i,p] of players.entries())assignCharacter(s,p.id,names[i]!);
 for(const p of Object.values(s.players))p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};
 for(const id of m.batch?[b,c]:[b])s.players[id]!.permanent!.endurance!+=(m.batch?15:4)-gameStats(s,id).endurance;
 if(m.converted)s.players[b]!.permanent!.spirit!-=gameStats(s,b).spirit;
 const keep=[takeCard(s,a,m.attack),takeCard(s,b,m.card),takeCard(s,b,m.wrong),takeCard(s,b,m.gift),takeCard(s,b,m.second),takeCard(s,d,'a2-p02-r2c3')];if(m.converted)keep.push(takeCard(s,d,m.evil?'a2-p04-r1c2':'a2-p04-r1c1'));for(const p of players)trimHand(s,p.id,...keep);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];s.events=[];
 function act(actorId:string,command:GameCommand){const input={actorId,command},e=entropy(),r=transition(s,input,e);if(!r.ok)throw Error(`DEATH_GIFT_FIXTURE_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('DEATH_GIFT_FIXTURE_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('DEATH_GIFT_FIXTURE_CARDS');}
 function settle(){for(let n=0;n<300;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('DEATH_GIFT_FIXTURE_WINDOW');}
 function start(id:string){act(id,{type:'START_TURN'});settle();act(id,{type:'CHOOSE_DRAW',draw:false});settle();}
 function end(id:string){if(s.phase==='action')act(id,{type:'PASS_ACTION'});if(s.phase==='withdrawal')act(id,{type:'PASS_WITHDRAWAL'});act(id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(x=>!keep.includes(x)).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});settle();}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));if(m.converted){start(d);act(b,{type:'REVEAL_CHARACTER'});settle();act(d,{type:'PLAY_TURN_CARD',cardInstanceId:m.evil?'a2-p04-r1c2':'a2-p04-r1c1',targetId:b});settle();if(s.players[b]!.faction!==(m.evil?'EVIL':'GOOD'))throw Error('DEATH_GIFT_CONVERSION');end(d);}start(a);
 if(m.batch){act(a,{type:'CHANT',cardInstanceId:m.attack});end(a);for(const id of [b,c,d]){start(id);end(id);}start(a);}
 if(beforeAttack)return s;
 act(a,{type:'ATTACK',cardInstanceId:m.attack,targetIds:m.batch?[b,c]:[b],dedicated:m.batch});
 for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(w?.kind==='death-gift'&&w.participants[w.cursor]===b)return s;if(!w)throw Error('DEATH_GIFT_FIXTURE_NO_DEATH');act(w.participants[w.cursor]!,{type:'PASS'});}throw Error('DEATH_GIFT_FIXTURE_LIMIT');
}
