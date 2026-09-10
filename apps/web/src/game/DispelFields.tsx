import type {GameCommand} from '@madou/protocol';
export function withDispel(command:GameCommand|null,hand:string[],targetId:string):GameCommand|null {
 return command?.type==='ATTACK'&&targetId&&command.targetIds.includes(targetId)&&hand.includes('a2-p02-r3c1')?{...command,dispel:{cardInstanceId:'a2-p02-r3c1',targetId}}:command;
}
export function DispelFields({hand,targets,names,targetId,disabled,onChange}:{hand:string[];targets:string[];names:Record<string,string>;targetId:string;disabled:boolean;onChange:(id:string)=>void}){
 if(!hand.includes('a2-p02-r3c1')||!targets.length)return null;
 return <div><label>攻撃前の呪払<select aria-label="呪払の対象" disabled={disabled} value={targets.includes(targetId)?targetId:''} onChange={e=>onChange(e.target.value)}><option value="">使わない</option>{targets.map(id=><option key={id} value={id}>{names[id]}</option>)}</select></label><p>選んだ相手のゴーレムを全て破壊してから攻撃します。呪払の使用では手札を補充しません。</p></div>;
}
