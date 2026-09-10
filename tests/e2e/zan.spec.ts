import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const choice of ['select','decline','cancel','maai'] as const)test(`Zan ${choice} retains maai history and target damage after refresh`,async({browser,request})=>{
 const table=await tableFixture(browser,request,choice==='maai'?'zan-maai':'zan');
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,page=table.pages[0]!,button=page.getByRole('button',{name:'斬を使う',exact:true});for(const seat of [1,2,3])expect(JSON.stringify(views.get(table.sessions[seat]!.id)!.game)).not.toContain('c2-p04-r1c2-ab02');await page.reload();
  if(choice==='maai')await expect(button).toHaveCount(0);else{await expect(button).toBeEnabled();if(choice!=='decline'){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();if(choice==='cancel'){await passUntil(table,views,g=>g.activeWindow?.pendingActorId===c,300);const cancel=table.pages[2]!;await cancel.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('cancel-ability');await cancel.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');const revision=views.get(a)!.revision;await cancel.getByRole('button',{name:'割り込みを使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);}}}
  await passUntil(table,views,g=>g.activeWindow?.kind==='follower-start',300);await page.reload();await table.pages[1]!.reload();expect(views.get(b)!.game!.currentAttack!.targets[0]!.hits[0]!.technique!.damage).toBe(choice==='select'?10:5);const done=await passUntil(table,views,g=>!g.activeWindow,300);expect(done.players[b]!.damage).toBe(choice==='select'?10:5);expect(done.phase).toBe('withdrawal');
 }finally{await table.close();}
});
