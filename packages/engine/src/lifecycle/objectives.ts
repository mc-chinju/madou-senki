import {getCharacter} from '@madou/catalog';
import type {GameState,PlayerState} from '../state.js';
import type {CurrentObjective,Faction,Protection} from './types.js';
// Exact Character(A4) defeat clauses; multiple names mean any actual death (G16).
const PROTECTION:Record<string,string[]>={
  "c2-p01-r1c1": [
    "c2-p03-r1c2"
  ],
  "c2-p01-r1c2": [
    "c2-p03-r1c2"
  ],
  "c2-p01-r2c1": [
    "c2-p03-r1c2"
  ],
  "c2-p01-r2c2": [
    "c2-p03-r1c2"
  ],
  "c2-p02-r1c1": [
    "c2-p03-r1c2"
  ],
  "c2-p02-r1c2": [
    "c2-p03-r1c2",
    "c2-p01-r1c1"
  ],
  "c2-p02-r2c1": [
    "c2-p03-r1c2"
  ],
  "c2-p02-r2c2": [
    "c2-p03-r1c2"
  ],
  "c2-p03-r1c1": [
    "c2-p03-r1c2"
  ],
  "c2-p03-r1c2": [],
  "c2-p03-r2c1": [
    "c2-p03-r1c2"
  ],
  "c2-p03-r2c2": [
    "c2-p05-r2c2"
  ],
  "c2-p04-r1c1": [
    "c2-p05-r2c2",
    "c2-p06-r2c1"
  ],
  "c2-p04-r1c2": [
    "c2-p05-r2c2",
    "c2-p06-r1c2"
  ],
  "c2-p04-r2c1": [
    "c2-p05-r2c2"
  ],
  "c2-p04-r2c2": [
    "c2-p05-r2c2"
  ],
  "c2-p05-r1c1": [
    "c2-p06-r1c2"
  ],
  "c2-p05-r1c2": [
    "c2-p05-r2c2",
    "c2-p03-r2c2"
  ],
  "c2-p05-r2c1": [
    "c2-p05-r2c2"
  ],
  "c2-p05-r2c2": [],
  "c2-p06-r1c1": [
    "c2-p05-r2c2"
  ],
  "c2-p06-r1c2": [],
  "c2-p06-r2c1": [
    "c2-p05-r2c2",
    "c2-p04-r1c1"
  ],
  "c2-p06-r2c2": [
    "c2-p06-r1c2"
  ],
  "c2-p07-r1c1": [
    "c2-p03-r1c2"
  ],
  "c2-p07-r1c2": []
};
export function initialProtection(characterId:string):Protection{return {characterIds:[...(PROTECTION[characterId]??[])]};}
export function factionObjective(faction:Faction):CurrentObjective{return {kind:'extinction',enemyFactions:faction==='ヴァンミール'?['GOOD','EVIL']:[faction==='GOOD'?'EVIL':'GOOD']};}
export function isActive(p:PlayerState):boolean{return !p.presence||p.presence==='active';}
export function protectedDead(state:GameState,p:PlayerState):boolean{return (p.protection??initialProtection(p.characterId)).characterIds.some(characterId=>Object.values(state.players).some(other=>(other.characterId===characterId||other.abilityCharacterIds?.includes(characterId))&&(other.presence==='dead'||other.presence==='pending-death')));}
export function allowedFactions(characterId:string):Faction[]{
 const fixed:Record<string,Faction[]>={'c2-p01-r1c1':['GOOD'],'c2-p01-r2c1':['GOOD'],'c2-p02-r1c2':['GOOD'],'c2-p02-r2c2':['GOOD'],'c2-p03-r1c2':['GOOD'],'c2-p07-r1c1':['GOOD'],'c2-p05-r2c2':['EVIL'],'c2-p06-r1c1':['EVIL'],'c2-p06-r1c2':['EVIL','ヴァンミール'],'c2-p06-r2c2':['EVIL','ヴァンミール'],'c2-p07-r1c2':['ヴァンミール']};
 return [...(fixed[characterId]??['GOOD','EVIL','ヴァンミール'])];
}
export function replaceAllegiance(p:PlayerState,faction:Faction,objective:CurrentObjective,protection:Protection):boolean{
 if(!allowedFactions(p.characterId).includes(faction))return false;
 p.faction=faction;p.currentObjective=structuredClone(objective);p.protection=structuredClone(protection);p.objective=objective.label??(faction==='ヴァンミール'&&objective.enemyFactions.length===2&&objective.enemyFactions.includes('GOOD')&&objective.enemyFactions.includes('EVIL')?'ヴァンミール陣営以外の全滅':`${objective.enemyFactions.join('・')}の全滅`);
 if(p.deathIdentity){p.deathIdentity.faction=faction;p.deathIdentity.currentObjective=structuredClone(objective);p.deathIdentity.protection=structuredClone(protection);p.deathIdentity.objective=p.objective;}return true;
}

export function currentDefeatCondition(p:PlayerState):string {
 const protection=p.protection??initialProtection(p.characterId);
 return protection.description??(protection.characterIds.length?protection.characterIds.map(id=>`${getCharacter(id)?.name??id}の死亡`).join('、または'): 'なし');
}
