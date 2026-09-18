import {expect,test} from '@playwright/test';
import {getAction} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';
for(const choice of ['cost','attack','child','cancel-child','cancel-ability'] as const)test(`Shadow jump ${choice} saves private payment and granted attack across refresh`,async({browser,request})=>{
 const table=await tableFixture(browser,request,'shadow-jump');
 try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,page=table.pages[1]!,hand=views.get(b)!.game!.self.hand,advance=hand.find(id=>getAction(id)?.name==='踏み込み／蹴る')!,child=hand.find(id=>getAction(id)?.name==='黒翼飛翔剣')!;
  async function click(seat:number,label:string){const rev=views.get(a)!.revision;await table.pages[seat]!.getByRole('button',{name:label,exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);}
  async function cancel(mode:'cancel'|'cancel-ability'){await passUntil(table,views,g=>g.activeWindow?.pendingActorId===c,300);const page=table.pages[2]!;await page.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption(mode);await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r2c3');await click(2,'割り込みを使う');}
  await click(1,'影飛びを使う');await page.reload();
  if(choice==='cancel-ability')await cancel('cancel-ability');
  else{
   await passUntil(table,views,g=>g.currentRoll?.purpose==='ability-check'&&g.currentRoll.stage==='before-roll',300);await page.reload();await passUntil(table,views,g=>g.activeWindow?.kind==='shadow-jump-cost',300);await page.reload();await expect(page.getByRole('region',{name:'影飛びの踏み込み',exact:true})).toContainText('自分へのこの攻撃は無効');for(const seat of [0,2,3]){expect(views.get(table.sessions[seat]!.id)!.game!.shadowJumpCost).toBeNull();await expect(table.pages[seat]!.getByRole('region',{name:'影飛びの踏み込み',exact:true})).toHaveCount(0);}
   if(choice==='cost')await click(1,'踏み込みを捨てずに終える');
   else{
    await page.getByRole('combobox',{name:'影飛びに捨てる踏み込み',exact:true}).selectOption(advance);await click(1,'踏み込みを捨てて攻撃を選ぶ');await passUntil(table,views,g=>g.activeWindow?.kind==='ability-attack',300);await page.reload();await expect(page.getByText('影飛びの追加攻撃は従者無視・間合い不可です。攻撃しなくても、支払った踏み込みは戻りません。',{exact:true})).toBeVisible();
    if(choice==='attack')await click(1,'追加攻撃をしない');else{await page.getByRole('combobox',{name:'追加攻撃に使うカード',exact:true}).selectOption(child);await click(1,'追加攻撃を行う');await page.reload();if(choice==='cancel-child')await cancel('cancel');}
   }
  }
  const done=await passUntil(table,views,g=>!g.activeWindow,400);expect([done.players[a]!.damage,done.players[b]!.damage]).toEqual([choice==='child'?7:0,choice==='cancel-ability'?4:0]);expect(done.phase).toBe('withdrawal');if(choice==='cost'||choice==='cancel-ability')expect(views.get(b)!.game!.self.hand).toContain(advance);else expect((await storedDiscard()).filter(id=>id===advance)).toHaveLength(1);
 }finally{await table.close();}
});
