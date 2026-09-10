import {useState} from 'react';
import type {PlayerView} from '@madou/engine';
import type {ClientEnvelope} from '@madou/protocol';
export function VirtualBladePanel({view,disabled,send}:{view:PlayerView;disabled:boolean;send:(command:ClientEnvelope['command'])=>boolean}){
 const [targetId,setTargetId]=useState('');if(!view.virtualBladeOptions.length)return null;
 return <section className="panel" aria-label="氷刃・炎刃"><h2>手札の代わりに使う技</h2>{view.virtualBladeOptions.map(o=><div key={o.abilityId}><p>{o.name}：近距離・魔・{o.technique.attributes[1]}、Lv4、ダメージ{o.technique.damage}{o.technique.maaiRequired===2?'。間合いで防ぐには2枚必要です。':''}</p><label>{o.name}の対象<select disabled={disabled} value={targetId} onChange={e=>setTargetId(e.target.value)}><option value="">選択してください</option>{o.targetIds.map(id=><option key={id} value={id}>{view.players[id]!.name}</option>)}</select></label><button disabled={disabled||!o.targetIds.includes(targetId)} onClick={()=>{if(send({type:'DECLARE_VIRTUAL_BLADE',abilityId:o.abilityId,targetIds:[targetId]}))setTargetId('');}}>{o.name}で攻撃する</button></div>)}</section>;
}
