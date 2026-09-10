export const REUSE_ABILITIES={
 'c2-p02-r1c2-ab03':{name:'妖精の弓',kind:'action-value'},
 'c2-p02-r2c2-ab04':{name:'主人公',kind:'reuse'},
 'c2-p03-r1c1-ab04':{name:'王の誇り',kind:'reuse'},
 'c2-p03-r2c1-ab04':{name:'月の愛',kind:'reuse'},
 'c2-p04-r1c1-ab03':{name:'凍気の奥義者',kind:'reuse'},
 'c2-p04-r1c2-ab04':{name:'魔導王第一軍',kind:'reuse'},
 'c2-p05-r1c2-ab04':{name:'魔導王第三軍',kind:'reuse'},
 'c2-p06-r1c1-ab04':{name:'魔導王第二軍',kind:'reuse'},
 'c2-p06-r2c1-ab03':{name:'炎の奥義者',kind:'reuse'},
 'c2-p06-r2c2-ab03':{name:'闇の雄叫び',kind:'reuse'},
} as const;
export type ReuseAbilityId=keyof typeof REUSE_ABILITIES;
export const REUSE_PACKAGES:Record<ReuseAbilityId,{right:'extra'|'unlimited';revealed:boolean;followers?:boolean;names?:readonly string[]}>= {
 'c2-p02-r1c2-ab03':{right:'extra',revealed:false},
 'c2-p02-r2c2-ab04':{right:'unlimited',revealed:true},
 'c2-p03-r1c1-ab04':{right:'extra',revealed:false,followers:true},
 'c2-p03-r2c1-ab04':{right:'unlimited',revealed:true,names:['月の竪琴','魔詩','呪歌']},
 'c2-p04-r1c1-ab03':{right:'extra',revealed:false},
 'c2-p04-r1c2-ab04':{right:'unlimited',revealed:true,names:['歌う船','飛竜']},
 'c2-p05-r1c2-ab04':{right:'unlimited',revealed:true,names:['グリフォン']},
 'c2-p06-r1c1-ab04':{right:'unlimited',revealed:true,names:['スケルトン','ゾンビー','ワイト','デス・ナイト']},
 'c2-p06-r2c1-ab03':{right:'extra',revealed:false},
 'c2-p06-r2c2-ab03':{right:'unlimited',revealed:true,names:['狼牙','妖獣','餓狼']},
};
