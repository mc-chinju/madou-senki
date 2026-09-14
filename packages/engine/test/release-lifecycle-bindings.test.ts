import {expect,it} from 'vitest';
import {createGame,derivedStats,transition,viewFor} from '../src/index.js';
import {ownsAbility} from '../src/abilities/ownership.js';
import {act,ready,until,finish,closeWindow} from './combat-helpers.js';
import {character,handCard,entropy} from './fixtures.js';

it.each(['c2-p02-r2c2-ab01','c2-p02-r2c2-ab02','c2-p02-r2c2-ab03','c2-p02-r2c2-ab04','c2-p02-r2c2-ab05'])('actual transformation retains ownership of %s and its spent history',abilityId=>{
 let s=ready();character(s,'A','聖騎士ランスロット');character(s,'C','リーア姫');s.players.A!.damage=4;
 expect(viewFor(s,'A').lifecycleAbilities).not.toContain('lancelot-transform');
 s.distances.A!.B=s.distances.B!.A='near';const card=handCard(s,'A','黒翼飛翔剣');s=act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false});s=until(s,'damage');
 const sword=viewFor(s,'A').abilityOptions.find(o=>o.abilityId==='c2-p02-r2c2-ab02')!;expect(sword).toBeDefined();
 s=act(s,'A',{type:'USE_ABILITY',abilityId:sword.abilityId,targetEventId:sword.targetEventId});s=closeWindow(s);
 const used=[...s.used!];expect(used.some(k=>k.includes(sword.abilityId))).toBe(true);
 s=act(s,'C',{type:'REVEAL_CHARACTER'});expect(viewFor(s,'A').lifecycleAbilities).toContain('lancelot-transform');
 s=act(s,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'lancelot-transform'});s=closeWindow(s);
 expect(s.players.A).toMatchObject({characterId:'c2-p07-r1c1',damage:4,abilityCharacterIds:['c2-p02-r2c2','c2-p07-r1c1']});
 expect(ownsAbility(s.players.A!,abilityId)).toBe(true);expect(s.used).toEqual(expect.arrayContaining(used));expect(s.used).toContain('A:lancelot-transform');
 expect(viewFor(s,'A').lifecycleAbilities).not.toContain('lancelot-transform');s=finish(s);expect(s.players.A!.damage).toBe(4);
});

