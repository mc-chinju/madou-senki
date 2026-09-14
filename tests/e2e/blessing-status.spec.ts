import {expect,test,type Locator,type Browser,type APIRequestContext} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
async function statusCase({browser,request}:{browser:Browser;request:APIRequestContext},mode:'confusion'|'hypnosis'){
 test.setTimeout(120000);const table=await tableFixture(browser,request,mode==='confusion'?'suppression-blessing-confusion':'suppression-blessing-hypnosis');
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
  const ban=table.pages[0]!.getByRole('region',{name:'能力の禁止と祝福'});await ban.getByRole('checkbox',{name:'楓',exact:true}).check();await click(ban.getByRole('button',{name:'神と人の差を使う',exact:true}));await finish();await own(d);
  const dp=table.pages[3]!;await dp.getByRole('region',{name:'自分の手札'}).getByRole('button',{name:mode==='confusion'?'錯乱':'催眠',exact:true}).click();await dp.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:dp.getByRole('heading',{name:'楓',exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();await click(dp.getByRole('button',{name:'攻撃を確認して実行',exact:true}));await finish();
  expect(game().players[b]!.statuses).toContainEqual(expect.objectContaining({kind:mode==='confusion'?'ability-disabled':'stopped'}));await own(c);const statuses=structuredClone(game().players[b]!.statuses);for(const page of table.pages)await page.reload();expect(game().players[b]!.statuses).toEqual(statuses);
  const panel=table.pages[2]!.getByRole('region',{name:'能力の禁止と祝福'});await panel.getByLabel('祝福する対象').selectOption(b);await click(panel.getByRole('button',{name:'祝福を使う',exact:true}));await finish();
  for(const page of table.pages)await page.reload();for(const session of table.sessions)expect(views.get(session.id)!.game!.players[b]!.statuses).toEqual(statuses);expect(views.get(b)!.game!.suppressionTargets[0]!.applicability).toBe('relieved');
  const saved=await(await request.get(`/__test/rooms/${table.roomId}/game`)).json();expect(saved.blessingLeases).toHaveLength(1);expect(saved.players[b].statuses).toContainEqual(expect.objectContaining({kind:mode==='confusion'?'ability-disabled':'stopped'}));
 }finally{await table.close();}
}
test('actual confusion remains after Blessing across all-seat reload',async({browser,request})=>statusCase({browser,request},'confusion'));
test('actual hypnosis remains after Blessing across all-seat reload',async({browser,request})=>statusCase({browser,request},'hypnosis'));
