import type {Browser,APIRequestContext} from '@playwright/test';
import {expect,test,type Locator} from '@playwright/test';
import {getAction} from '../../packages/catalog/src/index.js';
import {observe,passUntil,tableFixture,storedDiscard} from './helpers.js';
type Table=Awaited<ReturnType<typeof tableFixture>>;
type Views=Awaited<ReturnType<typeof observe>>;
async function click(table:Table,views:Views,button:Locator) {
  const owner=table.sessions[0]!.id,revision=views.get(owner)!.revision;
  await button.click();await expect.poll(()=>views.get(owner)?.revision).toBeGreaterThan(revision);
}
async function heal(table:Table,views:Views) {
  const p=table.pages[0]!,id=views.get(table.sessions[0]!.id)!.game!.self.hand.find(id=>getAction(id)?.name==='封傷')!;
  await p.getByLabel('手番技として使うカード').selectOption(id);
  await click(table,views,p.getByRole('button',{name:'手番技を使う',exact:true}));return id;
}
test('sword discard waits for hidden Cham to reveal and survives recipient reload',async({browser,request})=>{
  const table=await tableFixture(browser,request,'reclaim-sword-discard');
  try{
    const views=await observe(table),owner=table.sessions[0]!.id,cham=table.sessions[2]!.id,p=table.pages[0]!;
    await click(table,views,p.getByRole('button',{name:'行動を終える',exact:true}));
    await p.getByRole('region',{name:'自分の手札'}).getByRole('button',{name:'ふぇありぃそぅど',exact:true}).click();
    await click(table,views,p.getByRole('button',{name:'選んだ1枚を捨てて手番を終える',exact:true}));
    expect((await storedDiscard())).toContain('a2-p04-r2c1');expect(views.get(owner)!.game!.turnSeat).toBe(0);
    await passUntil(table,views,g=>g.reclaim?.pendingActorId===cham);
    const recipient=table.pages[2]!,panel=recipient.getByRole('region',{name:'カードの回収'});
    await recipient.reload();await expect(panel.getByRole('button')).toHaveCount(1);
    await click(table,views,recipient.getByRole('button',{name:'正体を公開',exact:true}));
    await expect(panel.getByRole('button',{name:'ふぇありぃそぅどを回収する',exact:true})).toBeEnabled();
    await recipient.reload();await click(table,views,panel.getByRole('button',{name:'ふぇありぃそぅどを回収する',exact:true}));
    expect(views.get(cham)!.game!.self.hand).toContain('a2-p04-r2c1');expect((await storedDiscard())).not.toContain('a2-p04-r2c1');
    expect(views.get(owner)!.game!.turnSeat).toBe(1);
  }finally{await table.close();}
});
test('Cham installs the actual sword through its turn card control and resumes the spent action',async({browser,request})=>{
  const table=await tableFixture(browser,request,'reclaim-sword-install');
  try{
    const views=await observe(table),owner=table.sessions[0]!.id,p=table.pages[0]!;
    await click(table,views,p.getByRole('button',{name:'ふぇありぃそぅどを設置する',exact:true}));await p.reload();
    await passUntil(table,views,g=>!g.activeWindow);
    expect(views.get(owner)!.game!.players[owner]!.attachments).toContain('a2-p04-r2c1');expect(views.get(owner)!.game!.phase).toBe('hand-adjustment');
    await expect(p.getByRole('button',{name:'ふぇありぃそぅどを設置する',exact:true})).toHaveCount(0);
  }finally{await table.close();}
});
test('combat payment pauses through reload before continuing the same partial defense',async({browser,request})=>{
  const table=await tableFixture(browser,request,'property-lancaster');
  try{
    const views=await observe(table),owner=table.sessions[0]!.id,b=table.sessions[1]!.id;
    await passUntil(table,views,g=>g.activeWindow?.kind==='normal-defense');
    const p=table.pages[1]!,card=views.get(b)!.game!.self.hand.find(id=>getAction(id)?.modes?.some(m=>m.playMode==='distance'))!;
    await p.getByRole('complementary',{name:'現在の判断'}).getByLabel('使うカード').selectOption(card);
    await click(table,views,p.getByRole('button',{name:'間合いを使う',exact:true}));
    const decision=views.get(owner)!.game!.reclaim!.decisionId;await p.reload();
    const panel=p.getByRole('region',{name:'カードの回収'});await expect(panel.getByRole('button',{name:'回収せずに進む',exact:true})).toBeEnabled();
    expect(views.get(owner)!.game!.reclaim!.decisionId).toBe(decision);
    await expect(p.getByRole('button',{name:'間合いを使う',exact:true})).toHaveCount(0);
    await passUntil(table,views,g=>g.activeWindow?.kind!=='reclaim');
    expect(views.get(owner)!.game!.activeWindow).toMatchObject({kind:'normal-defense',pendingActorId:b});
    expect(views.get(owner)!.game!.maaiDefense!.targets[0]).toMatchObject({submitted:1,remaining:1});
    await expect(p.getByRole('region',{name:'間合いの状況'})).toContainText('あと1枚');
  }finally{await table.close();}
});
test('distance source responses survive reload and return to the action controls',async({browser,request})=>{
  const table=await tableFixture(browser,request,'reclaim-distance');
  try{
    const views=await observe(table),owner=table.sessions[0]!.id,p=table.pages[0]!;
    await p.getByRole('region',{name:'自分の手札'}).getByRole('button',{name:'踏み込み／蹴る',exact:true}).click();
    await p.getByRole('article').filter({has:p.getByRole('heading',{name:'楓',exact:true})}).getByLabel('対象に選ぶ').check();
    await click(table,views,p.getByRole('button',{name:'接近',exact:true}));
    const response=table.pages[1]!.getByRole('complementary',{name:'現在の判断'});
    const maai=views.get(table.sessions[1]!.id)!.game!.self.hand.find(id=>getAction(id)?.name==='間合い／休息')!;
    await response.getByLabel('使うカード').selectOption(maai);
    await click(table,views,response.getByRole('button',{name:'間合いを使う',exact:true}));
    await click(table,views,p.getByRole('button',{name:'パス',exact:true}));
    const panel=p.getByRole('region',{name:'カードの回収'});
    await expect(panel.getByRole('button')).toHaveCount(1);await p.reload();
    await expect(panel.getByRole('button',{name:'回収せずに進む',exact:true})).toBeEnabled();
    await passUntil(table,views,g=>!g.activeWindow);
    expect(views.get(owner)!.game!.phase).toBe('action');
    await expect(p.getByRole('region',{name:'現在できる操作'}).getByRole('button',{name:'行動を終える',exact:true})).toBeEnabled();
  }finally{await table.close();}
});
for(const scenario of ['reclaim-courage','reclaim-courage-fail'] as const)test(`${scenario} uses the actual card and restores the printed check after reload`,async({browser,request})=>{
  const table=await tableFixture(browser,request,scenario);
  try{
    const views=await observe(table),owner=table.sessions[0]!.id,lester=table.sessions[2]!.id;
    await click(table,views,table.pages[0]!.getByRole('button',{name:'勇気を使う',exact:true}));
    await passUntil(table,views,g=>g.activeWindow?.kind==='reclaim');
    await passUntil(table,views,g=>g.reclaim?.pendingActorId===lester);
    const checkerPanel=table.pages[2]!.getByRole('region',{name:'カードの回収'});
    await expect(checkerPanel.getByRole('button')).toHaveCount(1);
    await click(table,views,table.pages[2]!.getByRole('button',{name:'正体を公開',exact:true}));
    await click(table,views,checkerPanel.getByRole('button',{name:'レスターとして回収判定をする',exact:true}));
    const decision=views.get(owner)!.game!.reclaim!.decisionId;
    await table.pages[2]!.reload();
    await expect(checkerPanel.getByRole('status')).toContainText('回収判定を進めています');
    expect(views.get(owner)!.game!.reclaim!.decisionId).toBe(decision);
    await passUntil(table,views,g=>g.activeWindow?.kind==='reclaim');
    if(scenario==='reclaim-courage'){
      await table.pages[0]!.reload();
      const recipientPanel=table.pages[0]!.getByRole('region',{name:'カードの回収'});
      await expect(recipientPanel.getByRole('button',{name:'勇気を回収する',exact:true})).toBeEnabled();
      await expect(checkerPanel.getByRole('button')).toHaveCount(0);
      await click(table,views,recipientPanel.getByRole('button',{name:'勇気を回収する',exact:true}));
      expect(views.get(owner)!.game!.reservedCards).toContain('a2-p01-r3c3');
      expect(views.get(owner)!.game!.self.hand).not.toContain('a2-p01-r3c3');
    }else expect(views.get(owner)!.game!.reclaim!.pendingActorId).toBe(table.sessions[3]!.id);
    await passUntil(table,views,g=>!g.activeWindow,160);
    expect(views.get(owner)!.game!.self.hand.includes('a2-p01-r3c3')).toBe(scenario==='reclaim-courage');
    expect(views.get(lester)!.game!.self.hand).not.toContain('a2-p01-r3c3');
  }finally{await table.close();}
});
test('ordinary recovery survives chooser reload and does not reopen the used main action',async({browser,request})=>{
  const table=await tableFixture(browser,request,'reclaim-owned');
  try {
    const views=await observe(table),owner=table.sessions[0]!.id,cardId=await heal(table,views);
    await passUntil(table,views,g=>g.activeWindow?.kind==='reclaim');
    const decision=views.get(owner)!.game!.reclaim!.decisionId;
    await table.pages[0]!.reload();
    const panel=table.pages[0]!.getByRole('region',{name:'カードの回収'});
    const take=panel.getByRole('button',{name:'通常回収（この名称は試合中1回）',exact:true});
    await expect(take).toBeEnabled();expect(views.get(owner)!.game!.reclaim!.decisionId).toBe(decision);
    for(const p of table.pages.slice(1))await expect(p.getByRole('region',{name:'カードの回収'}).getByRole('button')).toHaveCount(0);
    await click(table,views,take);
    expect(views.get(owner)!.game!.self.hand).toContain(cardId);
    expect(views.get(owner)!.game!.phase).toBe('hand-adjustment');
    await expect(table.pages[0]!.getByRole('button',{name:'手番技を使う',exact:true})).toHaveCount(0);
  }finally{await table.close();}
});
test('an unowned recovery response waits through reload and advances only after explicit decline',async({browser,request})=>{
  const table=await tableFixture(browser,request,'reclaim-unowned');
  try {
    const views=await observe(table),owner=table.sessions[0]!.id;await heal(table,views);
    await passUntil(table,views,g=>g.activeWindow?.kind==='reclaim');
    const before=views.get(owner)!.game!.activeWindow;
    await table.pages[0]!.reload();
    const panel=table.pages[0]!.getByRole('region',{name:'カードの回収'});
    await expect(panel.getByRole('button',{name:'回収せずに進む',exact:true})).toBeEnabled();
    expect(views.get(owner)!.game!.activeWindow).toEqual(before);
    await expect(panel.getByRole('button')).toHaveCount(1);
    await click(table,views,panel.getByRole('button',{name:'回収せずに進む',exact:true}));
    expect(views.get(owner)!.game!.activeWindow!.pendingActorId).toBe(table.sessions[1]!.id);
    await passUntil(table,views,g=>!g.activeWindow);
    expect(views.get(owner)!.game!.phase).toBe('hand-adjustment');
  }finally{await table.close();}
});
test('reclaimed cancellation is visibly reserved across reload until its parent finishes',async({browser,request})=>{
  const table=await tableFixture(browser,request,'reclaim-owned');
  try {
    const views=await observe(table),b=table.sessions[1]!.id;await heal(table,views);
    await click(table,views,table.pages[0]!.getByRole('button',{name:'パス',exact:true}));
    const response=table.pages[1]!.getByRole('complementary',{name:'現在の判断'});
    await response.getByLabel('使うカード').selectOption('a2-p02-r2c3');
    await click(table,views,response.getByRole('button',{name:'割り込みを使う',exact:true}));
    await passUntil(table,views,g=>g.activeWindow?.kind==='reclaim');
    const panel=table.pages[1]!.getByRole('region',{name:'カードの回収'});
    await click(table,views,panel.getByRole('button',{name:'通常回収（この名称は試合中1回）',exact:true}));
    await expect(panel.getByRole('heading',{name:'回収予約中',exact:true})).toBeVisible();
    expect(views.get(b)!.game!.self.hand).not.toContain('a2-p02-r2c3');
    await table.pages[1]!.reload();
    await expect(panel.getByRole('heading',{name:'回収予約中',exact:true})).toBeVisible();
    await passUntil(table,views,g=>!g.activeWindow,160);
    expect(views.get(b)!.game!.self.hand.filter(id=>id==='a2-p02-r2c3')).toHaveLength(1);
    expect(views.get(b)!.game!.reservedCards).toEqual([]);
  }finally{await table.close();}
});
for(const kind of ['rest','potion'] as const)test(`${kind} batch reloads between physical declarations and cancels only its first card`,async({browser,request})=>{
 const table=await tableFixture(browser,request,kind==='rest'?'reclaim-rest':'reclaim-potion');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,p=table.pages[0]!,responder=table.pages[1]!;
  const name=kind==='rest'?'間合い／休息':'回復の薬',cards=views.get(owner)!.game!.self.hand.filter(id=>getAction(id)?.name===name).slice(0,2);expect(cards).toHaveLength(2);
  const buttons=p.getByRole('region',{name:'自分の手札'}).getByRole('button',{name,exact:true});await buttons.nth(0).click();await buttons.nth(1).click();
  await click(table,views,p.getByRole('button',{name:kind==='rest'?'休息':'カードを使う',exact:true}));
  await p.reload();await expect.poll(()=>views.get(owner)?.game?.activeWindow?.kind).toBe('declaration');expect(views.get(owner)!.game!.self.damage).toBe(8);
  await passUntil(table,views,game=>game.activeWindow?.pendingActorId===table.sessions[1]!.id);
  const fate=views.get(table.sessions[1]!.id)!.game!.self.hand.find(id=>getAction(id)?.name==='命運凶変')!;
  await responder.getByLabel('割り込み効果').selectOption('cancel');await responder.getByRole('combobox',{name:'使うカード',exact:true}).selectOption(fate);
  await click(table,views,responder.getByRole('button',{name:'割り込みを使う',exact:true}));
  await passUntil(table,views,game=>game.currentAction?.source==='card'&&game.currentAction.cardInstanceId===cards[1]);
  expect(views.get(owner)!.game!.self.damage).toBe(8);await p.reload();
  await expect.poll(()=>views.get(owner)?.game?.activeWindow?.kind).toBe('declaration');
  let amount=1;
  if(kind==='potion'){
   const rolled=await passUntil(table,views,game=>game.currentRoll?.purpose==='potion-recovery');amount=rolled.currentRoll!.total!;
   await p.reload();await expect(p.getByRole('region',{name:'サイコロの結果'})).toBeVisible();
  }
  const done=await passUntil(table,views,game=>!game.activeWindow);expect(views.get(owner)!.game!.self.damage).toBe(Math.max(0,8-amount));expect(done.phase).toBe('hand-adjustment');
  for(const card of cards)expect((await storedDiscard()).filter(id=>id===card)).toHaveLength(1);
 }finally{await table.close();}
});
for(const kind of ['book','training','dedicated','crown','crystal'] as const)test(`early-turn ${kind} has an actual card control and survives declaration or roll reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-early');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,p=table.pages[0]!,panel=p.getByRole('region',{name:'手番カードの効果'});
  const name=kind==='book'?'秘伝書':kind==='crown'?'ソロモン王の冠':kind==='crystal'?'赤い水晶球':'修行（戦士技）';
  const count=views.get(owner)!.game!.self.hand.length;
  await click(table,views,panel.getByRole('button',{name:`${name}を使う${kind==='dedicated'?'（判定不要）':''}`,exact:true}));
  await p.reload();await expect.poll(()=>views.get(owner)?.game?.activeWindow?.kind).toBe('declaration');
  let amount=0;
  if(kind==='book'||kind==='training'){
   const waiting=await passUntil(table,views,game=>game.currentRoll?.purpose===(kind==='book'?'extra-draw':'training'));
   const rollId=waiting.currentRoll!.rollId;await p.reload();await expect(p.getByRole('region',{name:'サイコロの結果'})).toBeVisible();
   expect(views.get(owner)!.game!.currentRoll!.rollId).toBe(rollId);
   if(kind==='book')amount=waiting.currentRoll!.total!;
   else{
    await passUntil(table,views,game=>game.currentRoll?.rollId===rollId&&game.currentRoll.stage==='after-roll');
    await expect(p.getByRole('region',{name:'サイコロの結果'})).toContainText('より大きい');
    expect(views.get(table.sessions[1]!.id)!.game!.currentRoll).not.toHaveProperty('threshold');
   }
  }
  const done=await passUntil(table,views,game=>!game.activeWindow);expect(done.phase).toBe(kind==='book'?'action':'hand-adjustment');
  if(kind==='book'){
   expect(views.get(owner)!.game!.self.hand).toHaveLength(count-1+amount);
   await expect(panel.getByRole('button',{name:'秘伝書を使う',exact:true})).toHaveCount(0);
   await expect(panel.getByRole('button',{name:'修行（戦士技）を使う（判定不要）',exact:true})).toBeEnabled();
  }else if(kind==='dedicated'){
   expect(done.recentRolls.filter(r=>r.purpose==='training')).toHaveLength(0);
   expect(views.get(owner)!.game!.players[owner]!.attachments).toContain('a2-p03-r2c2');
  }else if(kind==='crown'||kind==='crystal')expect(views.get(owner)!.game!.players[owner]!.attachments).toContain(kind==='crown'?'a2-p03-r1c2':'a2-p03-r1c3');
 }finally{await table.close();}
});
for(const kind of ['good','evil','exchange','identity','astrology','mother'] as const)test(`targeted turn ${kind} saves target and private choice through reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-choices');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,target=table.sessions[kind==='identity'?3:1]!.id,p=table.pages[0]!;
  const card=kind==='good'?'a2-p04-r1c1':kind==='evil'?'a2-p04-r1c2':kind==='exchange'?'a2-p04-r1c3':kind==='mother'?'a2-p05-r1c2':'a2-p04-r2c2',name=getAction(card)!.name;
  const initialA=[...views.get(owner)!.game!.self.hand],initialB=[...views.get(target)!.game!.self.hand];
  const beforeSelection=views.get(owner)!.revision;
  await p.getByRole('combobox',{name:`${name}の対象`,exact:true}).selectOption(target);
  if(kind==='exchange'){expect(views.get(owner)!.revision).toBe(beforeSelection);expect(views.get(owner)!.game!.self.hand).toEqual(initialA);}
  await click(table,views,p.getByRole('button',{name:kind==='astrology'?`${name}で占星する`:`${name}を使う`,exact:true}));
  await p.reload();await expect.poll(()=>views.get(owner)?.game?.activeWindow?.kind).toBe('declaration');
  if(kind==='identity'||kind==='astrology'){
   await passUntil(table,views,g=>g.activeWindow?.kind==='private-inspection');const d=views.get(owner)!.game!.inspection!;
   await p.reload();const panel=p.getByRole('complementary',{name:'自分だけの確認内容'});await expect(panel).toBeVisible();
   expect(views.get(table.sessions[2]!.id)!.game!.inspection).toBeNull();expect(views.get(owner)!.game!.inspection!.decisionId).toBe(d.decisionId);
   if(kind==='astrology'){
    await panel.getByRole('radio').first().check();await click(table,views,panel.getByRole('button',{name:'選んだ1枚を捨てさせる',exact:true}));
   }else await click(table,views,panel.getByRole('button',{name:'確認を終える',exact:true}));
  }
  const done=await passUntil(table,views,g=>!g.activeWindow);expect(done.phase).toBe('hand-adjustment');
  if(kind==='exchange'){expect(views.get(owner)!.game!.self.hand).toEqual(initialB);expect(views.get(target)!.game!.self.hand).toEqual(initialA.filter(id=>id!==card));}
  if(kind==='mother')expect(done.players[target]!.attachments).toContain(card);
  if(kind==='good'||kind==='evil'||kind==='mother')expect(views.get(target)!.game!.self.faction).toBe(kind==='evil'?'EVIL':'GOOD');
  if(kind==='identity'){
   await p.reload();await expect(p.getByRole('region',{name:'自分だけの正体確認履歴'})).toBeVisible();
   expect(views.get(table.sessions[2]!.id)!.game!.players[target]).not.toHaveProperty('characterId');
  }
 }finally{await table.close();}
});
for(const kind of ['tragedy','keil','hostage','amulet'] as const)test(`named anytime ${kind} preserves its paid declaration and scoped result after reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,`reclaim-${kind}`);
 try{
  const views=await observe(table),owner=table.sessions[kind==='amulet'?0:1]!.id,p=table.pages[kind==='amulet'?0:1]!,o=views.get(owner)!.game!.anytimeCardOptions[0]!,count=views.get(owner)!.game!.self.hand.length,spirit=views.get(owner)!.game!.self.stats.spirit;
  await click(table,views,p.getByRole('region',{name:'その場で使うカード'}).getByRole('button',{name:o.label,exact:true}));await p.reload();
  await expect.poll(()=>views.get(owner)?.game?.activeWindow?.kind).toBe('declaration');expect(views.get(owner)!.game!.self.hand).toHaveLength(count);
  const done=await passUntil(table,views,g=>!g.activeWindow);expect((await storedDiscard())).toContain(o.cardInstanceId);
  if(kind!=='amulet'){
   expect(views.get(table.sessions[1]!.id)!.game!.self.damage).toBe(0);expect(views.get(table.sessions[2]!.id)!.game!.self.damage).toBe(kind==='keil'?15:0);
  }else expect(done.recentRolls.filter(r=>r.purpose==='ability-check')).toHaveLength(0);
  if(kind==='keil')expect(views.get(owner)!.game!.self.stats.spirit).toBe(spirit+1);
 }finally{await table.close();}
});
test('public Cham can cancel Hostage while character abilities are prohibited and keep the response across reload',async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-hostage');
 try{
  const views=await observe(table),owner=table.sessions[1]!.id,cham=table.sessions[2]!.id,p=table.pages[1]!,c=table.pages[2]!,o=views.get(owner)!.game!.anytimeCardOptions[0]!;
  await click(table,views,p.getByRole('button',{name:o.label,exact:true}));await passUntil(table,views,g=>g.activeWindow?.pendingActorId===cham);
  await expect(c.getByRole('button',{name:'人質を中止する',exact:true})).toHaveCount(0);await click(table,views,c.getByRole('button',{name:'正体を公開',exact:true}));
  await click(table,views,c.getByRole('button',{name:'人質を中止する',exact:true}));await c.reload();await expect.poll(()=>views.get(cham)?.game?.activeWindow?.kind).toBe('declaration');
  expect(views.get(cham)!.game!.reactionTargetAbilityId).toBeNull();await passUntil(table,views,g=>!g.activeWindow);expect(views.get(owner)!.game!.self.damage).toBe(21);
 }finally{await table.close();}
});
for(const kind of ['peace','revelation'] as const)test(`information anytime ${kind} restores its action phase after reload and preserves authorized state`,async({browser,request})=>{
 const table=await tableFixture(browser,request,`reclaim-${kind}`);
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,target=table.sessions[1]!.id,p=table.pages[0]!,b=table.pages[1]!,card=kind==='peace'?'a2-p02-r1c1':'a2-p02-r1c2';
  const o=views.get(owner)!.game!.anytimeCardOptions.find(o=>o.cardInstanceId===card&&o.targetId===target)!;
  await expect(p.getByRole('button',{name:'PLAY_ANYTIME_CARD',exact:true})).toHaveCount(0);await click(table,views,p.getByRole('button',{name:o.label,exact:true}));await p.reload();await expect.poll(()=>views.get(owner)?.game?.activeWindow?.kind).toBe('declaration');
  if(kind==='revelation'){
   await passUntil(table,views,g=>g.activeWindow?.kind==='private-inspection');const d=views.get(owner)!.game!.inspection!;expect(new Set(d.cards.map(c=>c.zone))).toEqual(new Set(['hand','followers','chants']));
   await p.reload();const panel=p.getByRole('complementary',{name:'自分だけの確認内容'});await expect(panel).toContainText('手札・従者・詠唱札');await expect(panel).toContainText('グリフォン');await expect(panel).toContainText('天地百撃斬');expect(views.get(table.sessions[2]!.id)!.game!.inspection).toBeNull();
   await click(table,views,panel.getByRole('button',{name:'確認を終える',exact:true}));
  }
  const done=await passUntil(table,views,g=>!g.activeWindow);expect(done.phase).toBe('action');
  if(kind==='revelation'){
   await p.reload();await expect(p.getByRole('region',{name:'自分だけの啓示の履歴'})).toBeVisible();expect(views.get(table.sessions[2]!.id)!.game!.inspectionHistory).toEqual([]);expect(views.get(owner)!.game!.players[target]).not.toHaveProperty('characterId');
  }else{
   await expect(p.getByRole('region',{name:'愛と平和の期限'})).toContainText('次の本人の手番行動');expect(views.get(target)!.game!.self.stats.spirit).toBe(12);
   await click(table,views,p.getByRole('button',{name:'行動を終える',exact:true}));await click(table,views,p.getByRole('button',{name:'選んだ0枚を捨てて手番を終える',exact:true}));
   await click(table,views,b.getByRole('button',{name:'手番を始める',exact:true}));await click(table,views,b.getByRole('button',{name:'カードを引かない',exact:true}));await click(table,views,b.getByRole('button',{name:'行動を終える',exact:true}));
   await expect(p.getByRole('region',{name:'愛と平和の期限'})).toHaveCount(0);
  }
 }finally{await table.close();}
});

for(const use of [true,false])test(`pre-attack Dispel use=${use} preserves the committed attack through reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-dispel');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,target=table.sessions[1]!.id,p=table.pages[0]!,hand=views.get(owner)!.game!.self.hand.length;
  await p.getByRole('region',{name:'自分の手札'}).getByRole('button',{name:'踏み込み／弓',exact:true}).click();
  await p.locator('article.player').filter({has:p.getByRole('heading',{name:views.get(owner)!.game!.players[target]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();
  if(use)await p.getByRole('combobox',{name:'呪払の対象',exact:true}).selectOption(target);
  await click(table,views,p.getByRole('button',{name:'攻撃を確認して実行',exact:true}));await p.reload();
  expect(views.get(owner)!.game!.self.hand).toHaveLength(hand-(use?2:1));
  await passUntil(table,views,g=>g.activeWindow?.kind==='attack-abilities');
  const g=views.get(owner)!.game!;expect(g.players[target]!.followers).toHaveLength(use?1:2);expect(g.players[target]!.followers.every(f=>f.face==='back')).toBe(true);
  if(use){expect((await storedDiscard())).toContain('a2-p02-r3c1');await expect(p.getByRole('region',{name:'公開ログ'})).toContainText('ウッドゴーレムを破壊しました');}
  else expect(g.self.hand).toContain('a2-p02-r3c1');
  await passUntil(table,views,g=>!g.activeWindow);expect(views.get(owner)!.game!.phase).toBe('withdrawal');
 }finally{await table.close();}
});

for(const use of [true,false])test(`substitute exact hit use=${use} preserves defense restrictions and its original attack after reload`,async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-substitute');
 try{
  const views=await observe(table),owner=table.sessions[2]!.id,target=table.sessions[1]!.id,p=table.pages[2]!,initial=views.get(owner)!.game!,o=initial.anytimeCardOptions.find(o=>o.cardInstanceId==='a2-p02-r2c1'&&o.hitIndex===1)!;
  if(use){
   await click(table,views,p.getByRole('button',{name:o.label,exact:true}));await p.reload();expect(views.get(owner)!.game!.self.hand).toHaveLength(initial.self.hand.length);
   await passUntil(table,views,g=>!!g.currentAttack?.substitution&&g.activeWindow?.kind==='normal-defense');await p.reload();
   const panel=p.getByRole('complementary',{name:'現在の判断'});await expect(panel).toContainText('2発目を引き受けています');await expect(panel).toContainText('手札の反撃技と本人の特殊能力だけ');await expect(panel.getByRole('button',{name:'従者で受ける',exact:true})).toHaveCount(0);await expect(panel.getByRole('button',{name:'間合いを使う',exact:true})).toHaveCount(0);
   await expect(panel.getByRole('combobox',{name:'使うカード'}).locator('option').filter({hasText:'見切る'})).toHaveCount(0);expect(views.get(owner)!.game!.currentAttack!.substitution).toEqual({originalTargetId:target,originalHitIndex:1});
  }
  await passUntil(table,views,g=>!g.activeWindow);expect(views.get(owner)!.game!.players[target]!.damage).toBe(use?14:21);expect(views.get(owner)!.game!.self.damage).toBe(use?28:21);
  if(!use)expect(views.get(owner)!.game!.self.hand).toContain('a2-p02-r2c1');
 }finally{await table.close();}
});

test('substitute OPEN refill resumes its exact saved hit after reload during OPEN roll and defense',async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-substitute-open');
 try{
  const views=await observe(table),owner=table.sessions[2]!.id,target=table.sessions[1]!.id,p=table.pages[2]!,d=table.pages[3]!,o=views.get(owner)!.game!.anytimeCardOptions.find(o=>o.cardInstanceId==='a2-p02-r2c1'&&o.hitIndex===1)!;
  await click(table,views,p.getByRole('button',{name:o.label,exact:true}));await p.reload();expect(views.get(owner)!.game!.activeWindow!.kind).toBe('before-roll');
  await passUntil(table,views,g=>g.activeWindow?.kind==='after-roll');await d.reload();
  const resumed=await passUntil(table,views,g=>['revival','declaration'].includes(g.activeWindow?.kind??''));
  if(resumed.activeWindow!.kind==='revival')await click(table,views,d.getByRole('button',{name:'復活しない',exact:true}));
  await passUntil(table,views,g=>!!g.currentAttack?.substitution&&g.activeWindow?.kind==='normal-defense');await p.reload();await expect(p.getByRole('complementary',{name:'現在の判断'})).toContainText('2発目を引き受けています');
  await passUntil(table,views,g=>!g.activeWindow);expect(views.get(owner)!.game!.self.damage).toBe(28);expect(views.get(owner)!.game!.players[target]!.damage).toBe(14);expect(views.get(owner)!.game!.logs.filter(e=>e.type==='OPEN'&&e.cardInstanceId==='a2-p01-r1c1')).toHaveLength(1);
 }finally{await table.close();}
});

