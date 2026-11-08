/** Approved chapter content; fiction never enters transaction/evidence fields. */
export const chapterContent = {
 receipt: {states:['订单还没下，退货先到了。','泥点擦掉了。购买日期写着：明天。','纸压平了。时间没理顺。'],action:'读出票面',reply:'请提前后悔。'},
 stamp: {states:['无论哪天盖，都是昨天。','锈去掉了。昨天还在。','弹簧修好了，昨天回来得更快了。'],action:'盖个邮戳',reply:'今天的事，昨天再办。'},
 'cosmic-parcel': {states:['箱子里装着一小片夜空。','封签背面写着：明日寄出。','封带拉紧了，星光没关住。'],action:'敲敲箱盖',reply:'宇宙在家，但不方便签收。'},
 tape: {states:['还没撕开，它先说了对不起。','灰清掉了，道歉没有减少。','这次粘稳了。它还是不放心。'],action:'拉出一截',reply:'对不起，刚才又粘人了。'},
 nested: {states:['小箱子里面，装着一个更大的箱子。','看得更清楚了，也更不明白了。','箱盖合得上，大小关系合不上。'],action:'打开一层',reply:'拆到最后，还是第一层。'},
 bell: {states:['你转过身，它响了。','铜锈没了，它继续装哑巴。','机构修好了，脾气一点没改。'],action:'轻按铃铛',reply:'叮。还是没人签收。'},
} as const;
export type ChapterCurio = keyof typeof chapterContent;
export const chapterCurios = Object.keys(chapterContent) as ChapterCurio[];
export const chapterReveal = {slip:'退回目的地：上一天。',conclusion:'它把“退回上一站”，办成了“退回上一天”。',result:'发现了：早到一天的退件。'};
export const chapterLetter = {front:'收件人：愿意留下这些东西的人。',back:'找不到收件人，也不必全部退回。',end:'这一回，就留在这里吧。'};
export const chapterLine = (id:ChapterCurio,condition:string)=>chapterContent[id].states[condition==='stabilized'?2:condition==='clean'?1:0];
