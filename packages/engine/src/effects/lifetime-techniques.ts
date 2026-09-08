import type {Technique} from '../reactions/continuations.js';
const owners:Record<string,string[]>={
 'a2-p09-r3c1':['不死王ガドューラ'],'a2-p13-r2c3':['破壊神ヴァンミール'],'a2-p13-r3c1':['邪祭ウーノス'],'a2-p13-r3c3':['邪祭ウーノス'],'a2-p14-r2c2':['白魔術師シェリム'],'a2-p14-r3c1':['大神官ジル'],'a2-p14-r3c2':['大神官ジル'],'a2-p15-r2c3':['魔聖母ディア'],'a2-p15-r3c1':['魔聖母ディア'],
};
export function canSelectLifetimeDedicated(id:string,name?:string){return owners[id]?.includes(name??'')??false;}
export function lifetimeTechniqueFor(id:string,name?:string,selected=false):Technique|undefined{
 const own=selected&&canSelectLifetimeDedicated(id,name);
 const base:Technique={school:'magic',range:'far',useLevel:7,effectLevel:7,damage:null,attributes:['魔'],counter:false,chant:false,noChecks:false,defense:'none',hitCount:1,target:'one',followerIgnore:false,contract:{conditions:['in-hand-or-chant','own-action'],costs:[{kind:'physical-card',at:'accept'}],timing:['declaration'],targets:'declared-players',lifetime:'attack-group'}};
 switch(id){
 case 'a2-p17-r3c3':return {...base,range:'none',useLevel:5,effectLevel:5,turnEffect:'magic-gate'};
 case 'a2-p09-r3c1':return {...base,school:'warrior',damage:8,attributes:['戦','鎌','詠'],chant:true,evadeProhibited:true,noChecks:own,target:own?'all':'one',...(own?{lifetimeHit:{kind:'instant-death',modifier:-2,optional:true}}:{})};
 case 'a2-p12-r2c1':return {...base,school:'warrior',range:'none',useLevel:5,effectLevel:5,attributes:['戦'],turnEffect:'heal-self'};
 case 'a2-p14-r3c1':case 'a2-p14-r3c2':return {...base,range:'none',useLevel:5,effectLevel:5,turnEffect:own?'heal-near':'heal-self'};
 case 'a2-p13-r3c1':return {...base,range:'none',useLevel:10,effectLevel:10,attributes:['魔','詠'],chant:!own,noChecks:own,target:own?'all':'one',turnEffect:'revive',revivalConversion:own};
 case 'a2-p13-r2c3':return {...base,useLevel:10,effectLevel:10,damage:20,attributes:['魔','詠'],chant:true,maaiProhibited:true,evadeProhibited:true,limitedDefenses:['teleport','counter'],destroyAllFollowers:true,selfCost:{damage:own?0:10,destroyFollowers:true}};
 case 'a2-p13-r3c3':return {...base,useLevel:8,effectLevel:8,damage:10,attributes:['魔','黒','詠'],chant:true,prohibitedFactions:['GOOD'],maaiProhibited:true,destroyFollowersAtOrBelowEffectLevel:true,noChecks:own,target:own?'all':'one',...(own?{lifetimeHit:{kind:'fixed-stop',modifier:0,optional:true}}:{})};
 case 'a2-p14-r2c2':return {...base,effectLevel:own?8:7,damage:own?12:8,attributes:['魔','白','詠'],chant:true,followerIgnore:true,noChecks:own,target:own?'all':'one',...(own?{}:{maxTargets:3}),lifetimeHit:{kind:'otherworld',modifier:0,optional:own}};
 case 'a2-p15-r2c3':return {...base,range:own?'far':'near',effectLevel:own?8:7,attributes:['魔','精','黒'],followerIgnore:own,noChecks:own,target:own?'all':'one',lifetimeHit:{kind:'soul-drain',modifier:-1,optional:own}};
 case 'a2-p15-r3c1':return {...base,effectLevel:own?8:7,attributes:['魔','精','黒','詠'],chant:true,followerIgnore:own,noChecks:own,target:own?'all':'one',lifetimeHit:{kind:'deadly-stop',modifier:own?-3:-1}};
 case 'a2-p18-r2c1':return {...base,damage:5,attributes:['魔','地','詠'],chant:true,lifetimeHit:{kind:'petrification',modifier:0}};
 }
}
