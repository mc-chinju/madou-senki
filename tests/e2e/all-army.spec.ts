import {expect,test,type Locator} from '@playwright/test';
import {observe,passUntil,tableFixture,currentCardAction} from './helpers.js';
type Table=Awaited<ReturnType<typeof tableFixture>>;type Views=Awaited<ReturnType<typeof observe>>;
async function click(t:Table,v:Views,button:Locator){const actor=t.sessions[0]!.id,revision=v.get(actor)!.revision;await button.click();await expect.poll(()=>v.get(actor)?.revision).toBeGreaterThan(revision);}
for(const mode of ['success','failure','decline'])test(`All Army ${mode} uses one hand follower and restores parent, child and morale windows`,async({browser,request})=>{
 const t=await tableFixture(browser,request,mode==='failure'?'reclaim-all-army-fail':'reclaim-all-army');try{
  const v=await observe(t),owner=t.sessions[0]!.id,target=t.sessions[1]!.id,p=t.pages[0]!,hand=[...v.get(owner)!.game!.self.hand],panel=p.getByRole('region',{name:'全軍突撃せよ',exact:true});
  await panel.getByRole('combobox',{name:'突撃に使う従者',exact:true}).selectOption('a2-p20-r3c1');await panel.getByRole('radio',{name:t.sessions[1]!.name,exact:true}).check();await expect(panel).toContainText('士気判定が必要');
  if(mode==='decline'){await panel.getByRole('button',{name:'突撃の選択をやめる',exact:true}).click();await expect(panel.getByRole('button',{name:'2枚を使って全軍突撃する',exact:true})).toBeDisabled();expect(v.get(owner)!.game!.self.hand).toEqual(hand);await p.reload();expect(v.get(owner)!.game!.self.hand).toEqual(hand);return;}
  await click(t,v,panel.getByRole('button',{name:'2枚を使って全軍突撃する',exact:true}));await p.reload();await expect(p.getByRole('region',{name:'現在の行動'})).toContainText('成立後、支払った従者の攻撃宣言へ進みます');expect(v.get(owner)!.game!.self.hand).toHaveLength(hand.length-2);
  await passUntil(t,v,g=>currentCardAction(g)?.cardInstanceId==='a2-p20-r3c1');await p.reload();await expect(p.getByRole('region',{name:'現在の行動'})).toContainText('グリフォン');
  await passUntil(t,v,g=>g.activeWindow?.kind==='before-roll');await p.reload();await passUntil(t,v,g=>g.activeWindow?.kind==='after-roll');await p.reload();await passUntil(t,v,g=>!g.activeWindow);
  expect(v.get(owner)!.game!.players[target]!.damage).toBe(mode==='success'?16:0);expect(v.get(owner)!.game!.self.hand).not.toContain('a2-p20-r3c1');await expect(p.getByRole('button',{name:'離脱しない',exact:true})).toBeVisible();
 }finally{await t.close();}
});
