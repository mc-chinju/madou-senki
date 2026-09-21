import {useState} from 'react';
import {getCharacter} from '@madou/catalog';
import type {PlayerView} from '@madou/engine';
import type {GameCommand} from '@madou/protocol';
function Choice({option,view,disabled,send}:{option:PlayerView['turnChoiceCardOptions'][number];view:PlayerView;disabled:boolean;send:(command:GameCommand)=>boolean}){
 const [target,setTarget]=useState('');const targetId=option.targetIds.includes(target)?target:option.targetIds[0]!;
 return <div><h3>{option.label}</h3><label>{option.label}の対象<select value={targetId} disabled={disabled} onChange={e=>setTarget(e.target.value)}>{option.targetIds.map(id=><option key={id} value={id}>{view.players[id]!.name}</option>)}</select></label>
 <button disabled={disabled} onClick={()=>send({type:'PLAY_TURN_CARD',cardInstanceId:option.cardInstanceId,targetId,mode:'ordinary'})}>{option.label}を使う</button>
 {option.canUseAstrology?<button disabled={disabled} onClick={()=>send({type:'PLAY_TURN_CARD',cardInstanceId:option.cardInstanceId,targetId,mode:'astrology'})}>{option.label}で占星する</button>:null}</div>;
}
export function TurnChoiceCardPanel({view,disabled,send}:{view:PlayerView;disabled:boolean;send:(command:GameCommand)=>boolean}){
 // What this seat confirmed is its own knowledge, kept beside the game: the record is read through a window
 // and scrolls past, so a history hung on it would empty itself while the table plays on.
 const history=view.inspectionHistory.filter(d=>d.zone==='character');
 return <>{view.turnChoiceCardOptions.length?<section className="panel" aria-label="対象を選ぶ手番カード"><h2>対象を選ぶ手番カード</h2>{view.turnChoiceCardOptions.map(option=><Choice key={option.cardInstanceId} option={option} view={view} disabled={disabled} send={send}/>)}</section>:null}
 {history.length?<section className="panel" aria-label="自分だけの正体確認履歴"><h2>自分だけの正体確認履歴</h2><ol>{history.map(d=><li key={d.decisionId}>{view.players[d.targetId]?.name??'参加者'}: {getCharacter(d.characterId??'')?.name??'確認済み'}</li>)}</ol></section>:null}</>;
}
