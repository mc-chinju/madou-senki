import {followerAttackFor} from './follower-attacks.js';
import {combinationTechniqueFor} from './combination-techniques.js';
import {lifetimeTechniqueFor} from './lifetime-techniques.js';
import { getAction } from '@madou/catalog';
import type { EffectContract, Technique } from '../reactions/continuations.js';
import type { TechniqueVariant } from '@madou/protocol';
import { printedWarriorTechniqueFor } from './techniques.js';
import { printedMagicTechniqueFor } from './magic-techniques.js';
export {followerFor} from './follower-descriptors.js';
export type {FollowerDescriptor} from './follower-descriptors.js';
/** This registry intentionally implements a bounded printed prototype, not the full catalog. */
export function techniqueFor(id: string, characterName?: string, dedicated = false, variant?: TechniqueVariant): Technique | undefined {
  const card = getAction(id); if (!card) return;
  if(card.category==='follower')return followerAttackFor(id,characterName,dedicated);
  const combination=combinationTechniqueFor(id,characterName,dedicated);if(combination)return combination;
  const lifetime=lifetimeTechniqueFor(id,characterName,dedicated);if(lifetime)return lifetime;
  const printedWarrior = printedWarriorTechniqueFor(id, characterName, dedicated, variant);
  if (printedWarrior) return printedWarrior;
  const printedMagic = printedMagicTechniqueFor(id, characterName, dedicated);
  if (printedMagic) return printedMagic;
  const basic = card.modes?.find(m => m.playMode === 'attack');
  const base: Technique = { school: 'warrior', range: 'none', useLevel: 0, effectLevel: 0, damage: null, attributes: [], counter: false, chant: false, noChecks: false, defense: 'none', hitCount: 1, target: 'one', followerIgnore: false,contract:{conditions:['in-hand-or-chant','own-action'],costs:[{kind:'physical-card',at:'accept'}],timing:['declaration'],targets:'declared-players',lifetime:'attack-group'} };
  if (card.category === 'advance' && basic) {
    const attributes = basic.attributes as string[];
    return { ...base, range: attributes.includes('遠') ? 'far' : 'near', useLevel: basic.warrior_level as number, effectLevel: basic.warrior_level as number, damage: basic.damage as number, attributes: [...attributes] };
  }
  if (['a2-p05-r3c1','a2-p05-r3c2','a2-p05-r3c3'].includes(id)) return { ...base, noChecks: true, defense: 'evade' };
  if (['a2-p06-r1c1','a2-p06-r1c2'].includes(id)) return { ...base, defense: 'teleport', teleportCheckModifier: dedicated && characterName === '餓狼ヨーツルム' ? 1 : 0 };
  if (id === 'a2-p08-r2c3') {const own=dedicated&&characterName==='忍びのイダ';return { ...base, range:'far', useLevel:4, effectLevel:own?6:4, damage:own?0:5, ...(own?{damageFormula:'d6x5' as const,onHitDiscardChants:true}:{}), attributes:['戦','忍','反'], counter:true, noChecks:own, defense:'counter', target:own?'all':'one', followerIgnore:own };}
  if (id === 'a2-p10-r3c3') {const own=dedicated&&characterName==='早駆けのランカスター';return { ...base, range:'far', useLevel:5, effectLevel:own?6:5, damage:own?7:5, attributes:['戦','槍','反'], counter:true, noChecks:own, counterCheck:own, counterIgnoresLevel:own, counterReturnFollowerIgnore:own, defense:'counter', followerIgnore:false };}
  if (id === 'a2-p10-r1c3') return { ...base, range:'far', useLevel:7, effectLevel:7, damage:7, attributes:['戦','剣','詠'], chant:true, noChecks:dedicated && characterName==='侍大将のシン', hitCount:'d6', target:dedicated && characterName==='侍大将のシン'?'all':'one', ...(characterName!=='侍大将のシン'?{activationCheckModifier:-2}:{}) };
  if (id === 'a2-p12-r1c3') return { ...base, useLevel:0, effectLevel:0, useLevelSource:'incoming-effect', attributes:['戦','反'], counter:true, defense:'parry' };
  if (id === 'a2-p11-r1c3') { const lancelot=characterName==='聖騎士ランスロット'||characterName==='聖騎士ランスロット2'; return { ...base, useLevel:5, effectLevel:5, attributes:['戦','盾','反'], counter:true, defense:'reflect', relativeDefenseLimits:{warriorOffset:lancelot&&dedicated?1:0,magicOffset:lancelot&&dedicated?2:1},reflectMagicLimit:lancelot&&dedicated?7:6, blockWarriorLimit:lancelot&&dedicated?6:5 }; }
  if (id === 'a2-p12-r3c2') {const own=dedicated&&characterName==='凍気のアイエル';return { ...base, school:'magic', useLevel:6, effectLevel:6, attributes:['魔','反'], counter:true, defense:'reflect', noChecks:own, relativeDefenseLimits:{magicOffset:0,...(own?{warriorOffset:0}:{})}, reflectMagicLimit:6, blockWarriorLimit:own?6:-1 };}
  if (id === 'a2-p18-r1c1') return { ...base, school:'magic', range:'far', useLevel:6, effectLevel:6, damage:null, attributes:['魔','精'], followerIgnore:true,onHitStatus:{kind:'silenced',modifiers:[-2,-1]} };
  return;
}
