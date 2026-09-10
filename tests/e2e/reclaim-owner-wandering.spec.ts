import {expect,test} from '@playwright/test';
import {actionCards} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture} from './helpers.js';

test('Actual protected death returns the reserved counter once to its wandering owner after browser reloads',async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-wandering');
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,bp=table.pages[1]!;
  const counter=actionCards.find(card=>card.name==='妖撃破山剣')!.id,own=()=>views.get(b)!.game!;
  await bp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(counter);
  await bp.getByRole('checkbox',{name:'専用技として使う',exact:true}).check();
  let revision=views.get(a)!.revision;
  await bp.getByRole('button',{name:'防御する',exact:true}).click();
  await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);
  await passUntil(table,views,()=>own().reclaim?.cardInstanceId===counter&&!!own().reclaim?.claims.length,300);
  await bp.reload();
  const claim=own().reclaim!.claims[0]!;revision=views.get(a)!.revision;
  await bp.getByRole('region',{name:'カードの回収',exact:true}).getByRole('button',{name:claim.label,exact:true}).click();
  await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);
  expect(own().reservedCards).toContain(counter);await bp.reload();
  expect(own().self.hand).not.toContain(counter);
  await passUntil(table,views,()=>views.get(a)!.game!.players[c]!.presence==='pending-death',400);
  expect(own().reservedCards).toContain(counter);
  for(const p of table.pages)await p.reload();
  await passUntil(table,views,g=>!g.activeWindow,400);
  for(const p of table.pages)await p.reload();
  expect(own().players[b]!.presence).toBe('wandering');expect(own().players[c]!.presence).toBe('dead');
  expect(own().self.hand.filter(id=>id===counter)).toHaveLength(1);expect(own().reservedCards).toEqual([]);
  expect(own().discard).not.toContain(counter);
  expect(own().logs.filter(e=>e.type==='PLAYER_WANDERING'&&e.actorId===b)).toHaveLength(1);
  for(const session of table.sessions.filter(s=>s.id!==b))expect(views.get(session.id)!.game!.self.hand).not.toContain(counter);
 }finally{await table.close();}
});
