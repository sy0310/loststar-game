// Resident links stay on the first planet. These notes grant no currency or claims.
export const parcelJournal = [
  {id:'empty-apology',cycle:75,requires:['mouse','tape'],art:'mouse',title:'替空箱子说声对不起',text:'拆封鼠把道歉胶带贴进了空箱。胶带终于停下来听它说：这里已经很好了。'},
  {id:'tomorrow-label',cycle:100,requires:['tagbird','stamp'],art:'tagbird',title:'标签鸟寄来了明天',text:'邮戳坚持盖昨天，标签鸟坚持贴明天。咔哒把它们放在同一个信封里，今天就有了去处。'},
  {id:'room-for-shell',cycle:150,requires:['hermit','nested'],art:'hermit',title:'小房间里还有一间小房间',text:'箱寄居蟹试住了套娃包裹的第三层。它没有搬走，只给拆封鼠多留了一扇门。'},
  {id:'shared-night',cycle:225,requires:['night-shift','bell'],art:'night-shift',title:'这次夜班，有人接力',text:'无人签收铃响了三下。鼠搬箱，蟹守门，标签鸟把夜色贴得很平整。没有员工，也不再空荡。'},
  {id:'planet-reply',cycle:300,requires:['return-request','last-recipient'],art:'last-recipient',title:'给星球的一封不退回的信',text:'管理员在空白地址写下“这里”。整颗退货箱星安静了一会儿，然后把退货申请折成了回信。'},
  {id:'visitor-shift',cycle:350,requires:['mouse','hermit'],art:'mouse',title:'邻居轮值：今日收件员',text:'拆封鼠和箱寄居蟹交换了门牌。门牌不合身，但每一份来访都被认真接住。'},
  {id:'paper-season',cycle:400,requires:['tagbird','tape'],art:'tagbird',title:'纸箱换季：晴天标签',text:'标签鸟摘掉旧警告，把“易碎”换成“可以轻轻拥抱”。胶带今天只负责把窗户贴牢。'},
  {id:'cosmic-receipt',cycle:450,requires:['cosmic-parcel','receipt'],art:'cosmic-parcel',title:'宇宙回执：已经收到',text:'没有人拆开宇宙包裹。它却每隔一阵就多出一张小票：谢谢你继续替我保管。'},
];
export function journalShift(cycles:number) {
  return parcelJournal.slice(0,5).filter(note=>cycles>=note.cycle).length + Math.max(0,Math.floor((cycles-300)/50));
}
export function currentJournalId(shift:number) {
  return shift<=0?null:parcelJournal[shift<=5?shift-1:5+(shift-6)%3].id;
}
