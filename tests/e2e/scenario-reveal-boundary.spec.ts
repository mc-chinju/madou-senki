import type {Browser,APIRequestContext} from '@playwright/test';
import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';
async function verifyScenario(browser:Browser,request:APIRequestContext,scenario:'canonical-S15-before'|'canonical-S15-after'|'canonical-S16'){
 const table=await tableFixture(browser,request,scenario);try{
 const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!,zero=scenario==='canonical-S16';expect(views.get(a)!.game!.players[b]!.revealed).toBe(false);
 await page.reload();if(!zero){const revision=views.get(a)!.revision;await page.getByRole('button',{name:'正体を公開',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);await page.reload();}
 else expect(views.get(a)!.game!.currentAttack!.technique.damage).toBe(0);
 await passUntil(table,views,g=>!g.activeWindow,300);await page.reload();const game=views.get(a)!.game!;expect(game.players[b]!.revealed).toBe(true);expect(game.players[b]!.damage).toBe(scenario==='canonical-S15-after'?4:0);expect((await storedDiscard()).filter(id=>id===(zero?'a2-p08-r3c3':'a2-p24-r1c2'))).toHaveLength(1);
 }finally{await table.close();}
}
test('canonical-S15-before reveal timing and numeric zero remain correct after reload',async({browser,request})=>{await verifyScenario(browser,request,'canonical-S15-before');});
test('canonical-S15-after reveal timing and numeric zero remain correct after reload',async({browser,request})=>{await verifyScenario(browser,request,'canonical-S15-after');});
test('canonical-S16 reveal timing and numeric zero remain correct after reload',async({browser,request})=>{await verifyScenario(browser,request,'canonical-S16');});
