import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReclaimPanel} from '../src/game/ReclaimPanel.js';
import {reclaimCommand,type ReclaimInputView} from '../src/game/reclaim-input.js';
function view():ReclaimInputView {return {
  legalChoices:['CHOOSE_RECLAIM','PASS'],reservedCards:[],players:{A:{name:'葵'},B:{name:'楓'}},
  reclaim:{decisionId:'reclaim-1',cardInstanceId:'a2-p06-r2c3',stage:'responses',pendingActorId:'A',canDecline:true,
    claims:[{claimId:'reclaim-1-A-base',right:'base',label:'通常回収（この名称は試合中1回）',action:'take'}]},
};}
it('submits only a current private claim or explicit decline',()=>{
  const s=view();expect(reclaimCommand(s,'reclaim-1-A-base')).toEqual({type:'CHOOSE_RECLAIM',decisionId:'reclaim-1',choice:'take',claimId:'reclaim-1-A-base'});
  expect(reclaimCommand(s)).toEqual({type:'CHOOSE_RECLAIM',decisionId:'reclaim-1',choice:'decline'});
  expect(reclaimCommand(s,'stale')).toBeNull();
  expect(reclaimCommand({...s,legalChoices:[]})).toBeNull();
  expect(reclaimCommand({...s,reclaim:{...s.reclaim!,canDecline:false}})).toBeNull();
});
it('a zero-claim chooser still sees an explicit decline and the suspended parent explanation',()=>{
  const s=view();s.reclaim!.claims=[];
  const html=renderToStaticMarkup(createElement(ReclaimPanel,{view:s,disabled:false,send:()=>true}));
  expect(html).toContain('回収せずに進む');expect(html).toContain('元の処理');
  expect(html).not.toContain('通常回収（');expect(html).not.toContain('reclaim-1');
});
it('another seat sees the pending public name without private rights or action buttons',()=>{
  const s=view();s.legalChoices=[];s.reclaim!.claims=[];s.reclaim!.canDecline=false;
  const html=renderToStaticMarkup(createElement(ReclaimPanel,{view:s,disabled:false,send:()=>true}));
  expect(html).toContain('葵');expect(html).toContain('回答を待っています');
  expect(html).not.toContain('<button');expect(html).not.toContain('回収権がありません');
});
it('reserved cards remain labelled unavailable until the parent completes',()=>{
  const s=view();s.reclaim=null;s.reservedCards=['a2-p05-r2c3'];
  const html=renderToStaticMarkup(createElement(ReclaimPanel,{view:s,disabled:true,send:()=>true}));
  expect(html).toContain('回収予約中');expect(html).toContain('必勝の祈り');expect(html).toContain('まだ使えません');
});
