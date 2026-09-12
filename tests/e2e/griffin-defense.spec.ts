import { expect, test,type Browser,type APIRequestContext } from '@playwright/test';
import { observe, passUntil, tableFixture } from './helpers.js';

type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
function game(table: Table, views: Views, seat = 0) { return views.get(table.sessions[seat]!.id)!.game!; }
async function click(table: Table, views: Views, seat: number, label: string) {
  const owner = table.sessions[0]!.id; const revision = views.get(owner)!.revision;
  await table.pages[seat]!.getByRole('button', { name: label, exact: true }).click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
async function run({browser,request}:{browser:Browser;request:APIRequestContext},mode:'select'|'cancel'|'late'){
 const table=await tableFixture(browser,request,mode==='late'?'received-griffin-follower':'received-griffin');
 try{const views=await observe(table),bp=table.pages[1]!,giant='c2-p07-r1c2-ab01',first=game(table,views,1).abilityOptions.find(o=>o.abilityId===giant)!.targetEventId;
 async function reload(){for(const page of table.pages)await page.reload();}
 await reload();await expect(bp.getByRole('button',{name:'巨神を使う',exact:true})).toBeVisible();
 if(mode==='late'){await click(table,views,1,'従者で受ける');await reload();await expect(bp.getByRole('button',{name:'巨神を使う',exact:true})).toHaveCount(0);expect(game(table,views,1).currentAttack!.hitIndex).toBe(0);}
 else {await click(table,views,1,'巨神を使う');if(mode==='cancel'){await passUntil(table,views,g=>g.activeWindow?.pendingActorId===table.sessions[2]!.id&&!!g.reactionTargetAbilityId,400);await table.pages[2]!.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');await click(table,views,2,'割り込みを使う');await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense',400);await reload();await expect(bp.getByRole('button',{name:'巨神を使う',exact:true})).toHaveCount(0);expect(game(table,views,1).currentAttack!.hitIndex).toBe(0);}}
 if(mode==='late'){await passUntil(table,views,g=>{expect(game(table,views,1).abilityOptions.some(o=>o.abilityId===giant)).toBe(false);return !g.activeWindow;},400);await reload();expect(game(table,views).outcome).toBeNull();return;}
 await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense'&&g.currentAttack?.hitIndex===1,400);await reload();expect(game(table,views,1).abilityOptions.find(o=>o.abilityId===giant)!.targetEventId).not.toBe(first);await click(table,views,1,'巨神を使う');await passUntil(table,views,g=>!g.activeWindow,400);await reload();expect(game(table,views,1).self.damage).toBe(mode==='cancel'?8:0);expect(game(table,views).outcome).toBeNull();
 }finally{await table.close();}
}
test('actual Griffin selected first Giant allows one fresh second-hit attempt across all-seat reload',async({browser,request})=>run({browser,request},'select'));
test('actual Griffin canceled first Giant remains spent until next hit across all-seat reload',async({browser,request})=>run({browser,request},'cancel'));
test('actual Griffin follower entry closes Giant choice through completion across all-seat reload',async({browser,request})=>run({browser,request},'late'));
