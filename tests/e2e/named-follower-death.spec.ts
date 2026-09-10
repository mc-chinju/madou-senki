import {expect,test,type Browser,type APIRequestContext} from '@playwright/test';
import {actionCards} from '../../packages/catalog/src/index.js';
import type {NamedDeathScenario} from '../../apps/worker/test/fixtures/named-follower-death-scenario.js';
import {observe,passUntil,tableFixture} from './helpers.js';
async function recover(browser:Browser,request:APIRequestContext,scenario:NamedDeathScenario,name:string){
 const table=await tableFixture(browser,request,scenario);
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,p=table.pages[0]!,card=actionCards.find(c=>c.name===name)!.id,own=()=>views.get(owner)!.game!;
  await passUntil(table,views,()=>own().reclaim?.cardInstanceId===card,300);
  await p.reload();const claim=own().reclaim!.claims.find(c=>c.right==='unlimited')!;expect(claim).toBeDefined();
  let revision=views.get(owner)!.revision;
  await p.getByRole('region',{name:'カードの回収',exact:true}).getByRole('button',{name:claim.label,exact:true}).click();
  await expect.poll(()=>views.get(owner)?.revision).toBeGreaterThan(revision);
  await p.reload();await expect.poll(()=>own().reclaim?.stage).toBe('ability-declaration');
  await passUntil(table,views,()=>own().reservedCards.includes(card),300);
  await p.reload();expect(own().self.hand).not.toContain(card);expect(own().discard).not.toContain(card);
  await passUntil(table,views,g=>!g.activeWindow,300);
  await p.reload();await expect.poll(()=>own().self.hand.filter(c=>c===card).length).toBe(1);
  expect(own().reservedCards).not.toContain(card);expect(own().discard).not.toContain(card);
 }finally{await table.close();}
}
test('Named death Singing Ship returns once across browser reloads',async({browser,request})=>recover(browser,request,'reclaim-named-death-ship','歌う船'));
test('Named death Flying Dragon returns once across browser reloads',async({browser,request})=>recover(browser,request,'reclaim-named-death-dragon','飛竜'));
test('Named death Griffon returns once across browser reloads',async({browser,request})=>recover(browser,request,'reclaim-named-death-griffin','グリフォン'));
test('Named death Skeleton returns once across browser reloads',async({browser,request})=>recover(browser,request,'reclaim-named-death-skeleton','スケルトン'));
test('Named death Zombie returns once across browser reloads',async({browser,request})=>recover(browser,request,'reclaim-named-death-zombie','ゾンビー'));
test('Named death Wight returns once across browser reloads',async({browser,request})=>recover(browser,request,'reclaim-named-death-wight','ワイト'));
test('Named death Death Knight returns once across browser reloads',async({browser,request})=>recover(browser,request,'reclaim-named-death-knight','デス・ナイト'));
