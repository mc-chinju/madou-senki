import {getAction,getCharacter,type ActionCard,type CharacterCard} from '@madou/catalog';
import type { LogView, PlayerView } from '@madou/engine';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {purposeNames} from './RollPanel.js';
import {statusNames} from './StatusList.js';
const labels:Record<string,string>={CARD_DRAWN:'カードを引きました',FOLLOWER_PLACED:'従者を配置しました',SETUP_PASSED:'配置を終えました',CHARACTER_REVEALED:'正体を公開しました',SETUP_COMPLETE:'初期配置を完了しました',DEATH_PENDING:'死亡時の処理に入りました',PLAYER_DIED:'死亡しました',PLAYER_REVIVED:'復活しました',PLAYER_WANDERING:'流浪状態になりました',PLAYER_RETURNED:'復帰しました',PLAYER_EXITED:'退場しました',CHARACTER_TRANSFORMED:'変身しました',FACTION_CHANGED:'陣営を変更しました',CARD_GIFTED:'カードを託しました',GAME_COMPLETED:'対戦の決着を迎えました',TURN_ENDED:'手番を終えました',CHARACTER_ASSIGNED:'配役を確認しました'};
const useNames:Record<NonNullable<LogView['use']>,string>={attack:'攻撃',defense:'防御',counter:'反撃',maai:'間合い',advance:'踏み込み',anytime:'いつでも',turn:'手番'};
/** Uses that always point at an opponent; the record names them instead of tagging the line with a target list. */
const directedUses=new Set<NonNullable<LogView['use']>>(['attack','defense','counter','maai','advance']);
/** Lines whose subject is the ability or the attack, not the seat; their text opens with its own particle. */
const ownParticle=new Set<LogView['type']>(['ABILITY_CANCELED','ATTACK_RESOLVED']);
const windowNames:Record<string,string>={declaration:'宣言',
 'before-roll':'判定前','after-roll':'判定後','effect-level':'効果Lv',damage:'ダメージ','attack-abilities':'攻撃時の能力','normal-defense':'防御','defense-advance':'間合いへの踏み込み','follower-entry-abilities':'従者登場前','follower-start':'従者の防御',hit:'命中','hit-abilities':'命中時の能力','on-hit-choice':'命中時の選択','lifecycle-boundary':'区切り','death-gift':'死亡時の託し',revival:'復活',approach:'踏み込み',withdrawal:'離脱',action:'行動','ability-attack':'追加攻撃','technique-double-choice':'ダメージ倍化','hit-advance-choice':'命中後の踏み込み','lifetime-effect-choice':'効果の選択','follower-bypass-choice':'従者の無視','private-inspection':'確認','beast-capture':'獣の捕獲','shadow-jump-cost':'影跳びの支払い'};
type Inspect=(card:ActionCard|CharacterCard)=>void;
export type LogOrder='oldest'|'newest';
export type LogLine={kind:'event';event:LogView}|{kind:'passes';id:number;lastId:number;windowKinds:string[];actorIds:string[]}|{kind:'through';id:number;lastId:number;actorIds:string[]};
export interface LogSection{key:string;heading:string;lines:LogLine[]}

