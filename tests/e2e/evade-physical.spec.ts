import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const [scenario,card] of [['evade-physical-1','a2-p05-r3c1'],['evade-physical-2','a2-p05-r3c2'],['evade-physical-3','a2-p05-r3c3']] as const)test(`${scenario} spends its exact defense and preserves remaining actual hits across reloads`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);
 try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!;
  expect(views.get(b)!.game!.self.hand).toContain(card);expect(views.get(a)!.game!.currentAttack).toMatchObject({targetId:b,technique:{damage:7}});
  await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(card);const rev=views.get(a)!.revision;await page.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();expect(views.get(b)!.game!.self.hand).not.toContain(card);expect(views.get(a)!.game!.currentAction).toMatchObject({cardInstanceId:card,kind:'defense'});
  await passUntil(table,views,g=>!g.activeWindow);await page.reload();await table.pages[0]!.reload();expect(views.get(b)!.game!.players[b]!.damage).toBe(14);expect(views.get(b)!.game!.self.hand).not.toContain(card);expect(views.get(a)!.game!.phase).toBe('withdrawal');
 }finally{await table.close();}
});
