import {expect,it} from 'vitest';
import {transition,viewFor,type GameState,type GameInput} from '../src/index.js';
import {act,ready,until,finish,pass} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';
import {coSourceFor} from '../src/combat/combination.js';
import {followerBottomFor} from '../src/effects/follower-attacks.js';
import {printedTechniqueAllowed} from '../src/combat/printed-restrictions.js';
function prepared(){const s=ready();character(s,'A','妖精王フューリー');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};return s;}
function reject(s:GameState,actorId:string,command:GameInput['command']){const snapshot=JSON.stringify(s);const result=transition(s,{actorId,command},entropy());expect(result).toEqual({ok:false,code:'UNSUPPORTED_CARD'});expect(transition(JSON.parse(snapshot),{actorId,command},entropy())).toEqual(result);expect(JSON.stringify(s)).toBe(snapshot);}
it('Fury rejects the actual black magic before payment or entropy consumption',()=>{const s=prepared(),card=handCard(s,'A','妖獣');reject(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});});
it.each(['呪殺','血流'])('Fury cannot put actual black %s into chants',name=>{const s=prepared(),card=handCard(s,'A',name);reject(s,'A',{type:'CHANT',cardInstanceId:card});});
it('Fury rejects actual black counter in a real incoming attack window',()=>{let s=ready();character(s,'B','妖精王フューリー');for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};const card=handCard(s,'B','狂王陣'),attack=handCard(s,'A','地槍');s=until(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false}),'normal-defense');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});});
it('A nonblack actual sword with black in its name remains legal for Fury',()=>{let s=prepared();const card=handCard(s,'A','黒翼飛翔剣');s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}));expect(s.players.B!.damage).toBe(7);});
it('Actual Vanmil suppression does not lift Fury mandatory black-counter restriction',()=>{
 let s=ready();character(s,'B','妖精王フューリー');character(s,'C','破壊神ヴァンミール');s.players.C!.revealed=true;for(const p of Object.values(s.players))p.permanent={spirit:20,endurance:100};const card=handCard(s,'B','狂王陣'),attack=handCard(s,'A','地槍');s=act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['B'],dedicated:false});while(s.windows!.at(-1)!.participants[s.windows!.at(-1)!.cursor]!=='C')s=pass(s);const abilityId='c2-p07-r1c2-ab03',o=viewFor(s,'C').abilityOptions.find(o=>o.abilityId===abilityId)!;s=act(s,'C',{type:'USE_ABILITY',abilityId,targetEventId:o.targetEventId,targetIds:['B']});s=until(s,'normal-defense');reject(s,'B',{type:'PLAY_DEFENSE',cardInstanceId:card,dedicated:false});
});
it('Loaded preexisting black chant cannot bypass Fury selection validation (structural saved-zone boundary)',()=>{const s=prepared(),card=handCard(s,'A','呪殺');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==card);s.players.A!.chants.push({cardInstanceId:card,revealed:false});reject(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});});
it('Saved declaration revalidates printed restriction before rolling (structural identity change boundary)',()=>{
 let s=ready();character(s,'A','餓狼ヨーツルム');const card=handCard(s,'A','妖獣');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});character(s,'A','妖精王フューリー');s=finish(s);expect(s.players.B!.damage).toBe(0);expect(s.rolls??[]).toHaveLength(0);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});
it('Actual black warrior co-source is refused before either physical source is paid',()=>{const s=prepared(),beast=handCard(s,'A','獣王剣'),black=handCard(s,'A','血流');reject(s,'A',{type:'ATTACK',cardInstanceId:beast,targetIds:['B'],dedicated:false,coSource:{cardInstanceId:black,dedicated:false}});});
it('Common co-source guard independently rejects black even without faction or level restrictions (structural boundary)',()=>{const s=prepared(),card=handCard(s,'A','血流');s.players.A!.faction='EVIL';s.players.A!.permanent!.warrior_level=10;expect(coSourceFor(s,'A',{cardInstanceId:card,dedicated:false},true)).toBeUndefined();});
it('Printed black follower bottom is disallowed for Fury without inventing a character grant',()=>{
 const s=prepared(),p=s.players.A!;const black=handCard(s,'A','竜王教団');expect(followerBottomFor(black)!.attributes).toContain('黒');expect(printedTechniqueAllowed(p,followerBottomFor(black)!)).toBe(false);reject(s,'A',{type:'ATTACK',cardInstanceId:black,targetIds:['B'],dedicated:true});
 const fairy=handCard(s,'A','妖精族');expect(printedTechniqueAllowed(p,followerBottomFor(fairy)!)).toBe(true);s.players.A!.revealed=true;expect(finish(act(s,'A',{type:'ATTACK',cardInstanceId:fairy,targetIds:['B'],dedicated:true})).players.B!.damage).toBeGreaterThan(0);
});
