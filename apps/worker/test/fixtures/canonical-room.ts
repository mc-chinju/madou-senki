import type {Entropy} from '@madou/engine';
import {Room} from '../../src/rooms/room.js';
/** Only store-worker exports this subclass; no client route exposes these setters. */
export class CanonicalRoom extends Room {
 private nextEntropy:Entropy|undefined;
 private entropyCalls=0;
 private overridesConsumed=0;
 setNextEntropy(value:Entropy):void{this.nextEntropy=structuredClone(value);}
 entropyProbe(){return {calls:this.entropyCalls,consumed:this.overridesConsumed,pending:this.nextEntropy!==undefined};}
 protected commandEntropy():Entropy{
  this.entropyCalls++;
  if(this.nextEntropy){const value=this.nextEntropy;this.nextEntropy=undefined;this.overridesConsumed++;return value;}
  return super.commandEntropy();
 }
}
