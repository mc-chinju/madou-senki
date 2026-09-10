import type {PlayerView} from '@madou/engine';
import type {GameCommand} from '@madou/protocol';
export function TurnCardPanel({view,disabled,send}:{view:Pick<PlayerView,'turnCardOptions'>;disabled:boolean;send:(command:GameCommand)=>boolean}){
  if(!view.turnCardOptions.length)return null;
  return <section className="panel" aria-label="手番カードの効果"><h2>手番カードの効果</h2>
    <p>秘伝書は手番の行動を使いません。ほかのカードは手番の行動として使用します。</p>
    {view.turnCardOptions.map(o=><div key={o.cardInstanceId}><button disabled={disabled} onClick={()=>send({type:'PLAY_TURN_CARD',cardInstanceId:o.cardInstanceId})}>{o.label}</button>{o.canUseDedicated?<button disabled={disabled} onClick={()=>send({type:'PLAY_TURN_CARD',cardInstanceId:o.cardInstanceId,mode:'dedicated'})}>{o.label}（判定不要）</button>:null}</div>)}
  </section>;
}
