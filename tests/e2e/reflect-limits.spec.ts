import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const [scenario,card,dedicated] of [['reflect-limit-mirror','a2-p11-r1c3',false],['reflect-limit-mirror','a2-p11-r1c3',true],['reflect-limit-god','a2-p17-r3c2',false]] as const)test(`${scenario} dedicated=${dedicated} actual defense and Prayer keep received damage after reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);
 try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!;
  await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(card);await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(dedicated);let rev=views.get(a)!.revision;await page.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();
  await passUntil(table,views,g=>g.activeWindow?.kind==='effect-level'&&g.activeWindow.pendingActorId===b);await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p05-r2c3');await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).uncheck();rev=views.get(a)!.revision;await page.getByRole('button',{name:'割り込みを使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();await passUntil(table,views,g=>!g.activeWindow);await page.reload();const done=views.get(b)!.game!;expect([done.players[a]!.damage,done.players[b]!.damage]).toEqual([5,0]);expect(done.self.hand).not.toContain(card);expect(done.self.hand).not.toContain('a2-p05-r2c3');expect(done.phase).toBe('withdrawal');
 }finally{await table.close();}
});
