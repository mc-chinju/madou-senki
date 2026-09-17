import {expect,test,type Locator} from '@playwright/test';
import {ritualPhysicalScenarios,ritualCard} from '../../apps/worker/test/fixtures/ritual-physical-scenarios.js';
import {observe,windowPassButtonName,tableFixture,storedDiscard} from './helpers.js';
for(const scenario of ritualPhysicalScenarios)test(`${scenario} actual ritual controls private gift public transformation and optional awakening survive reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario),errors:string[]=[];for(const p of table.pages)p.on('websocket',socket=>socket.on('framereceived',frame=>{const message=JSON.parse(String(frame.payload));if(message.type==='error')errors.push(message.code);}));
 try{
  const views=await observe(table),ids=table.sessions.map(p=>p.id),[a,b,c,d]=ids as [string,string,string,string],page=table.pages[0]!,bp=table.pages[1]!,cp=table.pages[2]!,dp=table.pages[3]!;
  const game=()=>views.get(a)!.game!,own=(id:string)=>views.get(id)!.game!.self,at=(id:string)=>table.pages[ids.indexOf(id)]!;
  async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(rev);await expect.poll(()=>views.get(b)?.revision).toBe(views.get(a)!.revision);}
  async function step(){const id=game().activeWindow!.pendingActorId!;await expect.poll(()=>views.get(id)?.revision).toBe(views.get(a)!.revision);await click(at(id).getByRole('button',{name:windowPassButtonName}));}
  async function until(done:()=>boolean){for(let n=0;n<500;n++){if(done())return;await step();}throw Error('RITUAL_UI_LIMIT');}
  const use=page.getByRole('button',{name:'儀式を行い、ヴァンミールへ変身する',exact:true});
  if(scenario==='ritual-wrong-owner'){await expect(use).toHaveCount(0);await expect(cp.getByRole('region',{name:'復活の儀式',exact:true})).toHaveCount(0);expect(own(c).hand).toContain(ritualCard);return;}
  if(scenario==='ritual-decline'){await click(page.getByRole('button',{name:'行動を終える',exact:true}));await expect(use).toHaveCount(0);expect(own(a).hand).toContain(ritualCard);return;}
  if(scenario.includes('gift')){
   const panel=bp.getByRole('region',{name:'復活の儀式',exact:true}),gift=panel.getByRole('button',{name:'復活の儀式を渡す',exact:true}),select=panel.getByRole('combobox',{name:'儀式を渡す相手',exact:true});
   if(scenario==='ritual-gift-stopped'){await expect(gift).toHaveCount(0);expect(own(b).hand).toContain(ritualCard);return;}
   if(scenario==='ritual-gift-hidden-target'||scenario==='ritual-gift-dead-target'){await expect(gift).toBeDisabled();await expect(select.locator('option')).toHaveCount(1);expect(own(b).hand).toContain(ritualCard);if(scenario==='ritual-gift-dead-target'){expect(game().players[a]).toMatchObject({presence:'dead',revealed:true});return;}await click(page.getByRole('button',{name:'正体を公開',exact:true}));await until(()=>!game().activeWindow);}
   const aHand=[...own(a).hand],bHand=[...own(b).hand],revealed=game().players[b]!.revealed,deck=game().deckCount,discard=await storedDiscard(),windowId=game().activeWindow?.windowId,phase=game().phase;
   await expect(gift).toBeDisabled();await expect(select.locator('option')).toHaveCount(2);await select.selectOption(a);await click(gift);
   expect(own(a).hand).toEqual([...aHand,ritualCard]);expect(own(b).hand).toEqual(bHand.filter(id=>id!==ritualCard));expect(game().players[b]!.revealed).toBe(revealed);expect(game().deckCount).toBe(deck);expect((await storedDiscard())).toEqual(discard);expect(game().phase).toBe(phase);expect(game().activeWindow?.windowId).toBe(windowId);await bp.reload();await page.reload();
   if(scenario==='ritual-gift-window')await until(()=>!game().activeWindow);
   if(game().phase==='action'){await click(use);await until(()=>!game().activeWindow);expect(game().players[a]).toMatchObject({characterId:'c2-p07-r1c2',revealed:true});expect((await storedDiscard()).filter(id=>id===ritualCard)).toHaveLength(1);}return;
  }
  const before={hand:[...own(a).hand],damage:own(a).damage,followers:structuredClone(own(a).followers),attachments:[...game().players[a]!.attachments]},deck=game().deckCount,rolls=game().recentRolls.map(r=>r.rollId);
  expect(before.damage).toBe(3);expect(before.attachments).toContain('a2-p03-r3c1');expect(before.followers.map(f=>f.cardInstanceId)).toContain('a2-p21-r2c2');await click(use);expect(own(a).hand).toEqual(before.hand.filter(id=>id!==ritualCard));expect(game().deckCount).toBe(deck);expect(game().players[a]!.characterId).not.toBe('c2-p07-r1c2');await page.reload();
  if(scenario==='ritual-fate'){await until(()=>game().activeWindow?.pendingActorId===d);const reaction=dp.getByRole('complementary',{name:'現在の判断'});await reaction.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');await click(reaction.getByRole('button',{name:'割り込みを使う',exact:true}));await until(()=>!game().activeWindow);expect(own(a).damage).toBe(before.damage);expect(own(a).characterId).toBe('c2-p05-r1c1');expect((await storedDiscard())).toContain(ritualCard);return;}
  await until(()=>game().activeWindow?.kind==='lifecycle-boundary');const boundary=game().activeWindow!.windowId;expect(game().activeWindow!.pendingActorId).toBe(a);expect(game().players[a]).toMatchObject({characterId:'c2-p07-r1c2',revealed:true});expect(own(a)).toMatchObject({damage:0,faction:'ヴァンミール',protection:{characterIds:[]}});expect(own(a).stats.endurance).toBe(25);expect(own(a).followers).toEqual(before.followers);expect(game().players[a]!.attachments).toEqual(before.attachments);expect(game().recentRolls.map(r=>r.rollId)).toEqual(rolls);expect(own(b).faction).toBe('EVIL');expect(own(d).faction).toBe('EVIL');
  const sub=scenario==='ritual-subordinates'||scenario==='ritual-both',conspiracy=scenario==='ritual-conspiracy'||scenario==='ritual-both';
  if(sub){await click(page.getByRole('button',{name:'下僕達を使う',exact:true}));await until(()=>game().activeWindow?.windowId===boundary);await expect(page.getByRole('button',{name:'下僕達を使う',exact:true})).toHaveCount(0);}
  await until(()=>game().activeWindow?.pendingActorId===c);await expect(cp.getByRole('button',{name:'陰謀を使い、勝利して退場する',exact:true})).toBeVisible();if(conspiracy)await click(cp.getByRole('button',{name:'陰謀を使い、勝利して退場する',exact:true}));await until(()=>!game().activeWindow);
  expect(own(b).faction).toBe(sub?'ヴァンミール':'EVIL');expect(own(d).faction).toBe(sub?'ヴァンミール':'EVIL');expect(game().players[c]!.presence).toBe(conspiracy?'exited':'active');expect((await storedDiscard()).filter(id=>id===ritualCard)).toHaveLength(1);expect(game().phase).toBe('hand-adjustment');expect(own(a).hand).toEqual(before.hand.filter(id=>id!==ritualCard));await page.reload();expect(own(a).characterId).toBe('c2-p07-r1c2');expect(errors).toEqual([]);
 }finally{await table.close();}
});
