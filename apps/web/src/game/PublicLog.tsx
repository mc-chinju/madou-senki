import {getAction,getCharacter,type ActionCard,type CharacterCard} from '@madou/catalog';
import type { LogView, PlayerView } from '@madou/engine';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {filterTarget,logInvolves,parseFilter,serializeFilter,storedFilter,storeFilter,type LogFilter} from './log-filter.js';
import {purposeNames} from './RollPanel.js';
import {statusNames} from './StatusList.js';
const labels:Record<string,string>={CARD_DRAWN:'カードを引きました',FOLLOWER_PLACED:'従者を配置しました',SETUP_PASSED:'配置を終えました',CHARACTER_REVEALED:'正体を公開しました',SETUP_COMPLETE:'初期配置を完了しました',DEATH_PENDING:'死亡時の処理に入りました',PLAYER_DIED:'死亡しました',PLAYER_REVIVED:'復活しました',PLAYER_WANDERING:'流浪状態になりました',PLAYER_RETURNED:'復帰しました',PLAYER_EXITED:'退場しました',CHARACTER_TRANSFORMED:'変身しました',FACTION_CHANGED:'陣営を変更しました',CARD_GIFTED:'カードを託しました',GAME_COMPLETED:'対戦の決着を迎えました',TURN_ENDED:'手番を終えました',CHARACTER_ASSIGNED:'配役を確認しました'};
const useNames:Record<NonNullable<LogView['use']>,string>={attack:'攻撃',defense:'防御',counter:'反撃',maai:'間合い',advance:'踏み込み',anytime:'いつでも',turn:'手番',combination:'複合技'};
/** Uses that always point at an opponent; the record names them instead of tagging the line with a target list. */
const directedUses=new Set<NonNullable<LogView['use']>>(['attack','defense','counter','maai','advance']);
/** Lines whose subject is the ability, the attack or the follower, not the seat; their text opens with its own particle. */
const ownParticle=new Set<LogView['type']>(['ABILITY_CANCELED','ATTACK_RESOLVED','FOLLOWER_DEFENDED','MORALE_CHECKED']);
/** What the follower did to the attack that reached it. */
const followerOutcomes:Record<NonNullable<LogView['followerOutcome']>,string>={blocked:'攻撃を防ぎました','equal-destroyed':'攻撃を防いで倒れました','lower-destroyed':'攻撃を受けて倒れました',
 'attribute-destroyed':'攻撃で破壊されました','level-destroyed':'攻撃で破壊されました','earth-nullified':'地の魔法を打ち消しました',reflected:'攻撃を跳ね返しました',
 'morale-failed':'士気が続かず退きました','passed-through':'攻撃に触れられませんでした'};
const windowNames:Record<string,string>={declaration:'宣言',
 'before-roll':'判定前','after-roll':'判定後','effect-level':'効果Lv',damage:'ダメージ','attack-abilities':'攻撃時の能力','normal-defense':'防御','defense-advance':'間合いへの踏み込み','follower-entry-abilities':'従者登場前','follower-start':'従者の防御',hit:'命中','hit-abilities':'命中時の能力','on-hit-choice':'命中時の選択','lifecycle-boundary':'区切り','death-gift':'死亡時の託し',revival:'復活',approach:'踏み込み',withdrawal:'離脱',action:'行動','ability-attack':'追加攻撃','technique-double-choice':'ダメージ倍化','hit-advance-choice':'命中後の踏み込み','lifetime-effect-choice':'効果の選択','follower-bypass-choice':'従者の無視','private-inspection':'確認','beast-capture':'獣の捕獲','shadow-jump-cost':'影跳びの支払い'};
type Inspect=(card:ActionCard|CharacterCard)=>void;
export type LogOrder='oldest'|'newest';
/** Acts the table sees as a fact and the seat sees by name: the two records are folded into one line. */
const ownPairs=new Set<LogView['type']>(['CHANTED','FOLLOWERS_ARRANGED','CARD_RECLAIMED','CARD_GIFTED','BEAST_CAPTURED','CHARACTER_INSPECTED','WISH_ACQUIRED']);
export type LogLine={kind:'event';event:LogView;own:boolean;ownCardInstanceIds?:string[];ownCharacterIds?:string[]}|{kind:'passes';id:number;lastId:number;windowKinds:string[];actorIds:string[]}|{kind:'through';id:number;lastId:number;scope:'action'|'turn';actorIds:string[]}
 |{kind:'discards';id:number;lastId:number;actorId:string;count:number;cardInstanceIds:string[]};
