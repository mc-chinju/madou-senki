import {expect,test,type Locator} from '@playwright/test';
import {advanceRemainingScenarios,advanceRemainingCards} from '../../apps/worker/test/fixtures/advance-remaining-physical-scenarios.js';
import {observe,windowPassButtonName,tableFixture,storedDiscard} from './helpers.js';
for(const scenario of advanceRemainingScenarios)test(`${scenario} physical mode and source remain consistent after reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario),errors:string[]=[];for(const p of table.pages)p.on('websocket',socket=>socket.on('framereceived',frame=>{const message=JSON.parse(String(frame.payload));if(message.type==='error')errors.push(message.code);}));
 try{const views=await observe(table),ids=table.sessions.map(p=>p.id),[a,b]=ids as [string,string],page=table.pages[0]!,bp=table.pages[1]!,index=Number(scenario.split('-')[2])-1,card=advanceRemainingCards[index]!,mode=scenario.split('-')[3],game=()=>views.get(a)!.game!,own=()=>game().self;
 async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(rev);for(const id of ids)await expect.poll(()=>views.get(id)?.revision).toBe(views.get(a)!.revision);}
 async function until(done:()=>boolean){for(let n=0;n<300;n++){if(done())return;const id=game().activeWindow!.pendingActorId!;await click(table.pages[ids.indexOf(id)]!.getByRole('button',{name:windowPassButtonName}));}throw Error('ADVANCE_UI_LIMIT');}
 const distances=structuredClone(game().distances);
 if(mode==='advance'){
 await bp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p07-r1c1');await click(bp.getByRole('button',{name:'間合いを使う',exact:true}));await bp.reload();await until(()=>game().activeWindow?.kind==='defense-advance');await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(card);await click(page.getByRole('button',{name:'踏み込みを使う',exact:true}));
 }else{
 const index=own().hand.indexOf(card);expect(index).toBeGreaterThanOrEqual(0);await page.getByRole('region',{name:'自分の手札',exact:true}).getByRole('article').nth(index).getByRole('button').first().click();await page.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:page.getByRole('heading',{name:table.sessions[1]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();
 await click(page.getByRole('button',{name:mode==='attack'?'攻撃を確認して実行':'接近',exact:true}));
 if(mode==='cancel'){await bp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p07-r1c1');await click(bp.getByRole('button',{name:'間合いを使う',exact:true}));}
 }
 await page.reload();await until(()=>!game().activeWindow);
 expect(game().players[b]!.damage).toBe(mode==='attack'?(index===0?4:index===1?5:3):mode==='advance'?10:0);expect(own().hand).not.toContain(card);
 if(mode==='approach'){expect(game().distances[a]![b]).toBe('near');expect(game().distances[b]![a]).toBe('near');expect(game().distanceMarkers).toEqual([{a,b,ownerId:a,cardInstanceId:card}]);expect((await storedDiscard())).not.toContain(card);}
 else{expect(game().distances).toEqual(distances);expect((await storedDiscard()).filter(id=>id===card)).toHaveLength(1);}
 expect(game().phase).toBe(mode==='attack'||mode==='advance'?'withdrawal':'action');await bp.reload();await expect.poll(()=>views.get(b)?.revision).toBe(views.get(a)!.revision);expect(errors).toEqual([]);
 }finally{await table.close();}
});
