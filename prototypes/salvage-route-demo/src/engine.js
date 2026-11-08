/* Lost Cargo • independent route prototype. No connection to previous Loststar saves. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LostCargo=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='0.1.1',SCHEMA=2,KEY='lostcargo.route-demo.v1';
const BALANCE=typeof module==='object'&&module.exports?require('../../../design/star-salvage/BALANCE_V01.json'):globalThis.LostCargoBalance;
const LEG=BALANCE.voyage.baseForwardFuel;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=v=>JSON.parse(JSON.stringify(v));
function random(s){let x=s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=(x>>>0)||1;return s.rng/4294967296;}
function roll(s,a,b){return a+Math.floor(random(s)*(b-a+1));}
function log(s,text,type='info'){s.log.push({seq:s.seq,run:s.runNo,depth:s.depth,type,text});s.log=s.log.slice(-150);}
function telemetry(s,kind,detail){s.telemetry.push({seq:s.seq,run:s.runNo,depth:s.depth,kind,...detail});s.telemetry=s.telemetry.slice(-400);}
function create(seed){return {schema:SCHEMA,version:VERSION,revision:0,seq:0,rng:(seed>>>0)||315766,phase:'port',runNo:0,fuel:BALANCE.initial.fuel,hull:BALANCE.initial.hull,money:BALANCE.initial.money,debt:BALANCE.initial.debt,capacity:BALANCE.initial.cargoCapacity,cargo:[],tools:[],archive:[],depth:0,distance:0,lastLeg:0,route:[],event:null,result:null,history:[],legs:[],log:[],telemetry:[],ledger:[],run:null,summary:null,helpUsed:false,flags:{},nextUid:1};}
function used(s){return s.cargo.reduce((n,x)=>n+x.size,0);}
function homeCost(s,dist=s.distance){return dist<=0?0:3+Math.ceil(dist/2);}
function spare(s){return Math.max(0,s.fuel-homeCost(s));}
function cargoValue(s){return s.cargo.filter(x=>!x.contract).reduce((n,x)=>n+x.value,0);}
function item(name,value,size=1,ability=null){return {name,value,size,ability};}
function option(id,label,desc,effect={},extra={}){return {id,label,desc,effect,...extra};}
function station(s){const f=Math.min(25,100-s.fuel),h=Math.min(25,100-s.hull);const good=s.cargo.filter(x=>!x.contract).sort((a,b)=>b.value-a.value)[0];return {title:'航道补给浮标',kind:'station',text:'一台自动售货机牢牢固定在轨道上。屏幕写着：请一次选好，下一班顾客可能在三个月后。这里只能完成一项服务。',choices:[option('fuel','购买燃料',`补充${f}燃料 · 花费${Math.ceil(f*1.8)}零件`,{money:-Math.ceil(f*1.8),fuel:f},{blocked:!f?'燃料已满':null}),option('repair','修复船体',`恢复${h}耐久 · 花费${Math.ceil(h*1.6)}零件`,{money:-Math.ceil(h*1.6),hull:h},{blocked:!h?'船体完好':null}),option('sale','卖掉一件回收货',good?`出售「${good.name}」 · 收到${Math.floor(good.value*1.1)}零件`:'货舱里没有可出售的货物',{money:good?Math.floor(good.value*1.1):0,remove:good?.uid},{blocked:!good?'暂无可售货物':null}),option('leave','不采购，继续航行','保留现有资源',{})]};}
const EVENTS={
 tank:s=>({title:'被压住的储油罐',kind:'wreck',text:'断裂的支架下，有一只仍显示绿色的储油罐。咔哒敲了敲外壳：里面确实还有燃料，问题是怎么把它拖出来。',choices:[option('safe','租用回收装置','花30零件 · 获得28燃料',{money:-30,fuel:28},{out:'装置慢慢收紧缆绳。燃料入舱，支架在你离开后才倒下。'}),option('force','用飞船强拖','损失16耐久 · 获得28燃料和一块回收板（1格）',{hull:-16,fuel:28,loot:[item('烧蚀回收板',60+s.depth*10)]},{out:'储油罐出来了。支架的一角也在船壳上留下了签名。'}),option('leave','绕过残骸','没有损失，也没有收获',{})]}),
 plates:s=>({title:'松动的散热片',kind:'wreck',text:'一排大型散热片还挂在残骸侧面。完整回收很值钱，但你的飞船比它们年轻不了多少。',choices:[option('safe','逐片拆下来','消耗5探索燃料 · 回收1格金属',{fuel:-5,loot:[item('可用散热片',65+s.depth*24)]},{out:'咔哒留下一颗拧不动的螺丝。它认为这是礼貌。'}),option('force','拖走整个组件','损失18耐久 · 取得2格高价值组件',{hull:-18,loot:[item('整组热交换器',145+s.depth*35,2)]}),option('leave','只标记位置','不占货舱，继续航行',{})]}),
 cabin:s=>({title:'无人值守的候机厅',kind:'cabin',text:'座椅落满薄霜，行李转盘却还在旋转。广播说：最后一位旅客，请领取您的昨天。',choices:[option('drone','派咔哒检查','花22零件 · 带走1格密封物件',{money:-22,loot:[item('旧式时差盒',105+s.depth*19)]},{out:'箱内只有一只停止的时钟。你把它装上船，它慢了半秒。'}),option('scan','扫描后回收','需要扫描仪 · 无额外费用，回收1格',{loot:[item('旧式时差盒',135+s.depth*20)]},{tool:'scanner'}),option('leave','不碰转盘','保留燃料与船况',{})]}),
 luggage:s=>({title:'会呼吸的行李箱',kind:'cabin',text:'门边的行李箱缓缓起伏，标签写着“普通寝具，请勿叫醒”。没有生命信号，却传来了很轻的鼾声。',choices:[option('take','密封带走','占2格 · 可出售；它也许还有后续',{loot:[item('梦话行李箱',185+s.depth*25,2)],flag:'dream'},{out:'你给它留了一个通风孔。它说了句谢谢，然后继续打鼾。'}),option('open','现场拆开外层','消耗4探索燃料 · 得到1格修补用品',{fuel:-4,loot:[item('自封修补胶',70+s.depth*8,1,'patch')]},{out:'里面没有旅客，只有一卷能封住裂缝的旧胶带。它先向你道了歉。'}),option('leave','让它睡着','不承担运输负担',{})]}),
 dream:s=>({title:'一段陌生的梦话',kind:'anomaly',text:'货舱里的箱子开始念一组坐标。导航识别出附近的备用储油点。箱子特别强调：别告诉主人，我在梦游。',choices:[option('follow','绕过去核实','消耗5探索燃料 · 获得24燃料',{fuel:-5,bonusFuel:24},{out:'坐标是对的。回收管接上以后，箱子又安静了。'}),option('record','只记录坐标','不绕行 · 卖出导航信息，获得45零件',{money:45}),option('leave','关小广播','不打扰它的梦',{})]}),
 mirror:s=>({title:'反向反光的航标',kind:'anomaly',text:'灯光照过去，航标的影子却指向光源。它仍然属于可回收物，只是不太遵守光学。',choices:[option('scan','按扫描结果拆卸','需要扫描仪 · 获得1格航标核心',{loot:[item('反光航标核心',150+s.depth*27)]},{tool:'scanner'}),option('risk','靠近并强行回收','船体可能损失10–22耐久 · 获得1格核心',{loot:[item('反光航标核心',150+s.depth*27)]},{risk:[10,22],out:'核心被固定在货舱里。现在，它的影子终于肯待在下面了。'}),option('leave','保持距离','不冒险',{})]}),
 conduit:s=>({title:'最后一段输电管',kind:'wreck',text:'输电管已经失去用途，但里面的导体还能换钱。外壳上贴着维修日期：下次一定。',choices:[option('slow','慢慢切下导体','消耗6探索燃料 · 直接回收可交易零件',{fuel:-6,money:55+s.depth*12}),option('quick','一次拉断','损失12耐久 · 取得1格导体束',{hull:-12,loot:[item('稀金属导体束',95+s.depth*25)]}),option('leave','保存船况','继续下一站',{})]}),
 beacon:s=>({title:'自己报失的信标',kind:'anomaly',text:'信标每隔十秒发一次消息：我弄丢了自己。你已经看见它了，但还需要让它同意被找到。',choices:[option('decode','解析广播密码','需要扫描仪 · 取得1格信标',{loot:[item('已找回的信标',145+s.depth*23)]},{tool:'scanner'}),option('buy','支付失物登记费','花35零件 · 取得1格信标',{money:-35,loot:[item('已找回的信标',145+s.depth*23)]},{out:'收据打印出来了。收件人是信标，付款人却是你。'}),option('leave','回复“收到”','没有物资收益',{})]}),
 engine:s=>({title:'仍在待机的发动机',kind:'wreck',text:'一台辅助发动机悬在断口外。铭牌说它适合小型民船。咔哒看了看你们的船，补充：勉强算小型。',choices:[option('tow','用牵引绞盘固定','需要牵引绞盘 · 只占1格',{loot:[item('折叠辅助发动机',160+s.depth*30)]},{tool:'winch'}),option('force','整机拖进货舱','损失20耐久 · 占2格',{hull:-20,loot:[item('辅助发动机',170+s.depth*30,2)]}),option('parts','只拆控制器','消耗4探索燃料 · 占1格',{fuel:-4,loot:[item('发动机控制器',80+s.depth*20)]}),option('leave','放弃这台发动机','保持当前资源',{})]}),
 reserve:s=>({title:'两只应急回收箱',kind:'wreck',text:'应急箱的固定架只能打开一侧。一边是储油罐，另一边是完好的导航备件。你需要选一个。',choices:[option('fuel','带走燃料','增加24燃料 · 不占货舱',{fuel:24}),option('cargo','带走备件','取得1格高价值备件',{loot:[item('备用导航仪',120+s.depth*32)]}),option('leave','什么都不拿','为更远的发现留出空间',{})]}),
 trader:s=>({title:'路过的回收小艇',kind:'station',text:'对方说刚卖掉了最后一件货，只剩满箱燃料。它需要一点钱，也愿意收你的货物。',choices:[option('buy','向对方买油','花38零件 · 增加22燃料',{money:-38,fuel:22}),option('sell','卖给它12燃料','只使用探索余油 · 得到70零件',{fuel:-12,money:70}),option('leave','挥挥手','各走各的航线',{})]}),
 workshop:s=>({title:'轨道上的修理铺',kind:'station',text:'一只机械手从棚子里伸出来，举着价目表：修坏的船，不修坏的心情。',choices:[option('fix','请它补好船壳','花45零件 · 恢复30耐久',{money:-45,hull:30}),option('supply','买一卷备用胶','花35零件 · 1格修补用品，可在货舱使用',{money:-35,loot:[item('船用修补卷',55,1,'patch')]}),option('leave','暂时不修','不花钱',{})]}),
 archive:s=>({title:'遗留的数据匣',kind:'anomaly',text:'一排小灯按不规律的顺序闪烁。数据匣里也许是航行日志，也许只是某位旅客从未发出的消息。',choices:[option('care','保留完整数据匣','消耗5探索燃料 · 占1格',{fuel:-5,loot:[item('未寄出的航行日志',110+s.depth*26)]},{out:'最新一条消息只有四个字：快到家了。'}),option('scrap','回收存储材料','立即取得普通零件，放弃完整记录',{money:45+s.depth*13}),option('leave','不动它','留下这里原来的安静',{})]}),
 station
};
const TYPES={tank:'回收点',plates:'回收点',cabin:'失联客舱',luggage:'漂流客舱',mirror:'异常信号',conduit:'回收点',beacon:'异常信号',engine:'大型残骸',reserve:'回收点',trader:'交易信号',workshop:'维修浮标',archive:'异常信号',station:'补给浮标'};
const SIGNALS={tank:'可用储罐回波',plates:'金属组件回波',cabin:'客舱应答',luggage:'微弱起伏声纹',mirror:'逆向反射',conduit:'金属导体回波',beacon:'循环广播',engine:'重型设备回波',reserve:'双舱储物信号',trader:'民船交易频段',workshop:'修理服务频段',archive:'间歇数据脉冲',station:'标准补给信标'};
function hasDream(s){return s.cargo.some(x=>x.story==='dream');}
function forwardCost(depth,last,extra=0){return Math.max(LEG[depth],last+1)+extra;}
function riskFor(id){return ['station','trader','workshop','reserve'].includes(id)?'低':['cabin','luggage','archive','tank','plates'].includes(id)?'低—中':'中';}
function routeOptions(s){
 if(s.depth>=8)return[];let pool=Object.keys(TYPES).filter(id=>!s.history.includes(id));if(pool.length<2)pool=Object.keys(TYPES);let ids=[];
 if(s.depth===0)ids=['tank','plates'];
 else if(s.depth===1){const p=pool.filter(x=>!['station','tank','plates'].includes(x));ids=['station',p[roll(s,0,p.length-1)]];}
 else{if(s.depth===4&&!s.history.includes('reserve'))ids.push('reserve');while(ids.length<2){const id=pool[roll(s,0,pool.length-1)];if(!ids.includes(id))ids.push(id);}}
 return ids.map((id,i)=>{const extra=i===0?0:roll(s,1,3);return{id,uid:`${s.runNo}:${s.depth}:${i}`,name:TYPES[id],signal:SIGNALS[id],extra,fuel:forwardCost(s.depth,s.lastLeg,extra),risk:riskFor(id),depth:s.depth+1};});
}
function quote(s,r){const out=forwardCost(s.depth,s.lastLeg,r.extra),ret=homeCost(s,s.distance+out),arrival=s.fuel-out;return{out,returnCost:ret,arrival,free:arrival-ret,enabled:s.phase==='route'&&s.hull>0&&s.depth<8&&arrival>=ret};}
function encounter(s){if(!s.event)return null;if(s.event.id==='dream'&&!hasDream(s))return{id:'dream',nonce:s.event.nonce,title:'接收已关闭',kind:'anomaly',text:'触发物已不在货舱，这次调查没有继续。',choices:[option('leave','离开现场','没有额外损失',{})]};const ctx={...s,depth:s.depth,...s.event.context};return{...EVENTS[s.event.id](ctx),id:s.event.id,nonce:s.event.nonce};}
function checkChoice(s,c){
 if(!c)return'选项不存在';if(c.blocked)return c.blocked;const e=c.effect;
 if(s.event?.id==='dream'&&!hasDream(s)&&c.id!=='leave')return'触发物已不在货舱，可以返航或离开现场';
 if(e.remove&&!s.cargo.some(x=>x.uid===e.remove&&!x.contract))return'货物已不在货舱';
 if(c.tool&&!s.tools.includes(c.tool))return'需要'+({scanner:'扫描仪',winch:'牵引绞盘'}[c.tool]||c.tool);
 if(e.fuel>0&&s.fuel===100&&!e.loot&&!e.hull&&!(e.money>0))return'燃料已满';
 if(e.hull>0&&s.hull===100&&!e.loot&&!e.fuel&&!(e.money>0))return'船体完好';
 if(e.money<0&&s.money+e.money<0)return'零件不足';if(e.fuel<0&&spare(s)<-e.fuel)return'会动用返航储备';
 if(e.loot&&used(s)+e.loot.reduce((n,x)=>n+x.size,0)>s.capacity)return'货舱不足，可先整理货舱';return null;
}
function addItem(s,x){const next={...x,uid:s.nextUid++,acquiredRun:s.runNo};s.cargo.push(next);if(!x.contract&&!s.archive.some(y=>y.name===x.name))s.archive.push({name:x.name,value:x.value,size:x.size,firstRun:s.runNo});}
function freshAccount(money){return{opening:money,eventIncome:0,eventSpent:0,salesCurrent:0,salesCarried:0,reward:0,rescueFee:0,supplySpent:0,repairSpent:0,toolSpent:0,debtPaid:0,legacy:false};}
function cash(s,delta,kind,item){const before=s.money;s.money+=delta;if(!Number.isSafeInteger(s.money)||s.money<0)throw Error('资金无效');const a=s.run?.account;if(a){if(kind==='sale')a[item.acquiredRun===s.runNo?'salesCurrent':'salesCarried']+=delta;else a[kind]+=Math.abs(delta);}s.ledger.push({seq:s.seq,run:s.runNo,kind,delta,before,after:s.money,...(item?{uid:item.uid,sourceRun:item.acquiredRun}:{})});s.ledger=s.ledger.slice(-500);}
function apply(s,e){const changes=[];if(e.money){const sold=e.remove?s.cargo.find(x=>x.uid===e.remove):null;cash(s,e.money,sold?'sale':e.money>0?'eventIncome':'eventSpent',sold);changes.push(`零件${e.money>0?'+':''}${e.money}`);}for(const[field,label,delta]of[['fuel','燃料',e.fuel],['fuel','燃料',e.bonusFuel],['hull','耐久',e.hull]]){if(!delta)continue;const before=s[field];s[field]=clamp(before+delta,0,100);if(s[field]!==before)changes.push(`${label}${s[field]>before?'+':''}${s[field]-before}`);}
 if(e.remove){s.cargo=s.cargo.filter(x=>x.uid!==e.remove);changes.push('出售1件货物');}for(const x of e.loot||[]){addItem(s,{...x,...(e.flag==='dream'?{story:'dream'}:{})});changes.push(`装入：${x.name}`);}if(e.flag)s.flags[e.flag]=true;return changes;
}
function summaryView(s){const r=s.summary;if(!r)return null;const a=s.run.account;return{...r,...a,spent:a.eventSpent,earned:a.eventIncome+a.reward,sold:a.salesCurrent+a.salesCarried,cashDelta:s.money-a.opening,cargoValue:cargoValue(s),currentCargoValue:s.cargo.filter(x=>!x.contract&&x.acquiredRun===s.runNo).reduce((n,x)=>n+x.value,0),operatingNet:a.eventIncome+a.reward+a.salesCurrent-a.eventSpent-a.rescueFee-a.supplySpent-a.repairSpent};}
function finish(s,rescue){const price=homeCost(s);let lost=[];if(rescue){lost=s.cargo.filter(x=>x.acquiredRun===s.runNo);s.cargo=s.cargo.filter(x=>x.acquiredRun!==s.runNo);cash(s,-Math.min(BALANCE.rescue.maximumCashCharge,s.money),'rescueFee');s.fuel=Math.max(BALANCE.rescue.minimumFuelAfter,s.fuel);s.hull=Math.max(BALANCE.rescue.minimumHullAfter,s.hull);}else{s.fuel-=price;const reward=s.run.contractActive&&s.depth>=BALANCE.contract.minimumNodes&&s.cargo.some(x=>x.contract)?BALANCE.contract.reward:0;if(reward)cash(s,reward,'reward');s.cargo=s.cargo.filter(x=>!x.contract);}
 s.summary={run:s.runNo,depth:s.depth,distance:s.distance,returnFuel:rescue?0:price,rescue,lost:lost.filter(x=>!x.contract).length,lostUids:lost.map(x=>x.uid),reward:s.run.account.reward,cashDelta:s.money-s.run.account.opening};s.phase='summary';s.event=null;s.result=null;s.route=[];log(s,rescue?'拖航完成。本趟新货用于抵扣救援成本，跨趟旧货与永久设备保留。':'平安返港。返航油已扣，货物与港口操作由你决定。');telemetry(s,'return',{rescue,fuel:s.fuel,hull:s.hull,money:s.money,cargoValue:cargoValue(s)});
}
function portQuote(s,type){const field=type==='buyFuel'?'fuel':'hull',unit=type==='buyFuel'?BALANCE.port.fuelUnitPrice:BALANCE.port.repairUnitPrice;const amount=Math.max(0,Math.min(BALANCE.port.maximumServiceIncrement,100-s[field],Math.floor(s.money/unit)));return{amount,cost:amount*unit,field};}
function preparation(s){const cost=(Math.max(0,12-s.fuel)*BALANCE.port.fuelUnitPrice+Math.max(0,25-s.hull)*BALANCE.port.repairUnitPrice);return{minimumCost:cost,needsAid:s.phase==='port'&&cost>0&&s.money<cost};}
function dispatch(input,action){
 let s=clone(input);const fail=message=>({state:input,ok:false,message});if(action.expected!==undefined&&action.expected!==s.revision)return fail('这一步已处理，请按当前画面操作');s.seq++;
 switch(action.type){
 case'depart':{if(s.phase!=='port')return fail('当前不在港口');if(s.fuel<12)return fail('燃料不足，请先补给或短工');if(s.hull<25)return fail('耐久低于25，请先维修');if(used(s)>=s.capacity)return fail('请为记录箱留出1格');s.runNo++;s.depth=0;s.distance=0;s.lastLeg=0;s.history=[];s.legs=[];s.flags={};s.event=null;s.result=null;s.summary=null;s.run={startMoney:s.money,startFuel:s.fuel,startHull:s.hull,spent:0,earned:0,contractActive:true,account:freshAccount(s.money)};addItem(s,{name:'航区测绘记录箱',size:1,value:0,contract:true});s.phase='route';s.route=routeOptions(s);s.helpUsed=false;log(s,'已出发。带回至少3处航点的记录可结算测绘委托。');telemetry(s,'depart',{fuel:s.fuel,hull:s.hull,cargo:s.cargo.map(x=>({uid:x.uid,sourceRun:x.acquiredRun}))});break;}
 case'travel':{if(s.phase!=='route')return fail('请先完成当前事件');const r=s.route.find(x=>x.uid===action.id);if(!r)return fail('航点已变化');const q=quote(s,r);if(!q.enabled)return fail('无法抵达并预留返航油');s.fuel-=q.out;s.distance+=q.out;s.legs.push(q.out);s.lastLeg=q.out;s.depth++;s.history.push(r.id);const id=hasDream(s)&&!s.flags.dreamDone&&s.depth>2&&!['station','trader','workshop'].includes(r.id)?'dream':r.id;if(id==='dream')s.flags.dreamDone=true;s.event={id,nonce:`${s.runNo}/${s.depth}`,context:{fuel:s.fuel,hull:s.hull,cargo:clone(s.cargo)}};s.phase='event';s.route=[];log(s,`抵达第${s.depth}航点：${r.name}。航行耗油${q.out}，当前返航需${homeCost(s)}。`);telemetry(s,'travel',{signal:r.id,burn:q.out,returnFuel:homeCost(s),spare:spare(s)});break;}
 case'choose':{if(s.phase!=='event'||s.event.nonce!==action.nonce)return fail('此事件已经处理');const ev=encounter(s),c=ev.choices.find(x=>x.id===action.id);const err=checkChoice(s,c);if(err)return fail(err);const e=clone(c.effect);if(c.risk)e.hull=(e.hull||0)-roll(s,c.risk[0],c.risk[1]);const changes=apply(s,e);s.run.spent=s.run.account.eventSpent;s.run.earned=s.run.account.eventIncome;s.result={title:ev.title,text:c.out||(c.id==='leave'?'你记下坐标，把注意力放回前方航路。':'处理完成。咔哒检查了固定带。'),changes};s.phase='result';log(s,ev.title+' · '+c.label+(changes.length?'；'+changes.join('，'):''),'choice');telemetry(s,'choice',{event:ev.id,option:c.id,fuel:s.fuel,hull:s.hull,money:s.money,cargo:s.cargo.map(x=>x.uid)});if(s.hull===0)finish(s,true);break;}
 case'continue':if(s.phase!=='result')return fail('当前没有结果');s.phase='route';s.event=null;s.result=null;s.route=routeOptions(s);break;
 case'return':if(!['route','event','result'].includes(s.phase)||!s.depth)return fail('尚未离港航行');if(s.hull===0||s.fuel<homeCost(s))return fail('当前需要普通拖航');finish(s,false);break;
 case'abort':if(s.phase!=='route'||s.depth!==0)return fail('只能在未航行时取消');s.cargo=s.cargo.filter(x=>!x.contract);s.phase='port';s.run=null;s.route=[];log(s,'已取消出发，没有消耗燃料。');break;
 case'rescue':if(!['route','event','result'].includes(s.phase)||!s.depth)return fail('当前不需要救援');if(s.hull>0&&s.fuel>=homeCost(s))return fail('当前可以正常返航，无需拖航');finish(s,true);break;
 case'port':if(s.phase!=='summary')return fail('尚未返港');s.phase='port';break;
 case'buyFuel':case'repair':{if(s.phase!=='port')return fail('请先回港');const q=portQuote(s,action.type);if(!q.amount)return fail(s[q.field]===100?'已经补满':'零件不足');cash(s,-q.cost,action.type==='buyFuel'?'supplySpent':'repairSpent');s[q.field]+=q.amount;log(s,`${q.field==='fuel'?'补充燃料':'维修船体'}${q.amount}，实付${q.cost}零件。`);break;}
 case'sell':case'sellAll':{if(!['port','summary'].includes(s.phase))return fail('请先返港');const goods=s.cargo.filter(x=>!x.contract&&(action.type==='sellAll'||x.uid===action.id));if(!goods.length)return fail('没有可售货物');for(const x of goods)cash(s,x.value,'sale',x);s.cargo=s.cargo.filter(x=>!goods.some(g=>g.uid===x.uid));log(s,`售出${goods.length}件回收物，收到${goods.reduce((n,x)=>n+x.value,0)}零件。`);break;}
 case'discard':{if(!['route','event','result'].includes(s.phase))return fail('港口可以出售');const x=s.cargo.find(x=>x.uid===action.id);if(!x)return fail('物品已不在货舱');if(x.contract)s.run.contractActive=false;s.cargo=s.cargo.filter(x=>x.uid!==action.id);log(s,`放弃：${x.name}`,'cargo');break;}
 case'use':{const x=s.cargo.find(x=>x.uid===action.id);if(!x||x.ability!=='patch')return fail('物品不能直接使用');if(s.hull===100)return fail('船体完好');s.cargo=s.cargo.filter(x=>x.uid!==action.id);s.hull=Math.min(100,s.hull+22);log(s,'修补用品已使用，船体恢复（上限100）。');break;}
 case'repay':{if(!['port','summary'].includes(s.phase))return fail('请先返港');if(![100,500,12000].includes(action.amount))return fail('还款金额无效');const amount=Math.min(action.amount,s.debt);if(!amount)return fail('船款已还清');if(s.money-amount<BALANCE.port.minimumMoneyAfterRepayment)return fail('至少保留50零件补给');cash(s,-amount,'debtPaid');s.debt-=amount;log(s,`归还船款${amount}，剩余${s.debt}。`);if(!s.debt)log(s,'船款已结清。失物号属于你。','milestone');break;}
 case'tool':{if(s.phase!=='port')return fail('只能在港口改装');const p=BALANCE.tools[action.id];if(!Number.isFinite(p)||s.tools.includes(action.id))return fail('设备已安装或不存在');if(s.money<p)return fail('零件不足');cash(s,-p,'toolSpent');s.tools.push(action.id);log(s,`设备安装完成，实付${p}零件。`);break;}
 case'feedback':{if(s.phase!=='summary'||!['steady','tense','unclear','skip'].includes(action.answer))return fail('无效反馈');s.telemetry=s.telemetry.filter(x=>!(x.kind==='feedback'&&x.run===s.runNo));telemetry(s,'feedback',{answer:action.answer});break;}
 case'aid':if(!preparation(s).needsAid)return fail('现有资源足以准备出航');s.fuel=Math.max(20,s.fuel);s.hull=Math.max(40,s.hull);s.helpUsed=true;log(s,'码头短工换取基本油料与船体修整，不支付现金。');break;
 default:return fail('未知操作');
 }
 s.revision++;if(s.summary)s.summary={...s.summary,cashDelta:s.money-s.run.account.opening};assertState(s);return{state:s,ok:true,message:''};
}
const phases=['port','route','event','result','summary'];
function integer(n,low=0,high=1e9){return Number.isSafeInteger(n)&&n>=low&&n<=high;}
function text(v,max=300){return typeof v==='string'&&v.length<=max;}
function validateCargo(xs,runNo){if(!Array.isArray(xs)||xs.length>8)throw Error('货舱字段无效');for(const x of xs){if(!x||!integer(x.uid,1)||!integer(x.size,1,4)||!integer(x.value)||!text(x.name,100)||!integer(x.acquiredRun,0,runNo)||x.ability!=null&&x.ability!=='patch'||x.story!=null&&x.story!=='dream'||x.contract!=null&&typeof x.contract!=='boolean')throw Error('物品字段无效');}if(new Set(xs.map(x=>x.uid)).size!==xs.length)throw Error('重复货物');}
function assertState(s){
 if(!s||!text(s.version,40)||typeof s.helpUsed!=='boolean'||s.schema!==SCHEMA||!phases.includes(s.phase))throw Error('存档版本或阶段无效');for(const k of ['fuel','hull','money','debt','capacity','depth','distance','revision','seq','nextUid','runNo','lastLeg'])if(!integer(s[k]))throw Error('数值无效：'+k);
 if(!integer(s.rng,1,4294967295)||s.fuel>100||s.hull>100||s.debt>12000||s.capacity!==4||s.depth>8||s.distance>300||s.lastLeg>40)throw Error('资源或距离越界');
 validateCargo(s.cargo,s.runNo);const contracts=s.cargo.filter(x=>x.contract);if(contracts.length>1||contracts.some(x=>x.name!=='航区测绘记录箱'||x.size!==1||x.value!==0||x.acquiredRun!==s.runNo)||['port','summary'].includes(s.phase)&&contracts.length)throw Error('记录箱与航次不一致');if(used(s)>s.capacity||s.cargo.some(x=>x.uid>=s.nextUid))throw Error('货舱不一致');
 for(const k of ['route','history','legs','log','telemetry','archive','tools','ledger'])if(!Array.isArray(s[k])||s[k].length>500)throw Error('数组无效：'+k);
 if(s.tools.some(x=>!['scanner','winch'].includes(x))||new Set(s.tools).size!==s.tools.length)throw Error('设备无效');
 if(!s.flags||Object.keys(s.flags).some(k=>!['dream','dreamDone'].includes(k)||typeof s.flags[k]!=='boolean'))throw Error('标记无效');
 if(s.legs.length!==s.depth||s.legs.reduce((n,x)=>n+x,0)!==s.distance||(s.legs.at(-1)||0)!==s.lastLeg||s.legs.some((x,i)=>!integer(x,LEG[i],40)||x<Math.max(LEG[i],(s.legs[i-1]||0)+1)||x>Math.max(LEG[i],(s.legs[i-1]||0)+1)+3))throw Error('航行距离与逐跳费用不一致');
 if(s.history.length!==s.depth||s.history.some(x=>!Object.hasOwn(TYPES,x)))throw Error('航路历史无效');
 for(const x of s.archive)if(!text(x.name,100)||!integer(x.size,1,4)||!integer(x.value)||!integer(x.firstRun,0,s.runNo))throw Error('见闻无效');
 for(const x of s.log)if(!integer(x.seq)||!integer(x.run,0,s.runNo)||!integer(x.depth,0,8)||!text(x.text,1000)||!text(x.type,30))throw Error('航记无效');
 for(const x of s.telemetry)if(!x||typeof x!=='object'||!text(x.kind,40)||JSON.stringify(x).length>3000)throw Error('行为记录无效');
 for(const x of s.ledger)if(!integer(x.seq)||!integer(x.run)||!text(x.kind,30)||!Number.isSafeInteger(x.delta)||!integer(x.before)||!integer(x.after)||x.after-x.before!==x.delta)throw Error('流水无效');
 if(s.phase==='route'){if(s.route.length!==(s.depth===8?0:2))throw Error('候选数量无效');for(const[i,r]of s.route.entries())if(!Object.hasOwn(TYPES,r.id)||r.uid!==`${s.runNo}:${s.depth}:${i}`||!integer(r.extra,i===0?0:1,i===0?0:3)||r.fuel!==forwardCost(s.depth,s.lastLeg,r.extra)||r.name!==TYPES[r.id]||r.signal!==SIGNALS[r.id]||r.depth!==s.depth+1||r.risk!==riskFor(r.id))throw Error('航点费用/身份无效');}else if(s.route.length)throw Error('阶段与航路不一致');
 if(['route','event','result','summary'].includes(s.phase)&&!s.run)throw Error('航次缺失');
 if(s.run){for(const k of ['startMoney','startFuel','startHull','spent','earned'])if(!integer(s.run[k]))throw Error('航次字段无效');const a=s.run.account;if(!a||Object.keys(freshAccount(0)).some(k=>k==='legacy'?typeof a[k]!=='boolean':!integer(a[k])))throw Error('收支明细无效');const expected=a.opening+a.eventIncome+a.salesCurrent+a.salesCarried+a.reward-a.eventSpent-a.rescueFee-a.supplySpent-a.repairSpent-a.toolSpent-a.debtPaid;if(expected!==s.money)throw Error('现金与流水不一致');if(typeof s.run.contractActive!=='boolean')throw Error('委托无效');}
 if(s.event){if(!Object.hasOwn(EVENTS,s.event.id)||s.event.nonce!==`${s.runNo}/${s.depth}`||!s.event.context||!integer(s.event.context.fuel,0,100)||!integer(s.event.context.hull,0,100))throw Error('事件来源无效');validateCargo(s.event.context.cargo,s.runNo);}
 if(s.phase==='event'&&!s.event)throw Error('事件缺失');if(s.phase==='result'&&(!s.result||!text(s.result.text,2000)||!text(s.result.title,100)||!Array.isArray(s.result.changes)||s.result.changes.some(x=>!text(x,200))))throw Error('结果无效');
 if(s.phase==='summary'&&(!s.summary||!integer(s.summary.run,1,s.runNo)||typeof s.summary.rescue!=='boolean'||!integer(s.summary.depth,0,8)||!integer(s.summary.returnFuel,0,200)||!integer(s.summary.reward)||!Number.isSafeInteger(s.summary.cashDelta)))throw Error('返港明细无效');return true;
}
function inferLegs(depth,distance,last){function visit(a,sum){if(a.length===depth)return sum===distance&&(a.at(-1)||0)===last?a:null;for(let e=0;e<=3;e++){const v=forwardCost(a.length,a.at(-1)||0,e);if(sum+v<=distance){const found=visit([...a,v],sum+v);if(found)return found;}}return null;}const found=visit([],0);if(!found)throw Error('旧航路费用无法核对');return found;}
function restore(raw){
 if(typeof raw==='string'&&raw.length>2000000)throw Error('存档过大');const s=typeof raw==='string'?JSON.parse(raw):clone(raw);if(!s||![1,SCHEMA].includes(s.schema))throw Error('版本不支持');
 if(s.schema===1){s.schema=SCHEMA;s.version=VERSION;s.ledger=[];s.legs=inferLegs(s.depth,s.distance,s.lastLeg);s.flags=s.flags||{};for(const x of s.cargo||[]){const seen=s.archive?.find(y=>y.name===x.name);x.acquiredRun=x.contract?s.runNo:seen?.firstRun<s.runNo?seen.firstRun:0;if(x.name==='梦话行李箱')x.story='dream';}for(const r of s.route||[])r.extra=r.fuel-Math.max(LEG[s.depth],s.lastLeg+1);if(s.run){s.run.account=freshAccount(s.money);s.run.account.legacy=true;}if(s.event){if(!Object.hasOwn(EVENTS,s.event.id))throw Error('旧事件不支持');s.event={id:s.event.id,nonce:`${s.runNo}/${s.depth}`,context:{fuel:s.fuel,hull:s.hull,cargo:clone(s.cargo)}};}s.migration='v01-preserved-balance; unknown cargo origin protected; historical cash detail unavailable';}
 // Keep only known structural fields. Event effects and hidden outcome text never come from imports.
 if(s.event){if(s.schema===SCHEMA&&(Object.keys(s.event).some(k=>!['id','nonce','context'].includes(k))||Object.keys(s.event.context||{}).some(k=>!['fuel','hull','cargo'].includes(k))))throw Error('事件包含非模型字段');const e=s.event;s.event={id:e.id,nonce:e.nonce,context:{fuel:e.context?.fuel,hull:e.context?.hull,cargo:e.context?.cargo}};}
 const keys=Object.keys(create(1)),out={};for(const k of keys)out[k]=s[k];if(s.migration)out.migration=s.migration;assertState(out);return out;
}
return {VERSION,SCHEMA,KEY,LEG,BALANCE,create,dispatch,restore,assertState,homeCost,spare,used,cargoValue,quote,checkChoice,encounter,summaryView,portQuote,preparation};

});
