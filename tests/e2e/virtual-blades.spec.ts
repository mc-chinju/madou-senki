import {expect,test,type Browser,type APIRequestContext} from '@playwright/test';
import {actionCards} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';
async function verifyBlade(browser:Browser,request:APIRequestContext,fixture:'virtual-blade-ice'|'virtual-blade-fire',cancel:boolean){
 const table=await tableFixture(browser,request,fixture);
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,page=table.pages[0]!,name=fixture.endsWith('ice')?'氷刃':'炎刃',hand=[...views.get(a)!.game!.self.hand];
  const hands=table.sessions.map(session=>[...views.get(session.id)!.game!.self.hand]);
  for(const seat of [1,2,3])await expect(table.pages[seat]!.getByRole('region',{name:'氷刃・炎刃',exact:true})).toHaveCount(0);
  await page.getByRole('combobox',{name:`${name}の対象`,exact:true}).selectOption(b);const rev=views.get(a)!.revision;await page.getByRole('button',{name:`${name}で攻撃する`,exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();await expect(page.getByRole('region',{name:'現在の行動',exact:true})).toContainText(name);
  if(cancel){await passUntil(table,views,g=>g.activeWindow?.pendingActorId===c&&!!g.reactionTargetAbilityId,300);const cancelPage=table.pages[2]!;await cancelPage.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('cancel-ability');await cancelPage.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');const revision=views.get(a)!.revision;await cancelPage.getByRole('button',{name:'割り込みを使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);await page.reload();}
  else{if(fixture.endsWith('ice')){await passUntil(table,views,g=>g.currentRoll?.purpose==='excess-level'&&g.currentRoll.stage==='before-roll',300);await page.reload();}await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense',300);await page.reload();await expect(page.getByRole('region',{name:'現在の行動',exact:true})).toContainText(`${name}`);await expect(page.getByRole('region',{name:'現在の行動',exact:true})).toContainText('魔法技');}
  const done=await passUntil(table,views,g=>!g.activeWindow,300);expect(done.phase).toBe('withdrawal');expect(done.players[b]!.damage).toBe(cancel?0:fixture.endsWith('ice')?3:5);expect(views.get(a)!.game!.self.hand).toEqual(hand);expect((await storedDiscard())).toEqual(cancel?['a2-p02-r2c3']:[]);
  for(const [seat,p] of table.pages.entries()){await p.reload();const own=views.get(table.sessions[seat]!.id)!.game!;if(cancel&&seat===2){expect(own.self.hand).toHaveLength(hands[seat]!.length);expect(own.self.hand).not.toContain('a2-p02-r2c3');expect(own.self.hand).toEqual(expect.arrayContaining(hands[seat]!.filter(id=>id!=='a2-p02-r2c3')));expect(own.self.hand.every(id=>actionCards.some(card=>card.id===id))).toBe(true);}else expect(own.self.hand).toEqual(hands[seat]);expect(own.reservedCards).toEqual([]);expect(own.reclaim).toBeNull();}
 }finally{await table.close();}
}
test('virtual-blade-ice cancel=false declares from UI and survives refresh without a physical source',async({browser,request})=>{await verifyBlade(browser,request,'virtual-blade-ice',false);});