it('actual dead Yotsulm changes allegiance at awakening and retains it through FuSen revival',()=>{
 let s=createGame(['A','B','C','D','E','F'].map(id=>({id,name:id})),entropy(),{startingSeat:0});character(s,'A','侍大将のシン');character(s,'B','邪祭ウーノス');character(s,'C','餓狼ヨーツルム');character(s,'D','魔聖母ディア');character(s,'E','魔導王ガイナス');character(s,'F','リーア姫');for(const actor of s.seatOrder)s=act(s,actor,{type:'PASS_SETUP'});s=act(s,'A',{type:'START_TURN'});s=act(s,'A',{type:'CHOOSE_DRAW',draw:false});
 s.players.C!.damage=derivedStats(s.players.C!).endurance-1;
 const attack=handCard(s,'A','衝破');s=finish(act(s,'A',{type:'ATTACK',cardInstanceId:attack,targetIds:['C'],dedicated:false}));
 expect(s.players.C!.presence).toBe('dead');expect(s.players.C!.deathIdentity!.faction).toBe('EVIL');
 s=act(s,'A',{type:'PASS_WITHDRAWAL'});s=act(s,'A',{type:'END_TURN',discardIds:s.players.A!.hand.slice(5)});
 s=act(s,'B',{type:'START_TURN'});s=act(s,'B',{type:'CHOOSE_DRAW',draw:false});handCard(s,'B','復活の儀式');
 s=until(act(s,'B',{type:'USE_REVIVAL_RITUAL'}),'lifecycle-boundary');s=closeWindow(act(s,'B',{type:'USE_LIFECYCLE_ABILITY',ability:'vanmil-subordinates'}));
 const objective={enemyFactions:['GOOD','EVIL']},protection={characterIds:['c2-p07-r1c2']};
 for(const id of ['C','D'])expect(s.players[id]).toMatchObject({faction:'ヴァンミール',currentObjective:objective,protection});
 expect(s.players.C!.deathIdentity).toMatchObject({characterId:'c2-p06-r2c2',faction:'ヴァンミール',currentObjective:objective,protection});
 s=finish(s);s=act(s,'B',{type:'END_TURN',discardIds:s.players.B!.hand.slice(5)});
 for(const actor of ['D','E','F']){s=act(s,actor,{type:'START_TURN'});s=act(s,actor,{type:'CHOOSE_DRAW',draw:false});s=act(s,actor,{type:'PASS_ACTION'});s=act(s,actor,{type:'END_TURN',discardIds:s.players[actor]!.hand.slice(5)});}
 s=act(s,'A',{type:'START_TURN'});const revival=handCard(s,'A','そうかっ！あれが伏線だったのか');s.players.A!.hand=s.players.A!.hand.filter(id=>id!==revival);s.deck.unshift(revival);
 s=act(s,'A',{type:'CHOOSE_DRAW',draw:true});s=closeWindow(s,[1]);s=closeWindow(s);s=act(s,'C',{type:'CHOOSE_REVIVAL',revive:true});s=act(s,'C',{type:'PASS_SETUP'});s=finish(s);
 expect(s.players.C).toMatchObject({presence:'active',characterId:'c2-p06-r2c2',faction:'ヴァンミール',currentObjective:objective,protection,damage:0});
});

it('Arseil conspiracy requires the actual awakening window and remains optional',()=>{
 let s=ready();character(s,'A','邪祭ウーノス');character(s,'B','占星術師のアルセイル');
 const command={type:'USE_LIFECYCLE_ABILITY',ability:'arseil-conspiracy'} as const;
 expect(viewFor(s,'B').lifecycleAbilities).not.toContain('arseil-conspiracy');const before=JSON.stringify(s);expect(transition(s,{actorId:'B',command},entropy()).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);
 handCard(s,'A','復活の儀式');s=until(act(s,'A',{type:'USE_REVIVAL_RITUAL'}),'lifecycle-boundary');s=act(s,'A',{type:'PASS'});expect(viewFor(s,'B').lifecycleAbilities).toContain('arseil-conspiracy');
 s=finish(s);expect(s.players.B!.presence).toBe('active');expect(s.individualResults?.B).toBeUndefined();expect(viewFor(s,'B').lifecycleAbilities).not.toContain('arseil-conspiracy');
});

it.each([false,true])('actual Vanmil awakening elected=%s converts Dia and Yotsulm only when selected',selected=>{
 let s=ready();character(s,'A','邪祭ウーノス');character(s,'B','侍大将のシン');character(s,'C','魔聖母ディア');character(s,'D','餓狼ヨーツルム');
 const before=['B','C','D'].map(id=>s.players[id]!.faction);handCard(s,'A','復活の儀式');s=until(act(s,'A',{type:'USE_REVIVAL_RITUAL'}),'lifecycle-boundary');
 expect(s.players.A!.characterId).toBe('c2-p07-r1c2');expect(viewFor(s,'A').lifecycleAbilities).toContain('vanmil-subordinates');
 if(selected)s=act(s,'A',{type:'USE_LIFECYCLE_ABILITY',ability:'vanmil-subordinates'});s=finish(s);
 expect(s.players.B!.faction).toBe(before[0]);expect(['C','D'].map(id=>s.players[id]!.faction)).toEqual(selected?['ヴァンミール','ヴァンミール']:before.slice(1));
 if(selected)for(const id of ['C','D'])expect(s.players[id]).toMatchObject({currentObjective:{enemyFactions:['GOOD','EVIL']},protection:{characterIds:['c2-p07-r1c2']}});
});
