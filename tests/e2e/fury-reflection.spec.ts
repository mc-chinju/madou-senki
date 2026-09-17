import {expect,test,type Locator} from '@playwright/test';
import {observe,windowPassButtonName,tableFixture,storedDiscard} from './helpers.js';
test('Actual Fury Royal Knights bow reflection survives browser reload without new bonus dice',async({browser,request})=>{
 const table=await tableFixture(browser,request,'fury-royal-reflection'),errors:string[]=[];
 for(const p of table.pages)p.on('websocket',socket=>socket.on('framereceived',frame=>{const message=JSON.parse(String(frame.payload));if(message.type==='error')errors.push(message.code);}));
 try{
 const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,page=table.pages[0]!;
 async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(rev);}
 async function settle(stop?:string){for(let n=0;n<300;n++){const current=views.get(a)!,g=current.game!,w=g.activeWindow;if(!w||w.kind===stop)return;const actor=w.pendingActorId!;await expect.poll(()=>views.get(actor)?.revision).toBe(current.revision);await table.pages[table.sessions.findIndex(p=>p.id===actor)]!.getByRole('button',{name:windowPassButtonName}).click();await expect.poll(()=>{expect(errors).toEqual([]);return views.get(a)?.revision;}).toBeGreaterThan(current.revision);}throw Error('FAIRY_UI_LIMIT');}
 async function select(seat:number,id:string){const p=table.pages[seat]!,who=table.sessions[seat]!.id,index=views.get(who)!.game!.self.hand.indexOf(id);expect(index).toBeGreaterThanOrEqual(0);await p.getByRole('region',{name:'自分の手札',exact:true}).getByRole('article').nth(index).getByRole('button').first().click();}

 await click(page.getByRole('button',{name:'従者を置かず進む',exact:true}));
 await select(1,'a2-p21-r1c2');await click(table.pages[1]!.getByRole('button',{name:'従者を置く',exact:true}));
 for(let i=1;i<4;i++)await click(table.pages[i]!.getByRole('button',{name:'従者を置かず進む',exact:true}));
 await click(page.getByRole('button',{name:'手番を始める',exact:true}));await click(page.getByRole('button',{name:'カードを引かない',exact:true}));
 const panel=page.getByRole('region',{name:'複数従者の攻撃'});
 await panel.getByRole('combobox',{name:'使う能力',exact:true}).selectOption('c2-p06-r1c2-ab04');
 await panel.getByRole('combobox',{name:'追加する従者',exact:true}).selectOption('a2-p21-r3c3');
 await panel.getByRole('button',{name:'攻撃に加える',exact:true}).click();
 await panel.getByRole('radio',{name:table.sessions[1]!.name,exact:true}).check();
 await click(panel.getByRole('button',{name:'選んだ従者で攻撃する',exact:true}));
 await settle('normal-defense');
 const original=views.get(a)!.game!;
 expect(original.currentAttack!.technique).toMatchObject({effectLevel:4,damage:5,attributes:['遠','戦','弓','白']});
 const rolls=structuredClone(original.recentRolls.filter(r=>r.purpose==='technique-value'||r.purpose==='attack-damage'));
 expect(rolls).toHaveLength(2);
 for(const p of table.pages)await p.reload();
 for(let n=0;n<150;n++){
  const v=views.get(a)!;if(v.game!.currentAction?.kind==='follower-reflection')break;
  const actor=v.game!.activeWindow!.pendingActorId!;
  await click(table.pages[table.sessions.findIndex(s=>s.id===actor)]!.getByRole('button',{name:windowPassButtonName}));
 }
 expect(views.get(a)!.game!.currentAction).toMatchObject({kind:'follower-reflection',technique:{effectLevel:4,damage:5}});
 for(const p of table.pages)await p.reload();
 expect(views.get(b)!.game!.abilityOptions.some(o=>o.abilityId==='c2-p02-r1c2-ab03')).toBe(false);
 await settle();for(const p of table.pages)await p.reload();
 const done=views.get(a)!.game!;
 expect([done.players[a]!.damage,done.players[b]!.damage]).toEqual([5,0]);
 expect(done.recentRolls.filter(r=>r.purpose==='technique-value'||r.purpose==='attack-damage')).toEqual(rolls);
 expect(done.recentRolls.filter(r=>r.purpose==='ability-value')).toEqual([]);
 expect((await storedDiscard()).filter(id=>id==='a2-p21-r3c3')).toHaveLength(1);expect(done.activeWindow).toBeNull();expect(errors).toEqual([]);
 }finally{await table.close();}
});