export interface LogSection{key:string;heading:string;lines:LogLine[]}
/** Where a line stands in the record: for a fold, the last record folded into it, since that is what made it grow. */
function lineId(line:LogLine):number{return line.kind==='event'?line.event.id:line.lastId;}
/** The newest record this reader holds, filter or no filter. An id belongs to its record and never moves, so
 *  this is the mark a reader standing at the end of the record has read up to. Reading it off what the filter
 *  keeps would leave the mark behind whenever the filter hides the end of the record, and widening it again
 *  would announce lines that were there all along. */
export function newestRecordId(view:Pick<PlayerView,'logs'|'privateLogs'>):number{
 return Math.max(view.logs?.at(-1)?.id??0,view.privateLogs?.at(-1)?.id??0);
}
/** Where the reader has read to, once they have been shown the end of the record. The record only grows, so
 *  what has been read is never unread again: not by a filter that hides it, nor by a page laid in front of it. */
export function readTo(seenId:number,view:Pick<PlayerView,'logs'|'privateLogs'>):number{
 return Math.max(seenId,newestRecordId(view));
}
/** Lines on screen that arrived after the reader last stood at the end of the record. Widening a filter and
 *  laying in an older page both bring lines older than that mark into view, so neither of them is an arrival. */
export function unreadLines(sections:LogSection[],seenId:number):number{
 return sections.reduce((total,section)=>total+section.lines.filter(line=>lineId(line)>seenId).length,0);
}

/** Groups the record by turn, folds a run of passes in one window, then joins windows the same seats passed in a row.
 *  The reader's own private record is woven in by event id, so a line only it can see keeps its place in the story.
 *  A filter drops the records the chosen seat has no share in before anything folds, so a fold never spans a gap. */
