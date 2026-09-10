import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';

test('Actual Rift banishment keeps the owners prayer reserved across reload then returns it once while absent',async({browser,request})=>{
 const table=await tableFixture(browser,request,'lia-prayer-otherworld');
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!,prayer='a2-p05-r2c3';
  await page.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('effect-plus');
  await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).check();
  await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(prayer);
  const revision=views.get(a)!.revision;
  await page.getByRole('button',{name:'割り込みを使う',exact:true}).click();
  await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);
  await passUntil(table,views,()=>views.get(b)!.game!.reservedCards.includes(prayer),300);
  await page.reload();
  expect(views.get(b)!.game!.self.hand).not.toContain(prayer);
  await passUntil(table,views,()=>views.get(b)!.game!.players[b]!.presence==='otherworld',300);
  expect(views.get(b)!.game!.reservedCards).toContain(prayer);
  for(const p of table.pages)await p.reload();
  expect(views.get(b)!.game!.self.hand).not.toContain(prayer);
  await passUntil(table,views,g=>!g.activeWindow,300);
  await page.reload();
  expect(views.get(b)!.game!.players[b]!.presence).toBe('otherworld');
  expect(views.get(b)!.game!.self.hand.filter(id=>id===prayer)).toHaveLength(1);
  expect(views.get(b)!.game!.reservedCards).toEqual([]);
  for(const session of table.sessions.filter(s=>s.id!==b))expect(views.get(session.id)!.game!.self.hand).not.toContain(prayer);
 }finally{await table.close();}
});
