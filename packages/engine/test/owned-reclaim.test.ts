import {expect,it} from 'vitest';
import {canonicalOwnedNames} from '../src/reclaim-names.js';
import {act,finish,pass,ready,until} from './combat-helpers.js';
import {character,handCard,handCards} from './fixtures.js';
import {allCardInstanceIds} from '../src/state.js';
import {gameStats,transition,viewFor,type GameState} from '../src/index.js';
import {entropy} from './fixtures.js';
import {getAction} from '@madou/catalog';
import {closeWindow} from './combat-helpers.js';

function nextOwnAction(state:GameState) {
  let s=state;
  for(let n=0;n<8;n++) {
    const id=s.seatOrder[s.turnSeat]!;
    if(s.phase==='action')s=act(s,id,{type:'PASS_ACTION'});
    if(s.phase==='withdrawal')s=act(s,id,{type:'PASS_WITHDRAWAL'});
    s=finish(act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))}));
    const next=s.seatOrder[s.turnSeat]!;
    s=finish(act(s,next,{type:'START_TURN'}));
    s=finish(act(s,next,{type:'CHOOSE_DRAW',draw:false}));
    if(next==='A')return s;
  }
  throw Error('OWN_TURN_NOT_REACHED');
}

it('S24 same-name physical copies share one base allowance',()=>{
  let s=ready();character(s,'A','大神官ジル');
  const [x,y]=handCards(s,['A','A'],'封傷');s.players.A!.damage=2;
  s=until(act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:x!,targetIds:['A'],dedicated:false}),'reclaim');
  expect(s.players.A!.damage).toBe(0);
  expect(s.resolution).toContain(x);
  const choice=viewFor(s,'A').reclaim!;
  expect(choice.claims.map(c=>c.right)).toEqual(['base']);
  const take={type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'take',claimId:choice.claims[0]!.claimId};
  const before=JSON.stringify(s);
  expect(transition(s,{actorId:'B',command:take} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
  s=act(JSON.parse(before) as GameState,'A',take);
  expect(s.players.A!.hand).toContain(x);
  expect(s.players.A!.reclaimUsage?.['封傷']?.baseSpent).toBe(true);
  expect(s.phase).toBe('hand-adjustment');
  s=nextOwnAction(s);
  s=until(act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:y!,targetIds:['A'],dedicated:false}),'reclaim');
  expect(viewFor(s,'A').reclaim!.claims).toEqual([]);
  expect(s.players.A!.damage).toBe(0);
  const current=viewFor(s,'A').reclaim!,second=JSON.stringify(s);
  expect(transition(s,{actorId:'A',command:{type:'CHOOSE_RECLAIM',decisionId:current.decisionId,choice:'take',claimId:`${current.decisionId}-A-base`}},entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(second);
  expect(transition(s,{actorId:'A',command:take} as Parameters<typeof transition>[1],entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(second);
  for(const id of ['A','B','C','D']) {
    expect(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]).toBe(id);
    s=pass(s);
  }
  expect(s.discard).toContain(y);
  expect(s.players.A!.hand).not.toContain(y);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
});

it.each([
  ['大神官ジル','follower',['女神官のシャリア']],
  ['吟遊詩人のレスター','technique',['死歌']],
  ['不死王ガドューラ','follower',['デス・ナイト']],
  ['占星術師のアルセイル','technique',['赤い水晶球','遠見の水晶球']],
  ['大神官ジル','technique',['踏み込み／殴る','踏み込み／蹴る','封傷']],
] as const)('Owned aliases expand to physical matches and canonical-name budgets: %s %s', (name,kind,expected) => {
  const s=ready();character(s,'A',name);
  expect(canonicalOwnedNames(s.players.A!,kind)).toEqual(expect.arrayContaining([...expected]));
  const other=canonicalOwnedNames(s.players.A!,kind==='technique'?'follower':'technique');
  for(const normalized of expected)expect(other).not.toContain(normalized);
});

it('S24 canonical fixture contains two physical 封傷 copies and one owned name', () => {
  const s=ready();character(s,'A','大神官ジル');
  const [x,y]=handCards(s,['A','A'],'封傷');
  expect(x).not.toBe(y);
  expect(canonicalOwnedNames(s.players.A!,'technique').filter(n=>n==='封傷')).toHaveLength(1);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
});

it('Current owned lists follow Lancelot II even while base abilities are inherited', () => {
  const s=ready();character(s,'A','聖騎士ランスロット2');
  s.players.A!.abilityCharacterIds=['c2-p02-r2c2','c2-p07-r1c1'];
  expect(canonicalOwnedNames(s.players.A!,'follower')).toEqual(['聖騎士団','王立騎士団']);
  expect(canonicalOwnedNames(s.players.A!,'follower')).not.toContain('アルケミア城');
});

it('Only actual follower death offers ordinary follower recovery',()=>{
  let s=ready();character(s,'A','大神官ジル');character(s,'B','侍大将のシン');
  const follower=handCard(s,'A','女神官のシャリア'),attack=handCard(s,'B','妖撃破山剣');
  s.distances.A!.B='near';s.distances.B!.A='near';
  s=act(s,'A',{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[follower]});
  s=finish(act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(0,Math.max(0,s.players.A!.hand.length-5))}));
  s=finish(act(s,'B',{type:'START_TURN'}));s=finish(act(s,'B',{type:'CHOOSE_DRAW',draw:false}));
  s=until(act(s,'B',{type:'ATTACK',cardInstanceId:attack,targetIds:['A'],dedicated:false}),'reclaim');
  const d=viewFor(s,'A').reclaim!;
  expect(d.cardInstanceId).toBe(follower);expect(d.claims.map(c=>c.right)).toEqual(['base']);
  expect(s.players.A!.followers).toEqual([]);expect(s.players.A!.damage).toBe(0);
  s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});
  expect(s.reclaimReservations).toContain(follower);expect(s.players.A!.hand).not.toContain(follower);
  s=finish(s);
  expect(s.players.A!.hand).toContain(follower);expect(s.players.A!.followers).toEqual([]);
  expect(s.players.A!.reclaimUsage?.['女神官のシャリア']?.baseSpent).toBe(true);
});

