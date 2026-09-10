import {expect,test,type Locator} from '@playwright/test';
import {observe,tableFixture,windowPassButtonName} from './helpers.js';
test('actual approach and once-per-game Curse recovery precede ritual with distance and possessions retained after reload',async({browser,request})=>{
 const table=await tableFixture(browser,request,'ritual-history'),errors:string[]=[];
 for(const p of table.pages)p.on('websocket',socket=>socket.on('framereceived',frame=>{const m=JSON.parse(String(frame.payload));if(m.type==='error')errors.push(m.code);}));
 try{
  const views=await observe(table),ids=table.sessions.map(s=>s.id),a=ids[0]!,page=table.pages[0]!,curse='a2-p13-r3c2',ritual='a2-p05-r1c1';
  const game=()=>views.get(a)!.game!;
  async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(rev);for(const id of ids)await expect.poll(()=>views.get(id)?.revision).toBe(views.get(a)!.revision);}
  async function step(){const g=game();if(g.activeWindow){await click(table.pages[ids.indexOf(g.activeWindow.pendingActorId!)]!.getByRole('button',{name:windowPassButtonName}));return;}
   const p=table.pages[g.turnSeat]!;
   if(g.phase==='hand-adjustment'){const self=views.get(ids[g.turnSeat]!)!.game!.self,excess=Math.max(0,self.hand.length-self.stats.handLimit);for(const card of self.hand.filter(id=>![curse,ritual].includes(id)).slice(0,excess))await p.getByRole('region',{name:'自分の手札',exact:true}).getByRole('article').nth(self.hand.indexOf(card)).getByRole('button').first().click();await click(p.getByRole('button',{name:`選んだ${excess}枚を捨てて手番を終える`,exact:true}));return;}
   const label=g.phase==='action'?'行動を終える':g.phase==='withdrawal'?'離脱しない':g.phase==='turn-start'?'手番を始める':g.phase==='draw'?'カードを引かない':null;expect(label).not.toBeNull();await click(p.getByRole('button',{name:label!,exact:true}));
  }
  async function until(done:()=>boolean){for(let n=0;n<650;n++){if(done())return;expect(game().outcome).toBeNull();await step();}throw Error('RITUAL_HISTORY_UI_LIMIT');}
  const action=()=>!game().activeWindow&&game().phase==='action'&&game().seatOrder[game().turnSeat]===a;
  async function target(index:number){await page.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:page.getByRole('heading',{name:table.sessions[index]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();}
  const initialDistances=structuredClone(game().distances),advance=game().self.hand.indexOf('a2-p24-r1c1');expect(advance).toBeGreaterThanOrEqual(0);
  await page.getByRole('region',{name:'自分の手札',exact:true}).getByRole('article').nth(advance).getByRole('button').first().click();await target(1);await click(page.getByRole('button',{name:'接近',exact:true}));await until(action);expect(game().distances).not.toEqual(initialDistances);await page.reload();
  await page.getByRole('region',{name:'自分の手札',exact:true}).getByRole('button',{name:'呪殺',exact:true}).click();await click(page.getByRole('button',{name:'詠唱',exact:true}));await until(action);
  await page.getByRole('region',{name:'自分の詠唱',exact:true}).getByRole('button',{name:'呪殺を選ぶ',exact:true}).click();await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(false);await target(2);await click(page.getByRole('button',{name:'攻撃を確認して実行',exact:true}));
  await until(()=>game().activeWindow?.kind==='reclaim'&&game().reclaim?.pendingActorId===a&&game().reclaim?.cardInstanceId===curse);const claim=game().reclaim!.claims.find(c=>c.right==='base');expect(claim).toBeDefined();await click(page.getByRole('region',{name:'カードの回収',exact:true}).getByRole('button',{name:claim!.label,exact:true}));await page.reload();await until(action);
  const before=structuredClone(game().self),distances=structuredClone(game().distances),attachments=[...game().players[a]!.attachments];expect(before.hand.filter(id=>id===curse)).toHaveLength(1);expect(distances).not.toEqual(initialDistances);
  await click(page.getByRole('button',{name:'儀式を行い、ヴァンミールへ変身する',exact:true}));await until(()=>game().activeWindow?.kind==='lifecycle-boundary');expect(game().self).toMatchObject({characterId:'c2-p07-r1c2',damage:0});expect(game().distances).toEqual(distances);expect(game().self.hand).toEqual(before.hand.filter(id=>id!==ritual));expect(game().self.followers).toEqual(before.followers);expect(game().self.chants).toEqual(before.chants);expect(game().players[a]!.attachments).toEqual(attachments);await page.reload();await until(()=>!game().activeWindow);
  for(const [i,p] of table.pages.entries()){await p.reload();await expect.poll(()=>views.get(ids[i]!)!.game!.distances).toEqual(distances);expect(views.get(ids[i]!)!.game!.outcome).toBeNull();}expect(game().self.hand.filter(id=>id===curse)).toHaveLength(1);expect(game().discard.filter(id=>id===ritual)).toHaveLength(1);expect(errors).toEqual([]);
 }finally{await table.close();}
});
