import {expect,it} from 'vitest';
import {getAction,getCharacter} from '@madou/catalog';
import {transition,viewFor,type GameState, discardIds } from '../src/index.js';
import {gameStats} from '../src/game-stats.js';
import {act,closeWindow,finish,pass,ready,until} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
const GOOD='a2-p04-r1c1',EVIL='a2-p04-r1c2',SWAP='a2-p04-r1c3',SEE='a2-p04-r2c2',MOTHER='a2-p05-r1c2';
function source(s:GameState,id:string){handCard(s,'A',getAction(id)!.name);}
function play(s:GameState,id:string,mode='ordinary'){return act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:id,targetId:'B',mode});}
it('Dinon exchanges only both residual hands once after its cancellable source payment',()=>{
 let s=ready();source(s,SWAP);const a=s.players.A!.hand.filter(id=>id!==SWAP),b=[...s.players.B!.hand];s=play(s,SWAP);
 expect(s.resolution).toContain(SWAP);s=finish(s);expect(s.players.A!.hand).toEqual(b);expect(s.players.B!.hand).toEqual(a);expect(discardIds(s)).toContain(SWAP);expect(s.phase).toBe('hand-adjustment');
 const other=viewFor(s,'C');expect(other.players.A).not.toHaveProperty('hand');expect(other.players.B).not.toHaveProperty('hand');
});
it.each([[GOOD,'GOOD','c2-p03-r1c2'],[EVIL,'EVIL','c2-p05-r2c2']] as const)('%s converts on a failed saved target check and replaces the exact objective and protection',(id,faction,protectedId)=>{
 let s=ready();character(s,'B','大神官ジル');s.players.B!.revealed=true;source(s,id);s=play(s,id);s=closeWindow(s);expect(s.rolls!.at(-1)!.rollerId).toBe('B');s=closeWindow(s,[6,6]);expect(s.rolls!.at(-1)!.success).toBe(false);s=finish(s);
 expect(s.players.B!).toMatchObject({faction,currentObjective:{kind:'extinction',enemyFactions:[faction==='GOOD'?'EVIL':'GOOD']},protection:{characterIds:[protectedId]}});
});
it('a successful target check leaves allegiance unchanged and Garwin has only the mandatory conversion +2',()=>{
 let s=ready();s.players.B!.revealed=true;source(s,GOOD);const before={faction:s.players.B!.faction,objective:s.players.B!.objective,protection:s.players.B!.protection};const spirit=gameStats(s,'B').spirit;
 s=closeWindow(play(s,GOOD));s=closeWindow(s,[1,1]);expect(s.rolls!.at(-1)).toMatchObject({purpose:'faction-change',threshold:spirit-1+2,success:true});s=finish(s);expect(s.players.B).toMatchObject(before);
});
it('ordinary Farseeing saves a private identity choice and private history without revealing its target',()=>{
 let s=ready();s.players.B!.revealed=false;source(s,SEE);s=closeWindow(play(s,SEE));s=closeWindow(s,[1,1]);s=until(s,'private-inspection');
 const d=viewFor(s,'A').inspection!;expect(d).toMatchObject({zone:'character',characterId:s.players.B!.characterId});expect(viewFor(s,'C').inspection).toBeNull();expect(s.resolution).toContain(SEE);
 s=act(JSON.parse(JSON.stringify(s)),'A',{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'finish'});s=finish(s);
 expect(s.players.B!.revealed).toBe(false);expect(viewFor(s,'A').privateLogs.some(e=>e.type==='CHARACTER_INSPECTED'&&e.characterId===s.players.B!.characterId)).toBe(true);expect(viewFor(s,'C').logs.filter(e=>e.type==='CHARACTER_INSPECTED').every(e=>!e.characterId)).toBe(true);
});
it('Arseil Farseeing replaces identity inspection with automatic hand inspection and an optional one-card discard',()=>{
 let s=ready();character(s,'A','占星術師のアルセイル');source(s,SEE);const before=structuredClone(s.used);s=until(play(s,SEE,'astrology'),'private-inspection');
 const d=viewFor(s,'A').inspection!;expect(d.zone).toBe('hand');expect(d).not.toHaveProperty('characterId');expect(d.cards.map(c=>c.cardInstanceId)).toEqual(s.players.B!.hand);expect(s.rolls??[]).toHaveLength(0);
 const snapshot=JSON.stringify(s);expect(transition(s,{actorId:'A',command:{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'discard-one',cardInstanceId:SEE}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(snapshot);
 const card=d.cards[0]!.cardInstanceId;s=act(s,'A',{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'discard-one',cardInstanceId:card});s=finish(s);expect(discardIds(s)).toContain(card);expect(s.used).toEqual(before);expect(s.phase).toBe('hand-adjustment');
});
it.each([GOOD,EVIL,SWAP,SEE,MOTHER])('canceled %s consumes the source but applies no choice effect',id=>{
 let s=ready();character(s,'B',getCharacter('c2-p04-r1c2')!.name);s.players.B!.revealed=true;source(s,id);const fate=handCard(s,'B','命運凶変'),before=structuredClone(s.players.B!),own=[...s.players.A!.hand],eventCursor=s.events.length;
 s=play(s,id);const target=viewFor(s,'A').reactionTargetActionId!;s=pass(s);s=finish(act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target}));
 expect(s.players.A!.hand).toEqual(own.filter(card=>card!==id));expect(s.players.B!.hand).toEqual([...before.hand.filter(card=>card!==fate),...s.events.slice(eventCursor).filter(e=>e.type==='CARD_DRAWN'&&e.actorId==='B').map(e=>e.cardInstanceId!)]);expect(s.players.B!.faction).toBe(before.faction);expect(s.players.B!.attachments).toEqual(before.attachments);expect(s.rolls??[]).toHaveLength(0);expect(s.inspections??[]).toHaveLength(0);expect(discardIds(s)).toContain(id);expect(s.phase).toBe('hand-adjustment');
});
it('Mother truth attaches to the revealed Asfelt without rolling',()=>{let s=ready();character(s,'B',getCharacter('c2-p04-r1c2')!.name);s.players.B!.revealed=true;source(s,MOTHER);s=finish(play(s,MOTHER));expect(s.players.B!).toMatchObject({faction:'GOOD',protection:{characterIds:['c2-p03-r1c2']},attachments:[MOTHER]});expect(s.rolls??[]).toHaveLength(0);});
it.each([[GOOD,'c2-p03-r1c2'],[EVIL,'c2-p05-r1c1']] as const)('%s actual named user changes only the printed check modifier',(id,owner)=>{
 let s=ready();character(s,'A',getCharacter(owner)!.name);character(s,'B','大神官ジル');s.players.B!.revealed=true;source(s,id);s=closeWindow(play(s,id));s=closeWindow(s,[1,1]);expect(s.rolls!.at(-1)!.modifier).toBe(-2);
});
it.each(['c2-p04-r1c2','c2-p05-r2c1'])('mandatory conversion resistance of %s survives ability suppression and does not affect ordinary Farseeing',target=>{
 let s=ready();character(s,'B',getCharacter(target)!.name);s.players.B!.revealed=true;s.suppressionDesignations=[{id:'suppressed',sourceActorId:'D',sourceCharacterId:'c2-p07-r1c2',sourceAbilityId:'c2-p07-r1c2-ab03',targetId:'B',eventId:'prior-ban'}];source(s,GOOD);const spirit=gameStats(s,'B').spirit;
 s=closeWindow(play(s,GOOD));s=closeWindow(s,[3,3]);expect(s.rolls!.at(-1)!.threshold).toBe(spirit+1);
 let other=ready();character(other,'A',getCharacter(target)!.name);source(other,SEE);const base=gameStats(other,'A').spirit;other=closeWindow(play(other,SEE));other=closeWindow(other,[1,1]);expect(other.rolls!.at(-1)!.threshold).toBe(base);
});
it.each([[GOOD,'c2-p05-r2c2'],[EVIL,'c2-p01-r2c1']] as const)('%s cannot partially rewrite a fixed faction target after failed resistance',(id,target)=>{
 let s=ready();character(s,'B',getCharacter(target)!.name);s.players.B!.revealed=true;source(s,id);const before=structuredClone(s.players.B!);
 s=closeWindow(play(s,id));s=closeWindow(s,[6,6]);s=finish(s);expect(s.players.B).toMatchObject({faction:before.faction,objective:before.objective,currentObjective:before.currentObjective,protection:before.protection});
});
it('invalid conversion target, self, unavailable target, wrong astrology and Asfelt user are atomic rejections',()=>{
 let s=ready();for(const id of [GOOD,EVIL,SEE,MOTHER,SWAP])source(s,id);
 const commands=[{cardInstanceId:GOOD,targetId:'B'},{cardInstanceId:EVIL,targetId:'A'},{cardInstanceId:SEE,targetId:'B',mode:'astrology'},{cardInstanceId:MOTHER,targetId:'B'},{cardInstanceId:SWAP,targetId:'missing'}];
 for(const c of commands){const before=JSON.stringify(s);expect(transition(s,{actorId:'A',command:{type:'PLAY_TURN_CARD',...c}} as any,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);}
 character(s,'A',getCharacter('c2-p04-r1c2')!.name);s.players.A!.revealed=true;expect(viewFor(s,'A').turnChoiceCardOptions.some(o=>o.cardInstanceId===MOTHER)).toBe(false);
 for(const presence of ['dead','wandering','otherworld','exited'] as const){s.players.B!.presence=presence;expect(viewFor(s,'A').turnChoiceCardOptions.find(o=>o.cardInstanceId===SWAP)?.targetIds).not.toContain('B');}
});
it('failed ordinary Farseeing creates no private knowledge or inspection and still ends the action',()=>{
 let s=ready();source(s,SEE);s=closeWindow(play(s,SEE));s=closeWindow(s,[6,6]);s=finish(s);expect(s.inspections??[]).toHaveLength(0);expect(s.events.some(e=>e.type==='CHARACTER_INSPECTED')).toBe(false);expect(s.phase).toBe('hand-adjustment');
});
it.each([[GOOD,'c2-p03-r1c2'],[SEE,'c2-p04-r2c1'],['a2-p03-r1c3','c2-p04-r2c1']] as const)('actual owned %s offers canonical base recovery after resolution or installation cancellation',(id,owner)=>{
 let s=ready();character(s,'A',getCharacter(owner)!.name);s.players.A!.revealed=true;s.players.B!.revealed=true;source(s,id);
 if(id==='a2-p03-r1c3'){
  const fate=handCard(s,'B','命運凶変');s=act(s,'A',{type:'PLAY_TURN_CARD',cardInstanceId:id});const target=viewFor(s,'A').reactionTargetActionId!;s=pass(s);s=act(s,'B',{type:'PLAY_REACTION',cardInstanceId:fate,mode:'cancel',targetActionId:target});
 }
 else s=play(s,id);
 for(let n=0;n<150;n++){const d=viewFor(s,'A').reclaim;if(d?.claims.length&&d.cardInstanceId===id)break;s=pass(s);}
 const d=viewFor(s,'A').reclaim!;expect(d.claims).toHaveLength(1);s=act(s,'A',{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'take',claimId:d.claims[0]!.claimId});s=finish(s);
 expect(s.players.A!.hand.filter(card=>card===id)).toHaveLength(1);expect(s.players.A!.reclaimUsage?.[getAction(id)!.name]?.baseSpent).toBe(true);
});
it('Mother truth immediately establishes protection wandering for an already-dead Lia before any outcome',()=>{
 let s=ready();character(s,'A',getCharacter('c2-p05-r2c2')!.name);character(s,'B',getCharacter('c2-p04-r1c2')!.name);s.players.B!.revealed=true;character(s,'C',getCharacter('c2-p03-r1c2')!.name);s.players.C!.presence='dead';source(s,MOTHER);
 s=play(s,MOTHER);s=closeWindow(s);expect(s.players.B!.presence).toBe('wandering');expect(s.players.B!.attachments).toContain(MOTHER);expect(s.outcome?.winnerIds??[]).not.toContain('B');expect(s.events.filter(e=>e.type==='PLAYER_WANDERING'&&e.actorId==='B')).toHaveLength(1);
});
it('Mother attachment is discarded once when a later real conversion makes Asfelt EVIL',()=>{
 let s=ready();character(s,'B',getCharacter('c2-p04-r1c2')!.name);s.players.B!.revealed=true;source(s,MOTHER);source(s,EVIL);s=finish(play(s,MOTHER));
 for(let n=0;n<4;n++){const id=s.seatOrder[s.turnSeat]!;s=act(s,id,{type:'END_TURN',discardIds:s.players[id]!.hand.filter(card=>card!==EVIL).slice(0,Math.max(0,s.players[id]!.hand.length-gameStats(s,id).handLimit))});const next=s.seatOrder[s.turnSeat]!;s=act(s,next,{type:'START_TURN'});s=act(s,next,{type:'CHOOSE_DRAW',draw:false});if(next!=='A')s=act(s,next,{type:'PASS_ACTION'});}
 s=closeWindow(play(s,EVIL));s=closeWindow(s,[6,6]);s=finish(s);expect(s.players.B!.faction).toBe('EVIL');expect(s.players.B!.attachments).not.toContain(MOTHER);expect(discardIds(s).filter(id=>id===MOTHER)).toHaveLength(1);
});
it('suppressed Arseil can decline the physical-card discard without spending the separate astrology budget',()=>{
 let s=ready();character(s,'A','占星術師のアルセイル');source(s,SEE);s.suppressionDesignations=[{id:'prior',sourceActorId:'D',sourceCharacterId:'c2-p07-r1c2',sourceAbilityId:'c2-p07-r1c2-ab03',targetId:'A',eventId:'prior'}];const hand=[...s.players.B!.hand],used=structuredClone(s.used);
 s=until(play(s,SEE,'astrology'),'private-inspection');const d=viewFor(s,'A').inspection!;
 const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command:{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'finish'}},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 s=act(s,'A',{type:'CHOOSE_INSPECTION',decisionId:d.decisionId,choice:'finish'});s=finish(s);expect(s.players.B!.hand).toEqual(hand);expect(s.used).toEqual(used);expect(s.rolls??[]).toHaveLength(0);
});
