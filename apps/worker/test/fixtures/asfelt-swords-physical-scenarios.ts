import {getAction} from '@madou/catalog';
import {createGame,gameStats,transition,allCardInstanceIds,type GameCommand} from '@madou/engine';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const asfeltSwordCards={wind:'a2-p08-r1c3',thunder:'a2-p08-r2c1',rend:'a2-p08-r2c2'} as const;
export type AsfeltSword=keyof typeof asfeltSwordCards;
export type AsfeltSwordMode='ordinary'|'guard'|'owner-ordinary'|'low'|'dedicated'|'all'|'subset'|'near'|'high'|'fate'|'maai'|'evade'|'suppressed'|'stopped'|'silenced'|'wrong-owner'|'decline';
export type AsfeltSwordsScenario=`asfelt-${AsfeltSword}-${AsfeltSwordMode}`;
export const asfeltSwordsScenarios=(Object.keys(asfeltSwordCards) as AsfeltSword[]).flatMap(card=>(['ordinary','guard','dedicated','all','fate','maai','evade','wrong-owner'] as const).map(mode=>`asfelt-${card}-${mode}` as AsfeltSwordsScenario));
export function isAsfeltSwordsScenario(name:string):name is AsfeltSwordsScenario{return asfeltSwordsScenarios.includes(name as AsfeltSwordsScenario);}
export function asfeltSwordMode(card:AsfeltSword,mode:AsfeltSwordMode){const dedicated=!['ordinary','guard','owner-ordinary','low','decline'].includes(mode),owner=dedicated&&mode!=='wrong-owner'||mode==='owner-ordinary';return {card:asfeltSwordCards[card],level:card==='wind'?4:card==='thunder'?5:6,damage:card==='wind'?6:card==='thunder'?7:8,dedicated,owner,guard:mode==='guard'||mode==='owner-ordinary'||dedicated,maai:card==='thunder'?1:2,hpIgnore:card!=='thunder',evadeProhibited:card!=='wind'};}
export function makeAsfeltSwordsPhysical(card:AsfeltSword,mode:AsfeltSwordMode,players:{id:string;name:string}[],options:{beforeStart?:boolean;warrior?:number;spirit?:number;blessedWater?:boolean}={}){
 const m=asfeltSwordMode(card,mode),prior=['suppressed','stopped','silenced'].includes(mode);let s=createGame(players,entropy(),{startingSeat:prior?3:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 for(const [i,p] of players.entries())assignCharacter(s,p.id,[m.owner?'竜皇子アスフェルト':'侍大将のシン',m.owner?'侍大将のシン':'黒騎士ガーウィン','忍びのイダ','魔導王ガイナス'][i]!);
 for(const p of Object.values(s.players)){p.permanent={endurance:100,warrior_level:20,magic_level:20,spirit:20};p.permanent.spirit!+=(p.id===a?(options.spirit??6):6)-gameStats(s,p.id).spirit;}
 s.players[a]!.permanent!.warrior_level!+=(options.warrior??(mode==='low'?m.level-1:m.dedicated?0:m.level))-gameStats(s,a).warrior_level;
 const guards=m.guard?{[b]:mode==='high'?'a2-p23-r1c1':'a2-p19-r1c3',[c]:mode==='high'?'a2-p19-r1c3':'a2-p23-r1c1',[d]:'a2-p22-r1c1'}:{};
 const keep=[takeCard(s,a,m.card),takeCard(s,d,'a2-p02-r2c3')];for(const [id,guard] of Object.entries(guards))keep.push(takeCard(s,id,guard));
 if(mode==='near')keep.push(takeCard(s,a,'a2-p24-r1c3'));if(mode==='maai')keep.push(takeCard(s,b,'a2-p06-r1c3'),takeCard(s,b,'a2-p07-r1c1'));if(mode==='evade')keep.push(takeCard(s,b,'a2-p05-r3c1'));if(prior)keep.push(takeCard(s,d,mode==='suppressed'?'a2-p13-r1c2':mode==='stopped'?'a2-p13-r2c1':'a2-p18-r1c1'));
 const blessing=options.blessedWater?takeCard(s,c,'a2-p01-r2c1'):null;if(blessing)s.players[c]!.hand=s.players[c]!.hand.filter(id=>id!==blessing);
 for(const p of players)trimHand(s,p.id,...keep);s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];if(blessing)s.deck.push(blessing);s.events=[];
 function act(actorId:string,command:GameCommand,face=1){const input={actorId,command},e={...entropy(),dice:Array(100).fill(face)},r=transition(s,input,e);if(!r.ok)throw Error(`ASFELT_SWORDS_${command.type}_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,e)))throw Error('ASFELT_SWORDS_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('ASFELT_SWORDS_CARDS');}
 function settle(face=1){for(let n=0;n<500;n++){const w=s.windows?.at(-1);if(!w)return;act(w.participants[w.cursor]!,{type:'PASS'},face);}throw Error('ASFELT_SWORDS_LIMIT');}
 // The round-end refill draws in seat order, so the blessing waits behind the seats that refill before C (G10).
 if(blessing){const rest=s.deck.filter(x=>x!==blessing),ahead=[a,b].filter(id=>guards[id]).length;s.deck=[...rest.slice(0,ahead),blessing,...rest.slice(ahead)];}
 for(const id of [a,b,c,d]){if(guards[id])act(id,{type:'PLACE_INITIAL_FOLLOWER',cardInstanceId:guards[id]!});act(id,{type:'PASS_SETUP'});}readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));if(options.beforeStart)return s;
 if(prior){act(d,{type:'START_TURN'});settle();act(d,{type:'CHOOSE_DRAW',draw:false});act(d,{type:'ATTACK',cardInstanceId:mode==='suppressed'?'a2-p13-r1c2':mode==='stopped'?'a2-p13-r2c1':'a2-p18-r1c1',targetIds:[a],dedicated:false});settle(6);if(s.phase==='withdrawal')act(d,{type:'PASS_WITHDRAWAL'});act(d,{type:'END_TURN',discardIds:[]});settle();}
 act(a,{type:'START_TURN'});settle(prior?6:1);if(s.phase==='draw')act(a,{type:'CHOOSE_DRAW',draw:false});if(mode==='subset'){act(c,{type:'REVEAL_CHARACTER'});settle();}if(mode==='near'){act(a,{type:'APPROACH',cardInstanceId:'a2-p24-r1c3',targetId:b});settle();}return s;
}
export function makeAsfeltSwordsScenario(name:AsfeltSwordsScenario,players:{id:string;name:string}[]){const [,card,...mode]=name.split('-');return makeAsfeltSwordsPhysical(card as AsfeltSword,mode.join('-') as AsfeltSwordMode,players);}
