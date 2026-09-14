import {expect,test} from '@playwright/test';
import {observe,tableFixture} from './helpers.js';
test('S01 authenticated HTTP snapshots match all four WebSocket priority views and reject outsiders',async({browser,request,baseURL})=>{
 if (!baseURL) throw new Error('Playwright baseURL must be configured');
 const table=await tableFixture(browser,request,'canonical-S01');
 try{const views=await observe(table),c=table.sessions[2]!.id;
 for(const [i,page] of table.pages.entries()){
 const result=await page.evaluate(async roomId=>{const r=await fetch(`/api/rooms/${roomId}/snapshot`,{headers:{'X-Room-Actor':'forged-actor'}});return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json()};},table.roomId);
 expect(result.status).toBe(200);expect(result.cache).toBe('no-store');const ws=views.get(table.sessions[i]!.id)!;expect(result.body).toEqual({revision:ws.revision,game:ws.game});expect(result.body.game.activeWindow.pendingActorId).toBe(c);
 }
 const anonymous=await request.get(`/api/rooms/${table.roomId}/snapshot`);expect(anonymous.status()).toBe(401);
 const outsider=await browser.newContext({baseURL});try{const page=await outsider.newPage();await page.goto('/');await page.getByLabel('表示名').fill('外部');await page.getByRole('button',{name:'はじめる',exact:true}).click();await expect(page.getByRole('heading',{name:/ようこそ/})).toBeVisible();const result=await page.evaluate(async roomId=>{const r=await fetch(`/api/rooms/${roomId}/snapshot`);return {status:r.status,body:await r.json()};},table.roomId);expect(result).toEqual({status:403,body:{error:'FORBIDDEN'}});}finally{await outsider.close();}
 }finally{await table.close();}
});
