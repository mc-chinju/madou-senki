import {useState} from 'react';
import {getAction} from '@madou/catalog';
import type {PlayerView} from '@madou/engine';
import type {GameCommand} from '@madou/protocol';
import {FollowerAttackTargets} from './FollowerAttackPanel.js';
export function AllArmyPanel({view,disabled,send}:{view:PlayerView;disabled:boolean;send:(command:GameCommand)=>boolean}){
 const [source,setSource]=useState(''),[targets,setTargets]=useState<string[]>([]);
 const option=view.allArmyOptions.find(o=>o.followerCardInstanceId===source);
 if(!view.allArmyOptions.length)return null;
 const chosen=option?.targetMode==='mandatory-all'?option.legalTargetIds:targets;
 const valid=!!option&&chosen.length>0&&chosen.every(id=>option.legalTargetIds.includes(id))&&(option.targetMode!=='one'||chosen.length===1);
 const names=Object.fromEntries(Object.entries(view.players).map(([id,p])=>[id,p.name]));
 return <section className="panel" aria-label="全軍突撃せよ"><h2>全軍突撃せよ</h2>
  <p>この札と手札の従者1枚を同時に使い、従者の下部にある技で攻撃します。取消や士気判定の失敗でも2枚を消費し、選び直せません。</p>
  <label>突撃に使う従者<select value={option?.followerCardInstanceId??''} disabled={disabled} onChange={e=>{setSource(e.target.value);setTargets([]);}}><option value="">従者を選択</option>{view.allArmyOptions.map(o=><option key={o.followerCardInstanceId} value={o.followerCardInstanceId}>{getAction(o.followerCardInstanceId)!.name}</option>)}</select></label>
  {option?<><p>{option.range==='near'?'近距離':'遠距離'} · {option.attributes.join('・')} · 使用Lv {option.effectLevel}</p><p>{option.moraleRequired?'攻撃の宣言後に士気判定が必要です。':'士気判定は不要です。'}</p><FollowerAttackTargets option={option} names={names} selected={targets} disabled={disabled} change={setTargets} inputName="all-army-target"/></>:null}
  <button disabled={disabled||!valid} onClick={()=>{if(valid)send({type:'PLAY_ALL_ARMY',cardInstanceId:'a2-p05-r2c2',followerCardInstanceId:source,targetIds:chosen});}}>2枚を使って全軍突撃する</button>
  <button disabled={disabled||!source} onClick={()=>{setSource('');setTargets([]);}}>突撃の選択をやめる</button>
 </section>;
}
