import type {Browser,APIRequestContext} from '@playwright/test';
import {expect,test,type Page} from '@playwright/test';
import {getAction} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture} from './helpers.js';
async function play(page:Page,id:string,label:string){await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(id);await page.getByRole('button',{name:label,exact:true}).click();}
async function verifyScenario(browser:Browser,request:APIRequestContext,three:boolean){
 const table=await tableFixture(browser,request,three?'r6-s12':'r6-s11');try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,card=(owner:string,name:string)=>views.get(owner)!.game!.self.hand.find(id=>getAction(id)!.name===name)!,bm=card(b,'間合い／休息'),cm=card(c,'間合い／休息'),advance=card(a,'踏み込み／蹴る');let rev=views.get(a)!.revision;await play(table.pages[1]!,bm,'間合いを使う');await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await table.pages[1]!.reload();await passUntil(table,views,g=>g.activeWindow?.kind!=='reclaim',300);
 if(three){await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense',300);await table.pages[1]!.reload();}
 else {rev=views.get(a)!.revision;await play(table.pages[2]!,cm,'間合いを使う');await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await passUntil(table,views,g=>g.activeWindow?.kind==='defense-advance',300);rev=views.get(a)!.revision;await play(table.pages[0]!,advance,'踏み込みを使う');await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await table.pages[0]!.reload();}
 await passUntil(table,views,g=>!g.activeWindow,300);await table.pages[1]!.reload();const done=views.get(b)!.game!;expect([done.players[b]!.damage,done.players[c]!.damage]).toEqual(three?[14,0]:[7,7]);expect(done.self.hand).not.toContain(bm);expect(done.phase).toBe('withdrawal');}finally{await table.close();}
}
test('S11 shared advance actual maai buttons preserve payment and final scope across reload',async({browser,request})=>{await verifyScenario(browser,request,false);});
test('S12 three hits actual maai buttons preserve payment and final scope across reload',async({browser,request})=>{await verifyScenario(browser,request,true);});
