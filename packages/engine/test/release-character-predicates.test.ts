import {expect,it} from 'vitest';
import {createGame,derivedStats,transition,viewFor} from '../src/index.js';
import {act,finish,ready,readySetup} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';

it.each([
 ['c2-p02-r1c2','妖精王フューリー','Lia','リーア姫'],
 ['c2-p02-r1c2','妖精王フューリー','Shelim','白魔術師シェリム'],
 ['c2-p04-r1c1','凍気のアイエル','Gainas','魔導王ガイナス'],
 ['c2-p04-r1c1','凍気のアイエル','Freiard','爆炎のフレイアード'],
 ['c2-p04-r1c2','竜皇子アスフェルト','Gainas','魔導王ガイナス'],
 ['c2-p04-r1c2','竜皇子アスフェルト','Dia','魔聖母ディア'],
 ['c2-p06-r2c1','爆炎のフレイアード','Gainas','魔導王ガイナス'],
 ['c2-p06-r2c1','爆炎のフレイアード','Aiel','凍気のアイエル'],
] as const)('%s %s loses on actual protected-%s death',(ownerId,owner,key,protectedName)=>{
 for(const victim of ['B','C']){
  let s=createGame(['A','B','C','D'].map(id=>({id,name:id})),entropy(),{startingSeat:3});
  character(s,'A',owner);character(s,'B',protectedName);character(s,'C','占星術師のアルセイル');character(s,'D','侍大将のシン');
  s=readySetup(s);s=act(s,'D',{type:'START_TURN'});s=act(s,'D',{type:'CHOOSE_DRAW',draw:false});
  expect(s.players.A!.characterId).toBe(ownerId);expect(s.players.A!.protection!.characterIds).toContain(s.players.B!.characterId);
  s.players[victim]!.damage=derivedStats(s.players[victim]!).endurance-1;const card=handCard(s,'D','衝破');
  s=finish(act(s,'D',{type:'ATTACK',cardInstanceId:card,targetIds:[victim],dedicated:false}));
  expect(s.players[victim]!.presence).toBe('dead');expect(s.events.some(e=>e.type==='PLAYER_DIED'&&e.actorId===victim)).toBe(true);
  expect(s.players.A!.presence).toBe(victim==='B'?'wandering':'active');
  if(victim==='B'){expect(s.players.A!.hand).toEqual([]);expect(s.events.some(e=>e.type==='PLAYER_WANDERING'&&e.actorId==='A')).toBe(true);}
 }
});

it.each([false,true])('Gadyura mandatory white technique prohibition survives disabled=%s',disabled=>{
 const s=ready();character(s,'A','不死王ガドューラ');if(disabled)s.players.A!.statuses=[{id:'fixture-disable',kind:'ability-disabled',modifiers:[0],nextCheck:0}];
 const card=handCard(s,'A','白光');const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));
 for(const dedicated of [false,true]){
  expect(transition(s,{actorId:'A',command:{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated}},entropy()).ok).toBe(false);
  expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);
 }
 expect(s.players.A!.hand).toContain(card);
});
