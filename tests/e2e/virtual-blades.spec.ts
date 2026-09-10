import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const [fixture,cancel] of [['virtual-blade-ice',false],['virtual-blade-fire',false],['virtual-blade-ice',true],['virtual-blade-fire',true]] as const)test(`${fixture} cancel=${cancel} declares from UI and survives refresh without a physical source`,async({browser,request})=>{
 const table=await tableFixture(browser,request,fixture);
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,page=table.pages[0]!,name=fixture.endsWith('ice')?'氷刃':'炎刃',hand=[...views.get(a)!.game!.self.hand];
  for(const seat of [1,2,3])await expect(table.pages[seat]!.getByRole('region',{name:'氷刃・炎刃',exact:true})).toHaveCount(0);
  await page.getByRole('combobox',{name:`${name}の対象`,exact:true}).selectOption(b);const rev=views.get(a)!.revision;await page.getByRole('button',{name:`${name}で攻撃する`,exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();await expect(page.getByRole('region',{name:'現在の行動',exact:true})).toContainText(name);
  if(cancel){await passUntil(table,views,g=>g.activeWindow?.pendingActorId===c&&!!g.reactionTargetAbilityId,300);const cancelPage=table.pages[2]!;await cancelPage.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('cancel-ability');await cancelPage.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');const revision=views.get(a)!.revision;await cancelPage.getByRole('button',{name:'割り込みを使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);await page.reload();}
  else{if(fixture.endsWith('ice')){await passUntil(table,views,g=>g.currentRoll?.purpose==='excess-level'&&g.currentRoll.stage==='before-roll',300);await page.reload();}await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense',300);await page.reload();await expect(page.getByRole('region',{name:'現在の行動',exact:true})).toContainText(`${name}`);await expect(page.getByRole('region',{name:'現在の行動',exact:true})).toContainText('魔法技');}
  const done=await passUntil(table,views,g=>!g.activeWindow,300);expect(done.phase).toBe('withdrawal');expect(done.players[b]!.damage).toBe(cancel?0:fixture.endsWith('ice')?3:5);expect(views.get(a)!.game!.self.hand).toEqual(hand);expect(done.discard).toEqual(cancel?['a2-p02-r2c3']:[]);
 }finally{await table.close();}
});
