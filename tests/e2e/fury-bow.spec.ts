import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';

test('Fury keeps two visible bow rolls and hidden source through two-client refresh and reroll',async({browser,request})=>{
 test.setTimeout(120_000);
 const table=await tableFixture(browser,request,'value-fury');
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,page=table.pages[0]!,other=table.pages[1]!;
  const ability='c2-p02-r1c2-ab03',base=views.get(a)!.game!.actionCalculation!;
  expect(JSON.stringify(views.get(b)!.game)).not.toContain(ability);
  const revision=views.get(a)!.revision;await page.getByRole('button',{name:'妖精の弓を使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);
  const before=await passUntil(table,views,g=>g.currentRoll?.purpose==='ability-value'&&g.currentRoll.stage==='before-roll',400);
  const effectId=before.currentRoll!.rollId;
  await page.reload();await other.reload();
  await expect(page.getByRole('region',{name:'サイコロの結果',exact:true})).toContainText('まだ振っていません');
  await passUntil(table,views,g=>g.currentRoll?.rollId===effectId&&g.currentRoll.stage==='after-roll'&&g.activeWindow?.pendingActorId===c,400);
  const panel=table.pages[2]!.getByRole('complementary',{name:'現在の判断'});
  await expect(panel.locator('option[value="force-fail"]')).toHaveCount(0);
  await panel.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('reroll');await panel.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r1c3');
  const rev=views.get(a)!.revision;await panel.getByRole('button',{name:'割り込みを使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);
  const rerolled=(await passUntil(table,views,g=>g.currentRoll?.rollId===effectId&&g.currentRoll.generation===1,400)).currentRoll!;expect(rerolled.attempts).toHaveLength(2);
  const frozen=await passUntil(table,views,g=>g.activeWindow?.kind==='damage',400);expect(frozen.actionCalculation).toMatchObject({effectLevel:base.effectLevel+rerolled.total!,calculation:{effectLevel:'final',damage:'pending'}});
  await page.reload();await other.reload();
  const damageBefore=(await passUntil(table,views,g=>g.currentRoll?.purpose==='ability-value'&&g.currentRoll.stage==='before-roll',400)).currentRoll!;expect(damageBefore.rollId).not.toBe(effectId);
  await page.reload();await other.reload();
  const damage=(await passUntil(table,views,g=>g.currentRoll?.rollId===damageBefore.rollId&&g.currentRoll.stage==='after-roll',400)).currentRoll!;
  await expect(other.getByRole('region',{name:'サイコロの結果',exact:true})).toContainText('特殊能力のサイコロ');
  const defense=await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense',400);
  expect(defense.currentAction).toMatchObject({technique:{useLevel:3,effectLevel:base.effectLevel+rerolled.total!,damage:4+damage.total!}});
  expect(defense.recentRolls.find(r=>r.rollId===effectId)).toMatchObject({faces:rerolled.faces,attempts:rerolled.attempts});
  expect(JSON.stringify(views.get(b)!.game)).not.toContain(ability);
  const done=await passUntil(table,views,g=>!g.activeWindow,400);expect(done.players[b]!.damage).toBe(4+damage.total!);
 }finally{await table.close();}
});
