import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
test('Actual Lester Courage base selection survives browser reload and returns once',async({browser,request})=>{
 const right='base' as 'base'|'printed';
 const table=await tableFixture(browser,request,'shared-a09-self');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,page=table.pages[0]!;
  async function click(button:Locator){const revision=views.get(owner)!.revision;await button.click();await expect.poll(()=>views.get(owner)?.revision).toBeGreaterThan(revision);}
  const panel=page.getByRole('region',{name:'カードの回収'});
  await click(page.getByRole('button',{name:'正体を公開',exact:true}));await page.reload();
  expect(views.get(owner)!.game!.reclaim!.claims.map(c=>c.right).sort()).toEqual(['base','printed']);
  const claim=views.get(owner)!.game!.reclaim!.claims.find(c=>c.right===right)!;
  await click(panel.getByRole('button',{name:claim.label,exact:true}));
  if(right==='printed'){
   await page.reload();await passUntil(table,views,g=>g.reclaim?.stage==='beneficiary-choice');
   await page.reload();expect(views.get(owner)!.game!.reclaim!.claims.map(c=>c.right)).toEqual(['printed']);
   await click(panel.getByRole('button',{name:'勇気を回収する',exact:true}));
  }
  await page.reload();await passUntil(table,views,g=>!g.activeWindow,200);
  for(const p of table.pages)await p.reload();
  const done=views.get(owner)!.game!;
  expect(done.self.hand.filter(id=>id==='a2-p01-r3c3')).toHaveLength(1);
  expect(done.discard).not.toContain('a2-p01-r3c3');expect(done.reservedCards).toEqual([]);
  expect(done.recentRolls.filter(r=>r.purpose==='activation'&&r.rollerId===owner)).toHaveLength(right==='printed'?1:0);
  for(const session of table.sessions.slice(1))expect(views.get(session.id)!.game!.self.hand).not.toContain('a2-p01-r3c3');
 }finally{await table.close();}
});
test('Actual Lester Courage printed selection survives browser reload and returns once',async({browser,request})=>{
 const right='printed' as 'base'|'printed';
 const table=await tableFixture(browser,request,'shared-a09-self');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,page=table.pages[0]!;
  async function click(button:Locator){const revision=views.get(owner)!.revision;await button.click();await expect.poll(()=>views.get(owner)?.revision).toBeGreaterThan(revision);}
  const panel=page.getByRole('region',{name:'カードの回収'});
  await click(page.getByRole('button',{name:'正体を公開',exact:true}));await page.reload();
  expect(views.get(owner)!.game!.reclaim!.claims.map(c=>c.right).sort()).toEqual(['base','printed']);
  const claim=views.get(owner)!.game!.reclaim!.claims.find(c=>c.right===right)!;
  await click(panel.getByRole('button',{name:claim.label,exact:true}));
  if(right==='printed'){
   await page.reload();await passUntil(table,views,g=>g.reclaim?.stage==='beneficiary-choice');
   await page.reload();expect(views.get(owner)!.game!.reclaim!.claims.map(c=>c.right)).toEqual(['printed']);
   await click(panel.getByRole('button',{name:'勇気を回収する',exact:true}));
  }
  await page.reload();await passUntil(table,views,g=>!g.activeWindow,200);
  for(const p of table.pages)await p.reload();
  const done=views.get(owner)!.game!;
  expect(done.self.hand.filter(id=>id==='a2-p01-r3c3')).toHaveLength(1);
  expect(done.discard).not.toContain('a2-p01-r3c3');expect(done.reservedCards).toEqual([]);
  expect(done.recentRolls.filter(r=>r.purpose==='activation'&&r.rollerId===owner)).toHaveLength(right==='printed'?1:0);
  for(const session of table.sessions.slice(1))expect(views.get(session.id)!.game!.self.hand).not.toContain('a2-p01-r3c3');
 }finally{await table.close();}
});