export function publicLogSections(view:PlayerView,order:LogOrder='oldest',filter:LogFilter={kind:'all'}):LogSection[]{
 const name=(id:string)=>view.players[id]?.name??'参加者';
 const {seatId,ownCards}=filterTarget(view,filter);
 // Only a record held from its very beginning opens with the table being set up. A window that opens partway
 // through starts inside a turn whose heading has not been read back yet, and must not claim to be the setup.
 const fromStart=view.logs[0]===undefined||view.logStart===undefined||view.logs[0].id<=view.logStart;
 const sections:LogSection[]=[{key:'setup',heading:fromStart?'対戦準備':'手番の途中から',lines:[]}];
 const entries=[...view.logs.map(event=>({event,own:false})),...view.privateLogs.map(event=>({event,own:true}))].sort((a,b)=>a.event.id-b.event.id)
  // A turn heading is the frame the kept lines hang in, so it outlives the filter and goes only if nothing hung on it.
  .filter(({event})=>seatId===undefined||event.type==='TURN_STARTED'||logInvolves(event,seatId,ownCards));
 for(const {event,own} of entries){
  if(event.type==='TURN_STARTED'){sections.push({key:`turn-${event.id}`,heading:`${event.turnNumber??'?'}手番 ${name(event.actorId)}さん`,lines:[]});continue;}
  const lines=sections.at(-1)!.lines,last=lines.at(-1);
  if(event.type==='CARDS_DISCARDED'){
   // The table's count and the owner's names are the same act seen twice, so they share one line.
   if(last?.kind==='discards'&&last.actorId===event.actorId){
    if(own){if(event.cardInstanceId)last.cardInstanceIds.push(event.cardInstanceId);}else last.count+=event.count??1;
    last.lastId=event.id;continue;
   }
   lines.push({kind:'discards',id:event.id,lastId:event.id,actorId:event.actorId,count:own?0:event.count??1,
    cardInstanceIds:own&&event.cardInstanceId?[event.cardInstanceId]:[]});continue;
  }
  if(own&&ownPairs.has(event.type)){
   // The table's line and this reader's named copy are the same act, so the names join the line already there.
   const cards=event.cardInstanceIds??(event.cardInstanceId?[event.cardInstanceId]:[]),characters=event.characterId?[event.characterId]:[];
   const at=cards.length||characters.length?publicLineOf(lines,event):-1;
   if(at>=0){const line=lines[at] as Extract<LogLine,{kind:'event'}>;
    lines[at]={...line,...(cards.length?{ownCardInstanceIds:[...line.ownCardInstanceIds??[],...cards]}:{}),
     ...(characters.length?{ownCharacterIds:[...line.ownCharacterIds??[],...characters]}:{})};continue;}
  }
  if(event.type==='PASSED'&&(event.windowKind==='action-through'||event.windowKind==='turn-through')){
   // One line per action or turn; the passes it fills in later are never recorded (G03). Leaving it and
   // pressing again with nothing in between is one seat changing its mind, so the line carries where it ended.
   const scope=event.windowKind==='turn-through'?'turn':'action';
   if(last?.kind==='through'&&last.scope===scope){if(!last.actorIds.includes(event.actorId))last.actorIds.push(event.actorId);last.lastId=event.id;continue;}
   lines.push({kind:'through',id:event.id,lastId:event.id,scope,actorIds:[event.actorId]});continue;
  }
  if(event.type==='PASSED'){
   // A seat passing again means a new window of the same kind has opened.
   if(last?.kind==='passes'&&last.windowKinds.at(-1)===event.windowKind&&!last.actorIds.includes(event.actorId)){last.actorIds.push(event.actorId);last.lastId=event.id;continue;}
   lines.push({kind:'passes',id:event.id,lastId:event.id,windowKinds:[event.windowKind??''],actorIds:[event.actorId]});continue;
  }
  lines.push({kind:'event',event,own});
 }
 for(const section of sections)section.lines=section.lines.reduce<LogLine[]>((lines,line)=>{
  const last=lines.at(-1),same=(a:string[],b:string[])=>a.length===b.length&&a.every(id=>b.includes(id));
  if(line.kind==='passes'&&last?.kind==='passes'&&same(last.actorIds,line.actorIds)){last.windowKinds.push(...line.windowKinds);last.lastId=line.lastId;}else lines.push(line);
  return lines;
 },[]);
 // A whole turn the reader had no share in is a heading over nothing, so a filtered record leaves it out.
 const kept=sections.filter(section=>(section.key!=='setup'||section.lines.length)&&(seatId===undefined||section.lines.length));
 // Folding needs the events adjacent in time, so the reader's order is applied to the finished sections.
 return order==='newest'?kept.map(section=>({...section,lines:[...section.lines].reverse()})).reverse():kept;
}
/** The table's line this reader's named copy belongs to. One act can name several cards and can point at
 *  several seats, so the copies are matched by seat within the run of lines the same kind of act just left. */
