import {getAction} from '@madou/catalog';
import type {GameCommand} from '@madou/protocol';
import {reclaimCommand,type ReclaimInputView} from './reclaim-input.js';
export function ReclaimPanel({view,disabled,send}:{view:ReclaimInputView;disabled:boolean;send:(command:GameCommand)=>boolean}) {
  const d=view.reclaim;
  if(!d&&!view.reservedCards.length)return null;
  return <section className="panel" aria-label="カードの回収"><h2>カードの回収</h2>
    {d?<><p>{getAction(d.cardInstanceId)?.name??'カード'}の処理が終わりました。回答が終わると元の処理へ戻ります。</p>
      {d.stage==='ability-declaration'?<p role="status">回収能力の宣言を確認しています。成立すると予約し、元の処理が終わってから手札へ戻ります。</p>:d.stage==='printed-check'?<p role="status">回収判定を進めています。結果が決まると、成功時は元の使用者が受け取りを選べます。</p>:d.canDecline?<>
        {d.claims.map(claim=>{const command=reclaimCommand(view,claim.claimId);return <button key={claim.claimId} disabled={disabled||!command} onClick={()=>{if(command)send(command);}}>{claim.label}</button>;})}
        <button disabled={disabled||!reclaimCommand(view)} onClick={()=>{const command=reclaimCommand(view);if(command)send(command);}}>回収せずに進む</button>
      </>:<p role="status">{view.players[d.pendingActorId]?.name??'参加者'}さんの回答を待っています。</p>}
    </>:null}
    {view.reservedCards.length?<><h3>回収予約中</h3><p>元の処理がすべて終わると手札へ戻ります。予約中の札はまだ使えません。</p>
      <ul>{view.reservedCards.map(id=><li key={id}>{getAction(id)?.name??'カード'}</li>)}</ul></>:null}
  </section>;
}
