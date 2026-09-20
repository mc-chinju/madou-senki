import type {PlayerView} from '@madou/engine';
import {getAction} from '@madou/catalog';
export function InformationHistoryPanel({view}:{view:Pick<PlayerView,'inspectionHistory'|'peaceExpiries'|'players'>}){
 const zones={hand:'手札',followers:'従者',chants:'詠唱札'};
 // The same history holds what a card named: a row of cards here, an identity in the panel that asked for it.
 const revelations=view.inspectionHistory.filter(d=>d.zone!=='character');
 return <>{view.peaceExpiries.length?<section className="panel" aria-label="愛と平和の期限"><h2>愛と平和の期限</h2>{view.peaceExpiries.map((e,i)=><p key={i}>{view.players[e.targetId]!.name}：精神力の基礎値12。{e.timing==='current-action'?'現在の行動とそこから続く反応が終わるまで':'次の本人の手番行動が終わるまで'}。</p>)}</section>:null}
 {revelations.length?<section className="panel" aria-label="自分だけの啓示の履歴"><h2>自分だけの啓示の履歴</h2><p>確認した時点の札です。その後に得た札は含みません。</p>{revelations.map(d=><details key={d.decisionId}><summary>{view.players[d.targetId]!.name}の確認内容</summary><ul>{d.cards.map(c=><li key={c.cardInstanceId}>{c.zone?zones[c.zone]:''} {c.position+1}：{getAction(c.cardInstanceId)?.name}</li>)}</ul></details>)}</section>:null}</>;
}
