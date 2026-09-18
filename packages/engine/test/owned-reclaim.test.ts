import {expect,it,describe} from 'vitest';
import {canonicalOwnedNames} from '../src/reclaim-names.js';
import {act,finish,pass,ready,until,closeWindow} from './combat-helpers.js';
import {character,handCard,handCards,entropy} from './fixtures.js';
import {allCardInstanceIds,gameStats,transition,viewFor,type GameState,techniqueFor} from '../src/index.js';
import {getAction,actionCards} from '@madou/catalog';
import {eventPending} from '../src/reclaim.js';
import {nextOwnAction,killOwnedLifetimePlayer,reviveOwnedLifetimePlayer,makeOwnedReclaimTable,playOwnedCardToDiscard,currentReclaimWindow,finishOwnedResolution as finishOwned} from './owned-reclaim-helpers.js';
function nextOwnTurn(state:GameState) {
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
  s=nextOwnTurn(s);
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
 expect(s.players.A!.hand).toContain(sword);s=nextOwnTurn(s);s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advance}));
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

const OWNED_TECHNIQUE_CASES: [string,string,string][] = [
  [
    "白魔術師シェリム",
    "白輪",
    "a2-p14-r1c3"
  ],
  [
    "白魔術師シェリム",
    "白光",
    "a2-p14-r1c2"
  ],
  [
    "白魔術師シェリム",
    "裂界",
    "a2-p14-r2c2"
  ],
  [
    "白魔術師シェリム",
    "天舞",
    "a2-p14-r2c1"
  ],
  [
    "大神官ジル",
    "踏み込み／殴る",
    "a2-p23-r1c2"
  ],
  [
    "大神官ジル",
    "踏み込み／殴る",
    "a2-p23-r1c3"
  ],
  [
    "大神官ジル",
    "踏み込み／殴る",
    "a2-p23-r2c1"
  ],
  [
    "大神官ジル",
    "踏み込み／殴る",
    "a2-p23-r2c2"
  ],
  [
    "大神官ジル",
    "踏み込み／蹴る",
    "a2-p23-r2c3"
  ],
  [
    "大神官ジル",
    "踏み込み／蹴る",
    "a2-p23-r3c1"
  ],
  [
    "大神官ジル",
    "踏み込み／蹴る",
    "a2-p23-r3c2"
  ],
  [
    "大神官ジル",
    "気破",
    "a2-p09-r3c2"
  ],
  [
    "大神官ジル",
    "死鬼界滅拳",
    "a2-p10-r1c1"
  ],
  [
    "大神官ジル",
    "死鬼滅殺拳",
    "a2-p10-r1c2"
  ],
  [
    "大神官ジル",
    "死鬼旋風脚",
    "a2-p09-r3c3"
  ],
  [
    "大神官ジル",
    "神罰",
    "a2-p14-r2c3"
  ],
  [
    "大神官ジル",
    "封傷",
    "a2-p14-r3c1"
  ],
  [
    "大神官ジル",
    "封傷",
    "a2-p14-r3c2"
  ],
  [
    "侍大将のシン",
    "天地百撃斬",
    "a2-p10-r1c3"
  ],
  [
    "侍大将のシン",
    "天地爆砕剣",
    "a2-p10-r2c1"
  ],
  [
    "有翼人のティア",
    "風矢",
    "a2-p14-r3c3"
  ],
  [
    "有翼人のティア",
    "魔風",
    "a2-p15-r1c1"
  ],
  [
    "有翼人のティア",
    "雷走",
    "a2-p15-r1c2"
  ],
  [
    "有翼人のティア",
    "裂風",
    "a2-p15-r1c3"
  ],
  [
    "有翼人のティア",
    "撃雷",
    "a2-p15-r2c1"
  ],
  [
    "妖精王フューリー",
    "踏み込み／弓",
    "a2-p24-r1c2"
  ],
  [
    "妖精王フューリー",
    "踏み込み／弓",
    "a2-p24-r1c3"
  ],
  [
    "妖精王フューリー",
    "踏み込み／弓",
    "a2-p24-r2c1"
  ],
  [
    "妖精王フューリー",
    "踏み込み／弓",
    "a2-p24-r2c2"
  ],
  [
    "妖精王フューリー",
    "踏み込み／弓",
    "a2-p24-r2c3"
  ],
  [
    "妖精王フューリー",
    "光流弓",
    "a2-p10-r2c2"
  ],
  [
    "妖精王フューリー",
    "星流弓",
    "a2-p10-r2c3"
  ],
  [
    "早駆けのランカスター",
    "連槍撃",
    "a2-p10-r3c2"
  ],
  [
    "早駆けのランカスター",
    "閃光槍",
    "a2-p10-r3c3"
  ],
  [
    "早駆けのランカスター",
    "竜殺天空槍",
    "a2-p11-r1c1"
  ],
  [
    "聖騎士ランスロット",
    "破山剣",
    "a2-p12-r1c1"
  ],
  [
    "聖騎士ランスロット",
    "妖撃破山剣",
    "a2-p11-r1c2"
  ],
  [
    "聖騎士ランスロット",
    "光竜剣",
    "a2-p11-r2c1"
  ],
  [
    "聖騎士ランスロット",
    "光竜破山剣",
    "a2-p11-r2c2"
  ],
  [
    "小人のランバ",
    "踏み込み／斧",
    "a2-p25-r1c3"
  ],
  [
    "小人のランバ",
    "踏み込み／斧",
    "a2-p25-r2c1"
  ],
  [
    "小人のランバ",
    "撃戦斧",
    "a2-p11-r2c3"
  ],
  [
    "小人のランバ",
    "剛戦斧",
    "a2-p11-r3c1"
  ],
  [
    "小人のランバ",
    "滅殺斧",
    "a2-p11-r3c3"
  ],
  [
    "小人のランバ",
    "死戦斧",
    "a2-p11-r3c2"
  ],
  [
    "小人のランバ",
    "地槍",
    "a2-p16-r2c3"
  ],
  [
    "小人のランバ",
    "植縛",
    "a2-p16-r3c1"
  ],
  [
    "小人のランバ",
    "地流",
    "a2-p16-r3c2"
  ],
  [
    "リーア姫",
    "破山剣",
    "a2-p12-r1c1"
  ],
  [
    "リーア姫",
    "光王陣",
    "a2-p16-r3c3"
  ],
  [
    "リーア姫",
    "おまえはだまされている",
    "a2-p04-r1c1"
  ],
  [
    "リーア姫",
    "神性介入",
    "a2-p02-r1c3"
  ],
  [
    "吟遊詩人のレスター",
    "魔詩",
    "a2-p17-r1c1"
  ],
  [
    "吟遊詩人のレスター",
    "呪歌",
    "a2-p17-r1c2"
  ],
  [
    "吟遊詩人のレスター",
    "死歌",
    "a2-p17-r1c3"
  ],
  [
    "吟遊詩人のレスター",
    "勇気",
    "a2-p01-r3c3"
  ],
  [
    "吟遊詩人のレスター",
    "ソロモン王の護符",
    "a2-p01-r3c2"
  ],
  [
    "黒妖精のアーネス",
    "踏み込み／弓",
    "a2-p24-r1c2"
  ],
  [
    "黒妖精のアーネス",
    "踏み込み／弓",
    "a2-p24-r1c3"
  ],
  [
    "黒妖精のアーネス",
    "踏み込み／弓",
    "a2-p24-r2c1"
  ],
  [
    "黒妖精のアーネス",
    "踏み込み／弓",
    "a2-p24-r2c2"
  ],
  [
    "黒妖精のアーネス",
    "踏み込み／弓",
    "a2-p24-r2c3"
  ],
  [
    "黒妖精のアーネス",
    "黒流弓",
    "a2-p07-r3c3"
  ],
  [
    "黒妖精のアーネス",
    "黒翼飛翔剣",
    "a2-p08-r1c1"
  ],
  [
    "黒妖精のアーネス",
    "黒翼天翔剣",
    "a2-p08-r1c2"
  ],
  [
    "凍気のアイエル",
    "氷矢",
    "a2-p12-r2c2"
  ],
  [
    "凍気のアイエル",
    "凍流",
    "a2-p12-r2c3"
  ],
  [
    "凍気のアイエル",
    "氷鏡",
    "a2-p12-r3c2"
  ],
  [
    "凍気のアイエル",
    "氷結",
    "a2-p12-r3c3"
  ],
  [
    "凍気のアイエル",
    "氷狼乱舞陣",
    "a2-p13-r1c1"
  ],
  [
    "竜皇子アスフェルト",
    "風斬剣",
    "a2-p08-r1c3"
  ],
  [
    "竜皇子アスフェルト",
    "雷斬剣",
    "a2-p08-r2c1"
  ],
  [
    "竜皇子アスフェルト",
    "裂風斬",
    "a2-p08-r2c2"
  ],
  [
    "占星術師のアルセイル",
    "鏡封",
    "a2-p13-r1c3"
  ],
  [
    "占星術師のアルセイル",
    "錯乱",
    "a2-p13-r1c2"
  ],
  [
    "占星術師のアルセイル",
    "催眠",
    "a2-p13-r2c1"
  ],
  [
    "占星術師のアルセイル",
    "赤い水晶球",
    "a2-p03-r1c3"
  ],
  [
    "占星術師のアルセイル",
    "遠見の水晶球",
    "a2-p04-r2c2"
  ],
  [
    "占星術師のアルセイル",
    "命運凶変",
    "a2-p02-r2c3"
  ],
  [
    "占星術師のアルセイル",
    "人質",
    "a2-p02-r2c2"
  ],
  [
    "忍びのイダ",
    "踏み込み／殴る",
    "a2-p23-r1c2"
  ],
  [
    "忍びのイダ",
    "踏み込み／殴る",
    "a2-p23-r1c3"
  ],
  [
    "忍びのイダ",
    "踏み込み／殴る",
    "a2-p23-r2c1"
  ],
  [
    "忍びのイダ",
    "踏み込み／殴る",
    "a2-p23-r2c2"
  ],
  [
    "忍びのイダ",
    "手裏剣",
    "a2-p08-r2c3"
  ],
  [
    "忍びのイダ",
    "裏天空剣",
    "a2-p08-r3c1"
  ],
  [
    "忍びのイダ",
    "気斬",
    "a2-p08-r3c3"
  ],
  [
    "忍びのイダ",
    "影分身",
    "a2-p08-r3c2"
  ],
  [
    "忍びのイダ",
    "木の葉隠れ",
    "a2-p13-r2c2"
  ],
  [
    "邪祭ウーノス",
    "呪殺",
    "a2-p13-r3c2"
  ],
  [
    "邪祭ウーノス",
    "復活",
    "a2-p13-r3c1"
  ],
  [
    "邪祭ウーノス",
    "封獄死霊陣",
    "a2-p13-r3c3"
  ],
  [
    "獣使いのウパニシャット",
    "獣王剣",
    "a2-p09-r1c1"
  ],
  [
    "黒騎士ガーウィン",
    "破黒剣",
    "a2-p09-r1c2"
  ],
  [
    "黒騎士ガーウィン",
    "黒竜剣",
    "a2-p09-r1c3"
  ],
  [
    "黒騎士ガーウィン",
    "魔空剣",
    "a2-p09-r2c1"
  ],
  [
    "魔導王ガイナス",
    "竜王爆砕剣",
    "a2-p09-r2c2"
  ],
  [
    "魔導王ガイナス",
    "血流",
    "a2-p09-r2c3"
  ],
  [
    "不死王ガドューラ",
    "死刻鎌",
    "a2-p09-r3c1"
  ],
  [
    "不死王ガドューラ",
    "疫病",
    "a2-p14-r1c1"
  ],
  [
    "魔聖母ディア",
    "吸魂",
    "a2-p15-r2c3"
  ],
  [
    "魔聖母ディア",
    "悪夢",
    "a2-p15-r2c2"
  ],
  [
    "魔聖母ディア",
    "死心盗",
    "a2-p15-r3c1"
  ],
  [
    "爆炎のフレイアード",
    "炎矢",
    "a2-p15-r3c2"
  ],
  [
    "爆炎のフレイアード",
    "炎流",
    "a2-p15-r3c3"
  ],
  [
    "爆炎のフレイアード",
    "炎舞",
    "a2-p16-r1c1"
  ],
  [
    "爆炎のフレイアード",
    "爆炎",
    "a2-p16-r1c2"
  ],
  [
    "爆炎のフレイアード",
    "烈火",
    "a2-p16-r1c3"
  ],
  [
    "餓狼ヨーツルム",
    "踏み込み／殴る",
    "a2-p23-r1c2"
  ],
  [
    "餓狼ヨーツルム",
    "踏み込み／殴る",
    "a2-p23-r1c3"
  ],
  [
    "餓狼ヨーツルム",
    "踏み込み／殴る",
    "a2-p23-r2c1"
  ],
  [
    "餓狼ヨーツルム",
    "踏み込み／殴る",
    "a2-p23-r2c2"
  ],
  [
    "餓狼ヨーツルム",
    "踏み込み／蹴る",
    "a2-p23-r2c3"
  ],
  [
    "餓狼ヨーツルム",
    "踏み込み／蹴る",
    "a2-p23-r3c1"
  ],
  [
    "餓狼ヨーツルム",
    "踏み込み／蹴る",
    "a2-p23-r3c2"
  ],
  [
    "餓狼ヨーツルム",
    "狼牙",
    "a2-p10-r3c1"
  ],
  [
    "餓狼ヨーツルム",
    "餓狼",
    "a2-p16-r2c2"
  ],
  [
    "餓狼ヨーツルム",
    "妖獣",
    "a2-p16-r2c1"
  ],
  [
    "餓狼ヨーツルム",
    "転移",
    "a2-p06-r1c1"
  ],
  [
    "餓狼ヨーツルム",
    "転移",
    "a2-p06-r1c2"
  ],
  [
    "聖騎士ランスロット2",
    "破山剣",
    "a2-p12-r1c1"
  ],
  [
    "聖騎士ランスロット2",
    "妖撃破山剣",
    "a2-p11-r1c2"
  ],
  [
    "聖騎士ランスロット2",
    "光竜剣",
    "a2-p11-r2c1"
  ],
  [
    "聖騎士ランスロット2",
    "光竜破山剣",
    "a2-p11-r2c2"
  ],
  [
    "破壊神ヴァンミール",
    "滅界",
    "a2-p13-r2c3"
  ]
];

