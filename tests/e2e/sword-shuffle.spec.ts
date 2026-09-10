import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
type Table=Awaited<ReturnType<typeof tableFixture>>;type Views=Awaited<ReturnType<typeof observe>>;
async function click(t:Table,v:Views,button:Locator){const actor=t.sessions[0]!.id,revision=v.get(actor)!.revision;await button.click();await expect.poll(()=>v.get(actor)?.revision).toBeGreaterThan(revision);}
for(const scenario of ['reclaim-sword-dawn','reclaim-sword-rebuild'] as const)test(`${scenario} reloads discard and hidden Cham reservation before the pending refill`,async({browser,request})=>{
 const t=await tableFixture(browser,request,scenario);try{
  const v=await observe(t),owner=t.sessions[0]!.id,cham=t.sessions[2]!.id,a=t.pages[0]!,c=t.pages[2]!,panel=a.getByRole('complementary',{name:'自分だけの確認内容'});
  await panel.getByRole('radio',{name:/ふぇありぃそぅど/}).check();await click(t,v,panel.getByRole('button',{name:'選んだ1枚を捨てさせる',exact:true}));await a.reload();await passUntil(t,v,g=>g.reclaim?.pendingActorId===cham);await c.reload();const reclaim=c.getByRole('region',{name:'カードの回収'});await expect(reclaim.getByRole('button')).toHaveCount(1);
  await click(t,v,c.getByRole('button',{name:'正体を公開',exact:true}));await click(t,v,reclaim.getByRole('button',{name:/ふぇありぃそぅど.*回収/}));await c.reload();await expect(reclaim).toContainText('回収予約中');expect(v.get(cham)!.game!.reservedCards).toContain('a2-p04-r2c1');expect(v.get(owner)!.game!.reservedCards).toEqual([]);
  for(let n=0;n<3;n++){const g=await passUntil(t,v,g=>g.activeWindow?.kind==='revival'||g.inspection?.zone==='all');if(g.inspection?.zone==='all')break;await click(t,v,t.pages[3]!.getByRole('button',{name:'復活しない',exact:true}));}
  expect(v.get(owner)!.game!.inspection?.zone).toBe('all');if(scenario==='reclaim-sword-dawn')expect(v.get(owner)!.game!.players[owner]!.open).toContain('a2-p01-r1c2');await click(t,v,panel.getByRole('button',{name:'確認を終える',exact:true}));await passUntil(t,v,g=>!g.activeWindow);await c.reload();expect(v.get(cham)!.game!.self.hand.filter(id=>id==='a2-p04-r2c1')).toHaveLength(1);
 }finally{await t.close();}
});
