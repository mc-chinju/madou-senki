import {getAction,getCharacter,type ActionCard,type CharacterCard} from '@madou/catalog';
import type { LogView, PlayerView } from '@madou/engine';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {purposeNames} from './RollPanel.js';
import {statusNames} from './StatusList.js';
const labels:Record<string,string>={CHARACTER_ASSIGNED:'配役を確認しました',CARD_DRAWN:'カードを引きました',OPEN:'カードを公開しました',FOLLOWER_PLACED:'従者を配置しました',SETUP_PASSED:'配置を終えました',CHARACTER_REVEALED:'正体を公開しました',SETUP_COMPLETE:'初期配置を完了しました',DEATH_PENDING:'死亡時の処理に入りました',PLAYER_DIED:'死亡しました',PLAYER_REVIVED:'復活しました',PLAYER_WANDERING:'流浪状態になりました',PLAYER_RETURNED:'復帰しました',PLAYER_EXITED:'退場しました',CHARACTER_TRANSFORMED:'変身しました',FACTION_CHANGED:'陣営を変更しました',CARD_GIFTED:'カードを託しました',GAME_COMPLETED:'対戦の決着を迎えました',TURN_ENDED:'手番を終えました'};
const useNames:Record<NonNullable<LogView['use']>,string>={attack:'攻撃',defense:'防御',counter:'反撃',maai:'間合い',advance:'踏み込み',anytime:'いつでも',turn:'手番'};
const windowNames:Record<string,string>={declaration:'宣言',
 'before-roll':'判定前','after-roll':'判定後','effect-level':'効果Lv',damage:'ダメージ','attack-abilities':'攻撃時の能力','normal-defense':'防御','defense-advance':'間合いへの踏み込み','follower-entry-abilities':'従者登場前','follower-start':'従者の防御',hit:'命中','hit-abilities':'命中時の能力','on-hit-choice':'命中時の選択','lifecycle-boundary':'区切り','death-gift':'死亡時の託し',revival:'復活',approach:'踏み込み',withdrawal:'離脱',action:'行動','ability-attack':'追加攻撃','technique-double-choice':'ダメージ倍化','hit-advance-choice':'命中後の踏み込み','lifetime-effect-choice':'効果の選択','follower-bypass-choice':'従者の無視','private-inspection':'確認','beast-capture':'獣の捕獲','shadow-jump-cost':'影跳びの支払い'};
type Inspect=(card:ActionCard|CharacterCard)=>void;
export type LogLine={kind:'event';event:LogView}|{kind:'passes';id:number;lastId:number;windowKinds:string[];actorIds:string[]}|{kind:'through';id:number;lastId:number;actorIds:string[]};
export interface LogSection{key:string;heading:string;lines:LogLine[]}

