import {expect,test,type Locator} from '@playwright/test';
import {getAction} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture} from './helpers.js';
type Table=Awaited<ReturnType<typeof tableFixture>>;
type Views=Awaited<ReturnType<typeof observe>>;
async function click(table:Table,views:Views,button:Locator){const actor=table.sessions[0]!.id,rev=views.get(actor)!.revision;await button.click();await expect.poll(()=>views.get(actor)?.revision).toBeGreaterThan(rev);}
for(const [index,cardInstanceId] of ['a2-p04-r3c2','a2-p04-r3c3'].entries())for(const kind of ['deck','hand','capacity','open'] as const)test(`${cardInstanceId} Wish ${kind} keeps private choices and the committed result after reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,kind==='open'?'reclaim-wish-open':'reclaim-wish');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,oldOwner=table.sessions[1]!.id,p=table.pages[0]!,b=table.pages[1]!,d=table.pages[3]!;
  await click(table,views,p.getByRole('button',{name:`祈願を使う（${index+1}枚目）`,exact:true}));await p.reload();await passUntil(table,views,g=>g.activeWindow?.kind==='wish');await p.reload();
  const decision=views.get(owner)!.game!.wish!,panel=p.getByRole('complementary',{name:'自分だけの祈願の選択'});await expect(panel).toBeVisible();await expect(b.getByRole('complementary',{name:'祈願の判断'})).toContainText('選択を待っています');expect(views.get(oldOwner)!.game!.wish).toBeNull();
  if(kind==='hand'){await panel.getByRole('combobox',{name:'取得先',exact:true}).selectOption('hand');await panel.getByRole('combobox',{name:'取得候補',exact:true}).selectOption(oldOwner);}
  else if(kind==='capacity'){await panel.getByRole('combobox',{name:'取得先',exact:true}).selectOption('public');await panel.getByRole('combobox',{name:'取得候補',exact:true}).selectOption(decision.publicSources.find(o=>o.ownerId===oldOwner&&o.zone==='open')!.cardInstanceId);}
  else await panel.getByRole('combobox',{name:'取得候補',exact:true}).selectOption(kind==='open'?getAction('a2-p01-r1c1')!.name:decision.deckNames.find(o=>o.count>1&&!['祈願','回復の薬'].includes(o.cardName))!.cardName);
  await click(table,views,panel.getByRole('button',{name:'この候補から1枚取得する',exact:true}));await p.reload();
  if(kind==='capacity'){await b.reload();const cap=views.get(oldOwner)!.game!.wishCapacity!,adjust=b.getByRole('complementary',{name:'祈願後の上限調整'});await expect(adjust).toContainText('詠唱札を1枚');await adjust.getByRole('checkbox',{name:getAction(cap.chantIds[0]!)!.name,exact:true}).check();await click(table,views,adjust.getByRole('button',{name:'選んだ札を捨てて続ける',exact:true}));}
  if(kind==='open'){expect(views.get(owner)!.game!.activeWindow!.kind).toBe('before-roll');await passUntil(table,views,g=>g.activeWindow?.kind==='after-roll');await d.reload();const result=await passUntil(table,views,g=>g.activeWindow?.kind==='revival'||g.activeWindow?.kind==='reclaim'||!g.activeWindow);if(result.activeWindow?.kind==='revival')await click(table,views,d.getByRole('button',{name:'復活しない',exact:true}));}
  await passUntil(table,views,g=>!g.activeWindow);await p.reload();const result=views.get(owner)!.game!;expect(result.phase).toBe('hand-adjustment');expect(result.discard).toContain(cardInstanceId);expect(result.logs.filter(e=>e.type==='WISH_ACQUIRED')).toHaveLength(1);
  if(kind==='hand'){await expect(p.getByRole('region',{name:'自分だけの祈願取得履歴'})).toBeVisible();await expect(b.getByRole('region',{name:'自分だけの祈願取得履歴'})).toBeVisible();await expect(table.pages[2]!.getByRole('region',{name:'自分だけの祈願取得履歴'})).toHaveCount(0);}
  if(kind==='open')expect(result.logs.filter(e=>e.type==='OPEN'&&e.cardInstanceId==='a2-p01-r1c1')).toHaveLength(1);
 }finally{await table.close();}
});
