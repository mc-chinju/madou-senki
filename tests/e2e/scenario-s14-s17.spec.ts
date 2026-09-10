import type {Browser,APIRequestContext} from '@playwright/test';
import {expect,test} from '@playwright/test';
import {getAction} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture} from './helpers.js';
async function verifyScenario(browser:Browser,request:APIRequestContext,reflection:boolean){
 const table=await tableFixture(browser,request,reflection?'r6-s17':'r6-s14');try{const views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,bp=table.pages[1]!;
 if(reflection){const teleport=views.get(b)!.game!.self.hand.find(id=>getAction(id)!.name==='転移')!;await bp.reload();await bp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(teleport);const rev=views.get(a)!.revision;await bp.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await bp.reload();}
 else {await expect(bp.getByRole('button',{name:'防御する',exact:true})).toHaveCount(0);await passUntil(table,views,g=>g.activeWindow?.kind==='after-roll'&&g.activeWindow.pendingActorId===c,300);const roll=views.get(c)!.game!.currentRoll!;expect(roll.purpose).toBe('follower-morale');const cp=table.pages[2]!,rev=views.get(a)!.revision;await cp.getByRole('combobox',{name:'割り込み効果',exact:true}).selectOption('reroll');await cp.getByRole('combobox',{name:'使うカード',exact:true}).selectOption('a2-p02-r1c3');await cp.getByRole('button',{name:'割り込みを使う',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await cp.reload();await passUntil(table,views,g=>g.currentRoll?.rollId===roll.rollId&&g.currentRoll.generation===1,300);await cp.reload();}
 await passUntil(table,views,g=>!g.activeWindow,300);await bp.reload();expect(views.get(b)!.game!.self.damage).toBe(0);expect(views.get(b)!.game!.phase).toBe('withdrawal');}finally{await table.close();}
}
test('S14 follower start hides unavailable defense and permits legal continuation across reload',async({browser,request})=>{await verifyScenario(browser,request,false);});
test('S17 reflection hides unavailable defense and permits legal continuation across reload',async({browser,request})=>{await verifyScenario(browser,request,true);});
