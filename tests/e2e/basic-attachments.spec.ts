import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
for(const [scenario,card,name,stat] of [['basic-attachment-warrior','a2-p03-r2c1','香具羅','warrior_level'],['basic-attachment-magic','a2-p03-r3c1','魔導書','magic_level'],['basic-attachment-evil','a2-p03-r3c2','悪の魅力','spirit'],['basic-attachment-good','a2-p03-r3c3','聖光','spirit']] as const)test(`${name} installation and actual opponent Wish preserve the correct stat after reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[0]!,other=table.pages[1]!,before=views.get(a)!.game!.self.stats[stat],recipient=views.get(b)!.game!.self.stats[stat];
  async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);}
  await page.getByRole('region',{name:'自分の手札',exact:true}).getByRole('button',{name,exact:true}).click();
  await click(page.getByRole('button',{name:'カードを使う',exact:true}));await page.reload();expect(views.get(a)!.game!.self.stats[stat]).toBe(before);
  await passUntil(table,views,g=>!g.activeWindow);await page.reload();
  expect(views.get(a)!.game!.self.stats[stat]).toBe(before+1);expect(views.get(b)!.game!.players[a]!.attachments).toContain(card);
  await click(page.getByRole('button',{name:'選んだ0枚を捨てて手番を終える',exact:true}));
  await click(other.getByRole('button',{name:'手番を始める',exact:true}));
  await click(other.getByRole('button',{name:'カードを引かない',exact:true}));
  await click(other.getByRole('button',{name:'祈願を使う（1枚目）',exact:true}));await passUntil(table,views,g=>g.activeWindow?.kind==='wish');await other.reload();
  const panel=other.getByRole('complementary',{name:'自分だけの祈願の選択'});
  expect(views.get(a)!.game!.wish).toBeNull();
  await panel.getByRole('combobox',{name:'取得先',exact:true}).selectOption('public');await panel.getByRole('combobox',{name:'取得候補',exact:true}).selectOption(card);
  await click(panel.getByRole('button',{name:'この候補から1枚取得する',exact:true}));await passUntil(table,views,g=>!g.activeWindow);
  await page.reload();await other.reload();expect(views.get(a)!.game!.self.stats[stat]).toBe(before);expect(views.get(b)!.game!.self.stats[stat]).toBe(recipient);
  expect(views.get(a)!.game!.players[a]!.attachments).not.toContain(card);expect(views.get(b)!.game!.self.hand.filter(id=>id===card)).toHaveLength(1);expect(views.get(b)!.game!.players[b]!.attachments).not.toContain(card);
 }finally{await table.close();}
});
