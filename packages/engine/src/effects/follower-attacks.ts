import {getAction} from '@madou/catalog';
import type {Technique} from '../reactions/continuations.js';
// Explicit printed permissions: an attack bottom alone never creates an action.
const owners:Record<string,string[]>={
 'a2-p19-r2c1':['不死王ガドューラ'],'a2-p19-r3c3':['不死王ガドューラ'],'a2-p20-r1c2':['黒騎士ガーウィン'],
 'a2-p20-r1c3':['聖騎士ランスロット','聖騎士ランスロット2'],'a2-p20-r2c1':['竜皇子アスフェルト'],
 'a2-p20-r3c1':['獣使いのウパニシャット'],'a2-p21-r1c1':['不死王ガドューラ'],'a2-p21-r1c2':['リーア姫'],
 'a2-p21-r1c3':['有翼人のティア'],'a2-p21-r2c2':['黒妖精のアーネス'],'a2-p21-r2c3':['小人のランバ'],
 'a2-p21-r3c1':['邪祭ウーノス'],'a2-p21-r3c2':['大神官ジル'],'a2-p21-r3c3':['妖精王フューリー'],
 'a2-p22-r1c3':['リーア姫'],'a2-p22-r3c1':['竜皇子アスフェルト'],'a2-p22-r3c2':['不死王ガドューラ'],'a2-p22-r3c3':['リーア姫'],
};
export function canSelectFollowerAttack(id:string,name:string|undefined){return !!name&&!!owners[id]?.includes(name);}
export function followerAttackFor(id:string,name:string|undefined,dedicated:boolean):Technique|undefined{
 if(!dedicated||!canSelectFollowerAttack(id,name))return;
 const card=getAction(id)!;const bottom=card.stats!.attack as {attributes:string[];level:number|string;damage:number|string;additional:string};
 const selected=['a2-p19-r2c1','a2-p19-r3c3','a2-p20-r2c1','a2-p20-r3c1','a2-p21-r1c1','a2-p21-r3c1','a2-p21-r3c3','a2-p22-r1c3'].includes(id);
 const mandatory=['a2-p21-r1c3','a2-p22-r3c1','a2-p22-r3c2','a2-p22-r3c3'].includes(id);
 const noChecks=selected||['a2-p22-r3c1','a2-p22-r3c2','a2-p22-r3c3'].includes(id);
 const attributes=[...bottom.attributes];if(['a2-p19-r2c1','a2-p19-r3c3','a2-p21-r1c1'].includes(id)){attributes.splice(attributes.indexOf('近'),1,'遠');}
 const t:Technique={school:attributes.includes('魔')?'magic':'warrior',range:attributes.includes('遠')?'far':'near',attributes,
 useLevel:typeof bottom.level==='number'?bottom.level:id==='a2-p21-r3c3'?3:0,effectLevel:typeof bottom.level==='number'?bottom.level:id==='a2-p21-r3c3'?3:0,
 damage:typeof bottom.damage==='number'?bottom.damage:0,noChecks,counter:false,chant:false,defense:'none',hitCount:id==='a2-p20-r3c1'?2:id==='a2-p21-r2c3'?3:1,
 target:selected||mandatory?'all':'one',...(mandatory?{mandatoryAll:true}:{}),followerIgnore:id==='a2-p21-r1c1',
 contract:{conditions:['character-specific','own-action'],costs:[{kind:'physical-card',at:'accept'}],timing:['declaration'],targets:'declared-players',lifetime:'attack-group'}};
 if(['a2-p19-r2c1','a2-p19-r3c3'].includes(id))t.counterProhibited=true;
 if(id==='a2-p20-r1c2'){t.effectLevel=5;t.damageMultiplier=2;}
 if(['a2-p20-r2c1','a2-p21-r3c1','a2-p21-r1c3'].includes(id))t.damageFormula='2d6';
 if(id==='a2-p21-r1c3')t.damageAdditive=10;
 if(id==='a2-p21-r2c3')t.useLevelSource='own-warrior';
 if(id==='a2-p21-r3c3'){t.effectLevelFormula='d6';t.damageFormula='d6';t.damageAdditive=4;}
 if(id==='a2-p22-r3c1')t.evadeProhibited=true;
 if(id==='a2-p22-r3c2'){t.maaiRequired=2;t.maaiAtomic=true;}
 if(id==='a2-p22-r3c3')t.maaiProhibited=true;
 return t;
}

/** C10 grants only the ordinary printed bottom; dedicated text is separately elected. */
export function followerBottomFor(id:string):Technique|undefined{
 const card=getAction(id);const bottom=card?.category==='follower'?card.stats?.attack as {attributes:string[];level:number|string;damage:number|string;additional:string}|undefined:undefined;
 if(!bottom)return;
 const attributes=[...bottom.attributes];const t:Technique={school:attributes.includes('魔')?'magic':'warrior',range:attributes.includes('遠')?'far':'near',attributes,useLevel:typeof bottom.level==='number'?bottom.level:id==='a2-p21-r3c3'?3:0,effectLevel:typeof bottom.level==='number'?bottom.level:id==='a2-p21-r3c3'?3:0,damage:typeof bottom.damage==='number'?bottom.damage:0,noChecks:false,counter:false,chant:false,defense:'none',hitCount:id==='a2-p20-r3c1'?2:id==='a2-p21-r2c3'?3:1,target:bottom.additional.includes('全員')?'all':'one',...(bottom.additional.includes('全員')?{mandatoryAll:true}:{}),followerIgnore:false,contract:{conditions:['own-action'],costs:[{kind:'physical-card',at:'accept'}],timing:['declaration'],targets:'declared-players',lifetime:'attack-group'}};
 if(['a2-p20-r2c1','a2-p21-r3c1','a2-p21-r1c3'].includes(id))t.damageFormula='2d6';
 if(id==='a2-p21-r1c3')t.damageAdditive=10;
 if(id==='a2-p21-r2c3')t.useLevelSource='own-warrior';
 if(id==='a2-p21-r3c3'){t.effectLevelFormula='d6';t.damageFormula='d6';t.damageAdditive=4;}
 if(id==='a2-p22-r3c1')t.evadeProhibited=true;
 if(id==='a2-p22-r3c2'){t.maaiRequired=2;t.maaiAtomic=true;}
 if(id==='a2-p22-r2c3')t.destroyAllFollowersExceptAttributes=['空'];
 if(id==='a2-p23-r1c1')t.stopUntilSourceTurn=true;
 return t;
}
