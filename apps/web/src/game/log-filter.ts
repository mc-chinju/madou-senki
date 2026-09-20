import type {LogView,PlayerView} from '@madou/engine';
/** What the reader asked the record to show: everyone, the part they have a share in, or one seat. */
export type LogFilter={kind:'all'}|{kind:'self'}|{kind:'seat';actorId:string};
/** Every card this reader may call their own: what they hold, what they have placed, and what they have let go.
 *  The reader's own record names cards nobody else saw, so it is the only place some of them are ever written. */
export function readerCards(view:PlayerView):ReadonlySet<string>{
 const self=view.self as PlayerView['self']|undefined;
 return new Set([...self?.hand??[],...(self?.followers??[]).map(card=>card.cardInstanceId),...(self?.chants??[]).map(card=>card.cardInstanceId),
  ...self?.discardedCardInstanceIds??[],...(view.privateLogs??[]).flatMap(cardsOf)]);
}
function cardsOf(event:LogView):string[]{
 return [event.cardInstanceId,...event.cardInstanceIds??[],event.death?.sourceCardInstanceId].filter((id):id is string=>!!id);
}
/** The one rule that says whether a record belongs to a seat: the seat acted, the record points at it, or a
 *  card of its own moved. Only a reader knows which cards are their own, so other seats are read by name alone. */
export function logInvolves(event:LogView,seatId:string,ownCards?:ReadonlySet<string>):boolean{
 if(event.actorId===seatId||event.death?.sourceActorId===seatId)return true;
 if(event.targetId===seatId||event.targetIds?.includes(seatId))return true;
 return !!ownCards?.size&&cardsOf(event).some(id=>ownCards.has(id));
}
/** The seat a filter reads, or nothing when the record is to stay whole. */
export function filterSeat(view:PlayerView,filter:LogFilter):string|undefined{
 return filter.kind==='seat'?filter.actorId:filter.kind==='self'?(view.self as PlayerView['self']|undefined)?.id:undefined;
}
/** The seat a filter reads together with the cards that seat may call its own. Naming one's own seat in the
 *  participant list has to read the same record as 「自分に関係する」, so which cards are known is decided by
 *  whose seat it is and never by which of the two ways the reader got there. */
export function filterTarget(view:PlayerView,filter:LogFilter):{seatId?:string;ownCards?:ReadonlySet<string>}{
 const seatId=filterSeat(view,filter);
 if(seatId===undefined)return {};
 return seatId===(view.self as PlayerView['self']|undefined)?.id?{seatId,ownCards:readerCards(view)}:{seatId};
}
const FILTER_KEY='madou:log-filter:v1';
/** The choice belongs to this table only, and a server render has no storage at all. */
function filterKey():string{return `${FILTER_KEY}:${globalThis.location?.pathname??''}`;}
export function serializeFilter(filter:LogFilter):string{return filter.kind==='seat'?`seat:${filter.actorId}`:filter.kind;}
/** A stored choice is only honoured while it still names a seat at this table. */
export function parseFilter(value:string|null|undefined,seatIds:readonly string[]):LogFilter{
 if(value==='self')return {kind:'self'};
 const seat=value?.startsWith('seat:')?value.slice(5):null;
 return seat&&seatIds.includes(seat)?{kind:'seat',actorId:seat}:{kind:'all'};
}
export function storedFilter(seatIds:readonly string[]):LogFilter{
 try{return parseFilter(globalThis.sessionStorage?.getItem(filterKey()),seatIds);}catch{return {kind:'all'};}
}
export function storeFilter(filter:LogFilter):void{
 try{globalThis.sessionStorage?.setItem(filterKey(),serializeFilter(filter));}catch{/* storage may be unavailable */}
}
