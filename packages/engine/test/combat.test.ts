import { expect, it } from 'vitest';
import * as engine from '../src/index.js';
import { character, entropy, handCard, loadFixture } from './fixtures.js';
import { closeWindow, act, finish, pass, ready, until } from './combat-helpers.js';
it('reserves a printed far attack, locks values, passes every public seat and applies damage',()=>{
  let s=ready(); const id=handCard(s,'A','踏み込み／弓'); s=act(s,'A',{type:'ATTACK',cardInstanceId:id,targetIds:['B'],dedicated:false});
  expect(s.resolution).toContain(id); expect(engine.activeWindowRef(s)).not.toBeNull();
  expect((s as any).windows.at(-1).participants).toEqual(['A','B','C','D']);
  s=finish(s); expect(s.players.B!.damage).toBe(4); expect(s.players.B!.revealed).toBe(true); expect(s.discard).toContain(id); expect(s.phase).toBe('withdrawal');
});
it('can explicitly skip withdrawal and continue to hand adjustment',()=>{let s=ready();const id=handCard(s,'A','踏み込み／弓');s=act(s,'A',{type:'ATTACK',cardInstanceId:id,targetIds:['B'],dedicated:false});s=finish(s);s=act(s,'A',{type:'PASS_WITHDRAWAL'});expect(s.phase).toBe('hand-adjustment');});

it('loads the named follower-start fixture with a real valid defense still owned',()=>{
  const s=loadFixture('follower-defense-started');const defense=handCard(structuredClone(s),'B','見切る');
  expect(s.players.B!.hand).toContain(defense);expect(engine.transition(s,{actorId:'B',command:{type:'PLAY_DEFENSE',cardInstanceId:defense,dedicated:false}},entropy())).toEqual({ok:false,code:'DEFENSE_WINDOW_CLOSED'});
});
it('normal defense becomes permanently unavailable after follower start for an owned valid card',()=>{
  let s=ready(); const attack=handCard(s,'A','踏み込み／弓'); const defense=handCard(s,'B','見切る');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}); s=until(s,'normal-defense'); s=act(s,'B',{type:'START_FOLLOWERS'});
  expect(s.players.B!.hand).toContain(defense);
  expect(engine.transition(s,{actorId:'B',command:{type:'PLAY_DEFENSE',cardInstanceId:defense,dedicated:false}} as any,entropy())).toEqual({ok:false,code:'DEFENSE_WINDOW_CLOSED'});
});
it('failed teleport spends its card and allows a different normal defense',()=>{
  let s=ready(); const attack=handCard(s,'A','踏み込み／弓'); const teleport=handCard(s,'B','転移'); const defense=handCard(s,'B','見切る');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}); s=until(s,'normal-defense');
  s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:teleport,dedicated:false});
  for(let n=0;n<50 && (s as any).windows.at(-1)?.kind!=='normal-defense';n++)s=pass(s,[6,6]);
  expect(s.discard).toContain(teleport); s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:defense,dedicated:false}); s=finish(s); expect(s.players.B!.damage).toBe(0);
});

it('a printed counter with an effect level equal to the incoming warrior hit cancels both',()=>{
  let s=ready(); const attack=handCard(s,'A','踏み込み／弓'); const counter=handCard(s,'B','受け流し');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}); s=until(s,'normal-defense');
  s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false}); s=finish(s);
  expect(s.players.A!.damage).toBe(0); expect(s.players.B!.damage).toBe(0);
  expect(s.discard).toEqual(expect.arrayContaining([attack,counter]));
});

it('a higher far counter replaces the incoming hit and damages its attacker',()=>{
  let s=ready(); const attack=handCard(s,'A','踏み込み／弓'); const counter=handCard(s,'B','閃光槍');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}); s=until(s,'normal-defense');
  s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});
  while(Object.keys(s.groups!).length<2)s=pass(s);s=until(s,'normal-defense');const child=Object.values(s.groups!).find(group=>group.attackerId==='B')!;
  expect(child.targets.map(target=>target.actorId)).toEqual(['A']);expect(JSON.parse(JSON.stringify(s))).toEqual(s);s=finish(s);
  expect(s.players.B!.damage).toBe(0); expect(s.players.A!.damage).toBe(5);
});

