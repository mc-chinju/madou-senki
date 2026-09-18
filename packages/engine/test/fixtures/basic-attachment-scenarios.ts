import {allCardInstanceIds,createGame,transition,type GameCommand,type GameState} from '@madou/engine';
import {getAction} from '@madou/catalog';
import {assignCharacter,entropy,takeCard,trimHand,readySetup} from './scenario-tools.js';
export const basicAttachmentScenarios=['basic-attachment-warrior','basic-attachment-magic','basic-attachment-evil','basic-attachment-good'] as const;
export type BasicAttachmentScenario=typeof basicAttachmentScenarios[number];
export function isBasicAttachmentScenario(name:string):name is BasicAttachmentScenario{return basicAttachmentScenarios.some(n=>n===name);}
export function makeBasicAttachmentScenario(name:BasicAttachmentScenario,players:{id:string;name:string}[],forbidden=false):GameState{
 let s=createGame(players,entropy(),{startingSeat:0});const [a,b,c,d]=players.map(p=>p.id) as [string,string,string,string];
 const evil=(name==='basic-attachment-evil')!==forbidden;
 assignCharacter(s,a,evil?'黒騎士ガーウィン':'侍大将のシン');assignCharacter(s,b,'占星術師のアルセイル');assignCharacter(s,c,'大神官ジル');assignCharacter(s,d,'魔導王ガイナス');
 for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20};
 const cards:Record<BasicAttachmentScenario,string>={'basic-attachment-warrior':'a2-p03-r2c1','basic-attachment-magic':'a2-p03-r3c1','basic-attachment-evil':'a2-p03-r3c2','basic-attachment-good':'a2-p03-r3c3'};
 const card=takeCard(s,a,cards[name]),fate=takeCard(s,b,'命運凶変'),wish=takeCard(s,b,'a2-p04-r3c2');trimHand(s,a,card);trimHand(s,b,fate,wish);
 s.deck=[...s.deck.filter(id=>getAction(id)!.category!=='open'),...s.deck.filter(id=>getAction(id)!.category==='open')];
 function act(actorId:string,command:GameCommand){const input={actorId,command},r=transition(s,input,entropy());if(!r.ok)throw Error(`BASIC_ATTACHMENT_${r.code}`);if(JSON.stringify(r)!==JSON.stringify(transition(JSON.parse(JSON.stringify(s)),input,entropy())))throw Error('BASIC_ATTACHMENT_REPLAY');s=r.state;const ids=allCardInstanceIds(s);if(ids.length!==220||new Set(ids).size!==220)throw Error('BASIC_ATTACHMENT_CARDS');}
 readySetup(()=>s,id=>act(id,{type:'PASS_SETUP'}));act(a,{type:'START_TURN'});act(a,{type:'CHOOSE_DRAW',draw:false});return s;
}
