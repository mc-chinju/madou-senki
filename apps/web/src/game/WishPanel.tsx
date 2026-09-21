import {useState} from 'react';
import {getAction} from '@madou/catalog';
import type {PlayerView} from '@madou/engine';
import type {GameCommand} from '@madou/protocol';
type Props={view:PlayerView;disabled:boolean;send:(command:GameCommand)=>boolean};
export function WishPanel(props:Props){
 // The acquisition is knowledge the two seats keep; the record it was read from is a window and scrolls past.
 const {view,disabled,send}=props,history=view.wishHistory;
 return <>
  {view.wishOptions.length?<section className="panel" aria-label="祈願の使用"><h2>祈願</h2><p>手番の行動として1枚を使い、取得先を選びます。</p>{view.wishOptions.map((cardInstanceId,i)=><button key={cardInstanceId} disabled={disabled} onClick={()=>send({type:'PLAY_TURN_CARD',cardInstanceId,mode:'wish'})}>祈願を使う（{i+1}枚目）</button>)}</section>:null}
  {view.activeWindow?.kind==='wish'||view.activeWindow?.kind==='wish-capacity'?<WishChoice key={`${view.activeWindow.windowId}-${view.wish?.decisionId??view.wishCapacity?.decisionId??'waiting'}`} {...props}/>:null}
  {history.length?<section className="panel" aria-label="自分だけの祈願取得履歴"><h2>祈願の取得履歴</h2><p>この取得内容は取得者と元の持ち主だけに表示されます。</p><ul>{history.map(e=><li key={e.eventId}>{view.players[e.actorId]?.name}さんが{getAction(e.cardInstanceId)?.name??'カード'}を取得しました。</li>)}</ul></section>:null}
 </>;
}
function WishChoice({view,disabled,send}:Props){
 const [kind,setKind]=useState<'deck'|'hand'|'public'>('deck'),[selected,setSelected]=useState(''),[followers,setFollowers]=useState<string[]>([]),[chants,setChants]=useState<string[]>([]);
 const d=view.wish,c=view.wishCapacity;
 const toggle=(ids:string[],id:string)=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];
 if(c){const valid=followers.length===c.followerCount&&chants.length===c.chantCount;return <aside className="decision" aria-label="祈願後の上限調整"><h2>上限を超えた札を選ぶ</h2><p>従者を{c.followerCount}枚、詠唱札を{c.chantCount}枚捨ててください。手札の超過は手番末に調整します。</p>
  {c.followerCount?<fieldset><legend>捨てる従者</legend>{c.followerIds.map(id=><label key={id} className="inline"><input type="checkbox" disabled={disabled} checked={followers.includes(id)} onChange={()=>setFollowers(toggle(followers,id))}/>{getAction(id)!.name}</label>)}</fieldset>:null}
  {c.chantCount?<fieldset><legend>捨てる詠唱札</legend>{c.chantIds.map(id=><label key={id} className="inline"><input type="checkbox" disabled={disabled} checked={chants.includes(id)} onChange={()=>setChants(toggle(chants,id))}/>{getAction(id)!.name}</label>)}</fieldset>:null}
  <button disabled={disabled||!valid} onClick={()=>send({type:'CHOOSE_WISH_CAPACITY',decisionId:c.decisionId,followerIds:followers,chantIds:chants})}>選んだ札を捨てて続ける</button></aside>;}
 if(!d)return <aside className="decision" aria-label="祈願の判断"><h2>祈願</h2><p role="status">{view.players[view.activeWindow!.pendingActorId]?.name??'参加者'}さんの選択を待っています。</p></aside>;
 const options=kind==='deck'?d.deckNames.map(o=>({value:o.cardName,label:`${o.cardName}（${o.count}枚）`})):
  kind==='hand'?d.handOwners.map(o=>({value:o.ownerId,label:`${view.players[o.ownerId]?.name}さんの手札（${o.count}枚）`})):
  d.publicSources.map(o=>({value:o.cardInstanceId,label:`${view.players[o.ownerId]?.name}さんの${{open:'OPEN',attachments:'設置札',chants:'詠唱札',followers:'従者'}[o.zone]} ${o.position+1}番目：${o.name??'裏向き'}`}));
 const valid=options.some(o=>o.value===selected);
 return <aside className="decision" aria-label="自分だけの祈願の選択"><h2>取得する札を選ぶ</h2><p>山札の候補はあなただけに表示されます。山札順は表示されません。同名札と他人の手札はランダムに1枚を取得します。</p>
  <label>取得先<select value={kind} disabled={disabled} onChange={e=>{setKind(e.target.value as typeof kind);setSelected('');}}><option value="deck">山札から名前を選ぶ</option><option value="hand">手札からランダムに取る</option><option value="public">場の札を選ぶ</option></select></label>
  <label>取得候補<select value={selected} disabled={disabled} onChange={e=>setSelected(e.target.value)}><option value="">選んでください</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  <button disabled={disabled||!valid} onClick={()=>send({type:'CHOOSE_WISH',decisionId:d.decisionId,source:kind==='deck'?{kind,cardName:selected}:kind==='hand'?{kind,ownerId:selected}:{kind,cardInstanceId:selected}})}>この候補から1枚取得する</button>
 </aside>;
}
