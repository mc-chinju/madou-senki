import {describe,it,expect} from 'vitest';
import {viewFor,transition,type GameState, discardIds } from '../src/index.js';
import {act,ready,until,pass,closeWindow,finish} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';
const DRAGON='c2-p02-r2c1-ab02',WHITE='c2-p02-r2c2-ab02',WIND='c2-p04-r1c2-ab01',FRENZY='c2-p06-r1c1-ab03';
const cases=[['早駆けのランカスター',DRAGON],['聖騎士ランスロット',WHITE],['竜皇子アスフェルト',WIND],['不死王ガドューラ',FRENZY]] as const;
function priority(s:GameState,actor='A'){for(let i=0;i<30;i++){const w=s.windows!.at(-1)!;if(w.participants[w.cursor]===actor)return s;s=pass(s);}throw Error('PRIORITY');}
function start(owner:string,cardName='黒翼飛翔剣',targets=['B']){let s=ready();character(s,'A',owner);for(const target of targets)s.distances.A![target]=s.distances[target]!.A='near';const card=handCard(s,'A',cardName);return act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:targets,dedicated:false});}
function use(s:GameState,id:string,actor='A'){s=priority(s,actor);const option=viewFor(s,actor).abilityOptions.find(o=>o.abilityId===id);expect(option).toBeDefined();return act(s,actor,{type:'USE_ABILITY',abilityId:id,targetEventId:option!.targetEventId});}
describe('Task7o canonical destruction packages',()=>{
 it.each(cases)('%s offers its canonical complete ability in the adopted window',(owner,id)=>{let s=until(start(owner),id===WHITE?'damage':'attack-abilities');s=use(s,id);expect(viewFor(s,'A').currentAction).toMatchObject({source:'ability',abilityId:id});expect(JSON.stringify(viewFor(s,'B'))).not.toContain(id);s=closeWindow(s);s=finish(s);});
});
function place(s:GameState,owner:string,name:string){const id=handCard(s,owner,name);s.players[owner]!.hand=s.players[owner]!.hand.filter(x=>x!==id);s.players[owner]!.followers.push({cardInstanceId:id,revealed:false});return id;}
function selected(owner:string,id:string,card='黒翼飛翔剣'){let s=start(owner,card);s=until(s,id===WHITE?'damage':'attack-abilities');s=use(s,id);return closeWindow(s);}
it('public reached results expose destroyed source but omit blocked hidden rear and pre-processing snapshot',()=>{
 let s=selected('早駆けのランカスター',DRAGON,'踏み込み／弓');const front=place(s,'B','城');const rear=place(s,'B','飛竜');
 s=until(s,'follower-start');expect(viewFor(s,'A').followerDefenseResults).toEqual([]);s=closeWindow(s);
 expect(viewFor(s,'A').followerDefenseResults).toEqual([{targetId:'B',source:'physical',position:0,cardInstanceId:front,hits:[{hitIndex:0,outcome:'blocked',hpReduction:0}]}]);
 expect(JSON.stringify(viewFor(s,'A'))).not.toContain(rear);expect(s.players.B!.followers).toContainEqual({cardInstanceId:rear,revealed:false});s=finish(s);
});
it('public destruction capability is effective per hit without private ability lineage',()=>{
 let s=selected('早駆けのランカスター',DRAGON);s=until(s,'normal-defense');
 expect(viewFor(s,'B').currentAttack!.technique.destructionEffects).toEqual(['竜属性の従者を破壊']);
 expect(viewFor(s,'B').currentAttack!.targets[0]!.hits[0]!.technique!.destructionEffects).toEqual(['竜属性の従者を破壊']);
 const wire=JSON.stringify(viewFor(s,'B'));for(const secret of [DRAGON,'竜殺槍','destructionModifiers'])expect(wire).not.toContain(secret);
});
function reject(s:GameState,id:string,actor='A'){const before=JSON.stringify(s);expect(transition(s,{actorId:actor,command:{type:'USE_ABILITY',abilityId:id,targetEventId:s.windows!.at(-1)!.eventId}},entropy())).toEqual({ok:false,code:'ABILITY_DISABLED'});expect(JSON.stringify(s)).toBe(before);}
function resolvedFollowers(s:GameState){for(let n=0;n<100;n++){if(['hit','hit-abilities'].includes(s.windows!.at(-1)!.kind))return s;s=pass(s);}throw Error('FOLLOWERS');}
function group(s:GameState){return Object.values(s.groups!)[0]!;}
function suppress(s:GameState){s.players.A!.statuses=[{id:'test-source-seal',kind:'ability-disabled',modifiers:[0],nextCheck:0}];}
it.each(cases)('%s can decline or cancel its one package; spent and late attempts reject exactly',(owner,id)=>{
 for(const cancel of [false,true]){let s=until(start(owner),id===WHITE?'damage':'attack-abilities');const event=s.windows!.at(-1)!.eventId;
  if(cancel){const fate=handCard(s,'B','命運凶変');s=use(s,id);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel-ability',targetAbilityId:viewFor(s,'B').reactionTargetAbilityId!});s=closeWindow(s);s=closeWindow(s);expect(s.used).toContain(`${event}:A:${id}`);s=priority(s);reject(s,id);}
  s=until(s,'normal-defense');expect(viewFor(s,'B').currentAttack!.technique.destructionEffects).toEqual([]);reject(s,id);s=finish(s);
 }
});
it.each([
 ['早駆けのランカスター',DRAGON,'風矢'],['聖騎士ランスロット',WHITE,'狼牙'],['竜皇子アスフェルト',WIND,'狼牙'],
 ['早駆けのランカスター',WIND,'黒翼飛翔剣'],['竜皇子アスフェルト',DRAGON,'黒翼飛翔剣'],['黒騎士ガーウィン',FRENZY,'黒翼飛翔剣'],
] as const)('%s rejects wrong school, attribute or absent owner (%s / %s)',(owner,id,card)=>{const s=until(start(owner,card),id===WHITE?'damage':'attack-abilities');expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===id)).toBe(false);reject(s,id);});
it.each([
 ['早駆けのランカスター',DRAGON,'黒翼飛翔剣','飛竜','attribute-destroyed'],
 ['早駆けのランカスター',DRAGON,'黒翼飛翔剣','兵士','lower-destroyed'],
 ['聖騎士ランスロット',WHITE,'黒翼飛翔剣','小悪魔','attribute-destroyed'],
 ['聖騎士ランスロット',WHITE,'黒翼飛翔剣','スケルトン','attribute-destroyed'],
 ['聖騎士ランスロット',WHITE,'黒翼飛翔剣','兵士','lower-destroyed'],
 ['竜皇子アスフェルト',WIND,'黒翼飛翔剣','飛竜','level-destroyed'],
 ['竜皇子アスフェルト',WIND,'風矢','兵士','level-destroyed'],
 ['竜皇子アスフェルト',WIND,'風矢','飛竜','blocked'],
 ['不死王ガドューラ',FRENZY,'黒翼飛翔剣','兵士','attribute-destroyed'],
 ['不死王ガドューラ',FRENZY,'黒翼飛翔剣','小悪魔','lower-destroyed'],
] as const)('%s reaches %s with %s: %s → %s',(owner,id,card,follower,outcome)=>{
 let s=selected(owner,id,card);const f=place(s,'B',follower);s=until(s,'follower-start');s=closeWindow(s);s=resolvedFollowers(s);
 const d=group(s).targets[0]!.followerDefense![0]!;expect(d.hits[0]!.outcome).toBe(outcome);
 if(outcome==='attribute-destroyed'||outcome==='level-destroyed'){expect(d).toMatchObject({defeated:true,revivalForbidden:true,hits:[{hpReduction:0}]});expect(d.morale).toBeUndefined();expect(s.rolls?.some(r=>r.purpose==='follower-morale')??false).toBe(false);expect(discardIds(s)).toContain(f);}
 s=finish(s);
});
it.each([false,true])('WhiteSword applies actual Gadyoora multiplier independent of reveal=%s',revealed=>{
 let s=ready();character(s,'A','聖騎士ランスロット');character(s,'B','不死王ガドューラ');s.players.B!.revealed=revealed;s.distances.A!.B=s.distances.B!.A='near';const card=handCard(s,'A','黒翼飛翔剣');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'damage');const ordinary=structuredClone(s);character(ordinary,'B','黒騎士ガーウィン');
 expect(viewFor(s,'A').abilityOptions).toEqual(viewFor(ordinary,'A').abilityOptions);
 for(let state of [s,ordinary]){const gad=state.players.B!.characterId==='c2-p06-r1c1';state=use(state,WHITE);state=until(state,'attack-abilities');expect(group(state).technique.damage).toBe(7);expect(group(state).targets[0]!.hits[0]!.damage).toBe(gad?14:7);expect(state.players.B!.revealed).toBe(revealed);state=finish(state);expect(state.players.B!.damage).toBe(gad?14:7);}
});
it.each(['before-damage','after-damage','before-snapshot','after-snapshot'] as const)('WhiteSword independent freezes with source disabled %s',boundary=>{
 let s=start('聖騎士ランスロット');character(s,'B','不死王ガドューラ');const f=place(s,'B','小悪魔');s=until(s,'damage');s=use(s,WHITE);s=closeWindow(s);
 if(boundary!=='before-damage')s=until(s,'attack-abilities');if(boundary==='before-snapshot')s=until(s,'follower-entry-abilities');if(boundary==='after-snapshot')s=until(s,'follower-start');suppress(s);
 if(boundary==='before-damage')s=until(s,'attack-abilities');expect(group(s).targets[0]!.hits[0]!.damage).toBe(boundary==='before-damage'?7:14);
 s=until(s,'follower-start');s=closeWindow(s);const d=group(s).targets[0]!.followerDefense![0]!;expect(d.hits[0]).toMatchObject(boundary==='after-snapshot'?{outcome:'attribute-destroyed',hpReduction:0}:{outcome:'lower-destroyed',hpReduction:0});expect(s.resolution).toContain(f);s=finish(s);expect(discardIds(s)).toContain(f);
});
it.each([false,true])('Asfelt effective Lv6 boundary includes Blessing crossing=%s',blessing=>{
 let s=selected('竜皇子アスフェルト',WIND);place(s,'B','飛竜');if(blessing){const b=handCard(s,'B','祝福');s.players.B!.hand=s.players.B!.hand.filter(id=>id!==b);s.players.B!.open.push(b);}s=until(s,'follower-start');expect(group(s).targets[0]!.followerDefense![0]!.levels).toEqual([blessing?7:6]);s=closeWindow(s);s=resolvedFollowers(s);expect(group(s).targets[0]!.followerDefense![0]!.hits[0]!.outcome).toBe(blessing?'blocked':'level-destroyed');s=finish(s);
});
it('Asfelt respects dedicated level7 instead of printed level5',()=>{
 let s=selected('竜皇子アスフェルト',WIND);character(s,'B','有翼人のティア');const f=place(s,'B','有翼族');s=until(s,'normal-defense');s=act(s,'B',{type:'START_FOLLOWERS',dedicatedCardInstanceIds:[f]});s=until(s,'follower-start');expect(group(s).targets[0]!.followerDefense![0]!.levels).toEqual([7]);s=closeWindow(s);expect(group(s).targets[0]!.followerDefense![0]!.hits[0]!.outcome).toBe('blocked');s=finish(s);
});
it('Frenzy destroys actual selected virtual Arnes without creating a physical card',()=>{
 let s=selected('不死王ガドューラ',FRENZY);character(s,'B','黒妖精のアーネス');s=until(s,'follower-entry-abilities');s=use(s,'c2-p03-r2c2-ab02','B');s=until(s,'follower-start');const target=group(s).targets[0]!;expect(target.followerDefense![0]!.source).toBe('virtual');s=closeWindow(s);expect(viewFor(s,'A').followerDefenseResults).toEqual([{source:'virtual',targetId:'B',position:-1,hits:[{hitIndex:0,outcome:'attribute-destroyed',hpReduction:0}]}]);expect(group(s).targets[0]!.followerDestroyed).toEqual([]);s=finish(s);expect(s.players.B!.damage).toBe(7);
});
it('actual LancelotII transformation inherits WhiteSword; actual Vanmil transformation grants no fictional inheritance',()=>{
 let s=ready();character(s,'A','聖騎士ランスロット');character(s,'C','リーア姫');s=act(s,'C',{type:'REVEAL_CHARACTER'});const option=viewFor(s,'A').abilityOptions.find(o=>o.abilityId==='c2-p02-r2c2-ab05')!;s=act(s,'A',{type:'USE_ABILITY',abilityId:option.abilityId,targetEventId:option.targetEventId});s=finish(s);expect(s.players.A!.characterId).toBe('c2-p07-r1c1');expect(s.players.A!.abilityCharacterIds).toContain('c2-p02-r2c2');s.distances.A!.B=s.distances.B!.A='near';const card=handCard(s,'A','黒翼飛翔剣');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'damage');s=use(s,WHITE);s=until(s,'normal-defense');expect(viewFor(s,'B').currentAttack!.technique.destructionEffects).toContain('黒・死属性の従者を破壊');s=finish(s);
 s=ready();character(s,'A','邪祭ウーノス');handCard(s,'A','復活の儀式');s=act(s,'A',{type:'USE_REVIVAL_RITUAL'});s=finish(s);expect(s.players.A!.abilityCharacterIds).toEqual(['c2-p07-r1c2']);s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});for(const actor of ['B','C','D']){s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});s=act(s,actor,{type:'PASS_ACTION'});s=act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.slice(5)});}s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});const spell=handCard(s,'A','妖獣');s=act(s,'A',{type:'ATTACK',cardInstanceId:spell,targetIds:['B'],dedicated:false});s=until(s,'attack-abilities');for(const id of [DRAGON,WHITE,WIND,FRENZY])expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===id)).toBe(false);s=finish(s);
});
it.each(cases)('%s real ordinary Heavenly Hundred Slash freezes shared destruction and physical HP independently on three hits',(owner,id)=>{
 let s=ready();character(s,'A',owner);const source=handCard(s,'A','天地百撃斬');s.players.A!.hand=s.players.A!.hand.filter(x=>x!==source);s.players.A!.chants.push({cardInstanceId:source,revealed:false});
 const f=place(s,'B',id===DRAGON?'飛竜':id===WHITE?'スケルトン':'兵士');const rear=place(s,'B','城');s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B'],dedicated:false});s=until(s,'damage');if(id===WHITE){s=use(s,id);s=closeWindow(s);}s=closeWindow(s,[3]);s=until(s,'attack-abilities');if(id!==WHITE){s=use(s,id);s=closeWindow(s);}expect(group(s).targets[0]!.hits).toHaveLength(3);s=until(s,'follower-start');s=closeWindow(s);const t=group(s).targets[0]!;
 expect(t.followerDefense![0]!.hits).toHaveLength(3);expect(t.followerDefense![0]!.hits.every(h=>h.hpReduction===0&&h.outcome===(id===WIND?'level-destroyed':'attribute-destroyed'))).toBe(true);
 expect(t.hits.map(h=>h.damage)).toEqual(id===WIND?[7,7,7]:[2,2,2]);expect(s.resolution).toContain(f);expect(s.resolution).toContain(rear);s=finish(s);expect(discardIds(s)).toContain(f);expect(discardIds(s)).toContain(rear);
});
it('Asfelt one target frozen while second target remains live keeps per-target destruction semantics',()=>{
 let s=ready();character(s,'A','竜皇子アスフェルト');const source=handCard(s,'A','撃雷');s.players.A!.hand=s.players.A!.hand.filter(x=>x!==source);s.players.A!.chants.push({cardInstanceId:source,revealed:false});place(s,'B','兵士');place(s,'C','辺境警備隊');s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B','C'],dedicated:false});s=until(s,'attack-abilities');s=use(s,WIND);s=until(s,'follower-start');const id=group(s).id;expect(group(s).targets[0]!.followerDefense).toBeDefined();expect(group(s).targets[1]!.followerDefense).toBeUndefined();suppress(s);
 const view=viewFor(s,'D').currentAttack!;expect(view.targets[0]!.hits[0]!.technique!.destructionEffects).toEqual(['従者Lv6以下を破壊']);expect(view.targets[1]!.hits[0]!.technique!.destructionEffects).toEqual([]);s=closeWindow(s);expect(s.groups![id]!.targets[0]!.followerDefense![0]!.hits[0]!.outcome).toBe('level-destroyed');s=until(s,'follower-entry-abilities');s=until(s,'follower-start');s=closeWindow(s);expect(s.groups![id]!.targets[1]!.followerDefense![0]!.hits[0]!.outcome).toBe('lower-destroyed');s=finish(s);
});
it('actual Ida Shadow → Confusion child disables Frenzy before remaining target snapshot',()=>{
 let s=ready();character(s,'A','不死王ガドューラ');character(s,'B','忍びのイダ');const source=handCard(s,'A','地裂'),seal=handCard(s,'B','錯乱');const human=place(s,'C','兵士');s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B','C'],dedicated:false});s=until(s,'attack-abilities');s=use(s,FRENZY);s=until(s,'normal-defense');const id=group(s).id;s=use(s,'c2-p04-r2c2-ab01','B');s=closeWindow(s);s=closeWindow(s,[1,1]);s=closeWindow(s);s=closeWindow(s,[6,6]);s=closeWindow(s);expect(s.windows!.at(-1)!.kind).toBe('ability-attack');s=act(s,'B',{type:'ATTACK',cardInstanceId:seal,targetIds:['A'],dedicated:false});
 for(let n=0;n<150;n++){const w=s.windows!.at(-1)!;if(w.kind==='normal-defense'&&w.continuation.kind==='group'&&w.continuation.id===id&&w.continuation.targetId==='C')break;const r=s.rolls?.at(-1);s=pass(s,w.kind==='before-roll'&&r?.purpose==='status-resistance'?[6,6]:Array(30).fill(1));}
 expect(s.players.A!.statuses).toEqual(expect.arrayContaining([expect.objectContaining({kind:'ability-disabled',sourceActorId:'B',sourceCardInstanceId:seal})]));expect(s.groups![id]!.targets[1]!.followerSnapshot).toBeNull();expect(viewFor(s,'C').currentAttack!.technique.destructionEffects).toEqual([]);s=until(s,'follower-start');s=closeWindow(s);expect(s.groups![id]!.targets[1]!.followerDefense![0]!.hits[0]).toMatchObject({outcome:'lower-destroyed',hpReduction:1});expect(s.resolution).toContain(human);s=finish(s);expect(discardIds(s)).toContain(human);expect(s.players.C!.damage).toBe(7);
});
it('Asfelt normal wind reflection copies active destruction and immutable original source once',()=>{
 let s=selected('竜皇子アスフェルト',WIND,'風矢');character(s,'B','不死王ガドューラ');const human=place(s,'A','兵士'),source=group(s).sourceCardInstanceIds![0]!,reflect=handCard(s,'B','神王界');s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:reflect,dedicated:false});s=until(s,'attack-abilities');const child=Object.values(s.groups!).find(g=>g.attackerId==='B')!;expect(s.actions![child.actionId]).toMatchObject({fixedReceivedEffect:true,effectSourceCardInstanceId:source,cardInstanceId:reflect});expect(child.technique).toMatchObject({destroyFollowersAtOrBelow:6,damage:4});s=priority(s,'B');expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===FRENZY)).toBe(false);suppress(s);s=until(s,'follower-start');s=closeWindow(s);expect(s.groups![child.id]!.targets[0]!.followerDefense![0]!.hits[0]).toMatchObject({outcome:'level-destroyed',hpReduction:0});s=finish(s);expect(s.players.A!.damage).toBe(4);expect(discardIds(s)).toContain(human);
});
it('Royal guard reflected WhiteSword preserves printed white + selected black/dead and original fixed damage',()=>{
 let s=selected('聖騎士ランスロット',WHITE,'破黒剣');const guard=place(s,'B','王立騎士団');const dead=place(s,'A','スケルトン'),white=place(s,'A','小天使');s=until(s,'follower-start');for(let n=0;n<60&&Object.keys(s.groups!).length<2;n++)s=pass(s);const child=Object.values(s.groups!).find(g=>g.attackerId==='B')!;expect(child.technique).toMatchObject({destroyFollowerAttributes:['白','黒','死'],damage:5});expect(s.actions![child.actionId]).toMatchObject({fixedReceivedEffect:true,effectSourceCardInstanceId:'a2-p09-r1c2',cardInstanceId:guard});expect(s.players.B!.followers.some(f=>f.cardInstanceId===guard)).toBe(true);suppress(s);s=until(s,'follower-start');s=closeWindow(s);expect(s.groups![child.id]!.targets[0]!.followerDefense!.map(d=>d.hits[0]!.outcome)).toEqual(['attribute-destroyed','attribute-destroyed']);s=finish(s);expect(discardIds(s)).toEqual(expect.arrayContaining([dead,white]));expect(s.players.A!.damage).toBe(5);
});
it('active Frenzy destroys human Royal guard before reflection; suppressed Frenzy permits intrinsic magic reflection',()=>{
 for(const disabled of [false,true]){let s=selected('不死王ガドューラ',FRENZY,'妖獣');const guard=place(s,'B','王立騎士団');if(disabled)suppress(s);s=until(s,'follower-start');for(let n=0;n<60;n++){if(Object.keys(s.groups!).length===2||['hit','hit-abilities'].includes(s.windows!.at(-1)!.kind))break;s=pass(s);}if(disabled){const child=Object.values(s.groups!).find(g=>g.attackerId==='B')!;expect(child).toBeDefined();expect(child.technique.destroyFollowerAttributes).toEqual(['白']);expect(s.actions![child.actionId]!.fixedReceivedEffect).toBe(true);}else{expect(Object.keys(s.groups!)).toHaveLength(1);expect(group(s).targets[0]!.followerDefense![0]!.hits[0]!.outcome).toBe('attribute-destroyed');expect(discardIds(s)).toContain(guard);}s=finish(s);}
});
it('copied normal reflection cannot acquire reflector Lester conversion',()=>{
 let s=selected('竜皇子アスフェルト',WIND,'風矢');character(s,'B','吟遊詩人のレスター');const reflect=handCard(s,'B','神王界');s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:reflect,dedicated:false});s=until(s,'attack-abilities');s=priority(s,'B');expect(viewFor(s,'B').abilityOptions).toEqual([]);s=finish(s);
});
it('Royal guard child pauses physical disposal after reached Lancaster dragon destruction',()=>{
 let s=selected('早駆けのランカスター',DRAGON,'踏み込み／弓');const front=place(s,'B','飛竜'),guard=place(s,'B','王立騎士団'),returnedDragon=place(s,'A','炎竜');const parentId=group(s).id;s=until(s,'follower-start');for(let n=0;n<60&&Object.keys(s.groups!).length<2;n++)s=pass(s);
 expect(s.players.B!.followers).toContainEqual({cardInstanceId:front,revealed:true});expect(discardIds(s)).not.toContain(front);expect(s.groups![parentId]!.targets[0]!.followerDefense![0]!).toMatchObject({defeated:true,revivalForbidden:true,hits:[{outcome:'attribute-destroyed',hpReduction:0}]});
 const child=Object.values(s.groups!).find(g=>g.attackerId==='B')!;expect(child.technique.destroyFollowerAttributes).toEqual(['竜']);expect(s.actions![child.actionId]!.effectSourceCardInstanceId).not.toBe(guard);suppress(s);s=finish(s);expect(discardIds(s)).toContain(front);expect(discardIds(s)).toContain(returnedDragon);expect(s.players.B!.followers.some(f=>f.cardInstanceId===guard)).toBe(true);expect(s.players.A!.damage).toBe(4);
});
it('WhiteSword source suppression preserves matching intrinsic black/dead predicates',()=>{
 let s=selected('聖騎士ランスロット',WHITE,'妖撃破山剣');suppress(s);s=until(s,'normal-defense');expect(viewFor(s,'B').currentAttack!.technique.destructionEffects).toEqual(['黒・死属性の従者を破壊']);s=finish(s);
});
it('ignored reached hidden human stays anonymous in public results through JSON and ownership change',()=>{
 let s=selected('不死王ガドューラ',FRENZY,'気斬');const hidden=place(s,'B','兵士');s=until(s,'follower-start');s=closeWindow(s);
 const publicResult=[{targetId:'B',source:'physical',position:0,hits:[{hitIndex:0,outcome:'passed-through',hpReduction:0}]}];expect(viewFor(s,'A').followerDefenseResults).toEqual(publicResult);expect(viewFor(s,'B').followerDefenseResults[0]!.cardInstanceId).toBe(hidden);expect(s.players.B!.followers).toContainEqual({cardInstanceId:hidden,revealed:false});
 // Pure projection fixture: changed physical ownership must not grant the current viewer historic disclosure.
 const moved=JSON.parse(JSON.stringify(s)) as GameState;moved.players.B!.followers=[];moved.players.C!.followers=[{cardInstanceId:hidden,revealed:false}];expect(viewFor(moved,'C').followerDefenseResults).toEqual(publicResult);s=finish(s);
});
it.each(cases)('%s destruction source disabled before its declaration resolves leaves no selected modifier',(owner,id)=>{
 let s=until(start(owner),id===WHITE?'damage':'attack-abilities');s=use(s,id);suppress(s);s=closeWindow(s);s=until(s,'normal-defense');expect(viewFor(s,'B').currentAttack!.technique.destructionEffects).toEqual([]);s=finish(s);
});
it.each(cases)('%s pure turn technique has no destruction option',(owner,id)=>{
 let s=ready();character(s,'A',owner);const card=handCard(s,'A','治癒');s=act(s,'A',{type:'PLAY_TURN_TECHNIQUE',cardInstanceId:card,targetIds:['A'],dedicated:false});s=until(s,'damage');expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId===id)).toBe(false);reject(s,id);s=finish(s);
});
it.each(cases)('%s actual returned eligible counter obtains destruction at its proper boundary',(owner,id)=>{
 let s=ready();character(s,'B',owner);s.distances.A!.B=s.distances.B!.A='near';const attack=handCard(s,'A','踏み込み／殴る'),counter=handCard(s,'B',id===FRENZY?'狂王陣': '妖撃破山剣');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:counter,dedicated:false});s=until(s,id===WHITE?'damage':'attack-abilities');s=use(s,id,'B');s=until(s,'normal-defense');const child=Object.values(s.groups!).find(g=>g.attackerId==='B')!;expect(child).toBeDefined();expect(viewFor(s,'A').currentAttack!.technique.destructionEffects.length).toBeGreaterThan(0);s=finish(s);
});
it.each(cases)('%s pure parry does not acquire destruction',(owner,id)=>{
 let s=ready();character(s,'B',owner);const attack=handCard(s,'A','踏み込み／弓'),parry=handCard(s,'B','受け流し');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});s=until(s,'normal-defense');s=act(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:parry,dedicated:false});s=until(s,'damage');s=priority(s,'B');expect(viewFor(s,'B').abilityOptions.some(o=>o.abilityId===id)).toBe(false);reject(s,id,'B');s=finish(s);expect(Object.keys(s.groups??{})).toHaveLength(0);
});
it('WhiteSword on actual Gadyoora copies already doubled damage once into Royal guard return',()=>{
 let s=start('聖騎士ランスロット','破黒剣');character(s,'B','不死王ガドューラ');const guard=place(s,'B','王立騎士団');s=until(s,'damage');s=use(s,WHITE);s=until(s,'attack-abilities');expect(group(s).targets[0]!.hits[0]!.damage).toBe(10);s=until(s,'follower-start');for(let n=0;n<60&&Object.keys(s.groups!).length<2;n++)s=pass(s);const child=Object.values(s.groups!).find(g=>g.attackerId==='B')!;expect(child.targets[0]!.hits[0]!.damage).toBe(10);expect(child.technique.damage).toBe(10);expect(s.actions![child.actionId]!.effectSourceCardInstanceId).toBe('a2-p09-r1c2');suppress(s);s=finish(s);expect(s.players.A!.damage).toBe(10);expect(s.players.B!.damage).toBe(0);expect(s.players.B!.followers.some(f=>f.cardInstanceId===guard)).toBe(true);
});
it('WhiteSword dedicated all-target sword applies one frozen multiplier only to its Gadyoora target',()=>{
 let s=ready();character(s,'A','聖騎士ランスロット');character(s,'B','不死王ガドューラ');const source=handCard(s,'A','光竜破山剣');s.players.A!.hand=s.players.A!.hand.filter(x=>x!==source);s.players.A!.chants.push({cardInstanceId:source,revealed:false});s=act(s,'A',{type:'ATTACK',cardInstanceId:source,targetIds:['B','C'],dedicated:true});s=until(s,'damage');s=use(s,WHITE);s=until(s,'attack-abilities');expect(group(s).technique.damage).toBe(5);expect(group(s).targets.map(t=>t.hits[0]!.damage)).toEqual([10,5]);suppress(s);s=finish(s);expect(s.players.B!.damage).toBe(10);expect(s.players.C!.damage).toBe(5);
});

it.each([['黒翼飛翔剣','剣'],['風矢','風']] as const)('Asfelt actual %s with %s attribute enables the destruction package',(name,attribute)=>{
 let s=until(start('竜皇子アスフェルト',name),'attack-abilities');expect(group(s).technique.attributes).toContain(attribute);
 s=use(s,WIND);s=until(s,'normal-defense');
 expect(viewFor(s,'B').currentAttack!.technique.destructionEffects).toContain('従者Lv6以下を破壊');s=finish(s);expect(s.players.B!.damage).toBeGreaterThan(0);
});
