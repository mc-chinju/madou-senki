import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
test('Fury black chants stay unavailable after refresh and a nonblack sword still resolves',async({browser,request})=>{
 const table=await tableFixture(browser,request,'mandatory-fury');try{
  const views=await observe(table),page=table.pages[0]!,a=table.sessions[0]!.id,b=table.sessions[1]!.id;
  for(const name of ['呪殺','血流']){await page.reload();await page.getByRole('region',{name:'自分の手札'}).getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name:'詠唱',exact:true})).toBeDisabled();expect(views.get(a)!.game!.self.chants).toHaveLength(0);}
  await page.reload();await page.getByRole('region',{name:'自分の手札'}).getByRole('button',{name:'黒翼飛翔剣',exact:true}).click();await page.getByRole('region',{name:'参加者の公開状態'}).locator('article').filter({has:page.getByRole('heading',{name:table.sessions[1]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();const rev=views.get(a)!.revision;await page.getByRole('button',{name:'攻撃を確認して実行',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();const done=await passUntil(table,views,g=>!g.activeWindow,300);expect(done.players[b]!.damage).toBe(7);
 }finally{await table.close();}
});
