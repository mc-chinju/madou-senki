import {expect,test} from '@playwright/test';
import {observe,passUntil,tableFixture} from './helpers.js';
import {leafDefenseMode} from '../../apps/worker/test/fixtures/leaf-defense-scenarios.js';
for(const scenario of ['leaf-ordinary','leaf-dedicated','leaf-three-ordinary','leaf-three-dedicated'] as const)test(`${scenario} actual Leaf defense and attacker check persist without an extra attack`,async({browser,request})=>{
 const table=await tableFixture(browser,request,scenario);
 try{const m=leafDefenseMode(scenario),views=await observe(table),a=table.sessions[0]!.id,b=table.sessions[1]!.id,c=table.sessions[2]!.id,page=table.pages[1]!;await page.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(m.card);await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(m.dedicated);const rev=views.get(a)!.revision;await page.getByRole('button',{name:'防御する',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);await page.reload();let blocked=m.dedicated;
 if(!m.dedicated){await passUntil(table,views,g=>g.currentRoll?.purpose==='technique-check'&&g.currentRoll.stage==='after-roll',300);await page.reload();const roll=views.get(a)!.game!.currentRoll!;expect(roll).toMatchObject({rollerId:a,modifier:-1,threshold:5});expect(views.get(b)!.game!.currentRoll).not.toHaveProperty('threshold');blocked=!roll.success;}
 await passUntil(table,views,g=>!g.activeWindow,400);await page.reload();const done=views.get(b)!.game!;expect([done.players[a]!.damage,done.players[b]!.damage,done.players[c]!.damage]).toEqual([0,m.three?(blocked?14:21):(blocked?0:5),m.three?21:0]);expect(done.self.hand).not.toContain(m.card);expect(done.phase).toBe('withdrawal');expect(done.seatOrder[done.turnSeat]).toBe(a);if(m.dedicated)expect(done.recentRolls.filter(r=>r.purpose==='technique-check')).toEqual([]);
 }finally{await table.close();}
});
