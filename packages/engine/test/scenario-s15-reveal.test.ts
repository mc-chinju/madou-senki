import {expect,it} from 'vitest';
import {act,finish,ready,until} from './combat-helpers.js';
import {assignCharacter,takeCard,trimHand} from './fixtures/scenario-tools.js';
it.each(['before','after'] as const)('S15 real allied characters reveal %s follower start changes only the permitted target suppression',timing=>{
 let s=ready();assignCharacter(s,'A','侍大将のシン');assignCharacter(s,'B','大神官ジル');for(const p of Object.values(s.players))p.permanent={endurance:100,spirit:20,warrior_level:20};
 const card=takeCard(s,'A','a2-p24-r1c2');trimHand(s,'A',card);s=act(s,'A',{type:'REVEAL_CHARACTER'});expect(s.players.B!.revealed).toBe(false);expect(s.players.A!.faction).toBe(s.players.B!.faction);
 s=until(act(s,'A',{type:'ATTACK',cardInstanceId:card,targetIds:['B'],dedicated:false}),'normal-defense');
 if(timing==='after')s=until(act(s,'B',{type:'START_FOLLOWERS'}),'follower-start');
 s=act(s,'B',{type:'REVEAL_CHARACTER'});s=finish(s);expect(s.players.B!.damage).toBe(timing==='before'?0:4);expect(s.players.B!.revealed).toBe(true);expect(s.discard.filter(id=>id===card)).toHaveLength(1);
});