/** Groups the public record by turn, folds a run of passes in one window, then joins windows the same seats passed in a row. */
export function publicLogSections(view:PlayerView,order:LogOrder='oldest'):LogSection[]{
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
 const kept=sections.filter(section=>section.key!=='setup'||section.lines.length);
 // Folding needs the events adjacent in time, so the reader's order is applied to the finished sections.
 return order==='newest'?kept.map(section=>({...section,lines:[...section.lines].reverse()})).reverse():kept;
}
function CardLink({id,onInspect,fallback='カード'}:{id:string|undefined;onInspect:Inspect;fallback?:string}){const card=id?getAction(id):undefined;return card?<button className="card-link" aria-label={`${card.name}の詳細を見る`} onClick={()=>onInspect(card)}>{card.name}</button>:<>{fallback}</>;}
function CharacterLink({characterId,onInspect}:{characterId:string|undefined;onInspect:Inspect}){const person=characterId?getCharacter(characterId):undefined;return person?<button className="card-link" aria-label={`${person.name}の詳細を見る`} onClick={()=>onInspect(person)}>{person.name}</button>:<>人物</>;}
function AbilityLink({abilityId,onInspect}:{abilityId:string|undefined;onInspect:Inspect}){
 const person=abilityId?getCharacter(abilityId.replace(/-ab\d+$/,'')):undefined,ability=person?.abilities.find(a=>a.id===abilityId);
 return person&&ability?<button className="card-link" aria-label={`${ability.name}（${person.name}）の詳細を見る`} onClick={()=>onInspect(person)}>{ability.name}</button>:<>特殊能力</>;
}
function eventText(view:PlayerView,event:LogView,onInspect:Inspect):ReactNode{
 const name=(id:string|undefined)=>view.players[id??'']?.name??'参加者';
 // Every line that points at a seat opens the same way, so neighbouring lines read alike.
 const opponents=event.targetIds?.length?`${event.targetIds.map(id=>`${name(id)}さん`).join('・')}へ`:'';
 switch(event.type){
  case 'WISH_ACQUIRED':return event.cardInstanceId?<>祈願で<CardLink id={event.cardInstanceId} onInspect={onInspect}/>を取得しました</>:'祈願でカード1枚を取得しました';
  case 'WISH_DISCARDED':return <>上限超過で<CardLink id={event.cardInstanceId} onInspect={onInspect}/>を捨てました</>;
  case 'FOLLOWER_DESTROYED':return <>{name(event.targetId)}さんの<CardLink id={event.cardInstanceId} onInspect={onInspect} fallback="ゴーレム"/>を破壊しました</>;
  case 'CHARACTER_INSPECTED':return event.characterId?<>{name(event.targetId)}さんの正体（<CharacterLink characterId={event.characterId} onInspect={onInspect}/>）を確認しました</>:`${name(event.targetId)}さんの正体を確認しました`;
  case 'CHARACTER_REVEALED':return event.characterId?<>正体（<CharacterLink characterId={event.characterId} onInspect={onInspect}/>）を公開しました</>:labels.CHARACTER_REVEALED!;
  case 'CHARACTER_ASSIGNED':return event.characterId?<>配役（<CharacterLink characterId={event.characterId} onInspect={onInspect}/>）を確認しました</>:labels.CHARACTER_ASSIGNED!;
  case 'CHARACTER_TRANSFORMED':return event.characterId?<><CharacterLink characterId={event.characterId} onInspect={onInspect}/>に変身しました</>:labels.CHARACTER_TRANSFORMED!;
  case 'PLAYER_REVIVED':return event.characterId?<><CharacterLink characterId={event.characterId} onInspect={onInspect}/>として復活しました</>:labels.PLAYER_REVIVED!;
  case 'PLAYER_DIED':return event.death?.sourceCardInstanceId?<>死亡しました（<CardLink id={event.death.sourceCardInstanceId} onInspect={onInspect}/>）</>:labels.PLAYER_DIED!;
  case 'CARD_GIFTED':return event.cardInstanceId?<>{name(event.targetId)}さんへ<CardLink id={event.cardInstanceId} onInspect={onInspect}/>を託しました</>:`${name(event.targetId)}さんへカードを託しました`;
  case 'OPEN':return <><CardLink id={event.cardInstanceId} onInspect={onInspect}/>を公開しました</>;
  case 'CARD_DRAWN':return <><CardLink id={event.cardInstanceId} onInspect={onInspect}/>を引きました</>;
  case 'BEAST_CAPTURED':return `${name(event.targetId)}さんから獣を${event.count??0}枚手札に加えました`;
  case 'CARD_PLAYED':return opponents&&directedUses.has(event.use!)
   ?<>{opponents}{useNames[event.use!]}を宣言しました（<CardLink id={event.cardInstanceId} onInspect={onInspect}/>）</>
   :<>{opponents}<CardLink id={event.cardInstanceId} onInspect={onInspect}/>を{useNames[event.use!]??''}に使いました</>;
  // A virtual follower attacks with no card, so the ability stands in for the card name.
  case 'ATTACK_DECLARED':return <>{opponents}攻撃を宣言しました（<AbilityLink abilityId={event.abilityId} onInspect={onInspect}/>）</>;
  case 'ATTACK_RESOLVED':{
   const ending=event.attackOutcome==='hit'?'が命中しました':event.attackOutcome==='blocked'?'は防がれました'
    :event.attackOutcome==='fizzled'?'は不発に終わりました':'は無効化されました';
   // Several attacks can be in flight at once, so the ending names the declaration it closes.
   const source=event.cardInstanceId?<>（<CardLink id={event.cardInstanceId} onInspect={onInspect}/>）</>
    :event.abilityId?<>（<AbilityLink abilityId={event.abilityId} onInspect={onInspect}/>）</>:null;
   // The attack is the subject here, not the seat, so the line brings its own particle.
   return <>{`の${opponents?`${opponents}の`:''}攻撃`}{source}{ending}</>;
  }
  case 'CHECK_SKIPPED':return event.checkSkip==='level'?'使用Lvを満たしていて判定は要りませんでした'
   :event.checkSkip==='card'?'カードの記述により判定は要りませんでした'
   :<><AbilityLink abilityId={event.abilityId} onInspect={onInspect}/>で判定を免れました</>;
  case 'ABILITY_DECLARED':return event.abilityId?<>{opponents}<AbilityLink abilityId={event.abilityId} onInspect={onInspect}/>を宣言しました</>:`${opponents}特殊能力を宣言しました`;
  case 'ABILITY_CANCELED':return event.abilityId?<>の<AbilityLink abilityId={event.abilityId} onInspect={onInspect}/>が取り消されました</>:'の特殊能力が取り消されました';
  case 'ROLL_RESOLVED':{
   const roll=event.roll!,result=roll.forcedFailure?'強制失敗':roll.success===undefined?'':roll.success?'成功':'失敗';
   // The threshold alone does not say which way it is read, and 修行 is the one check that wants a bigger total.
   const detail=[roll.threshold!==undefined?`目標値${roll.threshold}${roll.comparison==='greater-than'?'より大きい':'以下'}`:'',result].filter(Boolean).join('・');
   // A single die is already its own total, and which throw this is has to come before the result.
   const dice=roll.faces.length===1&&roll.faces[0]===roll.total?`${roll.total}`:`${roll.faces.join('・')}（合計${roll.total}）`;
   const again=roll.attempt>1?`の振り直し${roll.attempt-1}回目`:'';
   return `${purposeNames[roll.kind]??'判定'}${again}で${dice}を出しました${detail?`（${detail}）`:''}`;
  }
  case 'DAMAGE_APPLIED':return `${event.amount}ダメージを受けました`;
  case 'STATUS_CHANGED':{const status=statusNames[event.status!.kind]??'状態';return event.status!.change==='applied'?`${status}状態になりました`:`${status}状態から回復しました`;}
  case 'DISTANCE_CHANGED':return `${name(event.targetId)}さんと${event.distance==='near'?'近距離':'遠距離'}になりました`;
  case 'REST':return `休息しました（${event.count??0}枚）`;
  default:return labels[event.type]??'記録';
 }
}
const HIGHLIGHT_MS=1600;
const ORDER_KEY='madou:log-order:v1';
/** The choice belongs to this table only, and a server render has no storage at all. */
function orderKey():string{return `${ORDER_KEY}:${globalThis.location?.pathname??''}`;}
function storedOrder():LogOrder{try{return globalThis.sessionStorage?.getItem(orderKey())==='newest'?'newest':'oldest';}catch{return 'oldest';}}
function storeOrder(order:LogOrder):void{try{globalThis.sessionStorage?.setItem(orderKey(),order);}catch{/* storage may be unavailable */}}
export function PublicLog({view,onInspect}:{view:PlayerView;onInspect:Inspect}){
 const list=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 const [order,setOrder]=useState<LogOrder>(storedOrder);const orderRef=useRef(order);orderRef.current=order;
 const [following,setFollowing]=useState(true);const followingRef=useRef(true);
 const count=view.logs.length,lastId=view.logs.at(-1)?.id??0;
 // Lines newer than the previous snapshot stay marked for a moment, even across re-renders.
 const highlight=useRef({fromId:lastId,prevId:lastId,until:0});
 if(lastId>highlight.current.prevId)highlight.current={fromId:highlight.current.prevId,prevId:lastId,until:Date.now()+HIGHLIGHT_MS};
 const fresh=(id:number)=>id>highlight.current.fromId&&Date.now()<highlight.current.until;
 // Folding, reversing and counting walk the whole record, so they only run when it or its order changes.
 const sections=useMemo(()=>publicLogSections(view,order),[view,order]);
 // A run of passes folds into one line, so unread is counted in lines, not in events.
 const lineCount=useMemo(()=>sections.reduce((total,section)=>total+section.lines.length,0),[sections]);
 // Lines that arrived while the reader was scrolled away from the followed end.
 const [seenLines,setSeenLines]=useState(lineCount);
 // Newest first stacks arrivals at the top, so the followed end flips with the order.
 const pin=(el:HTMLDivElement)=>{el.scrollTop=orderRef.current==='newest'?0:el.scrollHeight;};
 const atEnd=(el:HTMLDivElement)=>orderRef.current==='newest'?el.scrollTop<24:el.scrollHeight-el.scrollTop-el.clientHeight<24;
 const follow=(value:boolean)=>{followingRef.current=value;setFollowing(value);if(value)setSeenLines(lineCount);};
 // Flipping the order moves the newest line to the other end, so where the reader stands has to be judged again.
 useEffect(()=>{const el=list.current;if(!el)return;if(followingRef.current){pin(el);setSeenLines(lineCount);}else if(atEnd(el))follow(true);},[count,lineCount,order]);
 // A narrower screen rewraps lines and grows the record; a follower must stay on the newest line.
 useEffect(()=>{const el=list.current,inner=content.current;if(!el||!inner||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(()=>{if(followingRef.current)pin(el);});observer.observe(inner);observer.observe(el);return ()=>observer.disconnect();},[]);
 const onScroll=()=>{const el=list.current;if(!el)return;const now=atEnd(el);if(now!==followingRef.current)follow(now);};
 const latest=()=>{const el=list.current;if(!el)return;pin(el);follow(true);el.focus({preventScroll:true});};
 const flip=()=>{const next:LogOrder=orderRef.current==='newest'?'oldest':'newest';orderRef.current=next;setOrder(next);storeOrder(next);const el=list.current;if(el&&followingRef.current)pin(el);};
 const unread=following?0:Math.max(0,lineCount-seenLines);
 const name=(id:string)=>view.players[id]?.name??'参加者';
 // Two windows of the same kind in a row are one thing to the reader, so the name is said once.
 const windows=(kinds:string[])=>{const names=kinds.map(kind=>windowNames[kind]).filter(Boolean).filter((name,index,all)=>name!==all[index-1]);return names.length?`${names.join('、')}で`:'';};
 const orderName=order==='newest'?'新しい順':'古い順';
 return <section className="panel log" aria-label="公開ログ"><div className="section-title log-title"><h2>戦記</h2>
  {/* Which way the record runs is a state, so it is shown as one and read out when it changes. */}
  <p className="tag" role="status">{orderName}</p>
  {/* The order button is always here, so it is last and keeps the edge; the one that comes and goes sits inside it. */}
  <div className="log-controls">
   {!following?<button type="button" className="secondary" onClick={latest}>{unread?`最新へ（新着${unread}件）`:'最新へ'}</button>:null}
   <button type="button" className="secondary" onClick={flip}>{order==='newest'?'古い順にする':'新しい順にする'}</button></div></div>
  {/* Anchoring keeps the read line still while browsing; while following, it would fight the pin instead. */}
  <div className={`log-scroll${following?' log-following':''}`} ref={list} onScroll={onScroll} tabIndex={0} role="region" aria-label="戦記の全件"><div ref={content}>{sections.map(section=><section key={section.key} aria-label={section.heading}><h3>{section.heading}</h3>
   {/* Newest first still counts from the oldest line, so a number keeps meaning the same record. */}
   <ol {...(order==='newest'?{reversed:true,start:section.lines.length}:{})}>{section.lines.map(line=>line.kind==='through'
   ?<li key={line.id} className={fresh(line.lastId)?'log-new':undefined}><strong>{line.actorIds.map(name).join('・')}</strong>がこの行動を任せました</li>
   :line.kind==='passes'
   ?<li key={line.id} className={fresh(line.lastId)?'log-new':undefined}><strong>{line.actorIds.map(name).join('・')}</strong>が{windows(line.windowKinds)}パスしました</li>
   :<li key={line.event.id} className={fresh(line.event.id)?'log-new':undefined}><strong>{name(line.event.actorId)}</strong>{ownParticle.has(line.event.type)?'':'が'}{eventText(view,line.event,onInspect)}</li>)}</ol></section>)}</div></div>
 </section>;
}
