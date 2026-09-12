import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
test('actual banned target death and revival retain designation across all-seat reload',async({browser,request})=>{
 test.setTimeout(120000);const table=await tableFixture(browser,request,'r6-combined-suppression');
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
   }else throw Error('TARGET_REVIVAL_UI_PHASE');
  }throw Error('TARGET_REVIVAL_UI_TURN_LIMIT');}
  const ap=table.pages[0]!,bp=table.pages[1]!,cp=table.pages[2]!,dp=table.pages[3]!;
  await click(ap.getByRole('button',{name:'気合いを使う',exact:true}));
  await passUntil(table,views,g=>g.activeWindow?.kind==='damage'&&g.activeWindow.pendingActorId===c,400);
  const panel=cp.getByRole('region',{name:'能力の禁止と祝福'});await panel.getByRole('checkbox',{name:table.sessions[0]!.name,exact:true}).check();await click(panel.getByRole('button',{name:'神と人の差を使う',exact:true}));await finish();
  const designations=table.sessions.map(p=>views.get(p.id)!.game!.suppressionTargets.map(({targetId,designated})=>({targetId,designated})));
  async function retained(){const before=table.sessions.map(p=>structuredClone(views.get(p.id)!.game!.suppressionTargets));for(const page of table.pages)await page.reload();for(const [i,p] of table.sessions.entries()){expect(views.get(p.id)!.game!.suppressionTargets).toEqual(before[i]);expect(views.get(p.id)!.game!.suppressionTargets.map(({targetId,designated})=>({targetId,designated}))).toEqual(designations[i]);}expect(views.get(a)!.game!.suppressionTargets.find(t=>t.targetId===a)!.applicability).toBe('suppressed');}
  await retained();await own(b);await bp.getByRole('region',{name:'自分の手札'}).getByRole('button',{name:'踏み込み／弓',exact:true}).click();await bp.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:bp.getByRole('heading',{name:table.sessions[0]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();await click(bp.getByRole('button',{name:'攻撃を確認して実行',exact:true}));
  await passUntil(table,views,g=>g.players[a]!.presence==='pending-death',400);await retained();await finish();expect(game().players[a]!.presence).toBe('dead');await retained();
  await own(d);await dp.getByLabel('手番技として使うカード').selectOption('a2-p13-r3c1');await dp.getByLabel('専用効果を使う',{exact:true}).check();await dp.getByRole('group',{name:'復活させる相手（複数選択可）'}).getByLabel(table.sessions[0]!.name,{exact:true}).check();await click(dp.getByRole('button',{name:'手番技を使う',exact:true}));
  await passUntil(table,views,g=>g.lifecycleDecision?.kind==='re-setup',400);expect(game().players[a]!.presence).toBe('active');expect(views.get(a)!.game!.self.damage).toBe(0);await retained();await click(ap.getByRole('button',{name:'従者の配置を終える',exact:true}));await finish();await retained();
 }finally{await table.close();}
});