function publicLineOf(lines:LogLine[],event:LogView):number{
 for(let i=lines.length-1;i>=0;i--){const line=lines[i]!;
  if(line.kind!=='event'||line.event.type!==event.type)return -1;
  if(!line.own&&line.event.actorId===event.actorId&&line.event.targetId===event.targetId)return i;
 }
 return -1;
}
/** The count on the line is the table's; only this reader knows which cards or faces, so the names say so. */
function OwnNames({ids,onInspect,kind='card'}:{ids:string[];onInspect:Inspect;kind?:'card'|'character'}){
 return <span className="log-own">（自分だけに見えています：{ids.map((id,index)=><span key={`${id}-${index}`}>{index?'・':''}{kind==='character'?<CharacterLink characterId={id} onInspect={onInspect}/>:<CardLink id={id} onInspect={onInspect}/>}</span>)}）</span>;
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
   // A 複合 card is paid together with a technique, so it is used as one, not used for one.
   :<>{opponents}<CardLink id={event.cardInstanceId} onInspect={onInspect}/>を{useNames[event.use!]??''}{event.use==='combination'?'として使いました':'に使いました'}</>;
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
  case 'CHANTED':return '詠唱して伏せました';
  case 'FOLLOWERS_ARRANGED':return `従者を並べました（${event.count??0}枚）`;
  // The follower turned face up to answer the attack, so its name is here unless it never became public.
  case 'FOLLOWER_DEFENDED':return <>の<CardLink id={event.cardInstanceId} onInspect={onInspect} fallback="従者"/>が{followerOutcomes[event.followerOutcome!]??'攻撃に応じました'}</>;
  case 'MORALE_CHECKED':return <>の<CardLink id={event.cardInstanceId} onInspect={onInspect} fallback="従者"/>が士気判定に{event.success?'成功しました':'失敗しました'}</>;
  case 'CARD_RECLAIMED':return event.cardInstanceId?<><CardLink id={event.cardInstanceId} onInspect={onInspect}/>を回収しました</>:'カードを1枚回収しました';
  case 'DECK_RESHUFFLED':return `捨て札を山札に戻して混ぜました（${event.count??0}枚）`;
  default:return labels[event.type]??'記録';
 }
}
const HIGHLIGHT_MS=1600;
const ORDER_KEY='madou:log-order:v1';
/** The choice belongs to this table only, and a server render has no storage at all. */
function orderKey():string{return `${ORDER_KEY}:${globalThis.location?.pathname??''}`;}
function storedOrder():LogOrder{try{return globalThis.sessionStorage?.getItem(orderKey())==='newest'?'newest':'oldest';}catch{return 'oldest';}}
function storeOrder(order:LogOrder):void{try{globalThis.sessionStorage?.setItem(orderKey(),order);}catch{/* storage may be unavailable */}}
/** Reading further back than the snapshot carries: what it costs to ask, and whether an answer is still due. */
export interface LogHistoryControl{loading:boolean;load:(beforeId:number)=>boolean|void}
export function PublicLog({view,onInspect,logHistory}:{view:PlayerView;onInspect:Inspect;logHistory?:LogHistoryControl}){
 const list=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);
 const [order,setOrder]=useState<LogOrder>(storedOrder);const orderRef=useRef(order);orderRef.current=order;
 const seatIds=view.seatOrder??[];
 const [filter,setFilter]=useState<LogFilter>(()=>storedFilter(seatIds));const filterKey=serializeFilter(filter);
 const [following,setFollowing]=useState(true);const followingRef=useRef(true);
 const count=view.logs.length,lastId=view.logs.at(-1)?.id??0;
 // Lines newer than the previous snapshot stay marked for a moment, even across re-renders.
 const highlight=useRef({fromId:lastId,prevId:lastId,until:0});
 if(lastId>highlight.current.prevId)highlight.current={fromId:highlight.current.prevId,prevId:lastId,until:Date.now()+HIGHLIGHT_MS};
 const fresh=(id:number)=>id>highlight.current.fromId&&Date.now()<highlight.current.until;
 // Folding, reversing and counting walk the whole record, so they only run when it or its order changes.
 const sections=useMemo(()=>publicLogSections(view,order,filter),[view,order,filter]);
 // A run of passes folds into one line, so the record is measured in lines, not in events: an older page can
 // lay a hundred records in front of the reader without the newest line changing at all.
 const lineCount=useMemo(()=>sections.reduce((total,section)=>total+section.lines.length,0),[sections]);
 // How far the reader has read, kept as the newest line they were shown at the followed end. An id is fixed to
 // its record: narrowing the filter, laying an older page in front, or a window that had to start over all move
 // every line's place but no line's id, so none of them can make a line already read look like it just arrived.
 // The mark is taken from the whole record and not from what the filter keeps: a reader at the followed end has
 // been shown the end of the record, and a filter that hid the last few lines must not make them arrivals.
 const newestId=newestRecordId(view);
 const [seenId,setSeenId]=useState(newestId);
 const markSeen=()=>setSeenId(seen=>readTo(seen,view));
 // Newest first stacks arrivals at the top, so the followed end flips with the order.
 const pin=(el:HTMLDivElement)=>{el.scrollTop=orderRef.current==='newest'?0:el.scrollHeight;};
 const atEnd=(el:HTMLDivElement)=>orderRef.current==='newest'?el.scrollTop<24:el.scrollHeight-el.scrollTop-el.clientHeight<24;
 const follow=(value:boolean)=>{followingRef.current=value;setFollowing(value);if(value)markSeen();};
 // Flipping the order moves the newest line to the other end, so where the reader stands has to be judged again.
 // Narrowing the record moves every line too, so where the reader stands has to be judged again.
 useEffect(()=>{const el=list.current;if(!el)return;if(followingRef.current){pin(el);markSeen();}else if(atEnd(el))follow(true);},[count,lineCount,newestId,order,filterKey]);
 // A narrower screen rewraps lines and grows the record; a follower must stay on the newest line.
 useEffect(()=>{const el=list.current,inner=content.current;if(!el||!inner||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(()=>{if(followingRef.current)pin(el);});observer.observe(inner);observer.observe(el);return ()=>observer.disconnect();},[]);
 // The oldest line sits at the top reading forwards and at the bottom reading backwards, so the far edge flips too.
 const atOlderEnd=(el:HTMLDivElement)=>orderRef.current==='newest'?el.scrollHeight-el.scrollTop-el.clientHeight<48:el.scrollTop<48;
 // A record with no start to point at is all there is: nothing behind it can be asked for.
 const oldestId=view.logs[0]?.id,atRecordStart=oldestId===undefined||view.logStart===undefined||oldestId<=view.logStart;
 // Where the reader stood when they asked for more, so the arriving page can be laid in without moving them.
 const anchor=useRef<{oldestId:number;height:number;top:number}|null>(null);
 const loadOlder=()=>{if(!logHistory||logHistory.loading||atRecordStart||oldestId===undefined)return;
  const el=list.current;anchor.current={oldestId,height:el?.scrollHeight??0,top:el?.scrollTop??0};logHistory.load(oldestId);};
 const onScroll=()=>{const el=list.current;if(!el)return;const now=atEnd(el);if(now!==followingRef.current)follow(now);if(atOlderEnd(el))loadOlder();};
 // A page read back from the past carries no line newer than the one the reader is on, so it is no arrival and
 // the count leaves it alone. The line their eye is on has to stay put, however much is laid in front of it.
 useEffect(()=>{const held=anchor.current;if(!held||oldestId===undefined||oldestId>=held.oldestId)return;
  anchor.current=null;
  const el=list.current;if(el&&orderRef.current==='oldest')el.scrollTop=Math.max(0,el.scrollHeight-held.height+held.top);},[oldestId,lineCount]);
 const latest=()=>{const el=list.current;if(!el)return;pin(el);follow(true);el.focus({preventScroll:true});};
 const flip=()=>{const next:LogOrder=orderRef.current==='newest'?'oldest':'newest';orderRef.current=next;setOrder(next);storeOrder(next);const el=list.current;if(el&&followingRef.current)pin(el);};
 const unread=useMemo(()=>following?0:unreadLines(sections,seenId),[sections,seenId,following]);
 const name=(id:string)=>view.players[id]?.name??'参加者';
 // Two windows of the same kind in a row are one thing to the reader, so the name is said once.
 // Filtering to one seat puts its passes next to each other, so a fold can run over a dozen windows. Past a
 // few names the list stops being read and only says "a long quiet stretch", which a count says better.
 const windows=(kinds:string[])=>{const names=kinds.map(kind=>windowNames[kind]).filter(Boolean).filter((name,index,all)=>name!==all[index-1]);
  if(!names.length)return '';
  return names.length>4?`${names.slice(0,3).join('、')}ほか${names.length-3}件で`:`${names.join('、')}で`;};
 const orderName=order==='newest'?'新しい順':'古い順';
 // Narrowing the record is not the same as asking for the newest line: a reader who had scrolled back stays
 // where they were, exactly as flipping the order leaves them. The effect below judges the new position.
 const choose=(value:string)=>{const next=parseFilter(value,seatIds);setFilter(next);storeFilter(next);};
 // Only a reader who can actually ask for more is told where the read record ends.
 const olderEdge=!logHistory?null:logHistory.loading?<p className="muted log-edge" role="status">過去の記録を読み込んでいます…</p>
  :atRecordStart?<p className="muted log-edge">これが戦記の最初です</p>
  :<button type="button" className="secondary compact log-edge" onClick={loadOlder}>過去の記録を読む</button>;
 const selfId=(view.self as PlayerView['self']|undefined)?.id;
 return <section className="panel log" aria-label="公開ログ"><div className="section-title log-title"><h2>戦記</h2>
  {/* Which way the record runs is a state, so it is shown as one and read out when it changes. */}
  <p className="tag" role="status">{orderName}</p>
  {/* The order button is always here, so it is last and keeps the edge; the ones that come and go sit inside it. */}
  <div className="log-controls">
   <label className="log-filter">絞り込み<select value={filterKey} onChange={event=>choose(event.target.value)}>
    <option value="all">全員</option>
    {/* The label already says these are a filter, so the option names what is kept, not that it is a record. */}
    {selfId?<option value="self">自分に関係する</option>:null}
    {seatIds.map(id=><option key={id} value={`seat:${id}`}>{name(id)}さん</option>)}</select></label>
   {!following?<button type="button" className="secondary" onClick={latest}>{unread?`最新へ（新着${unread}件）`:'最新へ'}</button>:null}
   <button type="button" className="secondary" onClick={flip}>{order==='newest'?'古い順にする':'新しい順にする'}</button></div></div>
  {/* Anchoring keeps the read line still while browsing; while following, it would fight the pin instead. */}
  <div className={`log-scroll${following?' log-following':''}`} ref={list} onScroll={onScroll} tabIndex={0} role="region" aria-label="戦記の全件"><div ref={content}>
   {/* The far end of what has been read says where it stands, and offers the next page to anyone not scrolling. */}
   {order==='oldest'?olderEdge:null}
   {/* A filter that keeps nothing has to say so, or the record reads as if it were still loading. */}
   {sections.length?null:<p className="muted">この絞り込みに当てはまる記録はまだありません</p>}
   {sections.map(section=><section key={section.key} aria-label={section.heading}><h3>{section.heading}</h3>
   {/* Newest first still counts from the oldest line, so a number keeps meaning the same record. */}
   <ol {...(order==='newest'?{reversed:true,start:section.lines.length}:{})}>{section.lines.map((line,index)=>{
   // A run of lines only this reader can see is one thing to the reader, so the words are said once at
   // its head and the rule down the side carries the rest. The lines are already in reading order here,
   // so the head stays the first line the eye meets whichever way the record runs.
   const previous=section.lines[index-1];
   const runStart=line.kind==='event'&&line.own&&!(previous?.kind==='event'&&previous.own);
   const mark=(id:number,own=false)=>`${own?'log-own-line ':''}${fresh(id)?'log-new':''}`.trim()||undefined;
   return line.kind==='through'
   ?<li key={line.id} className={mark(line.lastId)}><strong>{line.actorIds.map(name).join('・')}</strong>が{line.scope==='turn'?'この手番':'この行動'}を任せました</li>
   :line.kind==='passes'
   ?<li key={line.id} className={mark(line.lastId)}><strong>{line.actorIds.map(name).join('・')}</strong>が{windows(line.windowKinds)}パスしました</li>
   :line.kind==='discards'
   ?<li key={line.id} className={mark(line.lastId)}><strong>{name(line.actorId)}</strong>が{line.count||line.cardInstanceIds.length}枚を伏せたまま捨てました
    {line.cardInstanceIds.length?<OwnNames ids={line.cardInstanceIds} onInspect={onInspect}/>:null}</li>
   :<li key={line.event.id} className={mark(line.event.id,line.own)}><strong>{name(line.event.actorId)}</strong>{ownParticle.has(line.event.type)?'':'が'}{eventText(view,line.event,onInspect)}
    {line.ownCardInstanceIds?.length?<OwnNames ids={line.ownCardInstanceIds} onInspect={onInspect}/>:null}
    {line.ownCharacterIds?.length?<OwnNames ids={line.ownCharacterIds} kind="character" onInspect={onInspect}/>:null}
    {runStart?<span className="log-own">（自分だけに見えています）</span>:null}</li>;
   })}</ol></section>)}
   {order==='newest'?olderEdge:null}</div></div>
 </section>;
}
