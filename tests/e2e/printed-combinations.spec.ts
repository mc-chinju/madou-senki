import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
type Table=Awaited<ReturnType<typeof tableFixture>>;type Views=Awaited<ReturnType<typeof observe>>;
async function click(t:Table,v:Views,button:Locator){const actor=t.sessions[0]!.id,revision=v.get(actor)!.revision;await button.click();await expect.poll(()=>v.get(actor)?.revision).toBeGreaterThan(revision);}
for(const use of [false,true])test(`printed combination selection use=${use} keeps the parent attack through reload`,async({browser,request})=>{
 const t=await tableFixture(browser,request,'reclaim-printed-combinations');try{
  const v=await observe(t),owner=t.sessions[0]!.id,target=t.sessions[1]!.id,p=t.pages[0]!,spirit=v.get(owner)!.game!.self.stats.spirit;
  await p.getByRole('region',{name:'自分の手札'}).getByRole('button',{name:'魔詩',exact:true}).click();await p.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:p.getByRole('heading',{name:t.sessions[1]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();
  if(use){await p.getByRole('checkbox',{name:'おまえは、俺の敵でないっ！！',exact:true}).check();await p.getByRole('checkbox',{name:'月の竪琴',exact:true}).check();}
  await click(t,v,p.getByRole('button',{name:'攻撃を確認して実行',exact:true}));await p.reload();if(use){expect(v.get(owner)!.game!.self.stats.spirit).toBe(spirit+2);await expect(p.getByRole('region',{name:'現在の行動'})).toContainText('複合札の使用を確認しています');}
  await passUntil(t,v,g=>!g.activeWindow);expect(v.get(owner)!.game!.players[target]!.damage).toBe(use?9:5);await p.reload();expect(v.get(owner)!.game!.self.stats.spirit).toBe(spirit+(use?2:0));await click(t,v,p.getByRole('button',{name:'離脱しない',exact:true}));expect(v.get(owner)!.game!.self.stats.spirit).toBe(spirit);
 }finally{await t.close();}
});
test('a counter can select its own printed spirit component and reload its declaration',async({browser,request})=>{
 const t=await tableFixture(browser,request,'reclaim-printed-counter');try{
  const v=await observe(t),owner=t.sessions[1]!.id,p=t.pages[1]!,spirit=v.get(owner)!.game!.self.stats.spirit,panel=p.getByRole('complementary',{name:'現在の判断'});await panel.getByRole('combobox',{name:'使うカード',exact:true}).selectOption({label:'閃光槍'});await panel.getByRole('checkbox',{name:'おまえは、俺の敵でないっ！！',exact:true}).check();await click(t,v,panel.getByRole('button',{name:'防御する',exact:true}));await p.reload();expect(v.get(owner)!.game!.self.stats.spirit).toBe(spirit+2);await passUntil(t,v,g=>!g.activeWindow);expect(v.get(owner)!.game!.players[t.sessions[0]!.id]!.damage).toBe(5);await click(t,v,t.pages[0]!.getByRole('button',{name:'離脱しない',exact:true}));expect(v.get(owner)!.game!.self.stats.spirit).toBe(spirit);
 }finally{await t.close();}
});
