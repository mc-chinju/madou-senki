import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';

test('Prayer reserved by its living owner is discarded after actual owner death across reloads',async({browser,request})=>{
 const table=await tableFixture(browser,request,'lia-prayer-fatal');
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!,prayer='a2-p05-r2c3';
  await page.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('effect-plus');
  await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).check();
  await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(prayer);
  const revision=views.get(a)!.revision;
  await page.getByRole('button',{name:'割り込みを使う',exact:true}).click();
  await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);
  await passUntil(table,views,()=>views.get(b)!.game!.reservedCards.includes(prayer),300);
  await page.reload();expect(views.get(b)!.game!.self.hand).not.toContain(prayer);
  await passUntil(table,views,g=>g.players[b]!.presence==='pending-death',300);
  await page.reload();expect(views.get(b)!.game!.reservedCards).toContain(prayer);
  expect(views.get(b)!.game!.outcome).toBeNull();
  await passUntil(table,views,g=>!g.activeWindow,300);
  await page.reload();
  const done=views.get(b)!.game!;expect(done.players[b]!.presence).toBe('dead');
  expect(done.reservedCards).toEqual([]);expect(done.self.hand).not.toContain(prayer);
  expect((await storedDiscard()).filter(id=>id===prayer)).toHaveLength(1);
 }finally{await table.close();}
});
