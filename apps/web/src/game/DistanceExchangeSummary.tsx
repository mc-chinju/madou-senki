import type {PlayerView} from '@madou/engine';

export function DistanceExchangeSummary({progress,names}:{progress:PlayerView['distanceExchange'];names:Record<string,string>}){
 if(!progress)return null;
 const actor=progress.responseComplete?progress.maaiActorId:progress.advanceActorId;
 return <section className="panel" aria-label="接近・離脱の応酬"><h2>接近・離脱の応酬</h2><div aria-live="polite" aria-atomic="true"><p>今回の間合いへの踏み込み：{progress.paidAdvances} / {progress.requiredAdvances}枚</p><p>{names[actor]??'参加者'}さんの{progress.responseComplete?'間合い':'踏み込み'}の判断待ち</p></div></section>;
}