it('Using an owned follower as an attack never spends the ordinary follower-death allowance',()=>{
  let s=ready();character(s,'A','大神官ジル');s.distances.A!.B='near';s.distances.B!.A='near';
  const follower=handCard(s,'A','女神官のシャリア');
  s=until(act(s,'A',{type:'ATTACK',cardInstanceId:follower,targetIds:['B'],dedicated:true}),'reclaim');
  expect(viewFor(s,'A').reclaim).toMatchObject({cardInstanceId:follower,claims:[]});
  s=finish(s);expect(s.discard).toContain(follower);
  expect(s.players.A!.reclaimUsage?.['女神官のシャリア']).toBeUndefined();
});

it('Recovery history survives actual transform death and revival',()=>{
 let s=ready();character(s,'A','聖騎士ランスロット');character(s,'C','リーア姫');
 for(const p of Object.values(s.players))p.permanent={spirit:20};
 s.players.A!.damage=gameStats(s,'A').endurance-1;s.players.B!.permanent={spirit:20,endurance:100};
 s.distances.A!.B=s.distances.B!.A='near';
 const sword=handCard(s,'A','破山剣'),lethal=handCard(s,'B','黒翼飛翔剣'),fusen='a2-p01-r1c1',wish='a2-p04-r3c2',dawn='a2-p01-r1c2',advance=handCard(s,'D','踏み込み／弓');
 // Initial deal fixes the next OPEN and revival hand. Every later move uses a real command.
 for(const id of [fusen,wish,dawn,advance]){s.deck=s.deck.filter(x=>x!==id);s.discard=s.discard.filter(x=>x!==id);for(const p of Object.values(s.players)){p.hand=p.hand.filter(x=>x!==id);p.open=p.open.filter(x=>x!==id);}}
 for(const [actor,keep] of [['A',sword],['B',lethal],['C',''],['D','']]){const p=s.players[actor!]!;while(p.hand.length>5){const i=p.hand.findIndex(x=>x!==keep);s.deck.push(p.hand.splice(i,1)[0]!);}while(p.hand.length<5){const i=s.deck.findIndex(x=>getAction(x)!.category!=='open');p.hand.push(s.deck.splice(i,1)[0]!);}}
 const fillers=s.deck.filter(x=>getAction(x)!.category!=='open').slice(0,12);s.deck=s.deck.filter(x=>!fillers.includes(x));s.deck.unshift(fusen,wish,advance,...fillers.slice(0,2),dawn,...fillers.slice(2));
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B'],dedicated:false}),'reclaim');
 const first=viewFor(s,'A').reclaim!,claim=first.claims.find(c=>c.right==='base')!;
 s=finish(act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:first.decisionId,choice:'take',claimId:claim.claimId}));
 const history=structuredClone(s.players.A!.reclaimUsage),life=s.players.A!.lifeId;
 s=act(s,'C',{type:'REVEAL_CHARACTER'});s=finish(act(s,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'}));
 expect(s.players.A!.characterId).toBe('c2-p07-r1c1');expect(s.players.A!.reclaimUsage).toEqual(history);
 s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'A',{type:'END_TURN',discardIds:[]});
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
 s=finish(act(s,'B',{type:'ATTACK',cardInstanceId:lethal,targetIds:['A'],dedicated:false}));
 expect(s.players.A!.presence).toBe('dead');expect(s.players.A!.reclaimUsage).toEqual(history);expect(s.discard).toContain(sword);
 s=act(s,'B',{type:'PASS_WITHDRAWAL'});s=act(s,'B',{type:'END_TURN',discardIds:[]});
 expect(s.windows!.at(-1)!.kind).toBe('before-roll');s=closeWindow(s,[1]);s=closeWindow(s);
 s=act(s,'A',{type:'CHOOSE_REVIVAL',revive:true});expect(s.players.A!.lifeId).not.toBe(life);expect(s.players.A!.reclaimUsage).toEqual(history);expect(s.players.A!.hand).toContain(wish);
 s=finish(act(s,'A',{type:'PASS_SETUP'}));
 for(const actor of ['C','D']){s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});s=act(s,actor,{type:'PASS_ACTION'});s=act(s,actor,{type:'END_TURN',discardIds:[]});}
 s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});
 s=until(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:wish,mode:'wish'}),'wish');
 s=finish(act(s,'A',{type:'CHOOSE_WISH',decisionId:viewFor(s,'A').wish!.decisionId,source:{kind:'deck',cardName:'破山剣'}}));
 expect(s.players.A!.hand).toContain(sword);s=nextOwnAction(s);s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advance}));
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:sword,targetIds:['B'],dedicated:false}),'reclaim');
 const next=viewFor(s,'A').reclaim!;expect(next.claims.some(c=>c.right==='base')).toBe(false);expect(s.players.A!.reclaimUsage).toEqual(history);
 const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command:{type:'CHOOSE_RECLAIM',decisionId:next.decisionId,choice:'take',claimId:claim.claimId}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 s=finish(s);expect(s.discard).toContain(sword);expect(s.players.A!.reclaimUsage).toEqual(history);
});

