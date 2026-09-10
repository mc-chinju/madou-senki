import {useState} from 'react';
import {getAction} from '@madou/catalog';
import type {PlayerView} from '@madou/engine';
import type {ClientEnvelope} from '@madou/protocol';
export function ShadowJumpPanel({view,disabled,send}:{view:PlayerView;disabled:boolean;send:(command:ClientEnvelope['command'])=>boolean}){
 const [cardId,setCardId]=useState(''),choice=view.shadowJumpCost;if(!choice)return null;
 return <section className="panel" aria-label="影飛びの踏み込み"><h2>影飛びの追加攻撃</h2><p>自分へのこの攻撃は無効になりました。踏み込みを1枚捨てると、{view.players[choice.targetId]!.name}さんに従者無視・間合い不可で攻撃できます。</p><label>影飛びに捨てる踏み込み<select value={cardId} disabled={disabled} onChange={e=>setCardId(e.target.value)}><option value="">選択してください</option>{choice.cardInstanceIds.map(id=><option key={id} value={id}>{getAction(id)?.name??'踏み込み'}</option>)}</select></label><div className="button-row"><button disabled={disabled||!choice.cardInstanceIds.includes(cardId)} onClick={()=>send({type:'PAY_SHADOW_JUMP',abilityEventId:choice.abilityEventId,advanceCardInstanceId:cardId})}>踏み込みを捨てて攻撃を選ぶ</button><button className="secondary" disabled={disabled} onClick={()=>send({type:'PASS'})}>踏み込みを捨てずに終える</button></div></section>;
}