/** Groups the public record by turn, folds a run of passes in one window, then joins windows the same seats passed in a row. */
export function publicLogSections(view:PlayerView):LogSection[]{
 const name=(id:string)=>view.players[id]?.name??'参加者';
 const sections:LogSection[]=[{key:'setup',heading:'対戦準備',lines:[]}];
 for(const event of view.logs){
  if(event.type==='TURN_STARTED'){sections.push({key:`turn-${event.id}`,heading:`${event.turnNumber??'?'}手番 ${name(event.actorId)}さん`,lines:[]});continue;}
  const lines=sections.at(-1)!.lines,last=lines.at(-1);
  if(event.type==='PASSED'&&event.windowKind==='action-through'){
   // One line per action; the passes it fills in later are never recorded (G03).
   if(last?.kind==='through'&&!last.actorIds.includes(event.actorId)){last.actorIds.push(event.actorId);last.lastId=event.id;continue;}
   lines.push({kind:'through',id:event.id,lastId:event.id,actorIds:[event.actorId]});continue;
  }
  if(event.type==='PASSED'){
   // A seat passing again means a new window of the same kind has opened.
   if(last?.kind==='passes'&&last.windowKinds.at(-1)===event.windowKind&&!last.actorIds.includes(event.actorId)){last.actorIds.push(event.actorId);last.lastId=event.id;continue;}
   lines.push({kind:'passes',id:event.id,lastId:event.id,windowKinds:[event.windowKind??''],actorIds:[event.actorId]});continue;
  }
  lines.push({kind:'event',event});
 }
 for(const section of sections)section.lines=section.lines.reduce<LogLine[]>((lines,line)=>{
  const last=lines.at(-1),same=(a:string[],b:string[])=>a.length===b.length&&a.every(id=>b.includes(id));
  if(line.kind==='passes'&&last?.kind==='passes'&&same(last.actorIds,line.actorIds)){last.windowKinds.push(...line.windowKinds);last.lastId=line.lastId;}else lines.push(line);
  return lines;
 },[]);
 return sections.filter(section=>section.key!=='setup'||section.lines.length);
}
function CardLink({id,onInspect}:{id:string|undefined;onInspect:Inspect}){const card=id?getAction(id):undefined;return card?<button className="card-link" aria-label={`${card.name}の詳細を見る`} onClick={()=>onInspect(card)}>{card.name}</button>:<>カード</>;}
function AbilityLink({abilityId,onInspect}:{abilityId:string|undefined;onInspect:Inspect}){
 const person=abilityId?getCharacter(abilityId.replace(/-ab\d+$/,'')):undefined,ability=person?.abilities.find(a=>a.id===abilityId);
 return person&&ability?<button className="card-link" aria-label={`${ability.name}（${person.name}）の詳細を見る`} onClick={()=>onInspect(person)}>{ability.name}</button>:<>特殊能力</>;
}
function eventText(view:PlayerView,event:LogView,onInspect:Inspect):ReactNode{
 const name=(id:string|undefined)=>view.players[id??'']?.name??'参加者';
 const targets=event.targetIds?.length?`（対象: ${event.targetIds.map(name).join('・')}）`:'';
 switch(event.type){
  case 'WISH_ACQUIRED':return event.cardInstanceId?<>祈願で<CardLink id={event.cardInstanceId} onInspect={onInspect}/>を取得しました</>:'祈願でカード1枚を取得しました';
  case 'WISH_DISCARDED':return <>上限超過で<CardLink id={event.cardInstanceId} onInspect={onInspect}/>を捨てました</>;
  case 'FOLLOWER_DESTROYED':return `${name(event.targetId)}さんの${getAction(event.cardInstanceId??'')?.name??'ゴーレム'}を破壊しました`;
  case 'CHARACTER_INSPECTED':return `${name(event.targetId)}さんの正体を確認しました`;
  case 'BEAST_CAPTURED':return `${name(event.targetId)}さんから獣を${event.count??0}枚手札に加えました`;
  case 'CARD_PLAYED':return <><CardLink id={event.cardInstanceId} onInspect={onInspect}/>を{useNames[event.use!]??''}に使いました{targets}</>;
  case 'ABILITY_DECLARED':return event.abilityId?<><AbilityLink abilityId={event.abilityId} onInspect={onInspect}/>を宣言しました{targets}</>:'特殊能力を宣言しました';
  case 'ABILITY_CANCELED':return event.abilityId?<>の<AbilityLink abilityId={event.abilityId} onInspect={onInspect}/>が取り消されました</>:'の特殊能力が取り消されました';
  case 'ROLL_RESOLVED':{
   const roll=event.roll!,result=roll.forcedFailure?'失敗扱い':roll.success===undefined?'':roll.success?'成功':'失敗';
   const detail=[roll.threshold!==undefined?`目標値${roll.threshold}`:'',result].filter(Boolean).join('・');
   return `${purposeNames[roll.kind]??'判定'}で${roll.faces.join('・')}（合計${roll.total}）を出しました${detail?`（${detail}）`:''}${roll.attempt>1?`［振り直し${roll.attempt-1}回目］`:''}`;
  }
  case 'DAMAGE_APPLIED':return `${event.amount}ダメージを受けました`;
  case 'STATUS_CHANGED':{const status=statusNames[event.status!.kind]??'状態';return event.status!.change==='applied'?`${status}状態になりました`:`${status}状態から回復しました`;}
  case 'DISTANCE_CHANGED':return `${name(event.targetId)}さんと${event.distance==='near'?'近距離':'遠距離'}になりました`;
  case 'REST':return `休息しました（${event.count??0}枚）`;
  default:return labels[event.type]??'記録';
 }
}
const HIGHLIGHT_MS=1600;
export function PublicLog({view,onInspect}:{view:PlayerView;onInspect:Inspect}){
 const list=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 const [following,setFollowing]=useState(true);const followingRef=useRef(true);
 const count=view.logs.length,lastId=view.logs.at(-1)?.id??0;
 // Unread entries arrived while the reader was scrolled up.
 const [seenCount,setSeenCount]=useState(count);
 // Lines newer than the previous snapshot stay marked for a moment, even across re-renders.
 const highlight=useRef({fromId:lastId,prevId:lastId,until:0});
 if(lastId>highlight.current.prevId)highlight.current={fromId:highlight.current.prevId,prevId:lastId,until:Date.now()+HIGHLIGHT_MS};
 const fresh=(id:number)=>id>highlight.current.fromId&&Date.now()<highlight.current.until;
 const sections=publicLogSections(view);
 const follow=(value:boolean)=>{followingRef.current=value;setFollowing(value);if(value)setSeenCount(count);};
 useEffect(()=>{const el=list.current;if(el&&followingRef.current){el.scrollTop=el.scrollHeight;setSeenCount(count);}},[count]);
 // A narrower screen rewraps lines and grows the record; a follower must stay on the newest line.
 useEffect(()=>{const el=list.current,inner=content.current;if(!el||!inner||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(()=>{if(followingRef.current)el.scrollTop=el.scrollHeight;});observer.observe(inner);observer.observe(el);return ()=>observer.disconnect();},[]);
 const onScroll=()=>{const el=list.current;if(!el)return;const atEnd=el.scrollHeight-el.scrollTop-el.clientHeight<24;if(atEnd!==followingRef.current)follow(atEnd);};
 const latest=()=>{const el=list.current;if(!el)return;el.scrollTop=el.scrollHeight;follow(true);el.focus({preventScroll:true});};
 const unread=following?0:Math.max(0,count-seenCount);
 const name=(id:string)=>view.players[id]?.name??'参加者';
 const windows=(kinds:string[])=>{const names=kinds.map(kind=>windowNames[kind]).filter(Boolean);return names.length?`${names.join('、')}で`:'';};
 return <section className="panel log" aria-label="公開ログ"><div className="section-title log-title"><h2>戦記</h2>{!following?<button type="button" className="secondary" onClick={latest}>{unread?`最新へ（新着${unread}件）`:'最新へ'}</button>:null}</div>
  <div className="log-scroll" ref={list} onScroll={onScroll} tabIndex={0} role="region" aria-label="戦記の全件"><div ref={content}>{sections.map(section=><section key={section.key} aria-label={section.heading}><h3>{section.heading}</h3><ol>{section.lines.map(line=>line.kind==='through'
   ?<li key={line.id} className={fresh(line.lastId)?'log-new':undefined}><strong>{line.actorIds.map(name).join('・')}</strong>がこの行動を任せました</li>
   :line.kind==='passes'
   ?<li key={line.id} className={fresh(line.lastId)?'log-new':undefined}><strong>{line.actorIds.map(name).join('・')}</strong>が{windows(line.windowKinds)}パスしました</li>
   :<li key={line.event.id} className={fresh(line.event.id)?'log-new':undefined}><strong>{name(line.event.actorId)}</strong>{line.event.type==='ABILITY_CANCELED'?'':'が'}{eventText(view,line.event,onInspect)}</li>)}</ol></section>)}</div></div>
 </section>;
}
