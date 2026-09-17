import {expect,test,type Browser,type APIRequestContext} from '@playwright/test';
import {actionCards} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';
async function recover(browser:Browser,request:APIRequestContext,name:string){
 const table=await tableFixture(browser,request,'reclaim-ordinary-follower-death');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,p=table.pages[0]!,card=actionCards.find(c=>c.name===name)!.id,own=()=>views.get(owner)!.game!;
  await passUntil(table,views,()=>own().reclaim?.cardInstanceId===card,300);
  await p.reload();const revealRevision=views.get(owner)!.revision;await p.getByRole('button',{name:'正体を公開',exact:true}).click();await expect.poll(()=>views.get(owner)?.revision).toBeGreaterThan(revealRevision);await p.reload();const claim=own().reclaim!.claims.find(c=>c.right==='base')!;expect(claim).toBeDefined();
  let revision=views.get(owner)!.revision;
  await p.getByRole('region',{name:'カードの回収',exact:true}).getByRole('button',{name:claim.label,exact:true}).click();
  await expect.poll(()=>views.get(owner)?.revision).toBeGreaterThan(revision);
  await passUntil(table,views,()=>own().reservedCards.includes(card),300);
  await p.reload();expect(own().self.hand).not.toContain(card);expect((await storedDiscard())).not.toContain(card);
  await passUntil(table,views,g=>!g.activeWindow,300);
  await p.reload();await expect.poll(()=>own().self.hand.filter(c=>c===card).length).toBe(1);
  expect(own().reservedCards).not.toContain(card);expect((await storedDiscard())).not.toContain(card);
  for(const [seat,page] of table.pages.entries()){await page.reload();const g=views.get(table.sessions[seat]!.id)!.game!;expect(g.self.hand.filter(id=>id===card)).toHaveLength(seat===0?1:0);expect(g.players[owner]!.followers).toEqual([]);expect(g.reservedCards).toEqual([]);expect(g.reclaim).toBeNull();}
 }finally{await table.close();}
}
test('Actual placed follower ordinary recovery returns once after all-seat browser reload',async({browser,request})=>recover(browser,request,'女神官のシャリア'));