it('A printed owned name never grants another users physical card but still permits its own later use',()=>{
 let s=ready();character(s,'A','白魔術師シェリム');character(s,'B','大神官ジル');
 s.players.A!.damage=1;s.players.B!.damage=1;s.players.B!.revealed=true;
 const [foreign,own]=handCards(s,['A','B'],'封傷');
 expect(canonicalOwnedNames(s.players.B!,'technique')).toContain('封傷');
 s=until(act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:foreign!,targetIds:['A'],dedicated:false}),'reclaim');
 const decision=viewFor(s,'A').reclaim!.decisionId;s=pass(s);
 expect(viewFor(s,'B').reclaim).toMatchObject({decisionId:decision,pendingActorId:'B',claims:[],canDecline:true});
 s=JSON.parse(JSON.stringify(s));
 const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
 expect(transition(s,{actorId:'B',command:{type:'CHOOSE_RECLAIM',decisionId:decision,choice:'take',claimId:`${decision}-B-base`}},entropy()).ok).toBe(false);
 expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
 s=finish(s);expect(s.discard).toContain(foreign);expect(s.players.B!.hand).not.toContain(foreign);
 expect(s.players.B!.reclaimUsage).toBeUndefined();
 s=finish(act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(0,Math.max(0,s.players.A!.hand.length-gameStats(s,'A').handLimit))}));
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});
 s=until(act(s,'B',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:own!,targetIds:['B'],dedicated:false}),'reclaim');
 const d=viewFor(s,'B').reclaim!;expect(d.claims.map(c=>c.right)).toEqual(['base']);
 s=act(s,'B',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});
 s=finish(s);expect(s.players.B!.hand.filter(id=>id===own)).toHaveLength(1);expect(s.discard).toContain(foreign);
 expect(s.players.B!.reclaimUsage?.['封傷']?.baseSpent).toBe(true);
});
