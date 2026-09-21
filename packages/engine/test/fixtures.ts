import { readFileSync } from 'node:fs';
import { actionCards, characters } from '@madou/catalog';
import { createGame, transition, initialProtection, factionObjective, type Entropy, discardIds } from '../src/index.js';
export const entropy = () => ({ now: 1000, dice: [] as number[], random: Array.from({length: 2000}, (_, i) => ((i * 193 + 17) % 997) / 997) });
/** Deterministic mulberry32 tape. Dice faces are 1–6; random is in [0, 1). */
export function seededEntropy(seed: number): Entropy {
  let t = seed >>> 0;
  const next = () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const random: number[] = [];
  const dice: number[] = [];
  for (let i = 0; i < 8192; i++) {
    random.push(next());
    dice.push(1 + Math.floor(next() * 6));
  }
  return { now: 1000, dice, random };
}
export function freshGame() {
  return createGame(['A', 'B', 'C', 'D'].map(id => ({ id, name: id })), entropy(), { startingSeat: 0 });
}
export function loadFixture(name: 'basic-four-player'|'follower-defense-started'|'third-party-interrupt'|'multi-target-multi-hit') {
  const data=JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url),'utf8'));
  if(name==='basic-four-player')return data as ReturnType<typeof createGame>;
  let s=freshGame(); const apply=(actorId:string,command:unknown,dice:number[]=Array(40).fill(1))=>{const r=transition(s,{actorId,command} as any,{...entropy(),dice});if(!r.ok)throw Error(`${name}:${r.code}`);s=r.state;};
  for(const id of s.seatOrder)apply(id,{type:'PASS_SETUP'});apply('A',{type:'START_TURN'});apply('A',{type:'CHOOSE_DRAW',draw:false});character(s,'A','侍大将のシン');character(s,'B','黒騎士ガーウィン');
  const attack=handCard(s,'A',data.attack);
  if(name==='multi-target-multi-hit'){
    const follower=handCard(s,'B',data.follower);s.players.B!.hand=s.players.B!.hand.filter(id=>id!==follower);s.players.B!.followers=[{cardInstanceId:follower,revealed:false}];
    s.players.A!.hand=s.players.A!.hand.filter(id=>id!==attack);s.players.A!.chants=[{cardInstanceId:attack,revealed:false}];apply('A',{type:'ATTACK',cardInstanceId:attack,targetIds:data.targets,dedicated:true},[data.hits]);
    while(!Object.keys(s.groups??{}).length){const w=s.windows!.at(-1)!;apply(w.participants[w.cursor]!,{type:'PASS'},w.kind==='damage'?[data.hits]:Array(40).fill(1));}return s;
  }
  if(name==='follower-defense-started'){
    const defense=handCard(s,'B',data.defense);const follower=handCard(s,'B',data.follower);s.players.B!.hand=s.players.B!.hand.filter(id=>id!==follower);s.players.B!.followers=[{cardInstanceId:follower,revealed:false}];
    apply('A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});while(s.windows?.at(-1)?.kind!=='normal-defense'){const w=s.windows!.at(-1)!;apply(w.participants[w.cursor]!,{type:'PASS'});}apply('B',{type:'START_FOLLOWERS'});while(s.windows?.at(-1)?.kind!=='follower-start'){const w=s.windows!.at(-1)!;apply(w.participants[w.cursor]!,{type:'PASS'});}if(!s.players.B!.hand.includes(defense))throw Error('fixture defense missing');return s;
  }
  const interrupt=handCard(s,'C',data.interrupt);while(s.players.C!.hand.length>5){const index=s.players.C!.hand.findIndex(id=>id!==interrupt);s.deck.push(s.players.C!.hand.splice(index,1)[0]!);}
  apply('A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});apply('A',{type:'PASS'});apply('B',{type:'PASS'});return s;
}
/** Test-only zone move: preserve every physical card while arranging a scenario. */
export function handCard(s: ReturnType<typeof createGame>, owner: string, name: string) {
  const id = actionCards.find(c => c.name === name)!.id;
  s.deck = s.deck.filter((x: string) => x !== id); s.discard = s.discard.filter(entry => entry.cardInstanceId !== id);
  for (const p of Object.values(s.players) as any[]) {
    p.hand = p.hand.filter((x: string) => x !== id); p.open = p.open.filter((x: string) => x !== id);
  }
  s.players[owner]!.hand.push(id); return id;
}
export function handCards(s:ReturnType<typeof createGame>,owners:string[],name:string){
  const ids=actionCards.filter(c=>c.name===name).slice(0,owners.length).map(c=>c.id);if(ids.length!==owners.length)throw Error(`NOT_ENOUGH_COPIES:${name}`);
  ids.forEach((id,index)=>{s.deck=s.deck.filter(x=>x!==id);s.discard = s.discard.filter(entry => entry.cardInstanceId !== id);for(const p of Object.values(s.players)){p.hand=p.hand.filter(x=>x!==id);p.open=p.open.filter(x=>x!==id);}s.players[owners[index]!]!.hand.push(id);});return ids;
}
export function character(s: ReturnType<typeof createGame>, owner: string, name: string) {
  const c = characters.find(c => c.name === name)!;
  s.players[owner]!.characterId = c.id; s.players[owner]!.faction = c.initial_faction; s.players[owner]!.objective = c.objective;s.players[owner]!.currentObjective=factionObjective(c.initial_faction);s.players[owner]!.protection=initialProtection(c.id);
}