async function verifyS24(browser:Browser,request:APIRequestContext,scenario:'reclaim-extra'|'reclaim-unlimited',usePrinted:boolean){
 const t=await tableFixture(browser,request,scenario);try{const v=await observe(t),owner=t.sessions[0]!.id,p=t.pages[0]!,name=scenario==='reclaim-extra'?'踏み込み／弓':'破山剣';await p.getByRole('region',{name:'自分の手札'}).getByRole('button',{name,exact:true}).click();await p.getByRole('region',{name:'参加者の公開状態'}).getByRole('article').filter({has:p.getByRole('heading',{name:t.sessions[1]!.name,exact:true})}).getByRole('checkbox',{name:'対象に選ぶ'}).check();await click(t,v,p.getByRole('button',{name:'攻撃を確認して実行',exact:true}));await passUntil(t,v,g=>g.activeWindow?.kind==='reclaim');const panel=p.getByRole('region',{name:'カードの回収'});await expect(panel.getByRole('button',{name:'通常回収（この名称は試合中1回）',exact:true})).toBeEnabled();const card=v.get(owner)!.game!.reclaim!.cardInstanceId;await click(t,v,panel.getByRole('button',{name:usePrinted?(scenario==='reclaim-extra'?/妖精の弓で回収/:/主人公で回収/):'通常回収（この名称は試合中1回）'}));await p.reload();if(usePrinted)await expect(panel.getByRole('status')).toContainText('回収能力の宣言を確認しています');await passUntil(t,v,g=>!g.activeWindow);expect(v.get(owner)!.game!.self.hand.filter(id=>id===card)).toHaveLength(1);await expect(p.getByRole('button',{name:'離脱しない',exact:true})).toBeVisible();}finally{await t.close();}
}
test('S24 reclaim-extra chooses recovery printed=true and reloads its declaration',async({browser,request})=>{await verifyS24(browser,request,'reclaim-extra',true);});
test('S24 reclaim-extra chooses recovery printed=false and reloads its declaration',async({browser,request})=>{await verifyS24(browser,request,'reclaim-extra',false);});
test('S24 reclaim-unlimited chooses recovery printed=true and reloads its declaration',async({browser,request})=>{await verifyS24(browser,request,'reclaim-unlimited',true);});
test('S24 reclaim-unlimited chooses recovery printed=false and reloads its declaration',async({browser,request})=>{await verifyS24(browser,request,'reclaim-unlimited',false);});

