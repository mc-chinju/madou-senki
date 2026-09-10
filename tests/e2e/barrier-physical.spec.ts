import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const [scenario,card] of [['barrier-physical-1','a2-p18-r2c2'],['barrier-physical-2','a2-p18-r2c3']] as const)test(`${scenario} actual physical defense preserves its own use check and payment across reloads`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);
 try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!;
  await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(card);const rev=views.get(a)!.revision;await page.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();await passUntil(table,views,g=>g.currentRoll?.purpose==='excess-level'&&g.currentRoll.stage==='after-roll');await page.reload();const roll=structuredClone(views.get(b)!.game!.currentRoll!);expect(roll.threshold).toBe(6);expect(views.get(a)!.game!.currentRoll).not.toHaveProperty('threshold');
  await passUntil(table,views,g=>!g.activeWindow);await page.reload();const done=views.get(b)!.game!;expect([done.players[a]!.damage,done.players[b]!.damage]).toEqual(roll.success?[0,0]:[0,5]);expect(done.self.hand).not.toContain(card);expect(done.recentRolls.find(r=>r.rollId===roll.rollId)).toMatchObject({faces:roll.faces,success:roll.success,threshold:6});expect(done.phase).toBe('withdrawal');
 }finally{await table.close();}
});