describe('owned technique base recovery',()=>{
 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) retention-transform-revival',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId,[],true);
  if(name==='復活')table.state=killOwnedLifetimePlayer(table.state,'B');
  let s=playOwnedCardToDiscard(table,cardId);
  const choice=currentReclaimWindow(s,'A')!,base=choice.claims.find(c=>c.right==='base')!;
  s=finishOwned(act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'take',claimId:base.claimId}));
  const history=structuredClone(s.players.A!.reclaimUsage),life=s.players.A!.lifeId;
  expect(history?.[name]?.baseSpent).toBe(true);
  if(owner==='聖騎士ランスロット'){
   if(!s.players.C!.revealed)s=finishOwned(act(s,'C',{type:'REVEAL_CHARACTER'}));
   s=finishOwned(act(s,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'}));
   expect(s.players.A!.characterId).toBe('c2-p07-r1c1');expect(s.players.A!.reclaimUsage).toEqual(history);
  }
  if(owner==='邪祭ウーノス'){
   // A separate command continuation covers the identity change without replacing the ordinary revival case.
   let transformed=nextOwnAction({state:JSON.parse(JSON.stringify(s)),ownerId:'A'},cardId);
   transformed=finishOwned(act(transformed,'A',{type:'USE_REVIVAL_RITUAL'}));
   expect(transformed.players.A!.characterId).toBe('c2-p07-r1c2');expect(transformed.players.A!.reclaimUsage).toEqual(history);
  }
  s=killOwnedLifetimePlayer(s,'A');
  expect(s.players.A!.presence).toBe('dead');expect(s.players.A!.reclaimUsage).toEqual(history);
  if(owner==='破壊神ヴァンミール'){expect(s.outcome).toBeTruthy();return;}
  expect(s.outcome).toBeFalsy();
  s=reviveOwnedLifetimePlayer(JSON.parse(JSON.stringify(s)),'A');
  expect(s.players.A!.presence).toBe('active');expect(s.players.A!.lifeId).not.toBe(life);
  expect(s.players.A!.reclaimUsage).toEqual(history);
 },20000);

 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) reserve-before-parent-release',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=playOwnedCardToDiscard(table,cardId);
  const choice=currentReclaimWindow(s,table.ownerId)!,claim=choice.claims.find(c=>c.right==='base')!;
  const source=Object.values(s.actions!).find(a=>a.cardInstanceId===cardId)!;
  expect(source).toBeDefined();
  const nested=source.parentWindowId!==null;
  const eventId=s.reclaimDecisions!.find(d=>d.id===choice.decisionId)!.eventId;
  expect(eventPending(s,eventId)).toBe(true);
  s=act(s,table.ownerId,{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'take',claimId:claim.claimId});
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent).toBe(true);
  expect(s.resolution).not.toContain(cardId);expect(s.discard).not.toContain(cardId);
  // A top-level use closes atomically; a response must remain reserved under its live parent.
  expect(eventPending(s,eventId)).toBe(nested);
  if(nested){
   expect(s.reclaimReservations.filter(id=>id===cardId)).toHaveLength(1);
   expect(s.players[table.ownerId]!.hand).not.toContain(cardId);
   expect(s.reclaim![cardId]).toMatchObject({ownerId:table.ownerId,eventId,decisionId:choice.decisionId});
  }else{
   expect(s.reclaimReservations).not.toContain(cardId);
   expect(s.players[table.ownerId]!.hand.filter(id=>id===cardId)).toHaveLength(1);
  }
  s=finishOwned(JSON.parse(JSON.stringify(s)));
  expect(eventPending(s,eventId)).toBe(false);
  expect(s.reclaimReservations).not.toContain(cardId);expect(s.reclaim?.[cardId]).toBeUndefined();
  expect(s.players[table.ownerId]!.hand.filter(id=>id===cardId)).toHaveLength(1);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });

 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) exhaustion-across-physical-copies',(owner,name,cardId)=>{
  const copies=actionCards.filter(c=>c.name===name).map(c=>c.id);
  expect(copies).toContain(cardId);
  const firstId=copies.find(id=>id!==cardId)??cardId;
  const table=makeOwnedReclaimTable(owner,firstId,firstId===cardId?[]:[cardId]);
  let s=playOwnedCardToDiscard(table,firstId);
  const choice=currentReclaimWindow(s,table.ownerId)!,claim=choice.claims.find(c=>c.right==='base')!;
  expect(claim).toBeDefined();
  s=finishOwned(act(s,table.ownerId,{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'take',claimId:claim.claimId}));
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent).toBe(true);
  expect(s.players[table.ownerId]!.hand).toContain(cardId);
  s=playOwnedCardToDiscard({...table,state:s},cardId);
  const second=currentReclaimWindow(s,table.ownerId)!;
  expect(second.cardInstanceId).toBe(cardId);expect(second.claims.some(c=>c.right==='base')).toBe(false);
  s=finishOwned(s);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);
  if(firstId!==cardId)expect(s.players[table.ownerId]!.hand).toContain(firstId);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });

 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) normalized-name-once-game',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=playOwnedCardToDiscard(table,cardId);
  const first=currentReclaimWindow(s,table.ownerId)!;expect(first.cardInstanceId).toBe(cardId);
  const claim=first.claims.find(c=>c.right==='base')!;expect(claim).toBeDefined();expect(s.resolution).toContain(cardId);
  const command={type:'CHOOSE_RECLAIM',decisionId:first.decisionId,choice:'take',claimId:claim.claimId} as const;
  const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  s=finishOwned(act(s,table.ownerId,command));expect(s.players[table.ownerId]!.hand.filter(id=>id===cardId)).toHaveLength(1);
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent).toBe(true);expect(s.reclaimReservations).not.toContain(cardId);
  s=playOwnedCardToDiscard({...table,state:s},cardId);const second=currentReclaimWindow(s,table.ownerId)!;
  expect(second.cardInstanceId).toBe(cardId);expect(second.claims.some(c=>c.right==='base')).toBe(false);
  const repeated=JSON.stringify(s);expect(transition(s,{actorId:table.ownerId,command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(repeated);
  s=finishOwned(s);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });
 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) actual-use-disposition',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId),s=playOwnedCardToDiscard(table,cardId),choice=currentReclaimWindow(s,table.ownerId)!;
  expect(choice.cardInstanceId).toBe(cardId);expect(choice.claims.some(c=>c.right==='base')).toBe(true);
  expect(s.reclaimDecisions!.find(d=>d.id===choice.decisionId)!.source).toMatchObject({...(name==='勇気'?{kind:'courage-resolution',cancellationSucceeded:true}:{kind:'ordinary-disposition',trigger:'technique-resolved'}),sourceActorId:table.ownerId,cardInstanceId:cardId});
  expect(s.players[table.ownerId]!.hand).not.toContain(cardId);expect(s.resolution).toContain(cardId);
 });
 it.each(OWNED_TECHNIQUE_CASES)('%s owned technique %s (%s) optional-decline',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=playOwnedCardToDiscard(table,cardId);const choice=currentReclaimWindow(s,table.ownerId)!;
  expect(choice.claims.some(c=>c.right==='base')).toBe(true);
  s=finishOwned(act(s,table.ownerId,{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'decline'}));
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);expect(s.players[table.ownerId]!.hand).not.toContain(cardId);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);
 });
});

