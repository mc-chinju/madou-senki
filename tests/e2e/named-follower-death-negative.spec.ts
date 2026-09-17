import {expect,test,type Browser,type APIRequestContext,type Locator} from '@playwright/test';
import {actionCards} from '../../packages/catalog/src/index.js';
import type {NamedDeathScenario,NamedDeathNegativeScenario} from '../../apps/worker/test/fixtures/named-follower-death-scenario.js';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';
async function exercise(browser:Browser,request:APIRequestContext,scenario:NamedDeathScenario|NamedDeathNegativeScenario,name:string,mode:'decline'|'cancel'|'ban'){
 const table=await tableFixture(browser,request,scenario);
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,p=table.pages[0]!,card=actionCards.find(c=>c.name===name)!.id,own=()=>views.get(owner)!.game!;
  async function click(button:Locator){const revision=views.get(owner)!.revision;await button.click();await expect.poll(()=>views.get(owner)?.revision).toBeGreaterThan(revision);}
  await passUntil(table,views,()=>own().reclaim?.cardInstanceId===card,300);await p.reload();
  const claim=own().reclaim!.claims.find(c=>c.right==='unlimited')!,panel=p.getByRole('region',{name:'カードの回収',exact:true});
  await click(panel.getByRole('button',{name:mode==='decline'?'回収せずに進む':claim.label,exact:true}));await p.reload();
  if(mode!=='decline'){
   const index=mode==='cancel'?1:2,actor=table.sessions[index]!.id,respondent=table.pages[index]!;
   await passUntil(table,views,g=>g.activeWindow?.pendingActorId===actor,300);await respondent.reload();
   if(mode==='cancel'){
    await respondent.getByLabel('割り込み効果').selectOption('cancel-ability');await respondent.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');
    await click(respondent.getByRole('button',{name:'割り込みを使う',exact:true}));
   }else{
    const ban=respondent.getByRole('region',{name:'能力の禁止と祝福'});
    await ban.getByRole('checkbox',{name:own().players[owner]!.name,exact:true}).check();
    await click(ban.getByRole('button',{name:'神と人の差を使う',exact:true}));
   }
   await respondent.reload();
  }
  await passUntil(table,views,g=>!g.activeWindow,300);await p.reload();
  await expect.poll(async()=>(await storedDiscard()).filter(c=>c===card).length).toBe(1);expect(own().self.hand).not.toContain(card);expect(own().reservedCards).not.toContain(card);
 }finally{await table.close();}
}
test('Named death ship decline stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-ship','歌う船','decline'));
test('Named death ship cancel stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-ship-cancel','歌う船','cancel'));
test('Named death ship ban stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-ship-ban','歌う船','ban'));
test('Named death dragon decline stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-dragon','飛竜','decline'));
test('Named death dragon cancel stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-dragon-cancel','飛竜','cancel'));
test('Named death dragon ban stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-dragon-ban','飛竜','ban'));
test('Named death griffin decline stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-griffin','グリフォン','decline'));
test('Named death griffin cancel stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-griffin-cancel','グリフォン','cancel'));
test('Named death griffin ban stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-griffin-ban','グリフォン','ban'));
test('Named death skeleton decline stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-skeleton','スケルトン','decline'));
test('Named death skeleton cancel stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-skeleton-cancel','スケルトン','cancel'));
test('Named death skeleton ban stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-skeleton-ban','スケルトン','ban'));
test('Named death zombie decline stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-zombie','ゾンビー','decline'));
test('Named death zombie cancel stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-zombie-cancel','ゾンビー','cancel'));
test('Named death zombie ban stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-zombie-ban','ゾンビー','ban'));
test('Named death wight decline stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-wight','ワイト','decline'));
test('Named death wight cancel stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-wight-cancel','ワイト','cancel'));
test('Named death wight ban stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-wight-ban','ワイト','ban'));
test('Named death knight decline stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-knight','デス・ナイト','decline'));
test('Named death knight cancel stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-knight-cancel','デス・ナイト','cancel'));
test('Named death knight ban stays discarded after browser reload',async({browser,request})=>exercise(browser,request,'reclaim-named-death-knight-ban','デス・ナイト','ban'));
