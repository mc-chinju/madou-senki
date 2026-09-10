import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const [scenario,card] of [['teleport-physical-1','a2-p06-r1c1'],['teleport-physical-2','a2-p06-r1c2']] as const)for(const dedicated of [false,true])test(`${scenario} optional plus1=${dedicated} persists its actual check and result across reloads`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);
 try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!;
  expect(views.get(b)!.game!.self.stats.spirit).toBe(6);await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(card);await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(dedicated);const rev=views.get(a)!.revision;await page.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();
  await passUntil(table,views,g=>g.currentRoll?.purpose==='teleport'&&g.currentRoll.stage==='after-roll');await page.reload();const roll=structuredClone(views.get(b)!.game!.currentRoll!);expect(roll).toMatchObject({threshold:dedicated?7:6,modifier:dedicated?1:0});expect(views.get(b)!.game!.self.stats.spirit).toBe(6);expect(views.get(a)!.game!.currentRoll).not.toHaveProperty('threshold');
  await passUntil(table,views,g=>!g.activeWindow);await page.reload();expect(views.get(b)!.game!.players[b]!.damage).toBe(roll.success?0:4);expect(views.get(b)!.game!.self.stats.spirit).toBe(6);expect(views.get(b)!.game!.self.hand).not.toContain(card);expect(views.get(b)!.game!.recentRolls.find(r=>r.rollId===roll.rollId)).toMatchObject({faces:roll.faces,threshold:roll.threshold,success:roll.success});
 }finally{await table.close();}
});