test('successful Courage decline after reload keeps the final public response visible',async({browser,request})=>{
 const table=await tableFixture(browser,request,'reclaim-courage');
 try{
  const views=await observe(table),owner=table.sessions[0]!.id,lester=table.sessions[2]!.id,last=table.sessions[3]!.id;
  await click(table,views,table.pages[0]!.getByRole('button',{name:'勇気を使う',exact:true}));
  await passUntil(table,views,g=>g.activeWindow?.kind==='reclaim');
  await passUntil(table,views,g=>g.reclaim?.pendingActorId===lester);
  await click(table,views,table.pages[2]!.getByRole('button',{name:'正体を公開',exact:true}));
  await click(table,views,table.pages[2]!.getByRole('button',{name:'レスターとして回収判定をする',exact:true}));
  await passUntil(table,views,g=>g.reclaim?.stage==='beneficiary-choice');
  const decision=views.get(owner)!.game!.reclaim!.decisionId;
  await table.pages[0]!.reload();
  const panel=table.pages[0]!.getByRole('region',{name:'カードの回収'});
  await expect(panel.getByRole('button',{name:'勇気を回収する',exact:true})).toBeEnabled();
  await click(table,views,panel.getByRole('button',{name:'回収せずに進む',exact:true}));
  for(const session of table.sessions)await expect.poll(()=>views.get(session.id)?.game?.reclaim?.pendingActorId).toBe(last);
  expect(views.get(owner)!.game!.reclaim!.decisionId).toBe(decision);
  const lastPanel=table.pages[3]!.getByRole('region',{name:'カードの回収'});
  await table.pages[3]!.reload();
  await click(table,views,lastPanel.getByRole('button',{name:'回収せずに進む',exact:true}));
  await passUntil(table,views,g=>!g.activeWindow,160);
  expect((await storedDiscard()).filter(id=>id==='a2-p01-r3c3')).toHaveLength(1);
  expect(views.get(owner)!.game!.self.hand).not.toContain('a2-p01-r3c3');
 }finally{await table.close();}
});