it('allows defensive maai against a returned counter child before resuming its parent hit',()=>{
  let s=ready();const attack=handCard(s,'A','踏み込み／弓');const counter=handCard(s,'B','閃光槍');const maai=handCard(s,'A','間合い／休息');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});while(Object.keys(s.groups!).length<2)s=pass(s);s=until(s,'normal-defense');s=act(s,'A',{type:'PLAY_MAAI',cardInstanceId:maai});expect(s.windows!.at(-1)!.kind).toBe('defense-advance');s=act(s,'B',{type:'PASS'});s=finish(s);expect(s.players.A!.damage).toBe(0);expect(s.players.B!.damage).toBe(0);
});

it('returns reflection as nested attack groups and terminates a two-source loop by lineage',()=>{
  let s=ready();character(s,'A','白魔術師シェリム');const attack=handCard(s,'A','沈黙');const mirror=handCard(s,'B','ミラーシールド');const ice=handCard(s,'A','氷鏡');
  s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:mirror,dedicated:false});
  while(Object.keys(s.groups!).length<2)s=pass(s);s=until(s,'normal-defense');expect(s.windows!.at(-1)!.continuation).toMatchObject({kind:'group',targetId:'A'});
  s=act(s,'A',{type:'PLAY_DEFENSE',cardInstanceId:ice,dedicated:false});while(Object.keys(s.groups!).length<3)s=pass(s);s=until(s,'normal-defense');
  const returned=Object.values(s.groups!).find(group=>group.attackerId==='A'&&group.actionId!==Object.values(s.groups!)[0]!.actionId)!;
  expect(returned.targets[0]!.hits[0]!.lineage).toEqual([mirror,ice]);expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  const loopAttempt=structuredClone(s);loopAttempt.resolution=loopAttempt.resolution.filter(id=>id!==mirror);loopAttempt.players.B!.hand.push(mirror);const before=JSON.stringify(loopAttempt);
  expect(engine.transition(loopAttempt,{actorId:'B',command:{type:'PLAY_DEFENSE',cardInstanceId:mirror,dedicated:false}},entropy())).toEqual({ok:false,code:'ALREADY_USED'});expect(JSON.stringify(loopAttempt)).toBe(before);
  s=finish(s);expect(s.windows).toEqual([]);expect(s.groups).toEqual({});
});

it('uses the dedicated Lancelot mirror threshold to reflect effect-level seven magic',()=>{
  let s=ready();character(s,'A','白魔術師シェリム');character(s,'B','聖騎士ランスロット');const attack=handCard(s,'A','氷狼乱舞陣');const mirror=handCard(s,'B','ミラーシールド');
  s.players.A!.hand=s.players.A!.hand.filter(id=>id!==attack);s.players.A!.chants.push({cardInstanceId:attack,revealed:false});s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');
  expect(engine.transition(s,{actorId:'B',command:{type:'PLAY_DEFENSE',cardInstanceId:mirror,dedicated:false}},entropy())).toEqual({ok:false,code:'ILLEGAL_DEFENSE'});
  s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:mirror,dedicated:true});while(Object.keys(s.groups!).length<2)s=pass(s);s=until(s,'normal-defense');expect(Object.values(s.groups!).some(group=>group.attackerId==='B'&&group.targets[0]!.actorId==='A')).toBe(true);
});

it('applies the printed persistent silence status after the initial modified check fails on a zero-damage hit',()=>{let s=ready();character(s,'A','白魔術師シェリム');const silence=handCard(s,'A','沈黙');s=act(s,'A',{type:'ATTACK',cardInstanceId:silence,targetIds:['B'],dedicated:false});while(s.windows!.at(-1)!.kind!=='hit')s=pass(s);while(s.windows!.at(-1)!.cursor<s.windows!.at(-1)!.participants.length-1)s=pass(s);s=pass(s);s=closeWindow(s,[6,6]);s=closeWindow(s);s=finish(s);expect(s.players.B!.revealed).toBe(true);expect(s.players.B!.damage).toBe(0);expect(s.players.B!.statuses).toEqual([{id:expect.stringContaining('silence'),kind:'silenced',modifiers:[-2,-1],nextCheck:1,sourceActorId:'A',sourceCardInstanceId:silence,targetId:'B'}]);expect(JSON.parse(JSON.stringify(s))).toEqual(s);});

