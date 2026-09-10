import type {PlayerView} from '@madou/engine';
import type {GameCommand} from '@madou/protocol';
import {getAction} from '@madou/catalog';
type View=Pick<PlayerView,'printedCombinationOptions'>;
type Component='a2-p05-r1c3'|'a2-p05-r2c1';
function pool(view:View,command:GameCommand|null){return command&&(command.type==='ATTACK'||command.type==='PLAY_DEFENSE')?view.printedCombinationOptions.find(o=>o.cardInstanceId===command.cardInstanceId&&o.dedicated===command.dedicated)?.componentIds??[]:[];}
export function withPrintedComponents(view:View,command:GameCommand|null,selected:string[]):GameCommand|null{
 if(!selected.length)return command;if(!command||(command.type!=='ATTACK'&&command.type!=='PLAY_DEFENSE')||new Set(selected).size!==selected.length||selected.some(id=>!pool(view,command).includes(id as Component)))return null;
 return {...command,combinationCardInstanceIds:[...selected] as Component[]};
}
export function PrintedCombinationFields({view,command,selected,disabled,onChange}:{view:View;command:GameCommand|null;selected:string[];disabled:boolean;onChange:(ids:string[])=>void}){
 const available=pool(view,command);if(!available.length)return null;
 return <fieldset disabled={disabled}><legend>同時に使う複合札</legend><p>選んだ札も支払います。それぞれの使用を取り消す機会があります。</p>{available.map(id=><label key={id} className="inline"><input type="checkbox" checked={selected.includes(id)} onChange={()=>onChange(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])}/>{getAction(id)!.name}</label>)}</fieldset>;
}
