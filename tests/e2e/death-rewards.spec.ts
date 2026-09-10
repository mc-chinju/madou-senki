import {expect,test} from '@playwright/test';
import {getAction} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const scenario of ['death-reward-dia','death-reward-hunger','cham-death-gift'] as const)for(const choice of ['use','decline','cancel'] as const)test(`${scenario} ${choice} survives reload during declaration and result`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);try{
  const views=await observe(table),[a,b,c,d]=table.sessions.map(s=>s.id) as [string,string,string,string],cham=scenario==='cham-death-gift',page=table.pages[cham?1:0]!,gift=views.get(b)!.game!.self.hand.find(id=>getAction(id)!.name==='香具羅')!;await page.reload();
  if(choice!=='decline'){
   const revision=views.get(a)!.revision;
   if(cham){await page.getByRole('combobox',{name:'能力で託す手札',exact:true}).selectOption(gift);await page.getByRole('combobox',{name:'能力で託す相手',exact:true}).selectOption(c);await page.getByRole('button',{name:'能力で手札を託す',exact:true}).click();}
   else await page.getByRole('button',{name:scenario==='death-reward-dia'?'吸魂を使う':'飢えを使う',exact:true}).click();
   await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);await page.reload();expect(views.get(a)!.game!.outcome).toBeNull();
   if(choice==='cancel'){await passUntil(table,views,g=>g.activeWindow?.pendingActorId===c,300);const cancel=table.pages[2]!;await cancel.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('cancel-ability');await cancel.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');const rev=views.get(a)!.revision;await cancel.getByRole('button',{name:'割り込みを使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);}
  }
  await passUntil(table,views,g=>!g.activeWindow,300);await page.reload();await table.pages[2]!.reload();expect(views.get(a)!.game!.players[b]!.presence).toBe('dead');
  if(cham){expect(views.get(c)!.game!.self.hand.includes(gift)).toBe(choice==='use');if(choice==='use'){for(const actor of [a,d])expect(JSON.stringify(views.get(actor))).not.toContain(gift);for(const actor of [b,c])expect(views.get(actor)!.game!.privateLogs.some(e=>e.type==='CARD_GIFTED'&&e.cardInstanceId===gift)).toBe(true);}}
  else expect(views.get(a)!.game!.players[a]!.damage).toBe(choice==='use'?(scenario==='death-reward-dia'?5:0):8);
 }finally{await table.close();}
});