it('locks the dedicated Ida all-target d6x5 damage and ignores followers',()=>{let s=ready();character(s,'A','忍びのイダ');s.players.B!.permanent={endurance:20};s.players.C!.permanent={endurance:20};const shuriken=handCard(s,'A','手裏剣');const follower=handCard(s,'B','兵士');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==follower);s.players.B!.followers=[{cardInstanceId:follower,revealed:false}];s=act(s,'A',{type:'ATTACK',cardInstanceId:shuriken,targetIds:['B','C'],dedicated:true});s=until(s,'damage');s=closeWindow(s,[4]);s=closeWindow(s);const action=Object.values(s.actions!)[0]!;expect(action.technique.damage).toBe(20);while(s.windows!.at(-1)!.kind!=='follower-start')s=pass(s);s=pass(s);expect(Object.values(s.groups!)[0]!.targets[0]!.followerResults).toEqual([{cardInstanceId:follower,morale:null,outcome:'passed-through',hpReduction:0}]);s=finish(s);expect(s.players.B!.damage).toBe(20);expect(s.players.C!.damage).toBe(20);expect(s.players.B!.followers).toEqual([{cardInstanceId:follower,revealed:false}]);});

it('uses Lancaster dedicated counter check before returning fixed level-six damage-seven',()=>{let s=ready();character(s,'B','早駆けのランカスター');const attack=handCard(s,'A','手裏剣');const counter=handCard(s,'B','閃光槍');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:true});expect(s.actions![Object.keys(s.actions!).at(-1)!]!.checks).toHaveLength(1);s=finish(s);expect(s.players.A!.damage).toBe(7);expect(s.players.B!.damage).toBe(0);});

it('lets 必勝の祈り change the follower outcome through the effect-level child',()=>{let s=ready();const attack=handCard(s,'A','踏み込み／弓');const prayer=handCard(s,'A','必勝の祈り');const follower=handCard(s,'B','ウッドゴーレム');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==follower);s.players.B!.followers=[{cardInstanceId:follower,revealed:false}];s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});while(s.windows!.at(-1)!.kind!=='effect-level')s=pass(s);const parent=Object.keys(s.actions!)[0]!;s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:prayer,mode:'effect-plus',targetActionId:parent});s=closeWindow(s,[2]);s=closeWindow(s);s=finish(s);expect(s.players.B!.followers).toEqual([]);expect(s.discard).toContain(follower);expect(s.players.B!.revealed).toBe(true);expect(s.players.B!.damage).toBe(0);});

it('uses a stronger near counter at far range only to block without a returned attack',()=>{let s=ready();const attack=handCard(s,'A','踏み込み／弓');const counter=handCard(s,'B','妖撃破山剣');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});s=finish(s);expect(s.players.A!.damage).toBe(0);expect(s.players.B!.damage).toBe(0);expect(s.groups).toEqual({});});

it('suppresses a friendly hit when the target reveals before followers, but not after follower defense starts',()=>{let before=ready();before.players.B!.faction=before.players.A!.faction;const first=handCard(before,'A','踏み込み／弓');before=act(before,'A',{type:'ATTACK',cardInstanceId:first,targetIds:['B'],dedicated:false});before=until(before,'normal-defense');before=act(before,'B',{type:'REVEAL_CHARACTER'});before=finish(before);expect(before.players.B!.damage).toBe(0);
  let after=ready();after.players.B!.faction=after.players.A!.faction;const second=handCard(after,'A','踏み込み／弓');after=act(after,'A',{type:'ATTACK',cardInstanceId:second,targetIds:['B'],dedicated:false});after=until(after,'normal-defense');after=act(after,'B',{type:'START_FOLLOWERS'});after=until(after,'follower-start');after=act(after,'B',{type:'REVEAL_CHARACTER'});after=finish(after);expect(after.players.B!.damage).toBe(4);});
