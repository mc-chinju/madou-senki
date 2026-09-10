import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const scenario of ['mandatory-cham-warrior','mandatory-cham-magic','mandatory-conversion-asfelt','mandatory-conversion-garwin'] as const)test(`${scenario} shows saved mandatory values after refresh`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,cham=scenario.startsWith('mandatory-cham-');await table.pages[0]!.reload();await table.pages[1]!.reload();
  if(cham){const expected=scenario==='mandatory-cham-warrior'?2:5;const hit=await passUntil(table,views,g=>g.activeWindow?.kind==='attack-abilities',300);expect(hit.currentAttack!.targets[0]!.hits[0]!.technique!.damage).toBe(expected);await table.pages[0]!.reload();await table.pages[1]!.reload();const done=await passUntil(table,views,g=>!g.activeWindow,300);expect(done.players[b]!.damage).toBe(expected);}
  else{const threshold=views.get(b)!.game!.self.stats.spirit+1;const rolled=await passUntil(table,views,g=>g.activeWindow?.kind==='after-roll',300);expect(rolled.currentRoll).toMatchObject({purpose:'faction-change',threshold});await table.pages[0]!.reload();await table.pages[1]!.reload();await expect(table.pages[1]!.getByText(`判定値: ${threshold}以下`,{exact:true})).toBeVisible();expect(views.get(a)!.game!.currentRoll!.threshold).toBe(threshold);await passUntil(table,views,g=>!g.activeWindow,300);}
 }finally{await table.close();}
});
