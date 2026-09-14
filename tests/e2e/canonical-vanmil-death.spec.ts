import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
test('actual Vanmil death keeps established ban through pending death and all-seat reload',async({browser,request})=>{
 test.setTimeout(120000);const table=await tableFixture(browser,request,'canonical-vanmil-death');
 try{
  const views=await observe(table),[a,b,c,d]=table.sessions.map(p=>p.id) as [string,string,string,string];
  const game=()=>views.get(a)!.game!;
  async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);}
  const finish=()=>passUntil(table,views,g=>!g.activeWindow,400);
  async function own(target:string){for(let n=0;n<100;n++){
   const g=game();if(g.activeWindow){await finish();continue;}const index=g.turnSeat,id=table.sessions[index]!.id,page=table.pages[index]!,button=(name:string)=>page.getByRole('button',{name,exact:true});
   if(g.phase==='action'&&id===target)return;
   if(g.phase==='turn-start')await click(button('手番を始める'));else if(g.phase==='draw')await click(button('カードを引かない'));else if(g.phase==='action')await click(button('行動を終える'));else if(g.phase==='withdrawal')await click(button('離脱しない'));else if(g.phase==='hand-adjustment'){
    const own=views.get(id)!.game!.self,required=Math.max(0,own.hand.length-own.stats.handLimit),cards=page.getByRole('region',{name:'自分の手札'}).locator('button.card-face');for(let i=0;i<required;i++)await cards.nth(i).click();await click(button(`選んだ${required}枚を捨てて手番を終える`));
   }else throw Error('LIA_LIFE_UI_PHASE');
  }throw Error('LIA_LIFE_UI_TURN_LIMIT');}
  const ban=table.pages[0]!.getByRole('region',{name:'能力の禁止と祝福'});await ban.getByRole('checkbox',{name:'楓',exact:true}).check();await click(ban.getByRole('button',{name:'神と人の差を使う',exact:true}));await finish();
  const designated=table.sessions.map(session=>structuredClone(views.get(session.id)!.game!.suppressionTargets));
  await own(d);const dp=table.pages[3]!;
  await dp.getByRole('region',{name:'自分の手札'}).getByRole('button',{name:'踏み込み／弓',exact:true}).click();await dp.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:dp.getByRole('heading',{name:'葵',exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();await click(dp.getByRole('button',{name:'攻撃を確認して実行',exact:true}));
  await passUntil(table,views,g=>g.players[a]!.presence==='pending-death',400);
  for(const [seat,page] of table.pages.entries()){await page.reload();const g=views.get(table.sessions[seat]!.id)!.game!;expect(g.players[a]!.presence).toBe('pending-death');expect(g.outcome).toBeNull();expect(g.suppressionTargets).toEqual(designated[seat]);}
  expect(views.get(b)!.game!.suppressionTargets[0]!.applicability).toBe('suppressed');
  await finish();
  for(const [seat,page] of table.pages.entries()){await page.reload();const g=views.get(table.sessions[seat]!.id)!.game!;expect(g.players[a]!.presence).toBe('dead');expect(g.outcome).toMatchObject({reason:'vanmil-death',winnerIds:[b,c,d]});}
 }finally{await table.close();}
});
