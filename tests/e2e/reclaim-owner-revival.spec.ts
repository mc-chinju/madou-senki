import {expect,test,type Locator} from '@playwright/test';
import {actionCards} from '../../packages/catalog/src/index.js';
import {observe,windowPassButtonName,tableFixture} from './helpers.js';

test('Same-root death and revival retain the old prayer reservation across browser reload and discard it once',async({browser,request})=>{
 const table=await tableFixture(browser,request,'lia-prayer-revival');
 try{
  const views=await observe(table),ids=table.sessions.map(s=>s.id),[a,b,c,d]=ids as [string,string,string,string];
  const ap=table.pages[0]!,bp=table.pages[1]!,cp=table.pages[2]!,prayer='a2-p05-r2c3';
  const card=(name:string)=>actionCards.find(c=>c.name===name)!.id;
  const gift=card('「これで勝ったと思うなよ」'),transfer=card('香具羅'),fate=card('命運凶変');
  const game=()=>views.get(a)!.game!,own=()=>views.get(b)!.game!;
  async function click(button:Locator){const revision=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(revision);}
  await bp.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('effect-plus');
  await bp.getByRole('checkbox',{name:'専用技として使う',exact:true}).check();
  await bp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(prayer);
  await click(bp.getByRole('button',{name:'割り込みを使う',exact:true}));
  let reserved=false,died=false,revived=false,giftPlayed=false,canceled=false;
  for(let n=0;n<600&&game().activeWindow;n++){
   const w=game().activeWindow!,actor=w.pendingActorId!;
   await expect.poll(()=>views.get(actor)?.revision).toBe(views.get(a)!.revision);
   if(own().reservedCards.includes(prayer)&&!reserved){reserved=true;await bp.reload();expect(own().self.hand).not.toContain(prayer);}
   if(game().players[b]!.presence==='dead'&&!died){died=true;await bp.reload();expect(own().reservedCards).toContain(prayer);}
   if(w.kind==='death-gift'&&actor===c&&!giftPlayed){
    expect(died).toBe(true);giftPlayed=true;
    const panel=cp.getByRole('complementary',{name:'死亡時の贈与'});
    await panel.getByRole('combobox',{name:'死亡時に使うカード',exact:true}).selectOption(gift);
    await panel.getByRole('combobox',{name:'相手に託す手札',exact:true}).selectOption(transfer);
    await panel.getByRole('combobox',{name:'カードを託す相手',exact:true}).selectOption(d);
    await click(panel.getByRole('button',{name:'選んだ手札を託す',exact:true}));
   }else if(w.kind==='revival'&&actor===b){
    expect(died).toBe(true);expect(own().reservedCards).toContain(prayer);await bp.reload();
    await click(bp.getByRole('button',{name:'復活する',exact:true}));revived=true;
    expect(own().self.hand).not.toContain(prayer);
   }else if(w.kind==='re-setup'){
    const page=table.pages[ids.indexOf(actor)]!;await page.reload();
    expect(own().reservedCards).toContain(prayer);expect(own().self.hand).not.toContain(prayer);
    await click(page.getByRole('button',{name:'従者の配置を終える',exact:true}));
   }else if(giftPlayed&&!canceled&&w.kind==='declaration'&&actor===a){
    canceled=true;await ap.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(fate);
    await click(ap.getByRole('button',{name:'割り込みを使う',exact:true}));
   }else await click(table.pages[ids.indexOf(actor)]!.getByRole('button',{name:windowPassButtonName}));
  }
  for(const p of table.pages)await p.reload();
  expect({reserved,died,revived,giftPlayed,canceled}).toEqual({reserved:true,died:true,revived:true,giftPlayed:true,canceled:true});
  expect(game().activeWindow).toBeNull();expect(game().players[b]!.presence).toBe('active');expect(game().players[c]!.presence).toBe('dead');
  expect(own().reservedCards).toEqual([]);expect(own().self.hand).not.toContain(prayer);
  expect(game().discard.filter(id=>id===prayer)).toHaveLength(1);
  expect(game().logs.filter(e=>e.type==='PLAYER_DIED'&&e.actorId===b)).toHaveLength(1);
  expect(game().logs.filter(e=>e.type==='PLAYER_REVIVED'&&e.actorId===b)).toHaveLength(1);
 }finally{await table.close();}
});
