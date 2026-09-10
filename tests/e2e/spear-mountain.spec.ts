import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const [scenario,card,dedicated] of [['spear-ordinary','a2-p10-r3c3',false],['spear-dedicated','a2-p10-r3c3',true],['mountain-ordinary','a2-p11-r1c2',false],['mountain-dedicated','a2-p11-r1c2',true]] as const)test(`${scenario} actual defense selection preserves its check and returned damage across reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);
 try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[1]!;
  await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(card);await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(dedicated);const rev=views.get(b)!.revision;await page.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(b)?.revision).toBeGreaterThan(rev);await page.reload();let success=true;
  if(scenario!=='mountain-dedicated'){await passUntil(table,views,g=>g.activeWindow?.kind==='after-roll');await page.reload();const roll=views.get(b)!.game!.currentRoll!;expect(roll.purpose).toBe(scenario==='spear-dedicated'?'counter':'excess-level');expect(roll.faces).toHaveLength(2);success=roll.success!;}
  await passUntil(table,views,g=>!g.activeWindow);await page.reload();const done=views.get(b)!.game!;expect([done.players[a]!.damage,done.players[b]!.damage]).toEqual(success?[dedicated?7:scenario.startsWith('spear')?5:4,0]:[0,4]);expect(done.self.hand).not.toContain(card);expect(done.phase).toBe('withdrawal');
 }finally{await table.close();}
});
