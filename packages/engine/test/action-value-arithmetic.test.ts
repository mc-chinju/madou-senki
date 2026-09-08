import {describe,it,expect} from 'vitest';
import {composeValue,damagePreview,freezeDamage,acceptActionModifiers} from '../src/abilities/action-modifiers.js';
import {ready,act,until} from './combat-helpers.js';
import {character,handCard} from './fixtures.js';
/** Pure arithmetic/continuation helper evidence, not synthetic full-card ability combinations. */
describe('G08 arithmetic helpers (compositions without a current canonical producer)',()=>{
 it.each([
  {base:5,floor:6,add:[3],multipliers:[],want:9},
  {base:8,floor:6,add:[3],multipliers:[],want:11},
  {base:5,floor:null,add:[4,3],multipliers:[2,2],want:48},
  {base:5,floor:null,add:[0.5],multipliers:[0.5,2],want:5},
  {base:null,floor:6,add:[6],multipliers:[2],want:null},
  {base:0,floor:null,add:[6],multipliers:[2],want:12},
  {base:3,floor:null,add:[-5],multipliers:[2],want:0},
 ])('composes $base / $floor / $add / $multipliers to $want',({base,floor,add,multipliers,want})=>{expect(composeValue(base,floor,add,multipliers)).toBe(want);});
 it('damage continuation composes printed addition before chant, printed and optional multipliers, once',()=>{let s=ready();character(s,'A','侍大将のシン');const card=handCard(s,'A','黒翼飛翔剣');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'damage');const a=Object.values(s.actions!)[0]!;
  // No canonical printed package currently combines these three multiplier types.
  a.fromChant=true;a.technique.chantDamageMultiplier=2;a.technique.damageAdditive=3;a.technique.damageMultiplier=0.5;
  acceptActionModifiers(s,a).printedDamageDouble=true;
  expect(damagePreview(s,a)).toBe(20);freezeDamage(s,a);freezeDamage(s,a);expect(a.technique.damage).toBe(20);
 });
});
