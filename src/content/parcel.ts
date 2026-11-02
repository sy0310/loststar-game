import type { Planet } from './types';
export const parcel: Planet = {
  id:'parcel', name:'退货箱星', subtitle:'所有包裹，都在等一个不存在的收件人。', color:'#f7ac55', playable:true,
  regions:[{ id:'parcel-plains', name:'退件平原', visualTheme:'cardboard', discoveries:[
    {id:'receipt',kind:'artifact',name:'未购买的退货收据',description:'你确信没有买过它。收据却认真地写着：欢迎再次光临。',interaction:'收据轻轻卷起，给你打印了一张「已收到好奇心」的小票。',milestone:1,rarity:'寻常',icon:'receipt'},
    {id:'tape',kind:'artifact',name:'自动道歉的胶带',description:'每撕下一截，都会小声说一句对不起。粘性倒是很好。',interaction:'「对不起，把你的烦恼粘住了。」胶带有点不好意思。',milestone:2,rarity:'稀奇',icon:'tape'},
    {id:'mouse',kind:'creature',name:'拆封鼠',description:'宇宙最小的拆箱员。它只对包装感兴趣，礼物会原封不动地退回来。',interaction:'拆封鼠熟练地打开了空气，然后把空气认真装回去。',milestone:3,rarity:'稀奇',icon:'mouse'},
    {id:'nested',kind:'artifact',name:'无限套娃包裹',description:'箱子里有一个小箱子。小箱子里有一个稍大的箱子。请不要想太多。',interaction:'你打开第三层，发现第一层正在里面等你。',milestone:5,rarity:'稀奇',icon:'nested'},
    {id:'return-request',kind:'event',name:'来自星球的退货申请',description:'退货箱星申请退回整个宇宙。退货原因：与描述不符。',interaction:'失物号回复：「已受理。请保留宇宙的原始包装。」',milestone:8,rarity:'异常',icon:'signal'},
  ]}],
};
