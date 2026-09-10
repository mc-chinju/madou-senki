import {expect,test,type Locator} from '@playwright/test';
import {observe,tableFixture,windowPassButtonName} from './helpers.js';
test('actual ritual Vanmil otherworld absence remains nonterminal after browser reloads and later turns',async({browser,request})=>{
 const table=await tableFixture(browser,request,'ritual-otherworld'),errors:string[]=[];
 for(const p of table.pages)p.on('websocket',socket=>socket.on('framereceived',frame=>{const m=JSON.parse(String(frame.payload));if(m.type==='error')errors.push(m.code);}));
 try{
  const views=await observe(table),ids=table.sessions.map(s=>s.id),a=ids[0]!,c=ids[2]!,ap=table.pages[0]!,cp=table.pages[2]!,spear='a2-p14-r2c2';
  const game=()=>views.get(a)!.game!,own=()=>views.get(c)!.game!;
  async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(rev);for(const id of ids)await expect.poll(()=>views.get(id)?.revision).toBe(views.get(a)!.revision);}
  async function step(){const g=game();if(g.activeWindow){await click(table.pages[ids.indexOf(g.activeWindow.pendingActorId!)]!.getByRole('button',{name:windowPassButtonName}));return;}
   if(g.phase==='hand-adjustment'){const p=table.pages[g.turnSeat]!,self=views.get(ids[g.turnSeat]!)!.game!.self,excess=Math.max(0,self.hand.length-self.stats.handLimit);
    for(const card of self.hand.filter(id=>id!==spear).slice(0,excess))await p.getByRole('region',{name:'自分の手札',exact:true}).getByRole('article').nth(self.hand.indexOf(card)).getByRole('button').first().click();
    await click(p.getByRole('button',{name:`選んだ${excess}枚を捨てて手番を終える`,exact:true}));return;
   }
   const label=g.phase==='action'?'行動を終える':g.phase==='withdrawal'?'離脱しない':g.phase==='turn-start'?'手番を始める':g.phase==='draw'?'カードを引かない':null;expect(label).not.toBeNull();await click(table.pages[g.turnSeat]!.getByRole('button',{name:label!,exact:true}));
  }
  async function until(done:()=>boolean){for(let n=0;n<700;n++){if(done())return;expect(game().outcome).toBeNull();await step();}throw Error('ABSENCE_UI_LIMIT');}
  const action=()=>!game().activeWindow&&game().phase==='action'&&game().seatOrder[game().turnSeat]===c;
  async function chant(){await cp.getByRole('region',{name:'自分の手札',exact:true}).getByRole('button',{name:'裂界',exact:true}).click();await cp.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(false);await click(cp.getByRole('button',{name:'詠唱',exact:true}));await cp.reload();await until(action);}
  async function attack(index:number){await cp.getByRole('region',{name:'自分の詠唱',exact:true}).getByRole('button',{name:'裂界を選ぶ',exact:true}).click();await cp.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(false);await cp.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:cp.getByRole('heading',{name:table.sessions[index]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();await click(cp.getByRole('button',{name:'攻撃を確認して実行',exact:true}));}
  await click(ap.getByRole('button',{name:'儀式を行い、ヴァンミールへ変身する',exact:true}));await until(()=>game().activeWindow?.kind==='lifecycle-boundary');expect(game().self).toMatchObject({characterId:'c2-p07-r1c2',damage:0});await ap.reload();await until(action);
  await chant();await attack(0);await until(()=>!game().activeWindow);
  expect(game().players[a]).toMatchObject({characterId:'c2-p07-r1c2',presence:'otherworld',damage:8});const away=structuredClone(game().self);expect(game().outcome).toBeNull();await ap.reload();
  await until(action);expect(game().self).toEqual(away);expect(game().logs.filter(x=>x.type==='PLAYER_DIED'&&x.actorId===a)).toEqual([]);expect(game().logs.filter(x=>x.type==='GAME_COMPLETED')).toEqual([]);
  for(const card of ['a2-p05-r1c1',spear])expect(game().discard.filter(id=>id===card)).toHaveLength(1);
  for(const [i,p] of table.pages.entries()){await p.reload();await expect.poll(()=>views.get(ids[i]!)!.game!.players[a]!.presence).toBe('otherworld');expect(views.get(ids[i]!)!.game!.outcome).toBeNull();}expect(errors).toEqual([]);
 }finally{await table.close();}
});