const OWNED_FOLLOWER_CASES: [string,string,string][] = [
  [
    "白魔術師シェリム",
    "天使",
    "a2-p22-r2c1"
  ],
  [
    "大神官ジル",
    "女神官のシャリア",
    "a2-p21-r3c2"
  ],
  [
    "有翼人のティア",
    "有翼族",
    "a2-p21-r1c3"
  ],
  [
    "妖精王フューリー",
    "妖精族",
    "a2-p21-r3c3"
  ],
  [
    "聖騎士ランスロット",
    "アルケミア城",
    "a2-p20-r3c2"
  ],
  [
    "聖騎士ランスロット",
    "聖騎士団",
    "a2-p20-r1c3"
  ],
  [
    "小人のランバ",
    "小人族",
    "a2-p21-r2c3"
  ],
  [
    "リーア姫",
    "王立騎士団",
    "a2-p21-r1c2"
  ],
  [
    "リーア姫",
    "親衛隊",
    "a2-p22-r1c3"
  ],
  [
    "リーア姫",
    "守護者",
    "a2-p22-r3c3"
  ],
  [
    "黒妖精のアーネス",
    "女性親衛隊",
    "a2-p21-r2c2"
  ],
  [
    "竜皇子アスフェルト",
    "歌う船",
    "a2-p20-r2c1"
  ],
  [
    "竜皇子アスフェルト",
    "飛竜",
    "a2-p22-r3c1"
  ],
  [
    "邪祭ウーノス",
    "竜王教団",
    "a2-p21-r3c1"
  ],
  [
    "獣使いのウパニシャット",
    "グリフォン",
    "a2-p20-r3c1"
  ],
  [
    "黒騎士ガーウィン",
    "黒騎士団",
    "a2-p20-r1c2"
  ],
  [
    "不死王ガドューラ",
    "スケルトン",
    "a2-p19-r2c1"
  ],
  [
    "不死王ガドューラ",
    "ゾンビー",
    "a2-p19-r3c3"
  ],
  [
    "不死王ガドューラ",
    "ワイト",
    "a2-p21-r1c1"
  ],
  [
    "不死王ガドューラ",
    "デス・ナイト",
    "a2-p22-r3c2"
  ],
  [
    "魔聖母ディア",
    "闇の聖女",
    "a2-p21-r2c1"
  ],
  [
    "聖騎士ランスロット2",
    "聖騎士団",
    "a2-p20-r1c3"
  ],
  [
    "聖騎士ランスロット2",
    "王立騎士団",
    "a2-p21-r1c2"
  ]
];

