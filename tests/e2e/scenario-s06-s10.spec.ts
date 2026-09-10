import type {Browser,APIRequestContext} from '@playwright/test';
import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
async function verifyScenario(browser:Browser,request:APIRequestContext,mode:'s06'|'s08'|'s09'|'s10'){
 const table=await tableFixture(browser,request,mode==='s10'?'r6-s10-seven':`r6-${mode}`);try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,bp=table.pages[1]!;
 if(mode==='s06'){expect(views.get(b)!.game!.currentAttack!.technique.effectLevel).toBe(6);expect(views.get(a)!.game!.abilityOptions.some(o=>o.abilityId==='c2-p01-r2c1-ab03')).toBe(false);await table.pages[0]!.reload();}
 else if(mode==='s08'||mode==='s09'){const counter=mode==='s08'?'a2-p10-r3c3':'a2-p11-r1c2';if(mode==='s08'){expect(views.get(b)!.game!.recentRolls.some(r=>r.faces.join(',')==='6,6'&&r.success===false)).toBe(true);}else expect(views.get(b)!.game!.currentAttack!.technique.effectLevel).toBe(6);await bp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(counter);if(mode==='s09')await bp.getByRole('checkbox',{name:'剣匠',exact:false}).check();const revision=views.get(a)!.revision;await bp.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);await bp.reload();if(mode==='s09'){await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense'&&g.activeWindow.pendingActorId===c,300);expect(views.get(c)!.game!.currentAttack!.technique.effectLevel).toBe(6);await table.pages[2]!.reload();}}
 else {expect(views.get(b)!.game!.actionCalculation).toMatchObject({effectLevel:7,calculation:{effectLevel:'final'}});await bp.reload();}
 await passUntil(table,views,g=>!g.activeWindow,300);await bp.reload();const done=views.get(b)!.game!;expect([done.players[a]!.damage,done.players[b]!.damage,done.players[c]!.damage]).toEqual(mode==='s06'?[0,5,0]:mode==='s08'?[5,0,0]:mode==='s09'?[0,0,12]:[0,0,0]);expect(done.phase).toBe('withdrawal');}finally{await table.close();}
}
test('S06-S10 s06 real defense continuation retains exact outcome across reload',async({browser,request})=>{await verifyScenario(browser,request,'s06');});
test('S06-S10 s08 real defense continuation retains exact outcome across reload',async({browser,request})=>{await verifyScenario(browser,request,'s08');});
test('S06-S10 s09 real defense continuation retains exact outcome across reload',async({browser,request})=>{await verifyScenario(browser,request,'s09');});
test('S06-S10 s10 real defense continuation retains exact outcome across reload',async({browser,request})=>{await verifyScenario(browser,request,'s10');});
