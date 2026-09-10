import {expect,test,type Locator,type Browser,type APIRequestContext} from '@playwright/test';
import {observe,tableFixture,windowPassButtonName} from './helpers.js';
async function exercise(browser:Browser,request:APIRequestContext,subordinates:boolean,conspiracy=false){
 const table=await tableFixture(browser,request,subordinates?'ritual-terminal-subordinates':'ritual-terminal',subordinates?6:4),errors:string[]=[];
 for(const page of table.pages)page.on('websocket',socket=>socket.on('framereceived',frame=>{const m=JSON.parse(String(frame.payload));if(m.type==='error')errors.push(m.code);}));
 try{
  const views=await observe(table),ids=table.sessions.map(s=>s.id),a=ids[0]!,c=ids[2]!,ap=table.pages[0]!,cp=table.pages[2]!;
  const game=()=>views.get(a)!.game!;
  async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(rev);for(const id of ids)await expect.poll(()=>views.get(id)?.revision).toBe(views.get(a)!.revision);}
  async function step(){const g=game();if(g.activeWindow){const id=g.activeWindow.pendingActorId!;await click(table.pages[ids.indexOf(id)]!.getByRole('button',{name:windowPassButtonName}));return;}
   const label=g.phase==='action'?'行動を終える':g.phase==='withdrawal'?'離脱しない':g.phase==='hand-adjustment'?'選んだ0枚を捨てて手番を終える':g.phase==='turn-start'?'手番を始める':g.phase==='draw'?'カードを引かない':null;
   expect(label).not.toBeNull();await click(table.pages[g.turnSeat]!.getByRole('button',{name:label!,exact:true}));
  }
  async function until(done:()=>boolean){for(let n=0;n<600;n++){if(done())return;expect(game().outcome).toBeNull();await step();}throw Error('RITUAL_TERMINAL_UI_LIMIT');}
  await click(ap.getByRole('button',{name:'儀式を行い、ヴァンミールへ変身する',exact:true}));await ap.reload();
  await until(()=>game().activeWindow?.kind==='lifecycle-boundary');expect(game().self).toMatchObject({characterId:'c2-p07-r1c2',damage:0,faction:'ヴァンミール'});expect(game().self.stats.endurance).toBe(25);await ap.reload();
  if(subordinates)await click(ap.getByRole('button',{name:'下僕達を使う',exact:true}));
  if(conspiracy){const f=ids[5]!,fp=table.pages[5]!;
   await until(()=>game().activeWindow?.kind==='lifecycle-boundary'&&game().activeWindow?.pendingActorId===f);
   await click(fp.getByRole('button',{name:'正体を公開',exact:true}));
   await until(()=>game().activeWindow?.kind==='lifecycle-boundary'&&game().activeWindow?.pendingActorId===f);
   await click(fp.getByRole('button',{name:'陰謀を使い、勝利して退場する',exact:true}));await fp.reload();
  }
  await until(()=>!game().activeWindow&&game().phase==='action'&&game().seatOrder[game().turnSeat]===c);
  if(conspiracy){expect(game().players[ids[5]!]!.presence).toBe('exited');expect(game().individualResults).toEqual({[ids[5]!]: 'won'});expect(game().outcome).toBeNull();}
  await cp.getByRole('region',{name:'自分の手札',exact:true}).getByRole('button',{name:'竜殺天空槍',exact:true}).click();await cp.getByRole('checkbox',{name:'専用技として使う',exact:true}).check();await click(cp.getByRole('button',{name:'詠唱',exact:true}));await cp.reload();
  await until(()=>!game().activeWindow&&game().phase==='action'&&game().seatOrder[game().turnSeat]===c);
  await cp.getByRole('region',{name:'自分の詠唱',exact:true}).getByRole('button',{name:'竜殺天空槍を選ぶ',exact:true}).click();await cp.getByRole('checkbox',{name:'専用技として使う',exact:true}).check();
  await cp.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:cp.getByRole('heading',{name:table.sessions[0]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();await click(cp.getByRole('button',{name:'攻撃を確認して実行',exact:true}));await cp.reload();
  await until(()=>game().players[a]!.presence==='pending-death');for(const id of ids)expect(views.get(id)!.game!.outcome).toBeNull();await ap.reload();
  await until(()=>!!game().outcome);const outcome=structuredClone(game().outcome);expect(outcome).toMatchObject({reason:'vanmil-death',winnerIds:conspiracy?[ids[5],ids[2],ids[4]]:subordinates?[ids[2],ids[4],ids[5]]:ids.slice(1)});expect(game().players[a]!.presence).toBe('dead');expect(game().activeWindow).toBeNull();
  if(conspiracy){expect(game().players[ids[5]!]!.presence).toBe('exited');expect(game().individualResults).toEqual({[ids[5]!]: 'won'});expect(outcome!.results[ids[5]!]).toBe('won');}
  for(const card of ['a2-p05-r1c1','a2-p11-r1c1'])expect(game().discard.filter(id=>id===card)).toHaveLength(1);
  for(const [i,page] of table.pages.entries()){await page.reload();await expect.poll(()=>views.get(ids[i]!)!.game!.outcome).toEqual(outcome);}expect(errors).toEqual([]);
 }finally{await table.close();}
}
test('actual ritual and later chanted Dragon Spear show one Vanmil terminal result after browser reloads',async({browser,request})=>exercise(browser,request,false));
test('actual elected subordinates lose after ritual and Vanmil death across six browser reloads',async({browser,request})=>exercise(browser,request,true));
test('actual Arseil conspiracy personal victory survives later ritual terminal and all browser reloads',async({browser,request})=>exercise(browser,request,true,true));
