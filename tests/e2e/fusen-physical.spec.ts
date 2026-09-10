import {expect,test,type Locator} from '@playwright/test';
import {fusenPhysicalScenarios} from '../../apps/worker/test/fixtures/fusen-physical-scenarios.js';
import {observe,windowPassButtonName,tableFixture} from './helpers.js';
for(const [scenario,revive] of [...fusenPhysicalScenarios.map(s=>[s,true] as const),['fusen-converted-choice',false]] as const)test(`${scenario} revive=${revive} OPEN and private owner decision resume after reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario),errors:string[]=[];for(const p of table.pages)p.on('websocket',socket=>socket.on('framereceived',frame=>{const message=JSON.parse(String(frame.payload));if(message.type==='error')errors.push(message.code);}));
 try{const views=await observe(table),ids=table.sessions.map(p=>p.id),[a,b,c,d]=ids as [string,string,string,string],page=table.pages[0]!,bp=table.pages[1]!,source=scenario==='fusen-draw'?d:a;const game=()=>views.get(a)!.game!;let revived=false;
 async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(rev);}
 async function pass(){const current=views.get(a)!,id=current.game!.activeWindow!.pendingActorId!;await expect.poll(()=>views.get(id)?.revision).toBe(current.revision);await click(table.pages[ids.indexOf(id)]!.getByRole('button',{name:windowPassButtonName}));}
 if(scenario==='fusen-draw')await click(table.pages[3]!.getByRole('button',{name:'カードを引く',exact:true}));else if(scenario!=='fusen-converted-choice')await click(page.getByRole('region',{name:'手番カードの効果'}).getByRole('button',{name:'秘伝書を使う',exact:true}));
 await page.reload();
 for(let n=0;n<250&&game().activeWindow;n++){
  const w=game().activeWindow!;
  if(w.kind==='revival'){const id=w.pendingActorId!,p=table.pages[ids.indexOf(id)]!;await p.reload();for(const other of table.pages.filter(x=>x!==p))await expect(other.getByRole('button',{name:'復活する',exact:true})).toHaveCount(0);const accept=id===b&&revive;await click(p.getByRole('button',{name:accept?'復活する':'復活しない',exact:true}));if(accept)revived=true;}
  else if(w.kind==='re-setup'){expect(w.pendingActorId).toBe(b);await expect.poll(()=>views.get(b)?.game?.self.hand.length).toBe(5);expect(game().players[b]).toMatchObject({presence:'active',revealed:true,damage:0,attachments:[]});expect(views.get(b)!.game!.self.faction).toBe(scenario.startsWith('fusen-converted')||scenario==='fusen-evil'?'EVIL':'GOOD');await bp.reload();await bp.getByLabel('配置する従者').selectOption('a2-p18-r3c3');await click(bp.getByRole('button',{name:'この従者を配置する',exact:true}));await bp.reload();await click(bp.getByRole('button',{name:'従者の配置を終える',exact:true}));}
  else await pass();
 }
 await page.reload();expect(game().activeWindow).toBeNull();expect(game().players[source]!.open.filter(id=>id==='a2-p01-r1c1')).toHaveLength(1);expect(game().players[b]!.presence).toBe(scenario==='fusen-empty'||revived?'active':'dead');expect(game().players[c]!.presence).toBe(scenario==='fusen-empty'?'active':'dead');if(scenario==='fusen-converted-choice')expect(revived).toBe(revive);if(revived){expect(views.get(b)!.game!.self.hand).toHaveLength(5);expect(views.get(b)!.game!.self.followers).toContainEqual(expect.objectContaining({cardInstanceId:'a2-p18-r3c3'}));}expect(game().phase).toBe('action');expect(errors).toEqual([]);
 }finally{await table.close();}
});
