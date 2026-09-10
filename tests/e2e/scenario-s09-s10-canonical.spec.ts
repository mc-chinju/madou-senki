import type {Browser,APIRequestContext} from '@playwright/test';
import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
async function verifyScenario(browser:Browser,request:APIRequestContext,mode:'S09'|'S10'){
 const table=await tableFixture(browser,request,mode==='S09'?'canonical-S09':'canonical-S10');try{
 const views=await observe(table),[a,b,c]=table.sessions.map(p=>p.id) as [string,string,string],page=table.pages[1]!,game=()=>views.get(a)!.game!;
 async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);}
 if(mode==='S10')await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).check();
 await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(mode==='S09'?'a2-p12-r1c3':'a2-p11-r1c2');await click(page.getByRole('button',{name:'防御する',exact:true}));await page.reload();
 if(mode==='S10'){
 await passUntil(table,views,g=>g.activeWindow?.kind==='effect-level'&&g.activeWindow.pendingActorId===b,300);await page.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('effect-plus');await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).uncheck();await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p05-r2c3');await click(page.getByRole('button',{name:'割り込みを使う',exact:true}));await page.reload();
 }
 await passUntil(table,views,g=>!g.activeWindow,300);
 expect([game().players[a]!.damage,game().players[b]!.damage,game().players[c]!.damage]).toEqual(mode==='S09'?[0,0,10]:[0,0,0]);if(mode==='S10')expect(game().distances[a]![b]).toBe('far');await page.reload();expect(views.get(b)!.game!.self.hand).not.toContain(mode==='S09'?'a2-p12-r1c3':'a2-p11-r1c2');
 }finally{await table.close();}
}
test('S09 specified physical counter preserves target-local outcome across reload',async({browser,request})=>{await verifyScenario(browser,request,'S09');});
test('S10 specified physical counter preserves target-local outcome across reload',async({browser,request})=>{await verifyScenario(browser,request,'S10');});
