import {expect,test,type Locator,type Browser,type APIRequestContext} from '@playwright/test';
import {observe,tableFixture,windowPassButtonName} from './helpers.js';
async function exercise(browser:Browser,request:APIRequestContext,stopped:boolean){
 const table=await tableFixture(browser,request,stopped?'ritual-stopped':'ritual-disabled'),errors:string[]=[];
 for(const p of table.pages)p.on('websocket',socket=>socket.on('framereceived',frame=>{const m=JSON.parse(String(frame.payload));if(m.type==='error')errors.push(m.code);}));
 try{
  const views=await observe(table),ids=table.sessions.map(s=>s.id),a=ids[0]!,b=ids[1]!,page=table.pages[0]!,dp=table.pages[3]!,ritual='a2-p05-r1c1';const game=()=>views.get(a)!.game!;
  async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(rev);for(const id of ids)await expect.poll(()=>views.get(id)?.revision).toBe(views.get(a)!.revision);}
  async function step(){const g=game();if(g.activeWindow){await click(table.pages[ids.indexOf(g.activeWindow.pendingActorId!)]!.getByRole('button',{name:windowPassButtonName}));return;}const p=table.pages[g.turnSeat]!;
   if(g.phase==='hand-adjustment'){const self=views.get(ids[g.turnSeat]!)!.game!.self,excess=Math.max(0,self.hand.length-self.stats.handLimit);for(const card of self.hand.filter(id=>id!==ritual).slice(0,excess))await p.getByRole('region',{name:'自分の手札',exact:true}).getByRole('article').nth(self.hand.indexOf(card)).getByRole('button').first().click();await click(p.getByRole('button',{name:`選んだ${excess}枚を捨てて手番を終える`,exact:true}));return;}
   const label=g.phase==='action'?'行動を終える':g.phase==='withdrawal'?'離脱しない':g.phase==='turn-start'?'手番を始める':g.phase==='draw'?'カードを引かない':null;expect(label).not.toBeNull();await click(p.getByRole('button',{name:label!,exact:true}));
  }
  async function until(done:()=>boolean){for(let n=0;n<600;n++){if(done())return;expect(game().outcome).toBeNull();await step();}throw Error('RITUAL_DISABLED_UI_LIMIT');}
  await dp.getByRole('region',{name:'自分の手札',exact:true}).getByRole('button',{name:stopped?'催眠':'錯乱',exact:true}).click();await dp.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(false);await dp.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:dp.getByRole('heading',{name:table.sessions[0]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();await click(dp.getByRole('button',{name:'攻撃を確認して実行',exact:true}));
  if(stopped){await until(()=>!game().activeWindow&&game().phase==='turn-start'&&game().seatOrder[game().turnSeat]===a);await click(page.getByRole('button',{name:'手番を始める',exact:true}));await until(()=>!game().activeWindow&&game().phase==='turn-start'&&game().seatOrder[game().turnSeat]===b);}
  else await until(()=>!game().activeWindow&&game().phase==='action'&&game().seatOrder[game().turnSeat]===a);
  expect(game().players[a]!.statuses.some(x=>x.kind===(stopped?'stopped':'ability-disabled'))).toBe(true);await page.reload();
  const use=page.getByRole('button',{name:'儀式を行い、ヴァンミールへ変身する',exact:true});
  if(stopped){await expect(use).toHaveCount(0);expect(game().self.hand).toContain(ritual);expect(game().self.characterId).toBe('c2-p05-r1c1');expect(game().discard).not.toContain(ritual);expect(errors).toEqual([]);return;}
  const before=structuredClone(game().self),statuses=structuredClone(game().players[a]!.statuses);await click(use);await until(()=>game().activeWindow?.kind==='lifecycle-boundary');expect(game().self).toMatchObject({characterId:'c2-p07-r1c2',damage:0});expect(game().self.stats.endurance).toBe(25);expect(game().players[a]!.statuses).toEqual(statuses);await page.reload();await until(()=>!game().activeWindow);
  expect(game().self.hand).toEqual(before.hand.filter(id=>id!==ritual));expect(game().discard.filter(id=>id===ritual)).toHaveLength(1);for(const [i,p] of table.pages.entries()){await p.reload();await expect.poll(()=>views.get(ids[i]!)!.game!.players[a]!.characterId).toBe('c2-p07-r1c2');expect(views.get(ids[i]!)!.game!.outcome).toBeNull();}expect(errors).toEqual([]);
 }finally{await table.close();}
}
test('actual Confusion disables Uonos abilities but physical ritual still transforms after reload',async({browser,request})=>exercise(browser,request,false));
test('actual Hypnosis skips Uonos main action and retains unused ritual after reload',async({browser,request})=>exercise(browser,request,true));
