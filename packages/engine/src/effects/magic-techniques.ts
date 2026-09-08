import type { Technique } from '../reactions/continuations.js';

type Changes=Partial<Omit<Technique,'contract'>>;
const contract:Technique['contract']={conditions:['in-hand-or-chant','own-action'],costs:[{kind:'physical-card',at:'accept'}],timing:['declaration'],targets:'declared-players',lifetime:'attack-group'};
function magic(changes:Changes):Technique{return{school:'magic',range:'far',useLevel:0,effectLevel:0,damage:null,attributes:['魔'],counter:false,chant:false,noChecks:false,defense:'none',hitCount:1,target:'one',followerIgnore:false,...changes,contract};}
function own(base:Technique,selected:boolean,characterName:string|undefined,owners:string[],changes:Changes){return selected&&owners.includes(characterName??'')?{...base,...changes}:base;}
type Factory=(characterName:string|undefined,selected:boolean)=>Technique;
const factories:Record<string,Factory>={
  'a2-p12-r2c2':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:4,attributes:['魔','水']}),s,c,['凍気のアイエル'],{effectLevel:6,damage:6,noChecks:true,target:'all'}),
  'a2-p12-r2c3':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:4,attributes:['魔','水'],maaiRequired:2}),s,c,['凍気のアイエル'],{effectLevel:7,damage:6,noChecks:true,target:'all',optionalFollowerBypassAtOrBelowEffectLevel:true}),
  'a2-p12-r3c1':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:4,attributes:['魔','水'],onHitResistance:{modifiers:[0],failureDamage:6}}),s,c,['凍気のアイエル'],{effectLevel:6,noChecks:true,target:'all'}),
  'a2-p12-r3c3':(c,s)=>own(magic({useLevel:6,effectLevel:6,damage:4,attributes:['魔','水'],onHitResistance:{modifiers:[-1],statusKind:'stopped'}}),s,c,['凍気のアイエル'],{effectLevel:8,damage:8,noChecks:true,target:'all',onHitResistance:{modifiers:[-3],statusKind:'stopped'}}),
  'a2-p13-r1c2':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:null,attributes:['魔','精'],onHitResistance:{modifiers:[-2,-1],statusKind:'ability-disabled'}}),s,c,['占星術師のアルセイル'],{effectLevel:5,noChecks:true,target:'all',destroyAllFollowers:true,onHitResistance:{modifiers:[-2],statusKind:'ability-disabled'}}),
  'a2-p13-r1c3':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:null,attributes:['魔'],onHitResistance:{modifiers:[-2],statusKind:'stopped'}}),s,c,['占星術師のアルセイル'],{effectLevel:7,noChecks:true,target:'all'}),
  'a2-p13-r2c1':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:null,attributes:['魔','精'],onHitResistance:{modifiers:[-2,-1],statusKind:'stopped'}}),s,c,['占星術師のアルセイル'],{effectLevel:5,noChecks:true,target:'all'}),
  'a2-p13-r1c1':(c,s)=>s&&c==='凍気のアイエル'?magic({useLevel:7,effectLevel:8,damage:14,attributes:['魔','水','詠'],chant:false,evadeProhibited:true,noChecks:true,target:'all',destroyFollowersAtOrBelowEffectLevel:true}):magic({useLevel:7,effectLevel:7,damage:7,attributes:['魔','水','詠'],chant:true,evadeProhibited:true,destroyFollowersAtOrBelow:5}),
  'a2-p13-r3c2':(c,s)=>own(magic({useLevel:7,effectLevel:7,damage:14,attributes:['魔','精','黒','詠'],chant:true,maaiProhibited:true}),s,c,['邪祭ウーノス'],{noChecks:true,target:'all'}),
  'a2-p14-r1c1':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:12,attributes:['魔','黒'],evadeProhibited:true,destroyFollowersAtOrBelow:6,destroyFollowerExemptAttributes:['死'],personalImmunityCharacterNames:['不死王ガドューラ']}),s,c,['不死王ガドューラ'],{noChecks:true,target:'all'}),
  'a2-p14-r1c2':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:6,attributes:['魔','白'],destroyFollowerAttributesAtOrBelowEffectLevel:['黒','死']}),s,c,['白魔術師シェリム'],{effectLevel:6,noChecks:true,counter:true,defense:'counter'}),
  'a2-p14-r1c3':(c,s)=>own(magic({useLevel:6,effectLevel:6,damage:10,attributes:['魔','白'],evadeProhibited:true,destroyFollowerAttributes:['黒','死']}),s,c,['白魔術師シェリム'],{effectLevel:7,noChecks:true}),
  'a2-p14-r2c1':(c,s)=>s&&c==='白魔術師シェリム'?magic({useLevel:7,effectLevel:9,damage:15,attributes:['魔','白','詠'],chant:true,maaiProhibited:true,noChecks:true,target:'all',destroyAllFollowers:true}):magic({useLevel:7,effectLevel:7,damage:10,attributes:['魔','白','詠'],chant:true,maaiProhibited:true,destroyFollowerAttributes:['黒','死']}),
  'a2-p14-r2c3':(c,s)=>own(magic({useLevel:8,effectLevel:8,damage:16,attributes:['魔','反','詠'],counter:true,chant:true,defense:'counter'}),s,c,['大神官ジル','邪祭ウーノス'],{effectLevel:9,damage:20,noChecks:true,target:'all'}),
  'a2-p14-r3c3':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:4,attributes:['魔','風']}),s,c,['有翼人のティア'],{effectLevel:5,damage:7,noChecks:true,target:'all'}),
  'a2-p15-r1c1':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:4,attributes:['魔','風'],evadeProhibited:true}),s,c,['有翼人のティア'],{effectLevel:6,damage:7,noChecks:true,target:'all'}),
  'a2-p15-r1c2':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:7,attributes:['魔','風'],evadeProhibited:true}),s,c,['有翼人のティア'],{effectLevel:6,damage:10,noChecks:true,target:'all'}),
  'a2-p15-r1c3':(c,s)=>own(magic({useLevel:6,effectLevel:6,damage:7,attributes:['魔','風'],maaiRequired:2,ignoreFollowerAttributes:['空']}),s,c,['有翼人のティア'],{effectLevel:7,damage:12,noChecks:true,target:'all'}),
  'a2-p15-r2c1':(c,s)=>s&&c==='有翼人のティア'?magic({useLevel:7,effectLevel:8,damage:18,attributes:['魔','風','詠'],chant:true,noChecks:true,target:'all',destroyAllFollowersExceptAttributes:['建']}):magic({useLevel:7,effectLevel:7,damage:12,attributes:['魔','風','詠'],chant:true,maxTargets:4}),
  'a2-p15-r2c2':(c,s)=>own(magic({useLevel:6,effectLevel:6,damage:2,attributes:['魔','精','黒'],maaiProhibited:true,followerIgnore:true,onHitResistance:{modifiers:[-1],statusKind:'stopped',targetOverrides:[{characterNames:['竜皇子アスフェルト'],modifiers:[-2]}]}}),s,c,['魔聖母ディア'],{damage:null,damageFormula:'2d6x2',noChecks:true,target:'all'}),
  'a2-p15-r3c2':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:5,attributes:['魔','炎']}),s,c,['爆炎のフレイアード'],{effectLevel:5,damage:8,noChecks:true,target:'all'}),
  'a2-p15-r3c3':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:5,attributes:['魔','炎'],maaiRequired:2}),s,c,['爆炎のフレイアード'],{effectLevel:6,damage:8,noChecks:true,target:'all'}),
  'a2-p16-r1c1':(c,s)=>own(magic({useLevel:6,effectLevel:6,damage:5,attributes:['魔','炎'],evadeProhibited:true}),s,c,['爆炎のフレイアード'],{effectLevel:7,damage:8,noChecks:true,target:'all'}),
  'a2-p16-r1c2':(c,s)=>own(magic({useLevel:6,effectLevel:6,damage:10,attributes:['魔','炎']}),s,c,['爆炎のフレイアード'],{effectLevel:7,damage:13,noChecks:true,target:'all'}),
  'a2-p16-r1c3':(c,s)=>own(magic({useLevel:7,effectLevel:7,damage:15,attributes:['魔','炎','詠'],chant:true,maaiRequired:2}),s,c,['爆炎のフレイアード'],{effectLevel:8,damage:18,chant:false,noChecks:true,target:'all'}),
  'a2-p16-r2c1':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:5,attributes:['魔','精','黒'],destroyFollowerAttributes:['白']}),s,c,['餓狼ヨーツルム'],{effectLevel:5,damage:7,noChecks:true,target:'all'}),
  'a2-p16-r2c2':(c,s)=>own(magic({useLevel:6,effectLevel:6,damage:null,damageFormula:'attacker-magic-x2',attributes:['魔','精','黒'],destroyFollowerAttributes:['白']}),s,c,['餓狼ヨーツルム'],{noChecks:true,target:'all'}),
  'a2-p16-r2c3':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:6,attributes:['魔','地']}),s,c,['小人のランバ'],{damage:9,noChecks:true,target:'all'}),
  'a2-p16-r3c1':(c,s)=>own(magic({useLevel:4,effectLevel:4,damage:null,attributes:['魔','地'],onHitResistance:{modifiers:[-3,-2,-1,0],statusKind:'stopped'}}),s,c,['小人のランバ'],{noChecks:true,target:'all'}),
  'a2-p16-r3c2':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:4,attributes:['魔','地'],maaiRequired:2}),s,c,['小人のランバ'],{damage:7,noChecks:true,target:'all'}),
  'a2-p17-r1c2':(c,s)=>own(magic({useLevel:6,effectLevel:6,damage:null,damageFormula:'d6x2',attributes:['魔','精','歌'],followerIgnore:true}),s,c,['吟遊詩人のレスター'],{effectLevel:7,damageFormula:'d6x4',counterProhibited:true,noChecks:true,target:'all'}),
  'a2-p17-r1c1':(c,s)=>own(magic({useLevel:5,effectLevel:5,damage:5,attributes:['魔','精','歌'],onHitResistance:{modifiers:[-3,-2,-1],statusKind:'stopped'}}),s,c,['吟遊詩人のレスター'],{effectLevel:6,damage:7,followerIgnore:true,noChecks:true,target:'all',onHitResistance:{modifiers:[-3],statusKind:'stopped'}}),
  'a2-p17-r2c3':()=>magic({useLevel:5,effectLevel:5,damage:null,attributes:['魔','精'],followerIgnore:true,onHitResistance:{modifiers:[-1],failureDamage:10}}),
  'a2-p17-r3c1':()=>magic({useLevel:5,effectLevel:5,damage:5,attributes:['魔','精','黒','反'],counter:true,defense:'counter',onHitResistance:{modifiers:[-2,-1,0],statusKind:'stopped'}}),
  'a2-p17-r3c2':()=>magic({range:'none',useLevel:5,effectLevel:5,attributes:['魔','反'],counter:true,defense:'reflect',reflectMagicLimit:6,blockWarriorLimit:-1}),
  'a2-p17-r2c1':()=>magic({useLevel:4,effectLevel:4,damage:5}),
  'a2-p17-r2c2':()=>magic({useLevel:5,effectLevel:5,damage:7}),
  'a2-p18-r1c2':()=>magic({range:'near',useLevel:6,effectLevel:6,damage:15,attributes:['魔','詠'],chant:true,counterProhibited:true}),
  'a2-p18-r1c3':()=>magic({useLevel:6,effectLevel:6,damage:8,attributes:['魔','地'],maxTargets:2}),
  'a2-p18-r2c2':()=>magic({range:'none',useLevel:0,effectLevel:0,useLevelSource:'incoming-effect',attributes:['魔','反'],counter:true,defense:'negate'}),
  'a2-p18-r2c3':()=>magic({range:'none',useLevel:0,effectLevel:0,useLevelSource:'incoming-effect',attributes:['魔','反'],counter:true,defense:'negate'}),
};
const owners:Record<string,string[]>={
  'a2-p12-r3c1':['凍気のアイエル'],'a2-p12-r3c3':['凍気のアイエル'],'a2-p13-r1c3':['占星術師のアルセイル'],'a2-p13-r2c1':['占星術師のアルセイル'],'a2-p15-r2c2':['魔聖母ディア'],'a2-p16-r3c1':['小人のランバ'],'a2-p17-r1c1':['吟遊詩人のレスター'],
  'a2-p13-r1c2':['占星術師のアルセイル'],
  'a2-p12-r2c2':['凍気のアイエル'],'a2-p12-r2c3':['凍気のアイエル'],'a2-p13-r1c1':['凍気のアイエル'],'a2-p13-r3c2':['邪祭ウーノス'],'a2-p14-r1c1':['不死王ガドューラ'],'a2-p14-r1c2':['白魔術師シェリム'],'a2-p14-r1c3':['白魔術師シェリム'],'a2-p14-r2c1':['白魔術師シェリム'],'a2-p14-r2c3':['大神官ジル','邪祭ウーノス'],'a2-p14-r3c3':['有翼人のティア'],'a2-p15-r1c1':['有翼人のティア'],'a2-p15-r1c2':['有翼人のティア'],'a2-p15-r1c3':['有翼人のティア'],'a2-p15-r2c1':['有翼人のティア'],'a2-p15-r3c2':['爆炎のフレイアード'],'a2-p15-r3c3':['爆炎のフレイアード'],'a2-p16-r1c1':['爆炎のフレイアード'],'a2-p16-r1c2':['爆炎のフレイアード'],'a2-p16-r1c3':['爆炎のフレイアード'],'a2-p16-r2c1':['餓狼ヨーツルム'],'a2-p16-r2c2':['餓狼ヨーツルム'],'a2-p16-r2c3':['小人のランバ'],'a2-p16-r3c2':['小人のランバ'],'a2-p17-r1c2':['吟遊詩人のレスター'],
};
export function printedMagicTechniqueFor(id:string,characterName?:string,selected=false){return factories[id]?.(characterName,selected);}
export function canSelectPrintedMagicDedicated(id:string,characterName?:string){return owners[id]?.includes(characterName??'')??false;}
