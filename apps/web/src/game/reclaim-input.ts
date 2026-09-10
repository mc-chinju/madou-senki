import type {PlayerView} from '@madou/engine';
import type {GameCommand} from '@madou/protocol';
export type ReclaimInputView=Pick<PlayerView,'reclaim'|'reservedCards'|'legalChoices'> & {players:Record<string,{name?:string}>};
export function reclaimCommand(view:ReclaimInputView,claimId?:string):GameCommand|null {
  const d=view.reclaim;
  if(!d?.canDecline||!view.legalChoices.includes('CHOOSE_RECLAIM'))return null;
  if(claimId===undefined)return {type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:'decline'};
  const claim=d.claims.find(c=>c.claimId===claimId);
  return claim?{type:'CHOOSE_RECLAIM',decisionId:d.decisionId,choice:claim.action,claimId}:null;
}
