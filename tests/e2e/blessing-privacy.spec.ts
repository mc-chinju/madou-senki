import { expect, test, type Locator } from '@playwright/test';
import { observe, passUntil, tableFixture, windowPassButtonName } from './helpers.js';

const BAN = 'c2-p07-r1c2-ab03', BLESS = 'c2-p03-r1c2-ab04';
type Table = Awaited<ReturnType<typeof tableFixture>>;
type Views = Awaited<ReturnType<typeof observe>>;
async function click(table: Table, views: Views, button: Locator) {
  const owner = table.sessions[0]!.id; const revision = views.get(owner)!.revision;
  await button.click();
  await expect.poll(() => views.get(owner)?.revision).toBeGreaterThan(revision);
}
async function toLiaTurn(table: Table, views: Views, indices=[0,1], next=2) {
  const owner = table.sessions[0]!.id;
  for (const index of indices) {
    const page = table.pages[index]!;
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    if (views.get(owner)!.game!.phase === 'turn-start') {
      await click(table, views, button('手番を始める'));
      await passUntil(table, views, game => !game.activeWindow);
      await click(table, views, button('カードを引かない'));
      await passUntil(table, views, game => !game.activeWindow);
    }
    if (views.get(owner)!.game!.phase === 'action') await click(table, views, button('行動を終える'));
    if (views.get(owner)!.game!.phase === 'withdrawal') await click(table, views, button('離脱しない'));
    const own = views.get(table.sessions[index]!.id)!.game!.self;
    const required = Math.max(0, own.hand.length - own.stats.handLimit);
    const cards = page.getByRole('region', { name: '自分の手札' }).locator('button.card-face');
    for (let i = 0; i < required; i++) await cards.nth(i).click();
    await click(table, views, button(`選んだ${required}枚を捨てて手番を終える`));
    await passUntil(table, views, game => !game.activeWindow);
  }
  await click(table, views, table.pages[next]!.getByRole('button', { name: '手番を始める', exact: true }));
  await passUntil(table, views, game => !game.activeWindow);
  await click(table, views, table.pages[next]!.getByRole('button', { name: 'カードを引かない', exact: true }));
  await passUntil(table, views, game => !game.activeWindow);
}

test('actual exempt and ordinary Blessing share checks attempts and outside transcripts across all-seat reload',async({browser,request})=>{
  test.setTimeout(120000);
  const ordinary=await tableFixture(browser,request,'suppression-blessing-paired');
  const exempt=await tableFixture(browser,request,'suppression-blessing-exempt');
  try{
    const tables=[ordinary,exempt],views=await Promise.all(tables.map(table=>observe(table)));
    function normalized(table:Table,value:unknown):unknown{
      const replace=(text:string)=>table.sessions.reduce((s,p,i)=>s.replaceAll(p.id,`seat-${i}`),text);
      if(typeof value==='string')return replace(value);
      if(Array.isArray(value))return value.map(v=>normalized(table,v));
      if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[replace(k),normalized(table,v)]));
      return value;
    }
    function same(){for(const seat of [0,2,3])expect(normalized(exempt,views[1]!.get(exempt.sessions[seat]!.id)!.game)).toEqual(normalized(ordinary,views[0]!.get(ordinary.sessions[seat]!.id)!.game));}
    same();
    for(const [index,table] of tables.entries()){
      const panel=table.pages[0]!.getByRole('region',{name:'能力の禁止と祝福'});
      await panel.getByRole('checkbox',{name:'楓',exact:true}).check();await click(table,views[index]!,panel.getByRole('button',{name:'神と人の差を使う',exact:true}));
    }
    same();
    for(let n=0;n<150;n++){
      const g=views[0]!.get(ordinary.sessions[0]!.id)!.game!;if(!g.activeWindow)break;
      const seat=ordinary.sessions.findIndex(p=>p.id===g.activeWindow!.pendingActorId);
      for(const [index,table] of tables.entries())await click(table,views[index]!,table.pages[seat]!.getByRole('button',{name:windowPassButtonName}));
      same();
    }
    for(const [index,table] of tables.entries()){
      expect(views[index]!.get(table.sessions[0]!.id)!.game!.activeWindow).toBeNull();
      for(const page of table.pages)await page.reload();
    }
    same();
    expect(views[0]!.get(ordinary.sessions[1]!.id)!.game!.suppressionTargets[0]!.applicability).toBe('suppressed');
    expect(views[1]!.get(exempt.sessions[1]!.id)!.game!.suppressionTargets[0]!.applicability).toBe('exempt');
    for(const [index,table] of tables.entries())await toLiaTurn(table,views[index]!);same();
    for(const [index,table] of tables.entries()){
      const panel=table.pages[2]!.getByRole('region',{name:'能力の禁止と祝福'});await panel.getByLabel('祝福する対象').selectOption(table.sessions[1]!.id);await click(table,views[index]!,panel.getByRole('button',{name:'祝福を使う',exact:true}));
    }same();
    let sawRoll=false;
    for(let n=0;n<150;n++){
      const g=views[0]!.get(ordinary.sessions[0]!.id)!.game!;
      const roll=views[0]!.get(ordinary.sessions[2]!.id)!.game!.currentRoll;
      if(roll?.stage==='after-roll'){sawRoll=true;expect(roll).toMatchObject({formula:'2d6',modifier:-5,faces:[1,1],success:true});for(const table of tables)for(const page of table.pages)await page.reload();same();}
      if(!g.activeWindow)break;const seat=ordinary.sessions.findIndex(p=>p.id===g.activeWindow!.pendingActorId);
      for(const [index,table] of tables.entries())await click(table,views[index]!,table.pages[seat]!.getByRole('button',{name:windowPassButtonName}));same();
    }
    expect(sawRoll).toBe(true);
    for(const [index,table] of tables.entries()){for(const page of table.pages)await page.reload();const own=views[index]!.get(table.sessions[2]!.id)!.game!;expect(own.activeWindow).toBeNull();expect(own.abilityOptions.some(o=>o.abilityId===BLESS)).toBe(false);await expect(table.pages[2]!.getByRole('button',{name:'行動を終える',exact:true})).toBeVisible();}same();
    const leases=[];for(const table of tables){const saved=await(await request.get(`/__test/rooms/${table.roomId}/game`)).json();expect(saved.blessingLeases).toHaveLength(1);leases.push(normalized(table,saved.blessingLeases));}expect(leases[1]).toEqual(leases[0]);
    expect(views[0]!.get(ordinary.sessions[1]!.id)!.game!.suppressionTargets[0]!.applicability).toBe('relieved');
    expect(views[1]!.get(exempt.sessions[1]!.id)!.game!.suppressionTargets[0]!.applicability).toBe('exempt');
  }finally{await Promise.all([ordinary.close(),exempt.close()]);}
});
