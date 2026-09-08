import {it,expect} from 'vitest';
import {qualifiesForSpirit} from '../src/abilities/follower-entry.js';
import {act,ready,until,finish} from './combat-helpers.js';
import {character,handCard} from './fixtures.js';
import {viewFor} from '../src/index.js';
it('actual heterogeneous C10 sources compare their own printed use levels without synthesizing Lester ownership',()=>{
 let s=ready();character(s,'A','魔聖母ディア');s.distances.A!.B='near';s.distances.B!.A='near';
 const soldier=handCard(s,'A','兵士'),priest=handCard(s,'A','女神官のシャリア');
 const option=viewFor(s,'A').followerBundleOptions[0]!;
 s=act(s,'A',{type:'USE_FOLLOWER_ATTACK',abilityId:option.abilityId,targetEventId:option.targetEventId,sources:[{cardInstanceId:soldier,dedicated:false,targetIds:['B']},{cardInstanceId:priest,dedicated:false,targetIds:['B']}]});
 s=until(s,'normal-defense');const g=Object.values(s.groups!)[0]!;
 expect(g.targets[0]!.hits.map(h=>qualifiesForSpirit(s,g,h,4))).toEqual([true,false]);
 expect(viewFor(s,'A').abilityOptions.some(o=>o.abilityId==='c2-p03-r2c1-ab02')).toBe(false);
 s=finish(s);
});
