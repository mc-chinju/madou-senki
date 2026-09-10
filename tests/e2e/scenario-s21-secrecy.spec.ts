import {expect,test} from '@playwright/test';
import {observe,tableFixture,windowPassButtonName} from './helpers.js';
test('S21 White Light5 damage6 alternate hidden worlds match HTTP and WS before hit and disclose no unused ability in DOM',async({browser,request})=>{
 const traces:unknown[][]=[];
 for(const scenario of ['r6-s21','r6-s21-control'] as const){
  const table=await tableFixture(browser,request,scenario);try{
  const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id;
  function seatIds(value:unknown){let wire=JSON.stringify(value);for(const [index,session] of table.sessions.entries())wire=wire.replaceAll(session.id,`seat-${index}`);return JSON.parse(wire);}
  const trace:unknown[]=[];traces.push(trace);
  if(scenario==='r6-s21')expect(views.get(b)!.game!.abilityOptions.some(o=>o.abilityId==='c2-p01-r1c1-ab01')).toBe(true);
  expect(views.get(a)!.game!.currentAttack!.technique).toMatchObject({effectLevel:5,damage:6});
  for(let n=0;n<300;n++){
   const current=views.get(a)!;const game=current.game!;
   const foreign=[];
   for(const index of [0,2,3]){
    const page=table.pages[index]!,id=table.sessions[index]!.id;
    const http=await page.evaluate(async roomId=>{const r=await fetch(`/api/rooms/${roomId}/snapshot`);return {status:r.status,body:await r.json()};},table.roomId);
    expect(http.status).toBe(200);expect(http.body).toEqual({revision:views.get(id)!.revision,game:views.get(id)!.game});
    expect(JSON.stringify(http.body)).not.toContain('c2-p01-r1c1-ab01');expect(await page.content()).not.toContain('c2-p01-r1c1-ab01');
    if(!game.players[b]!.revealed){expect(JSON.stringify(http.body.game)).not.toContain('c2-p01-r1c1');foreign.push(http.body.game);}
   }
   if(!game.players[b]!.revealed)trace.push(seatIds(foreign));
   if(!game.activeWindow)break;
   const page=table.pages[table.sessions.findIndex(s=>s.id===game.activeWindow!.pendingActorId)]!;
   await page.getByRole('button',{name:windowPassButtonName}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(current.revision);
  }
  await table.pages[1]!.reload();expect(views.get(a)!.game!.players[b]).toMatchObject({damage:6,revealed:true});expect(views.get(a)!.game!.activeWindow).toBeNull();
  }finally{await table.close();}
 }
 expect(traces[0]!.length).toBeGreaterThan(0);expect(traces[0]).toEqual(traces[1]);
});
