/** Whole original turn/information packages; canonical IDs are private unless revealed. */
export const TURN_PACKAGES={
 'c2-p01-r2c2-ab02':{name:'なになに',kind:'turn-draw'},
 'c2-p01-r2c2-ab03':{name:'見ちゃった',kind:'turn-information'},
 'c2-p02-r2c1-ab04':{name:'わかんねえよ',kind:'turn-information'},
 'c2-p03-r1c2-ab02':{name:'神出鬼没',kind:'turn-information'},
 'c2-p03-r2c1-ab03':{name:'噂',kind:'turn-information'},
 'c2-p04-r1c1-ab04':{name:'双子',kind:'turn-information'},
 'c2-p04-r2c1-ab01':{name:'影',kind:'turn-information'},
 'c2-p04-r2c1-ab02':{name:'占星',kind:'turn-information'},
 'c2-p04-r2c1-ab03':{name:'本当の力',kind:'voluntary-reveal'},
 'c2-p05-r1c1-ab01':{name:'策謀の主',kind:'turn-information'},
 'c2-p06-r2c1-ab04':{name:'双子',kind:'turn-information'},
 'c2-p07-r1c1-ab03':{name:'成長',kind:'turn-draw'},
} as const;
export type TurnPackageId=keyof typeof TURN_PACKAGES;
export const CHAM_INSPECT='c2-p01-r2c2-ab03',LIA_INSPECT='c2-p03-r1c2-ab02',LESTER_INSPECT='c2-p03-r2c1-ab03',STAR_INSPECT='c2-p04-r2c1-ab02',ALSEIL_SHADOW='c2-p04-r2c1-ab01',TRUE_POWER='c2-p04-r2c1-ab03',UONOS_REVEAL='c2-p05-r1c1-ab01',LANCASTER_DISCARD='c2-p02-r2c1-ab04';
export function isTurnPackage(id:string):id is TurnPackageId{return Object.hasOwn(TURN_PACKAGES,id);}
export function mainTurnPackage(id:string):boolean{return [LANCASTER_DISCARD,'c2-p04-r1c1-ab04','c2-p06-r2c1-ab04'].includes(id);}
