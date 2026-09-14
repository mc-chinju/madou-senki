import {expect,test} from '@playwright/test';
import {observe,tableFixture} from './helpers.js';

test('structural Lia identity loss keeps the target suppressed through reload and a real action',async({browser,request})=>{
  const table=await tableFixture(browser,request,'suppression-identity-boundary');
  try {
    const views=await observe(table),[a,b,c]=table.sessions.map(p=>p.id) as [string,string,string,string];
    const stored=async()=>{
      const response=await request.get(`/__test/rooms/${table.roomId}/game`);
      expect(response.ok()).toBe(true);return response.json();
    };
    const before=await stored();
    expect(before.blessingLeases).toHaveLength(1);
    const lease=before.blessingLeases[0];
    expect(lease).toMatchObject({sourceActorId:c,sourceCharacterId:'c2-p03-r1c2',targetId:b});
    expect(lease.sourceLifeId).toBe(before.players[c].lifeId??`initial-life:${c}`);
    expect(before.players[c].characterId).not.toBe(lease.sourceCharacterId);
    async function reloadAndCheck(){
      for(const [i,page] of table.pages.entries()){
        await page.reload();await expect(page.getByRole('region',{name:'自分の手札'})).toBeVisible();
        await expect.poll(()=>views.get(table.sessions[i]!.id)?.game?.suppressionTargets).toEqual([{targetId:b,designated:true,applicability:'suppressed'}]);
        await expect(page.getByRole('region',{name:'能力の禁止と祝福'})).toContainText('楓');
      }
    }
    await reloadAndCheck();expect(await stored()).toEqual(before);
    const revision=views.get(a)!.revision;
    await table.pages[2]!.getByRole('button',{name:'行動を終える',exact:true}).click();
    await expect.poll(()=>views.get(a)?.revision).toBe(revision+1);
    const after=await stored();
    expect(after.blessingLeases).toEqual([]);
    expect(after.suppressionDesignations).toEqual(before.suppressionDesignations);
    expect(after.players[c].lifeId).toBe(before.players[c].lifeId);
    await reloadAndCheck();expect(await stored()).toEqual(after);
  } finally {await table.close();}
});