describe('owned follower base recovery',()=>{
 it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) retention-transform-revival',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId,[],true);
  if(name==='復活')table.state=killOwnedLifetimePlayer(table.state,'B');
  let s=playOwnedCardToDiscard(table,cardId);
  const choice=currentReclaimWindow(s,'A')!,base=choice.claims.find(c=>c.right==='base')!;
  s=finishOwned(act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'take',claimId:base.claimId}));
  const history=structuredClone(s.players.A!.reclaimUsage),life=s.players.A!.lifeId;
  expect(history?.[name]?.baseSpent).toBe(true);
  if(owner==='聖騎士ランスロット'){
   if(!s.players.C!.revealed)s=finishOwned(act(s,'C',{type:'REVEAL_CHARACTER'}));
   s=finishOwned(act(s,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'}));
   expect(s.players.A!.characterId).toBe('c2-p07-r1c1');expect(s.players.A!.reclaimUsage).toEqual(history);
  }
  if(owner==='邪祭ウーノス'){
   // A separate command continuation covers the identity change without replacing the ordinary revival case.
   let transformed=nextOwnAction({state:JSON.parse(JSON.stringify(s)),ownerId:'A'},cardId);
   transformed=finishOwned(act(transformed,'A',{type:'USE_REVIVAL_RITUAL'}));
   expect(transformed.players.A!.characterId).toBe('c2-p07-r1c2');expect(transformed.players.A!.reclaimUsage).toEqual(history);
  }
  s=killOwnedLifetimePlayer(s,'A');
  expect(s.players.A!.presence).toBe('dead');expect(s.players.A!.reclaimUsage).toEqual(history);
  if(owner==='破壊神ヴァンミール'){expect(s.outcome).toBeTruthy();return;}
  expect(s.outcome).toBeFalsy();
  s=reviveOwnedLifetimePlayer(JSON.parse(JSON.stringify(s)),'A');
  expect(s.players.A!.presence).toBe('active');expect(s.players.A!.lifeId).not.toBe(life);
  expect(s.players.A!.reclaimUsage).toEqual(history);
 },20000);

 it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) exhaustion-across-physical-copies',(owner,name,cardId)=>{
  const copies=actionCards.filter(c=>c.name===name).map(c=>c.id);
  expect(copies).toContain(cardId);
  const firstId=copies.find(id=>id!==cardId)??cardId;
  const table=makeOwnedReclaimTable(owner,firstId,firstId===cardId?[]:[cardId]);
  let s=playOwnedCardToDiscard(table,firstId);
  const choice=currentReclaimWindow(s,table.ownerId)!,claim=choice.claims.find(c=>c.right==='base')!;
  expect(claim).toBeDefined();
  s=finishOwned(act(s,table.ownerId,{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'take',claimId:claim.claimId}));
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent).toBe(true);
  expect(s.players[table.ownerId]!.hand).toContain(cardId);
  s=playOwnedCardToDiscard({...table,state:s},cardId);
  const second=currentReclaimWindow(s,table.ownerId)!;
  expect(second.cardInstanceId).toBe(cardId);expect(second.claims.some(c=>c.right==='base')).toBe(false);
  s=finishOwned(s);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);
  if(firstId!==cardId)expect(s.players[table.ownerId]!.hand).toContain(firstId);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });

 it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) normalized-name-once-game',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=playOwnedCardToDiscard(table,cardId);
  const first=currentReclaimWindow(s,table.ownerId)!;expect(first.cardInstanceId).toBe(cardId);
  const claim=first.claims.find(c=>c.right==='base')!;expect(claim).toBeDefined();expect(s.resolution).toContain(cardId);
  const command={type:'CHOOSE_RECLAIM',decisionId:first.decisionId,choice:'take',claimId:claim.claimId} as const;
  const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
  s=finishOwned(act(s,table.ownerId,command));expect(s.players[table.ownerId]!.hand.filter(id=>id===cardId)).toHaveLength(1);
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent).toBe(true);expect(s.reclaimReservations).not.toContain(cardId);
  s=playOwnedCardToDiscard({...table,state:s},cardId);const second=currentReclaimWindow(s,table.ownerId)!;
  expect(second.cardInstanceId).toBe(cardId);expect(second.claims.some(c=>c.right==='base')).toBe(false);
  const repeated=JSON.stringify(s);expect(transition(s,{actorId:table.ownerId,command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(repeated);
  s=finishOwned(s);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });
 it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) actual-follower-death-only',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId),s=playOwnedCardToDiscard(table,cardId),choice=currentReclaimWindow(s,table.ownerId)!;
  expect(choice.cardInstanceId).toBe(cardId);expect(choice.claims.some(c=>c.right==='base')).toBe(true);
  expect(s.reclaimDecisions!.find(d=>d.id===choice.decisionId)!.source).toMatchObject({kind:'ordinary-disposition',trigger:'follower-died',sourceActorId:table.ownerId,cardInstanceId:cardId});
  expect(s.players[table.ownerId]!.hand).not.toContain(cardId);expect(s.resolution).toContain(cardId);
 });
 it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) optional-decline',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=playOwnedCardToDiscard(table,cardId);const choice=currentReclaimWindow(s,table.ownerId)!;
  expect(choice.claims.some(c=>c.right==='base')).toBe(true);
  s=finishOwned(act(s,table.ownerId,{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'decline'}));
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);expect(s.players[table.ownerId]!.hand).not.toContain(cardId);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);
 });
 it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) reserve-before-parent-release',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=playOwnedCardToDiscard(table,cardId);
  const choice=currentReclaimWindow(s,table.ownerId)!,claim=choice.claims.find(c=>c.right==='base')!;
  const eventId=s.reclaimDecisions!.find(d=>d.id===choice.decisionId)!.eventId;
  s=act(s,table.ownerId,{type:'CHOOSE_RECLAIM',decisionId:choice.decisionId,choice:'take',claimId:claim.claimId});
  expect(eventPending(s,eventId)).toBe(true);
  expect(s.reclaimReservations.filter(id=>id===cardId)).toHaveLength(1);
  expect(s.reclaim![cardId]).toMatchObject({ownerId:table.ownerId,eventId,decisionId:choice.decisionId});
  expect(s.players[table.ownerId]!.hand).not.toContain(cardId);expect(s.discard).not.toContain(cardId);
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent).toBe(true);
  s=finishOwned(JSON.parse(JSON.stringify(s)));
  expect(eventPending(s,eventId)).toBe(false);
  expect(s.reclaimReservations).not.toContain(cardId);expect(s.reclaim?.[cardId]).toBeUndefined();
  expect(s.players[table.ownerId]!.hand.filter(id=>id===cardId)).toHaveLength(1);
  expect(allCardInstanceIds(s)).toHaveLength(220);expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });

 it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) morale-failure-excluded',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=table.state;
  const attack=handCard(s,'B','踏み込み／殴る');
  s=act(s,table.ownerId,{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[cardId]});
  s=finishOwned(act(s,table.ownerId,{type:'END_TURN',discardIds:s.players[table.ownerId]!.hand.slice(0,Math.max(0,s.players[table.ownerId]!.hand.length-gameStats(s,table.ownerId).handLimit))}));
  s=finishOwned(act(s,'B',{type:'START_TURN'}));s=finishOwned(act(s,'B',{type:'CHOOSE_DRAW',draw:false}));
  s=act(s,'B',{type:'ATTACK',cardInstanceId:attack,targetIds:[table.ownerId],dedicated:false});
  for(let n=0;s.windows?.length&&n<400;n++)s=pass(s,Array(30).fill(6));
  expect(s.windows).toEqual([]);
  const morale=s.rolls?.filter(r=>r.purpose==='follower-morale'&&r.resume.kind==='follower'&&r.resume.cardInstanceId===cardId)??[];
  // Printed checks are optional only through explicitly selected dedicated text; this run declines it.
  if(getAction(cardId)!.printed_text.includes('チェックに失敗すると捨て札になる')){
   expect(morale).toHaveLength(1);expect(morale[0]).toMatchObject({success:false,faces:[6,6],stage:'applied'});
   expect(s.players[table.ownerId]!.followers.some(f=>f.cardInstanceId===cardId)).toBe(false);
   expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);
  }else{
   expect(morale).toHaveLength(0);
   expect(s.players[table.ownerId]!.followers.some(f=>f.cardInstanceId===cardId)).toBe(true);
  }
  expect(s.reclaimDecisions?.filter(d=>d.cardInstanceId===cardId)??[]).toEqual([]);
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });

 it.each(OWNED_FOLLOWER_CASES)('%s owned follower %s (%s) attack-discard-not-follower-death',(owner,name,cardId)=>{
  const table=makeOwnedReclaimTable(owner,cardId);let s=table.state;
  const hasDirectAttack=!['天使','アルケミア城','闇の聖女'].includes(name)&&!(name==='王立騎士団'&&owner==='聖騎士ランスロット2');
  if(!hasDirectAttack){
   const before=JSON.stringify(s);
   expect(transition(s,{actorId:table.ownerId,command:{type:'ATTACK',cardInstanceId:cardId,targetIds:['B'],dedicated:true}},entropy()).ok).toBe(false);
   expect(JSON.stringify(s)).toBe(before);
   handCard(s,table.ownerId,getAction('a2-p05-r2c2')!.name);
   if(name==='アルケミア城'){
    const saved=JSON.stringify(s);
    expect(viewFor(s,table.ownerId).allArmyOptions.some(o=>o.followerCardInstanceId===cardId)).toBe(false);
    expect(transition(s,{actorId:table.ownerId,command:{type:'PLAY_ALL_ARMY',cardInstanceId:'a2-p05-r2c2',followerCardInstanceId:cardId,targetIds:['B']}},entropy()).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(saved);
    expect(s.reclaimDecisions?.some(d=>d.cardInstanceId===cardId)??false).toBe(false);
    expect(s.players[table.ownerId]!.reclaimUsage?.[name]).toBeUndefined();return;
   }
   const option=viewFor(s,table.ownerId).allArmyOptions.find(o=>o.followerCardInstanceId===cardId)!;
   expect(option).toBeDefined();
   s=act(s,table.ownerId,{type:'PLAY_ALL_ARMY',cardInstanceId:'a2-p05-r2c2',followerCardInstanceId:cardId,targetIds:option.targetMode==='mandatory-all'?option.legalTargetIds:option.legalTargetIds.slice(0,1)});
  }else{
   const profile=techniqueFor(cardId,owner,true)!;expect(profile).toBeDefined();
   s=act(s,table.ownerId,{type:'ATTACK',cardInstanceId:cardId,targetIds:profile.mandatoryAll?['B','C','D']:['B'],dedicated:true});
  }
  for(let n=0;n<400;n++){
   const choice=currentReclaimWindow(s,table.ownerId);
   if(choice?.cardInstanceId===cardId){
    expect(choice.claims.some(c=>c.right==='base')).toBe(false);
    expect(s.reclaimDecisions!.find(d=>d.id===choice.decisionId)!.source).toMatchObject({kind:'ordinary-disposition',trigger:'named-card-used',cardInstanceId:cardId});
    break;
   }
   if(!s.windows?.length)throw Error('OWNED_FOLLOWER_ATTACK_NO_DISPOSITION');s=pass(s);
  }
  s=finishOwned(s);expect(s.discard.filter(id=>id===cardId)).toHaveLength(1);
  expect(s.reclaimDecisions?.filter(d=>d.cardInstanceId===cardId&&d.source.kind==='ordinary-disposition'&&d.source.trigger==='named-card-used')).toHaveLength(1);
  expect(s.players[table.ownerId]!.reclaimUsage?.[name]?.baseSpent??false).toBe(false);
  expect(s.reclaimDecisions?.filter(d=>d.cardInstanceId===cardId&&d.source.kind==='ordinary-disposition'&&d.source.trigger==='follower-died')??[]).toEqual([]);
  expect(new Set(allCardInstanceIds(s)).size).toBe(220);
 });

});
