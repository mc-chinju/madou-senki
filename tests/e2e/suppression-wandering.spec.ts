import {expect,test,type Browser,type APIRequestContext} from '@playwright/test';
import type {SuppressionScenarioName} from '../../apps/worker/test/fixtures/suppression-scenarios.js';
import {observe,tableFixture} from './helpers.js';
async function wandering({browser,request}:{browser:Browser;request:APIRequestContext},scenario:SuppressionScenarioName){
  const table=await tableFixture(browser,request,scenario);
  try{
    const views=await observe(table),[a,b,c]=table.sessions.map(p=>p.id) as [string,string,string,string];
    const ban=scenario.endsWith('-ban'),target=ban?a:scenario.endsWith('-source')?c:b;
    const stored=async()=>{const r=await request.get(`/__test/rooms/${table.roomId}/game`);expect(r.ok()).toBe(true);return r.json();};
    const before=await stored();expect(before.players[target].presence).toBe('wandering');expect(before.players[target].hand).toEqual([]);
    expect(before.suppressionDesignations).toHaveLength(1);expect(before.blessingLeases??[]).toHaveLength(ban?0:1);
    async function reload(presence:string){for(const [i,page] of table.pages.entries()){
      await page.reload();await expect(page.getByRole('region',{name:'自分の手札'})).toBeVisible();
      await expect.poll(()=>views.get(table.sessions[i]!.id)?.game?.players[target]?.presence).toBe(presence);
      expect(views.get(table.sessions[i]!.id)!.game!.suppressionTargets).toEqual([{targetId:b,designated:true,applicability:ban?'suppressed':'relieved'}]);
      await expect(page.getByRole('region',{name:'能力の禁止と祝福'})).toContainText('楓');
    }}
    await reload('wandering');expect(await stored()).toEqual(before);
    const revision=views.get(a)!.revision;await table.pages[3]!.getByRole('button',{name:'行動を終える',exact:true}).click();await expect.poll(()=>views.get(a)?.revision).toBe(revision+1);
    const after=await stored();expect(after.suppressionDesignations).toEqual(before.suppressionDesignations);expect(after.blessingLeases??[]).toEqual(before.blessingLeases??[]);
    expect(after.players[target].characterId).toBe(before.players[target].characterId);expect(after.players[target].lifeId).toBe(before.players[target].lifeId);
    await reload(after.players[target].presence);expect(await stored()).toEqual(after);
  }finally{await table.close();}
}
test('structural wandering Vanmil keeps his established ban across reload and a real command',async({browser,request})=>wandering({browser,request},'suppression-wandering-ban'));
test('structural wandering Lia keeps her established lease across reload and a real command',async({browser,request})=>wandering({browser,request},'suppression-wandering-source'));
test('structural wandering target keeps its established lease across reload and a real command',async({browser,request})=>wandering({browser,request},'suppression-wandering-target'));
