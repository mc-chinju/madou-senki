import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';

test('Actual Arseil exit after reserved self-canceled Fate survives browser reloads and discards once',async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-exit');
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,ap=table.pages[0]!,bp=table.pages[1]!,fate='a2-p02-r2c3';
  const game=()=>views.get(a)!.game!,own=()=>views.get(b)!.game!;
  async function click(button:Locator){const revision=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);}
  await click(ap.getByRole('button',{name:'儀式を行い、ヴァンミールへ変身する',exact:true}));
  await passUntil(table,views,g=>g.activeWindow?.pendingActorId===b,300);
  await bp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(fate);
  await click(bp.getByRole('button',{name:'割り込みを使う',exact:true}));
  await passUntil(table,views,g=>g.activeWindow?.pendingActorId===b,300);
  await bp.reload();
  await click(bp.getByRole('button',{name:'アルセイルの固有反応で命運凶変を取り消す',exact:true}));
  await passUntil(table,views,()=>own().reclaim?.cardInstanceId===fate&&!!own().reclaim?.claims.length,300);
  await bp.reload();
  await click(bp.getByRole('region',{name:'カードの回収',exact:true}).getByRole('button',{name:own().reclaim!.claims[0]!.label,exact:true}));
  expect(own().reservedCards).toContain(fate);await bp.reload();expect(own().self.hand).not.toContain(fate);
  await passUntil(table,views,()=>own().lifecycleAbilities.includes('arseil-conspiracy'),400);
  expect(own().reservedCards).toContain(fate);
  for(const p of table.pages)await p.reload();
  await click(bp.getByRole('button',{name:'陰謀を使い、勝利して退場する',exact:true}));
  await bp.reload();expect(own().self.hand).not.toContain(fate);
  await passUntil(table,views,g=>!g.activeWindow,400);
  for(const p of table.pages)await p.reload();
  expect(game().players[b]!.presence).toBe('exited');expect(game().individualResults[b]).toBe('won');
  expect(own().reservedCards).toEqual([]);expect(own().self.hand).not.toContain(fate);
  expect((await storedDiscard()).filter(id=>id===fate)).toHaveLength(1);
  expect(game().logs.filter(e=>e.type==='PLAYER_EXITED'&&e.actorId===b)).toHaveLength(1);
 }finally{await table.close();}
});
