import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const [scenario,dedicated] of [['ice-mirror-magic',false],['ice-mirror-magic',true],['ice-mirror-warrior',true]] as const)test(`${scenario} dedicated=${dedicated} retains its actual check and received-effect result across reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);
 try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!;
  await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p12-r3c2');await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(dedicated);const rev=views.get(a)!.revision;await page.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();
  await passUntil(table,views,g=>!g.activeWindow);await page.reload();const done=views.get(b)!.game!,checks=done.recentRolls.filter(r=>r.purpose==='excess-level');expect(checks).toHaveLength(dedicated?0:1);const success=dedicated||checks[0]!.success;
  expect([done.players[a]!.damage,done.players[b]!.damage]).toEqual(scenario==='ice-mirror-warrior'?[0,0]:success?[5,0]:[0,5]);expect(done.self.hand).not.toContain('a2-p12-r3c2');expect(done.phase).toBe('withdrawal');
 }finally{await table.close();}
});
