import {expect,it} from 'vitest';
import {parseGameCommand} from '@madou/protocol';
import {transition,viewFor,type GameState} from '../src/index.js';
import {act,ready,until,finish,pass,closeWindow,passReclaims} from './combat-helpers.js';
import {character,entropy,handCard} from './fixtures.js';
const GOD='a2-p02-r1c3',FATE='a2-p02-r2c3',PRAYER='a2-p05-r2c3';
function reject(s:GameState,actorId:string,command:unknown){const before=JSON.stringify(s),views=s.seatOrder.map(id=>viewFor(s,id));expect(transition(s,{actorId,command} as never,entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(s.seatOrder.map(id=>viewFor(s,id))).toEqual(views);}
function priority(s:GameState,actor:string){for(let n=0;n<100;n++){const w=s.windows!.at(-1)!;if(w.participants[w.cursor]===actor)return s;s=pass(s);}throw Error('REACTION_PRIORITY');}

it.each(['reveal-cancel','decline'] as const)('Physical Fate grants hidden Alseil an optional reveal then cancellation: %s',choice=>{
 let s=ready();character(s,'D','占星術師のアルセイル');s.players.D!.revealed=false;const attack=handCard(s,'A','踏み込み／弓');handCard(s,'C','命運凶変');
 s=priority(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'C');const parent=s.actions![s.windows!.at(-1)!.continuation.id]!;
 s=act(s,'C',{type:'PLAY_REACTION',cardInstanceId:FATE,mode:'cancel',targetActionId:parent.id});const child=Object.values(s.actions!).find(a=>a.cardInstanceId===FATE)!;
 expect(s.resolution).toContain(FATE);expect(s.players.C!.hand).not.toContain(FATE);expect(viewFor(s,'D').legalChoices).not.toContain('CANCEL_REACTION');reject(s,'D',{type:'CANCEL_REACTION',targetActionId:child.id});
 if(choice==='reveal-cancel'){s=act(s,'D',{type:'REVEAL_CHARACTER'});s=priority(s,'D');expect(viewFor(s,'D').legalChoices).toContain('CANCEL_REACTION');s=act(s,'D',{type:'CANCEL_REACTION',targetActionId:child.id});expect(s.actions![child.id]!.canceled).toBe(true);}
 s=finish(s);expect(s.players.B!.damage).toBe(choice==='reveal-cancel'?4:0);expect(s.players.D!.revealed).toBe(choice==='reveal-cancel');expect(s.discard.filter(id=>id===FATE)).toHaveLength(1);expect(s.discard.filter(id=>id===attack)).toHaveLength(1);expect(s.players.C!.hand).not.toContain(FATE);expect(s.actions).toEqual({});
});

it('Physical Prayer rolls an independent d6 and self God replaces it once before frozen effect comparison',()=>{
 let s=ready();const attack=handCard(s,'A','踏み込み／弓');handCard(s,'A','必勝の祈り');handCard(s,'A','神性介入');handCard(s,'A','命運凶変');
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'effect-level');const parent=s.actions![s.windows!.at(-1)!.continuation.id]!,base=parent.technique.effectLevel;
 s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:PRAYER,mode:'effect-plus',targetActionId:parent.id});s=passReclaims(closeWindow(s,[2]));const roll=s.rolls!.at(-1)!;
 expect(roll).toMatchObject({purpose:'prayer-addition',rollerId:'A',formula:'d6',faces:[2],stage:'after-roll'});expect(s.actions![parent.id]!.technique.effectLevel).toBe(base);
 reject(s,'A',{type:'PLAY_REACTION',cardInstanceId:FATE,mode:'force-fail',targetRollId:roll.id});
 s=act(s,'A',{type:'PLAY_REACTION',cardInstanceId:GOD,mode:'reroll',targetRollId:roll.id});s=passReclaims(closeWindow(s,[6]));expect(s.rolls!.find(r=>r.id===roll.id)).toMatchObject({faces:[6],generation:1});expect(s.rolls!.find(r=>r.id===roll.id)!.attempts.map(a=>a.faces)).toEqual([[2],[6]]);expect(s.actions![parent.id]!.technique.effectLevel).toBe(base);
 s=priority(s,'A');reject(s,'A',{type:'PLAY_REACTION',cardInstanceId:GOD,mode:'reroll',targetRollId:roll.id});s=until(s,'normal-defense');expect(s.actions![parent.id]!.technique).toMatchObject({useLevel:3,effectLevel:base+6,damage:4});
 reject(s,'B',{type:'PLAY_REACTION',cardInstanceId:GOD,mode:'reroll',targetRollId:roll.id});s=finish(s);expect(s.players.B!.damage).toBe(4);expect(s.discard.filter(id=>id===PRAYER)).toHaveLength(1);expect(s.discard.filter(id=>id===GOD)).toHaveLength(1);
});

it('Dedicated Lia Prayer cannot reopen an actual technique after its effect level is frozen',()=>{
 let s=ready();character(s,'B','リーア姫');const attack=handCard(s,'A','踏み込み／弓');handCard(s,'B','必勝の祈り');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');const parent=Object.values(s.actions!).find(a=>a.cardInstanceId===attack)!;
 reject(s,'B',{type:'PLAY_REACTION',cardInstanceId:PRAYER,mode:'effect-plus',targetActionId:parent.id,dedicated:true});expect(s.players.B!.hand).toContain(PRAYER);s=finish(s);expect(s.players.B!.damage).toBe(4);expect(s.rolls?.some(r=>r.purpose==='prayer-addition')??false).toBe(false);
});

it('Physical Fate protocol binds exactly one of its three modes to the matching single target',()=>{
 for(const [mode,key] of [['force-fail','targetRollId'],['cancel-ability','targetAbilityId'],['cancel','targetActionId']] as const){const command={type:'PLAY_REACTION',cardInstanceId:FATE,mode,[key]:'target'};expect(parseGameCommand(command).ok).toBe(true);for(const other of ['targetRollId','targetAbilityId','targetActionId'].filter(k=>k!==key)){expect(parseGameCommand({...command,[other]:'second'}).ok).toBe(false);}expect(parseGameCommand({...command,mode:[mode,'cancel']}).ok).toBe(false);}
});
