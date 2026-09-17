import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';
test('S07 Lia reuses the same returned prayer on a later independent attack across browser reloads',async({browser,request})=>{
 const table=await tableFixture(browser,request,'canonical-S07');try{
 const views=await observe(table),[a,b,c]=table.sessions.map(p=>p.id) as [string,string,string],ap=table.pages[0]!,bp=table.pages[1]!,prayer='a2-p05-r2c3',game=()=>views.get(a)!.game!,own=()=>views.get(b)!.game!;
 async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);for(const p of table.sessions)await expect.poll(()=>views.get(p.id)?.revision).toBe(views.get(a)!.revision);}
 for(const [seat,card] of [[0,'a2-p24-r1c2'],[1,'a2-p24-r1c3']] as const){
 const page=table.pages[seat]!,self=views.get(table.sessions[seat]!.id)!.game!.self;
 await page.getByRole('region',{name:'自分の手札',exact:true}).getByRole('article').nth(self.hand.indexOf(card)).getByRole('button').first().click();await page.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:page.getByRole('heading',{name:game().players[c]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();await click(page.getByRole('button',{name:'攻撃を確認して実行',exact:true}));
 await passUntil(table,views,g=>g.activeWindow?.kind==='effect-level'&&g.activeWindow.pendingActorId===b,300);
 await bp.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('effect-plus');await bp.getByRole('checkbox',{name:'専用技として使う',exact:true}).check();await bp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(prayer);await click(bp.getByRole('button',{name:'割り込みを使う',exact:true}));
 await passUntil(table,views,()=>own().reservedCards.includes(prayer),300);await bp.reload();expect(own().self.hand).not.toContain(prayer);expect(own().reservedCards.filter(id=>id===prayer)).toHaveLength(1);
 await passUntil(table,views,g=>!g.activeWindow,300);await bp.reload();expect(own().self.hand.filter(id=>id===prayer)).toHaveLength(1);expect(own().reservedCards).not.toContain(prayer);expect((await storedDiscard())).not.toContain(prayer);
 if(seat===0){await click(ap.getByRole('button',{name:'離脱しない',exact:true}));await click(ap.getByRole('button',{name:'選んだ0枚を捨てて手番を終える',exact:true}));await passUntil(table,views,g=>!g.activeWindow,300);await click(bp.getByRole('button',{name:'手番を始める',exact:true}));await click(bp.getByRole('button',{name:'カードを引かない',exact:true}));}
 }
 }finally{await table.close();}
});
