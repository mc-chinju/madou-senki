import {getAction} from '@madou/catalog';
import {expect,it} from 'vitest';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,closeWindow,finish,pass,passReclaims,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
import {gameStats} from '../src/game-stats.js';
const BOOK='a2-p03-r1c1',CROWN='a2-p03-r1c2',CRYSTAL='a2-p03-r1c3',WAR='a2-p03-r2c2',MAGIC='a2-p03-r2c3';
it.each([[WAR,'修行（戦士技）','warrior_level'],[MAGIC,'修行（魔法技）','magic_level']] as const)('%s training compares against the pre-earned unconditional stat with strict greater-than', (id,name,stat)=>{
 for(const [faces,success] of [[[3,3],false],[[3,4],true]] as const){
  let s=ready();character(s,'A','大神官ジル');s.players.A!.permanent={[stat]:6-gameStats(s,'A')[stat]};handCard(s,'A',name);
  s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:id,mode:'ordinary'});expect(s.rolls??[]).toHaveLength(0);
  s=closeWindow(s);expect(s.windows!.at(-1)!.kind).toBe('before-roll');s=closeWindow(s,[...faces]);
  expect(s.rolls!.at(-1)).toMatchObject({threshold:6,comparison:'greater-than',success});
  // G03 判定の公開範囲: the outcome is public, the threshold stays with the revealed seat.
  expect(viewFor(s,'B').currentRoll).not.toHaveProperty('threshold');expect(viewFor(s,'B').currentRoll!.success).toBe(success);
  s=finish(s);expect(s.players.A!.attachments.includes(id)).toBe(success);expect(s.discard.includes(id)).toBe(!success);expect(gameStats(s,'A')[stat]).toBe(success?7:6);
 }
});
it('Lancelot explicitly chooses automatic training, while ordinary training has a real intervenable check',()=>{
 for(const mode of ['ordinary','dedicated'] as const){let s=ready();character(s,'A','聖騎士ランスロット');handCard(s,'A','修行（戦士技）');
  s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:WAR,mode});s=finish(s);
  expect(s.rolls?.length??0).toBe(mode==='ordinary'?1:0);expect(s.players.A!.attachments.includes(WAR)).toBe(mode==='dedicated');
 }
});
it('Secret Book draws three extra cards while preserving the ordinary action and forbids another opening use',()=>{
 let s=ready();handCard(s,'A','秘伝書');const before=s.players.A!.hand.length;
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:BOOK});expect(s.players.A!.hand).toHaveLength(before-1);
 s=closeWindow(s,[3]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'extra-draw',faces:[3]});s=finish(s);
 expect(s.players.A!.hand).toHaveLength(before+2);expect(s.phase).toBe('action');expect(s.discard).toContain(BOOK);
 expect(viewFor(s,'A').turnCardOptions.some(o=>o.cardInstanceId===BOOK)).toBe(false);s=act(s,'A',{type:'PASS_ACTION'});expect(s.phase).toBe('hand-adjustment');
});
it.each([[CROWN,'ソロモン王の冠'],[CRYSTAL,'赤い水晶球']] as const)('%s attaches through a cancellable actual declaration', (id,name)=>{
 let s=ready();handCard(s,'A',name);const fate=handCard(s,'B','命運凶変');s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:id});
 expect(s.players.A!.attachments).not.toContain(id);expect(finish(s).players.A!.attachments).toContain(id);
 const target=viewFor(s,'A').reactionTargetActionId!;s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target});s=finish(s);
 expect(s.players.A!.attachments).not.toContain(id);expect(s.discard).toContain(id);expect(s.phase).toBe('hand-adjustment');
});
function nextOwn(s:GameState){
 s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(gameStats(s,'A').handLimit)});
 for(const id of ['B','C','D']){s=act(s,id,{type:'START_TURN'});s=act(s,id,{type:'CHOOSE_DRAW',draw:false});s=act(s,id,{type:'PASS_ACTION'});s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.slice(gameStats(s,id).handLimit)});}
 s=act(s,'A',{type:'START_TURN'});return act(s,'A',{type:'CHOOSE_DRAW',draw:false});
}
it('training freezes unconditional equipment and permanent changes immediately before rolling, never adding its own future point',()=>{
 let s=ready();character(s,'A','大神官ジル');handCard(s,'A','ソロモン王の冠');s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:CROWN}));s=nextOwn(s);
 handCard(s,'A','魔導書');const book=s.players.A!.hand.find(id=>id==='a2-p03-r3c1')!;
 s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceIds:[book]}));s=nextOwn(s);handCard(s,'A','修行（魔法技）');
 const base=gameStats(s,'A',{provenance:{kind:'none'}}).magic_level;s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:MAGIC});s=closeWindow(s);
 s.players.A!.permanent={...s.players.A!.permanent,magic_level:1};s=closeWindow(s,[6,6]);expect(s.rolls!.at(-1)!.threshold).toBe(base+1);
 const threshold=s.rolls!.at(-1)!.threshold;s.players.A!.permanent.magic_level=3;s=finish(s);expect(s.rolls!.at(-1)!.threshold).toBe(threshold);
 expect(s.players.A!.attachments).toContain(MAGIC);expect(gameStats(s,'A',{provenance:{kind:'none'}}).magic_level).toBe(base+4);
});
it('training forced failure survives a whole-roll reroll and a canceled dedicated source cannot install',()=>{
 let s=ready();character(s,'A','聖騎士ランスロット');handCard(s,'A','修行（戦士技）');const fate=handCard(s,'B','命運凶変'),god=handCard(s,'C','神性介入');
 const accepted=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:WAR,mode:'dedicated'}),target=viewFor(accepted,'A').reactionTargetActionId!;
 let canceled=pass(accepted);canceled=finish(act(canceled,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target}));expect(canceled.players.A!.attachments).not.toContain(WAR);expect(canceled.rolls??[]).toHaveLength(0);
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:WAR});s=closeWindow(s);s=closeWindow(s,[6,6]);const roll=s.rolls!.at(-1)!.id;
 s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'force-fail',targetRollId:roll});s=passReclaims(closeWindow(s));
 while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='C')s=pass(s);
 s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:god,mode:'reroll',targetRollId:roll});s=closeWindow(s,[6,6]);s=finish(s);
 expect(s.rolls!.find(r=>r.id===roll)).toMatchObject({forcedFailure:true,success:false,attempts:[{faces:[6,6]},{faces:[6,6]}]});expect(s.discard).toContain(WAR);
});
it('Secret Book resumes an actual OPEN revival draw without losing the saved extra count or ordinary action',()=>{
 let s=ready();handCard(s,'A','秘伝書');s.players.B!.presence='dead';const open=handCard(s,'C',getAction('a2-p01-r1c1')!.name);s.players.C!.hand=s.players.C!.hand.filter(id=>id!==open);s.deck.unshift(open);const count=s.players.A!.hand.length;
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:BOOK});s=closeWindow(s,[3]);s=closeWindow(s);expect(s.windows!.at(-1)!.kind).toBe('before-roll');
 expect(s.resolution).toContain(BOOK);s=closeWindow(s,[1]);s=closeWindow(s);expect(s.windows!.at(-1)!.kind).toBe('revival');
 s=act(JSON.parse(JSON.stringify(s)),'B',{type:'CHOOSE_REVIVAL',revive:false});s=finish(s);
 expect(s.players.A!.hand).toHaveLength(count+2);expect(s.players.A!.open).toContain(open);expect(s.phase).toBe('action');expect(s.rolls!.filter(r=>r.purpose==='extra-draw')).toHaveLength(1);
});
it('Secret Book rejects another seat or late use after an actual approach, and unsupported dedicated use pays nothing',()=>{
 let s=ready();handCard(s,'A','秘伝書');handCard(s,'A','修行（戦士技）');
 for(const [actorId,cardInstanceId,mode] of [['B',BOOK,'ordinary'],['A',WAR,'dedicated']] as const){const before=JSON.stringify(s);expect(transition(s,{actorId,command:{type:'PLAY_TURN_CARD',cardInstanceId,mode}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
 const advance=handCard(s,'A','踏み込み／弓');s=finish(act(s,'A',{type:'APPROACH',targetId:'B',cardInstanceId:advance}));expect(s.phase).toBe('action');
 expect(viewFor(s,'A').turnCardOptions.some(o=>o.cardInstanceId===BOOK)).toBe(false);expect(transition(s,{actorId:'A',command:{type:'PLAY_TURN_CARD',cardInstanceId:BOOK}},entropy()).ok).toBe(false);
});
it.each([[CROWN,'ソロモン王の冠','氷矢',1],[CROWN,'ソロモン王の冠','魔詩',0],[CRYSTAL,'赤い水晶球','氷矢',0],[CRYSTAL,'赤い水晶球','魔詩',2]] as const)('%s applies only its selected spell attributes for %s / %s', (id,name,spell,bonus)=>{
 let s=ready();character(s,'A','大神官ジル');handCard(s,'A',name);s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:id}));s=nextOwn(s);
 const base=gameStats(s,'A',{provenance:{kind:'none'}}).magic_level,card=handCard(s,'A',spell);s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});
 const a=Object.values(s.actions!)[0]!;expect(a.checkSpecs?.filter(c=>c.purpose==='excess-level')).toHaveLength(Math.max(0,a.technique.useLevel-base-bonus));
 expect(gameStats(s,'A',{provenance:{kind:'action',id:a.id}}).magic_level).toBe(base+bonus);expect(gameStats(s,'B',{provenance:{kind:'action',id:a.id}}).magic_level).toBe(gameStats(s,'B',{provenance:{kind:'none'}}).magic_level);
});
it.each([[CROWN,'ソロモン王の冠','大神官ジル','女性親衛隊',1],[CROWN,'ソロモン王の冠','黒騎士ガーウィン','女性親衛隊',0],[CRYSTAL,'赤い水晶球','黒騎士ガーウィン','女性親衛隊',2],[CRYSTAL,'赤い水晶球','大神官ジル','女性親衛隊',0],[CROWN,'ソロモン王の冠','大神官ジル','グリフォン',0],[CRYSTAL,'赤い水晶球','黒騎士ガーウィン','グリフォン',0]] as const)('%s morale at actual entry uses current faction %s / %s / %s', (id,name,owner,follower,bonus)=>{
 let s=ready();character(s,'A',owner);handCard(s,'A',name);s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:id}));s=nextOwn(s);
 const guard=handCard(s,'A',follower);s=act(s,'A',{type:'ARRANGE_FOLLOWERS',cardInstanceIds:[guard]});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(gameStats(s,'A').handLimit)});
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});const attack=handCard(s,'B','踏み込み／弓');
 s=act(s,'B',{type:'ATTACK',cardInstanceId:attack,targetIds:['A'],dedicated:false});
 for(let n=0;n<150;n++){const roll=s.rolls?.at(-1);if(roll?.purpose==='follower-morale'&&roll.stage==='before-roll')break;s=pass(s);}
 const roll=s.rolls!.at(-1)!,base=gameStats(s,'A',{provenance:{kind:'none'}}).spirit;expect(roll.purpose).toBe('follower-morale');s=closeWindow(s,[1,1]);
 expect(s.rolls!.find(r=>r.id===roll.id)!.threshold).toBe(base+roll.modifier+bonus);
});
it('attribute magic correction participates before the final zero clamp after an unconditional level loss',()=>{
 let s=ready();handCard(s,'A','赤い水晶球');s=finish(act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:CRYSTAL}));s=nextOwn(s);
 const base=gameStats(s,'A').magic_level;s.players.A!.permanent={magic_level:-base-3};const card=handCard(s,'A','魔詩');
 s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});const a=Object.values(s.actions!)[0]!;
 expect(gameStats(s,'A',{provenance:{kind:'action',id:a.id}}).magic_level).toBe(0);expect(a.checkSpecs).toHaveLength(a.technique.useLevel);
});
it.each([[BOOK,'秘伝書','action'],[MAGIC,'修行（魔法技）','hand-adjustment']] as const)('canceled %s pays only its declared card and grants no roll draw or installed correction', (id,name,phase)=>{
 let s=ready();handCard(s,'A',name);const fate=handCard(s,'B','命運凶変'),hand=s.players.A!.hand.length,magic=gameStats(s,'A').magic_level;
 s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:id});const target=viewFor(s,'A').reactionTargetActionId!;s=pass(s);
 s=finish(act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target}));
 expect(s.phase).toBe(phase);expect(s.players.A!.hand).toHaveLength(hand-1);expect(s.players.A!.attachments).not.toContain(id);expect(s.discard).toContain(id);
 expect(s.rolls??[]).toHaveLength(0);expect(gameStats(s,'A').magic_level).toBe(magic);
});
