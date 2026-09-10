import type {PlayerView} from '@madou/engine';
import type {GameCommand} from '@madou/protocol';
export function AnytimeCardPanel({view,disabled,send}:{view:Pick<PlayerView,'anytimeCardOptions'|'legalChoices'>;disabled:boolean;send:(command:GameCommand)=>boolean}) {
  if(!view.legalChoices.includes('PLAY_ANYTIME_CARD')||!view.anytimeCardOptions.length)return null;
  return <section className="panel" aria-label="その場で使うカード"><h2>その場で使うカード</h2>
    <p>現在の宣言や攻撃に対応できます。使用したカードはすぐに補充されます。</p>
    {view.anytimeCardOptions.map(option=><button key={`${option.cardInstanceId}-${option.targetEventId}-${option.targetId??''}-${option.groupId??''}-${option.hitIndex??''}`} disabled={disabled}
      onClick={()=>send({type:'PLAY_ANYTIME_CARD',cardInstanceId:option.cardInstanceId,targetEventId:option.targetEventId,...(option.targetId?{targetId:option.targetId}:{}),...(option.groupId?{groupId:option.groupId}:{}),...(option.hitIndex!==undefined?{hitIndex:option.hitIndex}:{})})}>{option.label}</button>)}
  </section>;
}
