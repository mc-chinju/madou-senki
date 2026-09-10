import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
import {getAction} from '../../packages/catalog/src/index.js';
for(const [fixture,cancel] of [['r5-distance-approach',false],['r5-distance-withdrawal',false],['r5-distance-approach',true],['r5-distance-withdrawal',true]] as const)test(`${fixture} exchange cancel=${cancel} selects ability and restores partial response after refresh`,async({browser,request})=>{
 const table=await tableFixture(browser,request,fixture);
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,withdraw=fixture.endsWith('withdrawal'),ownerSeat=withdraw?0:1,otherSeat=withdraw?1:0,owner=table.sessions[ownerSeat]!.id,other=table.sessions[otherSeat]!.id,page=table.pages[ownerSeat]!,advancePage=table.pages[otherSeat]!,abilityId=withdraw?'c2-p02-r1c1-ab01':'c2-p01-r2c2-ab01',kind=withdraw?'withdrawal':'approach';
  const maai=views.get(owner)!.game!.self.hand.find(id=>getAction(id)?.name==='間合い／休息')!,advances=views.get(other)!.game!.self.hand.filter(id=>getAction(id)?.name==='踏み込み／蹴る');
  async function click(seat:number,label:string){const rev=views.get(a)!.revision;await table.pages[seat]!.getByRole('button',{name:label,exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);}
  if(withdraw){await page.getByRole('region',{name:'自分の手札',exact:true}).getByRole('button',{name:'間合い／休息',exact:true}).click();await page.getByRole('region',{name:'参加者の公開状態'}).locator('article').nth(1).getByRole('checkbox',{name:'対象に選ぶ'}).check();await page.getByRole('combobox',{name:'離脱の間合いに添える能力',exact:true}).selectOption(abilityId);await click(ownerSeat,'離脱');}
  else{await page.getByRole('combobox',{name:'間合いに添える能力',exact:true}).selectOption(abilityId);await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(maai);await click(ownerSeat,'間合いを使う');}
  await page.reload();
  if(cancel){await passUntil(table,views,g=>g.activeWindow?.pendingActorId===c&&!!g.reactionTargetAbilityId,300);const cancelPage=table.pages[2]!;await cancelPage.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('cancel-ability');await cancelPage.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');await click(2,'割り込みを使う');}
  await passUntil(table,views,g=>g.activeWindow?.kind===kind,300);await advancePage.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(advances[0]!);await click(otherSeat,'踏み込みを使う');await advancePage.reload();await page.reload();
  await expect(advancePage.getByRole('region',{name:'接近・離脱の応酬',exact:true})).toContainText(`1 / ${cancel?1:2}枚`);expect(views.get(other)!.game!.activeWindow!.pendingActorId).toBe(cancel?owner:other);
  if(!cancel){await advancePage.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(advances[1]!);await click(otherSeat,'踏み込みを使う');}
  const done=await passUntil(table,views,g=>!g.activeWindow,300);expect(done.distances[a]![b]).toBe('near');expect(done.discard.filter(id=>id===maai)).toHaveLength(1);if(cancel)expect(views.get(other)!.game!.self.hand).toContain(advances[1]);if(!withdraw)expect(done.distanceMarkers[0]!.cardInstanceId).toBe(advances[cancel?0:1]);
 }finally{await table.close();}
});
for(const choice of ['select','decline','cancel'] as const)test(`Tia earth defense ${choice} is private and resumes after browser refresh`,async({browser,request})=>{
 const table=await tableFixture(browser,request,'r5-distance-earth');
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,page=table.pages[1]!;
  const button=page.getByRole('button',{name:'飛翔を使う',exact:true});await expect(button).toBeEnabled();
  for(const seat of [0,2,3])expect(JSON.stringify(views.get(table.sessions[seat]!.id)!.game)).not.toContain('c2-p02-r1c1-ab01');
  if(choice!=='decline'){
   const revision=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);await page.reload();
   if(choice==='cancel'){
    await passUntil(table,views,g=>g.activeWindow?.pendingActorId===c&&!!g.reactionTargetAbilityId,300);
    const cancel=table.pages[2]!;await cancel.reload();await cancel.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('cancel-ability');await cancel.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');
    const rev=views.get(a)!.revision;await cancel.getByRole('button',{name:'割り込みを使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);
    await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense',300);await page.reload();await expect(button).toHaveCount(0);
   }
  }else await page.reload();
  const done=await passUntil(table,views,g=>!g.activeWindow,300);expect(done.players[b]!.damage).toBe(choice==='select'?0:6);expect(done.discard.filter(id=>id==='a2-p16-r2c3')).toHaveLength(1);
 }finally{await table.close();}
});
for(const [fixture,cancel] of [['r5-distance-cham',false],['r5-distance-tia',false],['r5-distance-lancaster',false],['r5-distance-cham',true]] as const)test(`${fixture} canceled=${cancel} elected maai persists its first advance across refresh`,async({browser,request})=>{
 const table=await tableFixture(browser,request,fixture);
 try{
  const views=await observe(table),a=table.sessions[0]!.id,lancaster=fixture.endsWith('lancaster'),defenseSeat=lancaster?0:1,attackSeat=lancaster?1:0,defender=table.sessions[defenseSeat]!.id,attacker=table.sessions[attackSeat]!.id,abilityId=lancaster?'c2-p02-r2c1-ab03':fixture.endsWith('cham')?'c2-p01-r2c2-ab01':'c2-p02-r1c1-ab01';
  const defense=table.pages[defenseSeat]!,attack=table.pages[attackSeat]!,maai=views.get(defender)!.game!.self.hand.find(id=>getAction(id)?.name==='間合い／休息')!,advances=views.get(attacker)!.game!.self.hand.filter(id=>getAction(id)?.name==='踏み込み／蹴る');
  for(const seat of [0,1,2,3].filter(i=>i!==defenseSeat)){expect(views.get(table.sessions[seat]!.id)!.game!.maaiAbilityOptions).toEqual([]);expect(JSON.stringify(views.get(table.sessions[seat]!.id)!.game)).not.toContain(abilityId);}
  await defense.getByRole('combobox',{name:'間合いに添える能力',exact:true}).selectOption(abilityId);await defense.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(maai);
  async function click(seat:number,label:string){const rev=views.get(a)!.revision;await table.pages[seat]!.getByRole('button',{name:label,exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);}
  await click(defenseSeat,'間合いを使う');await defense.reload();
  if(cancel){const c=table.sessions[2]!.id;await passUntil(table,views,g=>g.activeWindow?.pendingActorId===c&&!!g.reactionTargetAbilityId,400);const page=table.pages[2]!;await page.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('cancel-ability');await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');await click(2,'割り込みを使う');await defense.reload();await passUntil(table,views,g=>g.activeWindow?.kind==='defense-advance',400);await attack.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(advances[0]!);await click(attackSeat,'踏み込みを使う');const done=await passUntil(table,views,g=>!g.activeWindow,400);expect(done.players[defender]!.damage).toBe(4);expect(views.get(attacker)!.game!.self.hand).toContain(advances[1]);expect(done.discard.filter(id=>id===maai)).toHaveLength(1);return;}
  if(lancaster){const done=await passUntil(table,views,g=>!g.activeWindow,400);expect(done.players[defender]!.damage).toBe(0);expect(views.get(attacker)!.game!.self.hand).toEqual(expect.arrayContaining(advances));return;}
  await passUntil(table,views,g=>g.activeWindow?.kind==='defense-advance',400);
  await attack.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(advances[0]!);await click(attackSeat,'踏み込みを使う');await passUntil(table,views,g=>g.activeWindow?.kind==='defense-advance',400);
  await attack.reload();await defense.reload();await expect(attack.getByRole('region',{name:'間合いの状況',exact:true})).toContainText('間合い1枚を打ち消すには踏み込み2枚');expect(views.get(attacker)!.game!.maaiDefense).toMatchObject({sharedAdvances:1,targets:[{effective:1}]});
  await attack.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(advances[1]!);await click(attackSeat,'踏み込みを使う');const done=await passUntil(table,views,g=>!g.activeWindow,400);expect(done.players[defender]!.damage).toBe(4);for(const id of [maai,...advances])expect(done.discard.filter(x=>x===id)).toHaveLength(1);
 }finally{await table.close();}
});
