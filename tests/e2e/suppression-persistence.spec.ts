import {expect,test,type Browser,type APIRequestContext,type Locator} from '@playwright/test';
import type {SuppressionScenarioName} from '../../apps/worker/test/fixtures/suppression-scenarios.js';
import {observe,tableFixture,windowPassButtonName} from './helpers.js';

async function persistence({browser,request}:{browser:Browser;request:APIRequestContext},scenario:SuppressionScenarioName){
  test.setTimeout(90000);
  const table=await tableFixture(browser,request,scenario);
  try{
    const views=await observe(table),[a,b,c]=table.sessions.map(p=>p.id) as [string,string,string,string];
    const ban=scenario.includes('-ban-'),otherworld=scenario.endsWith('otherworld');
    const target=ban?a:scenario.includes('-target-')?b:c,targetName=table.sessions.find(p=>p.id===target)!.name;
    const stored=async()=>{const r=await request.get(`/__test/rooms/${table.roomId}/game`);expect(r.ok()).toBe(true);return r.json();};
    const before=await stored();
    expect(before.suppressionDesignations).toHaveLength(1);expect(before.blessingLeases??[]).toHaveLength(ban?0:1);
    expect(before.players[target].presence??'active').toBe('active');expect(before.players[target].statuses??[]).toEqual([]);
    async function click(button:Locator){const rev=views.get(a)!.revision;await button.click();await expect.poll(()=>views.get(a)?.revision).toBeGreaterThan(rev);}
    const page=table.pages[3]!,name=otherworld?'裂界':scenario.endsWith('confusion')?'錯乱':'催眠';
    if(otherworld)await page.getByRole('region',{name:'自分の詠唱',exact:true}).getByRole('button',{name:'裂界を選ぶ',exact:true}).click();
    else await page.getByRole('region',{name:'自分の手札',exact:true}).getByRole('button',{name,exact:true}).click();
    await page.getByRole('checkbox',{name:'専用技として使う',exact:true}).setChecked(false);
    await page.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:page.getByRole('heading',{name:targetName,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();
    await click(page.getByRole('button',{name:'攻撃を確認して実行',exact:true}));
    for(let n=0;n<300;n++){
      const current=views.get(a)!,g=current.game!,w=g.activeWindow;if(!w)break;
      const actor=w.pendingActorId;await expect.poll(()=>views.get(actor)?.revision).toBe(current.revision);
      const p=table.pages[table.sessions.findIndex(s=>s.id===actor)]!;
      if(views.get(actor)!.game!.lifetimeDecision)await click(p.getByRole('button',{name:'精神力−3で判定する',exact:true}));
      else await click(p.getByRole('button',{name:windowPassButtonName}));
    }
    expect(views.get(a)!.game!.activeWindow).toBeNull();
    const after=await stored();expect(after.outcome).toBeUndefined();
    if(otherworld){expect(after.players[target].presence).toBe('otherworld');expect(after.players[target].lifeId).toBe(before.players[target].lifeId);}
    else expect(after.players[target].statuses).toContainEqual(expect.objectContaining({kind:scenario.endsWith('confusion')?'ability-disabled':'stopped'}));
    expect(after.suppressionDesignations).toEqual(before.suppressionDesignations);expect(after.blessingLeases??[]).toEqual(before.blessingLeases??[]);
    for(const [i,p] of table.pages.entries()){
      await p.reload();await expect(p.getByRole('region',{name:'自分の手札'})).toBeVisible();
      await expect.poll(()=>views.get(table.sessions[i]!.id)?.game?.suppressionTargets).toEqual([{targetId:b,designated:true,applicability:ban?'suppressed':'relieved'}]);
      await expect(p.getByRole('region',{name:'能力の禁止と祝福'})).toContainText(ban?'特殊能力を使用できません':'祝福');
      expect(views.get(table.sessions[i]!.id)!.game!.players[target]!.presence).toBe(after.players[target].presence??'active');
    }
    expect(await stored()).toEqual(after);
  }finally{await table.close();}
}

test('actual confusion on Vanmil retains his ban after all-seat reload',async ({browser,request})=>persistence({browser,request},'suppression-persist-ban-confusion'));
test('actual hypnosis on Vanmil retains his ban after all-seat reload',async ({browser,request})=>persistence({browser,request},'suppression-persist-ban-hypnosis'));
test('actual Rift sends Vanmil away without removing his ban after all-seat reload',async ({browser,request})=>persistence({browser,request},'suppression-persist-ban-otherworld'));
test('actual confusion on Lia retains her lease after all-seat reload',async ({browser,request})=>persistence({browser,request},'suppression-persist-source-confusion'));
test('actual hypnosis on Lia retains her lease after all-seat reload',async ({browser,request})=>persistence({browser,request},'suppression-persist-source-hypnosis'));
test('actual Rift sends Lia away without removing her lease after all-seat reload',async ({browser,request})=>persistence({browser,request},'suppression-persist-source-otherworld'));
test('actual Rift sends the blessed target away without removing its lease after all-seat reload',async ({browser,request})=>persistence({browser,request},'suppression-persist-target-otherworld'));
