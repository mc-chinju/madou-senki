import {it,expect} from 'vitest';
import {getAction,type ActionCard} from '@madou/catalog';
import {isPrintedMagicTechnique} from '../src/abilities/turn-information.js';
import {techniqueFor} from '../src/effects/registry.js';
it('catalogue-only future printed magic does not require runtime handler registration',()=>{const card:ActionCard={...getAction('a2-p18-r1c1')!,id:'future-unimplemented-magic'};expect(techniqueFor(card.id)).toBeUndefined();expect(isPrintedMagicTechnique(card)).toBe(true);});
it('normal printed school never reads follower lower magic or dedicated alternate magic',()=>{expect(isPrintedMagicTechnique(getAction('a2-p18-r1c1'))).toBe(true);expect(isPrintedMagicTechnique({...getAction('a2-p18-r1c1')!,category:'follower'})).toBe(false);expect(isPrintedMagicTechnique({...getAction('a2-p18-r1c1')!,stats:{school:'戦'},character_overrides:[{school:'魔'}]})).toBe(false);});
