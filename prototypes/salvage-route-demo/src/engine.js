/* Lost Cargo • independent route prototype. No connection to previous Loststar saves. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LostCargo=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='0.5.1',SCHEMA=8,KEY='lostcargo.route-demo.v1';
const Cargo=typeof module==='object'&&module.exports?require('./cargo-layout.js'):globalThis.LostCargoLayout;
const BALANCE=typeof module==='object'&&module.exports?require('../../../design/star-salvage/BALANCE_V01.json'):globalThis.LostCargoBalance;
const PORT=typeof module==='object'&&module.exports?require('../../../design/star-salvage/v041/BALANCE_V041.json'):globalThis.LostCargoPortBalance;
const Holds=typeof module==='object'&&module.exports?require('./ship-holds.js'):globalThis.LostCargoHolds;
const NewEncounters=typeof module==='object'&&module.exports?require('./encounters-v05.js'):globalThis.SalvageEncounters;
const Market=typeof module==='object'&&module.exports?require('./market-v05.js'):globalThis.SalvageMarket;
const V05=typeof module==='object'&&module.exports?require('../../../design/star-salvage/v05/BALANCE_V05.json'):globalThis.LostCargoV05Balance;
const V051=typeof module==='object'&&module.exports?require('../../../design/star-salvage/v051/BALANCE_V051.json'):globalThis.LostCargoV051Balance;
const ITEM_IDS=['metal_crate','energy_battery','nav_chip','broken_engine','medkit','fuel_can','sample','toolbox',...Object.keys(NewEncounters.curios)];
const LEGACY_ITEM_IDS={
'熔边螺母':'toolbox','散落接头':'broken_engine','烧蚀回收板':'metal_crate','固定卡扣':'toolbox','薄片垫圈':'metal_crate','可用散热片':'metal_crate','整组热交换器':'broken_engine','旧式时差盒':'energy_battery','梦话行李箱':'metal_crate','自封修补胶':'toolbox','反光航标核心':'sample','稀金属导体束':'energy_battery','绝缘端帽':'toolbox','已找回的信标':'nav_chip','折叠辅助发动机':'broken_engine','辅助发动机':'broken_engine','发动机控制器':'nav_chip','备用导航仪':'nav_chip','船用修补卷':'toolbox','未寄出的航行日志':'sample'};
const LEG=BALANCE.voyage.baseForwardFuel;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=v=>JSON.parse(JSON.stringify(v));
function random(s){let x=s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=(x>>>0)||1;return s.rng/4294967296;}
function roll(s,a,b){return a+Math.floor(random(s)*(b-a+1));}
function log(s,text,type='info'){s.log.push({seq:s.seq,run:s.runNo,depth:s.depth,type,text});s.log=s.log.slice(-150);}
function telemetry(s,kind,detail){s.telemetry.push({seq:s.seq,run:s.runNo,depth:s.depth,kind,...detail});s.telemetry=s.telemetry.slice(-400);}
function freshProgress(){return{eligibleVoyages:0,newOptionShown:false,eggSeen:false,dryReturns:0};}
function freshDiscovery(){return{eligible:false,newCandidateShown:false,arrivedNew:false,eligibleRolls:0};}
function create(seed){return {progress:freshProgress(),hold:{mode:'bc',topologyVersion:Holds.version},discoveries:{encounters:[],eggs:[],mementoClaimed:false},market:Market.create(seed),schema:SCHEMA,version:VERSION,revision:0,seq:0,rng:(seed>>>0)||315766,phase:'port',runNo:0,fuel:BALANCE.initial.fuel,hull:BALANCE.initial.hull,money:BALANCE.initial.money,debt:BALANCE.initial.debt,capacity:BALANCE.initial.cargoCapacity,cargo:[],missionSlot:null,fleet:{ownedShipIds:['starter'],equippedShipId:'starter',cargoLevels:{starter:0},fuelLevels:{starter:0},hullLevels:{starter:0},parked:{}},missions:[],activeMissionId:null,nextMissionUid:1,voyageShip:null,cargoGrid:{width:4,height:4,placements:[]},tools:[],archive:[],depth:0,distance:0,lastLeg:0,route:[],event:null,result:null,history:[],legs:[],log:[],telemetry:[],ledger:[],run:null,summary:null,helpUsed:false,flags:{},nextUid:1};}
function shipStats(s,shipId=s.fleet.equippedShipId){const spec=PORT.ships[shipId],f=s.fleet,cargoLevel=f.cargoLevels[shipId]||0,fuelLevel=f.fuelLevels[shipId]||0,hullLevel=f.hullLevels[shipId]||0;return{...spec,id:shipId,cargoLevel,fuelLevel,hullLevel,height:spec.height+cargoLevel,maxFuel:spec.fuelBase+fuelLevel*spec.fuelStep,maxHull:spec.hullBase+hullLevel*spec.hullStep};}
function resourceCaps(s){const v=['route','event','result'].includes(s.phase)?s.voyageShip:null,st=shipStats(s);return{fuel:v?.maxFuel??st.maxFuel,hull:v?.maxHull??st.maxHull};}
function resourceLimit(s,field){return resourceCaps(s)[field];}
function shipResources(s,id=s.fleet.equippedShipId){return id===s.fleet.equippedShipId?{fuel:s.fuel,hull:s.hull}:clone(s.fleet.parked[id]);}
function shipUpgradeQuote(s,kind){if(!['fuel','hull'].includes(kind))return{cost:null,enabled:false};const st=shipStats(s),level=st[kind+'Level'],cost=st[kind+'UpgradeCosts'][level],from=st[kind==='fuel'?'maxFuel':'maxHull'];return{shipId:st.id,kind,level,levels:st[kind+'UpgradeCosts'].length,from,to:from+(cost===undefined?0:st[kind+'Step']),max:st[kind+'Base']+st[kind+'UpgradeCosts'].length*st[kind+'Step'],cost:cost??null,enabled:s.phase==='port'&&cost!==undefined&&s.money>=cost};}
function shipComparison(s,id){const spec=PORT.ships[id],base=PORT.ships.starter;return{firstFuel:forwardCost(0,0,0,spec.fuelPercent),starterFirstFuel:forwardCost(0,0,0,base.fuelPercent),collision:Math.ceil(16*spec.damagePercent/100),starterCollision:16};}
function cargoSpace(s) {
 const ship = shipStats(s);
 if (s.hold.mode === 'legacy') return { width: ship.width, height: ship.height, capacity: ship.width * ship.height, label: '原装货舱 · 返港安全整理', legacy: true };
 return Holds.space(ship.id, ship.cargoLevel);
}
function capacityCells(s) { return cargoSpace(s).capacity; }
function tryHoldTransition(s) {
 if (s.hold.mode !== 'legacy' || !['port', 'summary'].includes(s.phase)) return false;
 const ship = shipStats(s);
 const space = Holds.space(ship.id, ship.cargoLevel);
 const packed = Cargo.solve(s.cargo, s.cargoGrid.placements, space);
 if (!packed) return false;
 s.hold.mode = 'bc';
 s.cargoGrid = { width: space.width, height: space.height, placements: packed };
 return true;
}
function activeMission(s){return s.missions.find(x=>x.uid===s.activeMissionId)||null;}
function missionProgress(s,m=activeMission(s)){if(!m)return null;const spec=PORT.missions[m.type],newItems=s.cargo.filter(x=>x.acquiredRun===s.runNo).length;return{nodes:Math.min(s.depth,spec.minimumNodes),neededNodes:spec.minimumNodes,items:Math.min(newItems,spec.minimumItems),neededItems:spec.minimumItems};}
function cargoUpgradeQuote(s,id=s.fleet.equippedShipId){const spec=shipStats(s,id),cost=spec.cargoUpgradeCosts[spec.cargoLevel];return{shipId:id,cost:cost??null,level:spec.cargoLevel,width:spec.width,height:spec.height,nextHeight:cost===undefined?spec.height:spec.height+1,capacity:spec.width*spec.height,nextCapacity:cost===undefined?spec.width*spec.height:spec.width*(spec.height+1),enabled:cost!==undefined&&s.money>=cost&&s.phase==='port'};}
function supplyQuote(s,type,full=false){const base=portQuote(s,type),amount=full?resourceLimit(s,base.field)-s[base.field]:base.amount,cost=amount*(type==='buyFuel'?BALANCE.port.fuelUnitPrice:BALANCE.port.repairUnitPrice);return{...base,amount,cost,full,from:s[base.field],target:s[base.field]+amount,enabled:amount>0&&s.money>=cost&&s.phase==='port'};}
function finishMission(s,rescue){const m=activeMission(s);if(!m||m.status!=='active')return;const spec=PORT.missions[m.type];const eligible=!rescue&&s.depth>=spec.minimumNodes&&s.cargo.filter(x=>x.acquiredRun===s.runNo).length>=spec.minimumItems&&(!spec.recordBox||!!s.missionSlot);if(eligible){m.status='complete';m.completedRun=s.runNo;if(m.legacyAutoSettlement){cash(s,spec.reward,'reward');s.ledger.at(-1).missionId=m.uid;m.status='claimed';m.claimedRun=s.runNo;s.activeMissionId=null;}}else if(rescue){m.status='abandoned';s.activeMissionId=null;}else{m.status='accepted';m.targetRun=s.runNo+1;}}
function used(s){return s.cargo.reduce((n,x)=>n+x.cells,0);}
function homeCost(s,dist=s.distance){return dist<=0?0:3+Math.ceil(dist/2);}
function returnQuotes(s, depth=s.depth, distance=s.distance) {
 const quotes=[{method:'normal',cost:homeCost(s,distance)}];
 if(distance>0 && s.run?.returnRules?.version==='v051' && V051.gate.depths.includes(depth)) {
  quotes.push({method:'gate',cost:s.run.returnRules.gateFuel});
 }
 return quotes;
}
function returnHint(s) {
 if(s.run?.returnRules?.version!=='v051') return '本趟沿用旧航道，下趟启用折返信标。';
 if(V051.gate.depths.includes(s.depth)) return '本站折返信标已就绪，可选择固定'+s.run.returnRules.gateFuel+'燃料返港。';
 const next=V051.gate.depths.find(depth=>depth>s.depth);
 return next?'第'+next+'站附近有折返信标，抵达后可用。当前仍按原航道预留。':'本段按已走距离预留返港油，加油不缩短距离。';
}
function safeReturnReserve(s, depth=s.depth, distance=s.distance) {
 return Math.min(...returnQuotes(s,depth,distance).map(quote=>quote.cost));
}
function spare(s){return Math.max(0,s.fuel-safeReturnReserve(s));}
function cargoValue(s){return s.cargo.filter(x=>!x.contract).reduce((n,x)=>n+x.value,0);}
function item(name,value,cells=2,ability=null,shapeId={1:'point1',2:'line2',3:'ell3',4:'square4',5:'ell5',6:'rect6',7:'ell7',8:'rect8'}[cells]){return {name,value,cells,ability,shapeId,shapeVersion:1,itemId:LEGACY_ITEM_IDS[name]||'metal_crate'};}
function option(id,label,desc,effect={},extra={}){return {id,label,desc,effect,...extra};}
function station(s){const f=Math.min(25,resourceLimit(s,'fuel')-s.fuel),h=Math.min(25,resourceLimit(s,'hull')-s.hull);const good=s.cargo.filter(x=>!x.contract).sort((a,b)=>b.value-a.value)[0];return {title:'航道补给浮标',kind:'station',text:'一台自动售货机牢牢固定在轨道上。屏幕写着：请一次选好，下一班顾客可能在三个月后。这里只能完成一项服务。',choices:[option('fuel','购买燃料',`补充${f}燃料 · 花费${Math.ceil(f*1.8)}零件`,{money:-Math.ceil(f*1.8),fuel:f},{blocked:!f?'燃料已满':null}),option('repair','修复船体',`恢复${h}耐久 · 花费${Math.ceil(h*1.6)}零件`,{money:-Math.ceil(h*1.6),hull:h},{blocked:!h?'船体完好':null}),option('sale','卖掉一件回收货',good?`出售「${good.name}」 · 收到${Math.floor(good.value*1.1)}零件`:'货舱里没有可出售的货物',{money:good?Math.floor(good.value*1.1):0,remove:good?.uid},{blocked:!good?'暂无可售货物':null}),option('leave','不采购，继续航行','保留现有资源',{})]};}
const EVENTS={
 tank:s=>({title:'被压住的储油罐',kind:'wreck',text:'断裂的支架下，有一只仍显示绿色的储油罐。咔哒敲了敲外壳：里面确实还有燃料，问题是怎么把它拖出来。',choices:[option('safe','租用回收装置','花30零件 · 获得28燃料',{money:-30,fuel:28},{out:'装置慢慢收紧缆绳。燃料入舱，支架在你离开后才倒下。'}),option('force','用飞船强拖','损失16耐久 · 获得28燃料和3件回收物（1＋2＋3格）',{hull:-16,fuel:28,loot:[item('熔边螺母',18,1),item('散落接头',22,2),item('烧蚀回收板',20+s.depth*10,3,null,'ell3')]},{out:'储油罐出来了。支架的一角也在船壳上留下了签名。'}),option('leave','绕过残骸','没有损失，也没有收获',{})]}),
 plates:s=>({title:'松动的散热片',kind:'wreck',text:'一排大型散热片还挂在残骸侧面。完整回收很值钱，但你的飞船比它们年轻不了多少。',choices:[option('safe','逐片拆下来','消耗5探索燃料 · 回收3件金属（1＋1＋2格）',{fuel:-5,loot:[item('固定卡扣',16,1),item('薄片垫圈',20,1),item('可用散热片',29+s.depth*24,2)]},{out:'咔哒留下一颗拧不动的螺丝。它认为这是礼貌。'}),option('force','拖走整个组件','损失18耐久 · 取得8小格高价值组件',{hull:-18,loot:[item('整组热交换器',145+s.depth*35,8)]}),option('leave','只标记位置','不占货舱，继续航行',{})]}),
 cabin:s=>({title:'无人值守的候机厅',kind:'cabin',text:'座椅落满薄霜，行李转盘却还在旋转。广播说：最后一位旅客，请领取您的昨天。',choices:[option('drone','派咔哒检查','花22零件 · 带走2格密封物件',{money:-22,loot:[item('旧式时差盒',105+s.depth*19,2)]},{out:'箱内只有一只停止的时钟。你把它装上船，它慢了半秒。'}),option('scan','扫描后回收','需要扫描仪 · 无额外费用，回收3格',{loot:[item('旧式时差盒',135+s.depth*20,3)]},{tool:'scanner'}),option('leave','不碰转盘','保留燃料与船况',{})]}),
 luggage:s=>({title:'会呼吸的行李箱',kind:'cabin',text:'门边的行李箱缓缓起伏，标签写着“普通寝具，请勿叫醒”。没有生命信号，却传来了很轻的鼾声。',choices:[option('take','密封带走','占6格 · 可出售；它也许还有后续',{loot:[item('梦话行李箱',185+s.depth*25,6)],flag:'dream'},{out:'你给它留了一个通风孔。它说了句谢谢，然后继续打鼾。'}),option('open','现场拆开外层','消耗4探索燃料 · 得到1格修补用品',{fuel:-4,loot:[item('自封修补胶',70+s.depth*8,1,'patch')]},{out:'里面没有旅客，只有一卷能封住裂缝的旧胶带。它先向你道了歉。'}),option('leave','让它睡着','不承担运输负担',{})]}),
 dream:s=>({title:'一段陌生的梦话',kind:'anomaly',text:'货舱里的箱子开始念一组坐标。导航识别出附近的备用储油点。箱子特别强调：别告诉主人，我在梦游。',choices:[option('follow','绕过去核实','消耗5探索燃料 · 获得24燃料',{fuel:-5,bonusFuel:24},{out:'坐标是对的。回收管接上以后，箱子又安静了。'}),option('record','只记录坐标','不绕行 · 卖出导航信息，获得45零件',{money:45}),option('leave','关小广播','不打扰它的梦',{})]}),
 mirror:s=>({title:'反向反光的航标',kind:'anomaly',text:'灯光照过去，航标的影子却指向光源。它仍然属于可回收物，只是不太遵守光学。',choices:[option('scan','按扫描结果拆卸','需要扫描仪 · 获得3格航标核心',{loot:[item('反光航标核心',150+s.depth*27,3,null,'ell3')]},{tool:'scanner'}),option('risk','靠近并强行回收','船体可能损失10–22耐久 · 获得3格核心',{loot:[item('反光航标核心',150+s.depth*27,3,null,'ell3')]},{risk:[10,22],out:'核心被固定在货舱里。现在，它的影子终于肯待在下面了。'}),option('leave','保持距离','不冒险',{})]}),
 conduit:s=>({title:'最后一段输电管',kind:'wreck',text:'输电管已经失去用途，但里面的导体还能换钱。外壳上贴着维修日期：下次一定。',choices:[option('slow','慢慢切下导体','消耗6探索燃料 · 直接回收可交易零件',{fuel:-6,money:55+s.depth*12}),option('quick','一次拉断','损失12耐久 · 取得导体束与端帽（3＋1格）',{hull:-12,loot:[item('稀金属导体束',65+s.depth*25,3,null,'line3'),item('绝缘端帽',30,1)]}),option('leave','保存船况','继续下一站',{})]}),
 beacon:s=>({title:'自己报失的信标',kind:'anomaly',text:'信标每隔十秒发一次消息：我弄丢了自己。你已经看见它了，但还需要让它同意被找到。',choices:[option('decode','解析广播密码','需要扫描仪 · 取得2格信标',{loot:[item('已找回的信标',145+s.depth*23,2)]},{tool:'scanner'}),option('buy','支付失物登记费','花35零件 · 取得2格信标',{money:-35,loot:[item('已找回的信标',145+s.depth*23,2)]},{out:'收据打印出来了。收件人是信标，付款人却是你。'}),option('leave','回复“收到”','没有物资收益',{})]}),
 engine:s=>({title:'仍在待机的发动机',kind:'wreck',text:'一台辅助发动机悬在断口外。铭牌说它适合小型民船。咔哒看了看你们的船，补充：勉强算小型。',choices:[option('tow','用牵引绞盘固定','需要牵引绞盘 · 只占4小格',{loot:[item('折叠辅助发动机',160+s.depth*30,4,null,'tee4')]},{tool:'winch'}),option('force','整机拖进货舱','损失20耐久 · 占8小格',{hull:-20,loot:[item('辅助发动机',170+s.depth*30,8)]}),option('parts','只拆控制器','消耗4探索燃料 · 占2格',{fuel:-4,loot:[item('发动机控制器',80+s.depth*20,2)]}),option('leave','放弃这台发动机','保持当前资源',{})]}),
 reserve:s=>({title:'两只应急回收箱',kind:'wreck',text:'应急箱的固定架只能打开一侧。一边是储油罐，另一边是完好的导航备件。你需要选一个。',choices:[option('fuel','带走燃料','增加24燃料 · 不占货舱',{fuel:24}),option('cargo','带走备件','取得5格高价值备件',{loot:[item('备用导航仪',120+s.depth*32,5,null,'ell5')]}),option('leave','什么都不拿','为更远的发现留出空间',{})]}),
 trader:s=>({title:'路过的回收小艇',kind:'station',text:'对方说刚卖掉了最后一件货，只剩满箱燃料。它需要一点钱，也愿意收你的货物。',choices:[option('buy','向对方买油','花38零件 · 增加22燃料',{money:-38,fuel:22}),option('sell','卖给它12燃料','只使用探索余油 · 得到70零件',{fuel:-12,money:70}),option('leave','挥挥手','各走各的航线',{})]}),
 workshop:s=>({title:'轨道上的修理铺',kind:'station',text:'一只机械手从棚子里伸出来，举着价目表：修坏的船，不修坏的心情。',choices:[option('fix','请它补好船壳','花45零件 · 恢复30耐久',{money:-45,hull:30}),option('supply','买一卷备用胶','花35零件 · 1格修补用品，可在货舱使用',{money:-35,loot:[item('船用修补卷',55,1,'patch')]}),option('leave','暂时不修','不花钱',{})]}),
 archive:s=>({title:'遗留的数据匣',kind:'anomaly',text:'一排小灯按不规律的顺序闪烁。数据匣里也许是航行日志，也许只是某位旅客从未发出的消息。',choices:[option('care','保留完整数据匣','消耗5探索燃料 · 占3格',{fuel:-5,loot:[item('未寄出的航行日志',110+s.depth*26,3,null,'line3')]},{out:'最新一条消息只有四个字：快到家了。'}),option('scrap','回收存储材料','立即取得普通零件，放弃完整记录',{money:45+s.depth*13}),option('leave','不动它','留下这里原来的安静',{})]}),
 station
};
Object.assign(EVENTS, NewEncounters.factories({item, option, resourceLimit, depthValuePerCell:V05.encounters.deepValuePerCellPerDepth}));
const TYPES={tank:'回收点',plates:'回收点',cabin:'失联客舱',luggage:'漂流客舱',mirror:'异常信号',conduit:'回收点',beacon:'异常信号',engine:'大型残骸',reserve:'回收点',trader:'交易信号',workshop:'维修浮标',archive:'异常信号',station:'补给浮标'};
const SIGNALS={tank:'可用储罐回波',plates:'金属组件回波',cabin:'客舱应答',luggage:'微弱起伏声纹',mirror:'逆向反射',conduit:'金属导体回波',beacon:'循环广播',engine:'重型设备回波',reserve:'双舱储物信号',trader:'民船交易频段',workshop:'修理服务频段',archive:'间歇数据脉冲',station:'标准补给信标'};
const LEGACY_ROUTE_IDS = Object.keys(TYPES);
Object.assign(TYPES, Object.fromEntries(Object.entries(NewEncounters.metadata).map(([id, data]) => [id, data[0]])));
Object.assign(SIGNALS, Object.fromEntries(Object.entries(NewEncounters.metadata).map(([id, data]) => [id, data[1]])));
function hasDream(s){return s.cargo.some(x=>x.story==='dream');}
function forwardCost(depth,last,extra=0,percent=100){return Math.max(Math.ceil(LEG[depth]*percent/100),last+1)+extra;}
function riskFor(id){if(NewEncounters.metadata[id])return NewEncounters.metadata[id][2];return ['station','trader','workshop','reserve'].includes(id)?'低':['cabin','luggage','archive','tank','plates'].includes(id)?'低—中':'中';}
function legacyRouteOptions(s){
 if(s.depth>=8)return[];let pool=LEGACY_ROUTE_IDS.filter(id=>!s.history.includes(id));if(pool.length<2)pool=LEGACY_ROUTE_IDS;let ids=[];
 if(s.depth===0)ids=['tank','plates'];
 else if(s.depth===1){const p=pool.filter(x=>!['station','tank','plates'].includes(x));ids=['station',p[roll(s,0,p.length-1)]];}
 else{if(s.depth===4&&!s.history.includes('reserve'))ids.push('reserve');while(ids.length<2){const id=pool[roll(s,0,pool.length-1)];if(!ids.includes(id))ids.push(id);}}
 return ids.map((id,i)=>{const extra=i===0?0:roll(s,1,3);return{id,uid:`${s.runNo}:${s.depth}:${i}`,name:TYPES[id],signal:SIGNALS[id],extra,fuel:forwardCost(s.depth,s.lastLeg,extra,s.voyageShip?.fuelPercent||100),risk:riskFor(id),depth:s.depth+1};});
}
function routeOptions(s) {
 if (s.run?.contentPoolVersion === 'v042' || s.runNo === 1 && s.depth === 0) return legacyRouteOptions(s);
 if (s.depth >= 8) return [];
 const depth = s.depth + 1;
 let pool = Object.keys(TYPES).filter(id => {
  if (s.history.includes(id)) return false;
  const data = NewEncounters.metadata[id];
  return !data || depth >= data[3] && depth <= data[4];
 });
 if (s.depth === 0) pool = pool.filter(id => V05.encounters.earlyRouteIds.includes(id));
 const ids = [];
 while (ids.length < 2) {
  const available = pool.filter(id => !ids.includes(id));
  const weight = id => NewEncounters.metadata[id]?.[5] ? V05.encounters.rareWeight : V05.encounters.commonWeight;
  let target = roll(s, 1, available.reduce((sum, id) => sum + weight(id), 0));
  const selected = available.find(id => (target -= weight(id)) <= 0);
  ids.push(selected);
 }
 if(s.run.returnRules.version==='v051' && s.depth===1 && !s.progress.newOptionShown) {
  const unseen=id=>NewEncounters.metadata[id] && !s.discoveries.encounters.some(seen=>seen.id===id);
  if(!ids.some(unseen)) {
   const safe=pool.filter(id=>unseen(id) && ['comet_label','ring_sampler','silent_fuel','drifting_cup','lost_probe','backwards_clock'].includes(id));
   if(safe.length) ids[0]=safe[roll(s,0,safe.length-1)];
  }
 }
 const routes=ids.map((id, index) => {
  const extra = index === 0 ? 0 : roll(s, 1, 3);
  return { id, uid: `${s.runNo}:${s.depth}:${index}`, name: TYPES[id], signal: SIGNALS[id], extra,
   fuel: forwardCost(s.depth, s.lastLeg, extra, s.voyageShip?.fuelPercent || 100), risk: riskFor(id), depth };
 });
 if(s.run.returnRules.version==='v051' && routes.some(route=>NewEncounters.metadata[route.id] && !s.discoveries.encounters.some(seen=>seen.id===route.id) && quote(s,route).enabled)) {
  s.progress.newOptionShown=true;
  s.run.discovery.newCandidateShown=true;
 }
 return routes;
}
function discoverArrival(s) {
 if(s.run.contentPoolVersion!=='v05') return;
 const current=s.run.returnRules.version==='v051';
 const first=!s.discoveries.encounters.some(seen=>seen.id===s.event.id);
 if(first) s.discoveries.encounters.push({id:s.event.id,title:TYPES[s.event.id]||'陌生的梦话',run:s.runNo,depth:s.depth});
 if(current) {
  if(NewEncounters.metadata[s.event.id]) s.run.discovery.arrivedNew=true;
  if(s.depth>=2 && !s.run.discovery.eligible) {
   s.run.discovery.eligible=true;
   s.progress.eligibleVoyages++;
  }
 }
 if(s.run.eggId) return;
 let candidates=NewEncounters.eggCandidates(s);
 const guarantee=current && s.depth>=2 &&
  (!s.progress.eggSeen && s.progress.eligibleVoyages>=V051.discovery.initialEligibleVoyages || s.progress.dryReturns>=V051.discovery.drySafeReturns);
 // A navigation acknowledgement is compatible with every real arrival at depth2+.
 // A repeated acknowledgement is read-only and never reissues the memento.
 if(guarantee && !candidates.length) candidates=['early_signal'];
 if(!candidates.length) return;
 if(current) s.run.discovery.eligibleRolls++;
 if(!guarantee && roll(s,1,100)>V05.encounters.eggChancePercent) return;
 const id=candidates[roll(s,0,candidates.length-1)];
 s.run.eggId=id;
 const seen=s.discoveries.eggs.some(record=>record.id===id);
 if(!seen) s.discoveries.eggs.push({id,text:NewEncounters.eggs[id],run:s.runNo,depth:s.depth});
 if(current) {
  s.run.eggOccurrence={id,depth:s.depth,first:!seen};
  s.progress.eggSeen=true;
 }
 log(s,NewEncounters.eggs[id],'observation');
}
function quote(s,r) {
 const out=forwardCost(s.depth,s.lastLeg,r.extra,s.voyageShip?.fuelPercent||100);
 const distance=s.distance+out;
 const quotes=returnQuotes(s,s.depth+1,distance);
 const ret=Math.min(...quotes.map(value=>value.cost));
 const arrival=s.fuel-out;
 return {out,returnCost:ret,arrival,free:arrival-ret,
  normalReturnCost:homeCost(s,distance),gateReturnCost:quotes.find(value=>value.method==='gate')?.cost??null,
  enabled:s.phase==='route'&&s.hull>0&&s.depth<8&&arrival>=ret};
}
function baseEncounter(s){if(!s.event)return null;if(s.event.id==='dream'&&!hasDream(s))return{id:'dream',nonce:s.event.nonce,title:'接收已关闭',kind:'anomaly',text:'触发物已不在货舱，这次调查没有继续。',choices:[option('leave','离开现场','没有额外损失',{})]};const ctx={...s,depth:s.depth,...s.event.context};const ev={...EVENTS[s.event.id](ctx),id:s.event.id,nonce:s.event.nonce},percent=s.voyageShip?.damagePercent||100;ev.choices=ev.choices.map(c=>({...c,effect:{...c.effect,...(c.effect.hull<0?{hull:-Math.ceil(-c.effect.hull*percent/100)}:{})},...(c.risk?{risk:c.risk.map(n=>Math.ceil(n*percent/100))}:{})}));return ev;}
function encounter(s) {
 const event = baseEncounter(s);
 if (!event) return null;
 const occurrence=s.run?.eggOccurrence;
 const egg=occurrence?.depth===s.depth ? {...occurrence,text:NewEncounters.eggs[occurrence.id]} : s.discoveries.eggs.find(seen=>seen.run===s.runNo&&seen.depth===s.depth);
 event.newDiscovery=!!NewEncounters.metadata[event.id] && s.discoveries.encounters.some(seen=>seen.id===event.id&&seen.run===s.runNo&&seen.depth===s.depth);
 if (egg) event.eggText = egg.text;
 if (egg?.id === 'shifting_coordinates' && event.id === 'foldback_marker' && !s.discoveries.mementoClaimed) {
  event.choices.unshift(option('memento', '收下漂移导航盘', '1格 · 只是一件纪念物', {
   loot: [{ ...item('漂移导航盘', 35, 1), itemId: 'nav_chip' }], memento: true
  }));
 }
 return event;
}
function checkChoice(s,c,options={}){
 if(!c)return'选项不存在';if(c.blocked)return c.blocked;const e=c.effect;
 if(e.memento&&s.discoveries.mementoClaimed)return'已经收下过这件纪念物';
 if(s.event?.id==='dream'&&!hasDream(s)&&c.id!=='leave')return'触发物已不在货舱，可以返航或离开现场';
 if(e.remove&&!s.cargo.some(x=>x.uid===e.remove&&!x.contract))return'货物已不在货舱';
 if(c.tool&&!s.tools.includes(c.tool))return'需要'+({scanner:'扫描仪',winch:'牵引绞盘'}[c.tool]||c.tool);
 if(e.fuel>0&&s.fuel===resourceLimit(s,'fuel')&&!e.loot&&!e.hull&&!(e.money>0))return'燃料已满';
 if(e.hull>0&&s.hull===resourceLimit(s,'hull')&&!e.loot&&!e.fuel&&!(e.money>0))return'船体完好';
 if(e.money<0&&s.money+e.money<0)return'零件不足';if(e.fuel<0&&spare(s)<-e.fuel)return'会动用返航储备';
 if(!options.ignoreCargo&&e.loot){
  const current=s.cargo.filter(x=>x.uid!==e.remove),items=[...current,...e.loot.map((x,i)=>({...x,uid:s.nextUid+i,acquiredRun:s.runNo}))];
  if(items.reduce((n,x)=>n+x.cells,0)>capacityCells(s))return'货舱不足，可在装载时选择换下旧货';
  const placements=(s.cargoGrid?.placements||[]).filter(p=>current.some(x=>x.uid===p.uid));
  if(!Cargo.extend(items,placements,cargoSpace(s)))return'货舱形状需要整理，请调整位置后装载';
 }return null;
}
function routeView(s){return{nodes:s.history.map((id,i)=>({uid:`visited:${s.runNo}:${i+1}`,id,name:TYPES[id],signal:SIGNALS[id],risk:riskFor(id),depth:i+1,legFuel:s.legs[i],current:i===s.depth-1&&!['port','summary'].includes(s.phase)})),candidates:clone(s.route),returnCost:safeReturnReserve(s),returnQuotes:returnQuotes(s),returnMethod:s.summary?.returnMethod??null,done:['port','summary'].includes(s.phase),currentDepth:s.depth};}
function cargoDraft(s,action){
 const fail=message=>({ok:false,message,items:[],placements:[],newUids:[]});
 if(!action||action.expected!==undefined&&action.expected!==s.revision)return fail('这份装载方案已过期，请按当前货舱重开');
 let effect={},nextRun=s.runNo;
 if(action.type==='choose'){
  if(s.phase!=='event'||s.event.nonce!==action.nonce)return fail('此事件已经处理');
  const c=encounter(s).choices.find(c=>c.id===action.id),err=checkChoice(s,c,{ignoreCargo:true});if(err)return fail(err);effect=c.effect;
 }else if(action.type==='depart'){
  if(s.phase!=='port')return fail('当前不在港口');if(s.fuel<12)return fail('燃料不足，请先补给或短工');if(s.hull<25)return fail('耐久低于25，请先维修');
  nextRun++;effect={};
 }else return fail('此操作没有待装载货物');
 const discarded=action.discardUids??[];
 if(!Array.isArray(discarded)||new Set(discarded).size!==discarded.length||discarded.some(uid=>!Number.isSafeInteger(uid)||!s.cargo.some(x=>x.uid===uid)||uid===effect.remove))return fail('待放弃货物已变化，请重开装载');
 if(action.type==='depart'&&discarded.length)return fail('港口货物请先出售或调整位置');
 if(s.event?.id==='dream'&&discarded.some(uid=>s.cargo.find(x=>x.uid===uid)?.story==='dream'))return fail('请先完成当前随货调查，再处理触发物');
 const current=s.cargo.filter(x=>x.uid!==effect.remove&&!discarded.includes(x.uid));
 const incoming=(effect.loot||[]).map((x,i)=>({...clone(x),uid:s.nextUid+i,acquiredRun:nextRun,...(effect.flag==='dream'?{story:'dream'}:{})}));
 const items=clone([...current,...incoming]),existing=s.cargoGrid.placements.filter(p=>current.some(x=>x.uid===p.uid));
 const filled=Cargo.extend(items,existing,cargoSpace(s)),placements=filled||clone(existing);
 return{ok:true,message:filled?'':'请安排待装物件；空间不够时可明确换下旧货',items,placements,newUids:incoming.map(x=>x.uid),discardUids:[...discarded],action:{type:action.type,...(action.type==='choose'?{id:action.id,nonce:action.nonce}:{}),expected:s.revision},revision:s.revision,complete:!!filled,requiresRepack:!filled,missionPreview:action.type==='depart'};
}
function plannedCargo(s,action){
 const draft=cargoDraft(s,action);if(!draft.ok)return draft;
 const layout=action.layout===undefined?draft.placements:action.layout;
 const valid=Cargo.validate(draft.items,layout,cargoSpace(s));if(!valid.ok)return{ok:false,message:valid.message};
 return{...draft,placements:clone(layout)};
}
function pruneGrid(s){s.cargoGrid.placements=s.cargoGrid.placements.filter(p=>s.cargo.some(x=>x.uid===p.uid));}
function addItem(s,x){const next={...x,uid:s.nextUid++,acquiredRun:s.runNo};s.cargo.push(next);if(!x.contract&&!s.archive.some(y=>y.name===x.name))s.archive.push({name:x.name,value:x.value,cells:x.cells,firstRun:s.runNo});}
function freshAccount(money){return{opening:money,eventIncome:0,eventSpent:0,salesCurrent:0,salesCarried:0,reward:0,rescueFee:0,supplySpent:0,repairSpent:0,toolSpent:0,debtPaid:0,legacy:false};}
function cash(s,delta,kind,item){const before=s.money;s.money+=delta;if(!Number.isSafeInteger(s.money)||s.money<0)throw Error('资金无效');const a=s.run?.account;if(a){if(kind==='sale')a[item.acquiredRun===s.runNo?'salesCurrent':'salesCarried']+=delta;else a[kind]+=Math.abs(delta);}s.ledger.push({seq:s.seq,run:s.runNo,kind,delta,before,after:s.money,...(item?{uid:item.uid,sourceRun:item.acquiredRun}:{})});s.ledger=s.ledger.slice(-500);}
function apply(s,e){const changes=[];if(e.money){const sold=e.remove?s.cargo.find(x=>x.uid===e.remove):null;cash(s,e.money,sold?'sale':e.money>0?'eventIncome':'eventSpent',sold);changes.push(`零件${e.money>0?'+':''}${e.money}`);}for(const[field,label,delta]of[['fuel','燃料',e.fuel],['fuel','燃料',e.bonusFuel],['hull','耐久',e.hull]]){if(!delta)continue;const before=s[field];s[field]=clamp(before+delta,0,resourceLimit(s,field));if(s[field]!==before)changes.push(`${label}${s[field]>before?'+':''}${s[field]-before}`);}
 if(e.remove){s.cargo=s.cargo.filter(x=>x.uid!==e.remove);changes.push('出售1件货物');}for(const x of e.loot||[]){addItem(s,{...x,...(e.flag==='dream'?{story:'dream'}:{})});changes.push(`装入：${x.name}`);}if(e.flag)s.flags[e.flag]=true;if(e.memento)s.discoveries.mementoClaimed=true;return changes;
}
function summaryView(s){const r=s.summary;if(!r)return null;const a=s.run.account;return{...r,...a,spent:a.eventSpent,earned:a.eventIncome+a.reward,sold:a.salesCurrent+a.salesCarried,cashDelta:s.money-a.opening,cargoValue:cargoValue(s),currentCargoValue:s.cargo.filter(x=>!x.contract&&x.acquiredRun===s.runNo).reduce((n,x)=>n+x.value,0),operatingNet:a.eventIncome+a.reward+a.salesCurrent-a.eventSpent-a.rescueFee-a.supplySpent-a.repairSpent};}
function finish(s,rescue,method='normal'){const price=returnQuotes(s).find(quote=>quote.method===method)?.cost??homeCost(s);let lost=[];if(rescue){lost=s.cargo.filter(x=>x.acquiredRun===s.runNo);s.cargo=s.cargo.filter(x=>x.acquiredRun!==s.runNo);cash(s,-Math.min(BALANCE.rescue.maximumCashCharge,s.money),'rescueFee');s.fuel=Math.max(BALANCE.rescue.minimumFuelAfter,s.fuel);s.hull=Math.max(BALANCE.rescue.minimumHullAfter,s.hull);}else{s.fuel-=price;}finishMission(s,rescue);
 if(s.missionSlot&&rescue)lost.push(s.missionSlot);if(activeMission(s)?.status==='accepted'&&activeMission(s).type==='survey'&&!rescue){if(s.missionSlot)s.missionSlot.acquiredRun=s.runNo+1;}else s.missionSlot=null;
 s.summary={run:s.runNo,depth:s.depth,distance:s.distance,returnFuel:rescue?0:price,returnMethod:rescue?'rescue':method,rescue,lost:lost.filter(x=>!x.contract).length,lostUids:lost.map(x=>x.uid),reward:s.run.account.reward,cashDelta:s.money-s.run.account.opening};s.phase='summary';s.event=null;s.result=null;s.route=[];log(s,rescue?'拖航完成。本趟新货用于抵扣救援成本，跨趟旧货与永久设备保留。':'平安返港。返航油已扣，货物与港口操作由你决定。');telemetry(s,'return',{rng:s.rng,rescue,method:rescue?'rescue':method,fuelCost:rescue?0:price,fuel:s.fuel,hull:s.hull,money:s.money,cargoValue:cargoValue(s)});
 if(!rescue) {
  Market.safeReturn(s);
  if(s.run.returnRules.version==='v051' && s.run.discovery.eligible) s.progress.dryReturns=s.run.eggId?0:s.progress.dryReturns+1;
 }
 if(!rescue && method==='gate') log(s,'折返信标已使用，实扣'+price+'燃料，返港结算已保存。');
}
function portQuote(s,type){const field=type==='buyFuel'?'fuel':'hull',unit=type==='buyFuel'?BALANCE.port.fuelUnitPrice:BALANCE.port.repairUnitPrice;const amount=Math.max(0,Math.min(BALANCE.port.maximumServiceIncrement,resourceLimit(s,field)-s[field],Math.floor(s.money/unit)));return{amount,cost:amount*unit,field};}
function preparation(s){const cost=(Math.max(0,12-s.fuel)*BALANCE.port.fuelUnitPrice+Math.max(0,25-s.hull)*BALANCE.port.repairUnitPrice);return{minimumCost:cost,needsAid:s.phase==='port'&&cost>0&&s.money<cost};}
function dispatch(input,action){
 let s=clone(input);const fail=message=>({state:input,ok:false,message});if(action.expected!==undefined&&action.expected!==s.revision)return fail('这一步已处理，请按当前画面操作');try{assertState(s);}catch(e){return fail('货舱或档案校验失败：'+e.message);}s.seq++;
 switch(action.type){
 case'depart':{
  const plan=plannedCargo(s,action);if(!plan.ok)return fail(plan.message);
  s.runNo++;s.depth=0;s.distance=0;s.lastLeg=0;s.history=[];s.legs=[];s.flags={};s.event=null;s.result=null;s.summary=null;
  s.voyageShip={shipId:s.fleet.equippedShipId,cargoLevel:shipStats(s).cargoLevel,fuelLevel:shipStats(s).fuelLevel,hullLevel:shipStats(s).hullLevel,maxFuel:shipStats(s).maxFuel,maxHull:shipStats(s).maxHull,fuelPercent:shipStats(s).fuelPercent,damagePercent:shipStats(s).damagePercent};s.run={returnRules:{version:'v051',gateFuel:V051.gate.fuel},discovery:freshDiscovery(),eggOccurrence:null,contentPoolVersion:'v05',eggId:null,startMoney:s.money,startFuel:s.fuel,startHull:s.hull,spent:0,earned:0,contractActive:activeMission(s)?.type==='survey'&&activeMission(s)?.status==='accepted',account:freshAccount(s.money)};
  const task=activeMission(s);if(task&&task.status==='accepted'){task.status='active';task.targetRun=s.runNo;if(s.missionSlot)s.missionSlot.acquiredRun=s.runNo;}s.cargoGrid.placements=plan.placements;
  s.phase='route';s.route=routeOptions(s);s.helpUsed=false;log(s,s.run.contractActive?'已出发，测绘记录箱随船。':'已出发，航行与返港由你决定。');telemetry(s,'depart',{fuel:s.fuel,hull:s.hull,cargo:s.cargo.map(x=>({uid:x.uid,sourceRun:x.acquiredRun}))});break;
 }
 case'travel':{if(s.phase!=='route')return fail('请先完成当前事件');const r=s.route.find(x=>x.uid===action.id);if(!r)return fail('航点已变化');const q=quote(s,r);if(!q.enabled)return fail('无法抵达并预留返航油');s.fuel-=q.out;s.distance+=q.out;s.legs.push(q.out);s.lastLeg=q.out;s.depth++;s.history.push(r.id);const id=hasDream(s)&&!s.flags.dreamDone&&s.depth>2&&!['station','trader','workshop'].includes(r.id)?'dream':r.id;if(id==='dream')s.flags.dreamDone=true;s.event={id,nonce:`${s.runNo}/${s.depth}`,context:{fuel:s.fuel,hull:s.hull,cargo:clone(s.cargo),missionSlot:clone(s.missionSlot)}};s.phase='event';s.route=[];discoverArrival(s);log(s,`抵达第${s.depth}航点：${r.name}。航行耗油${q.out}，当前可用返航需${safeReturnReserve(s)}。`);telemetry(s,'travel',{signal:r.id,burn:q.out,returnFuel:safeReturnReserve(s),spare:spare(s)});break;}
 case'choose':{
  if(s.phase!=='event'||s.event.nonce!==action.nonce)return fail('此事件已经处理');
  const ev=encounter(s),c=ev.choices.find(x=>x.id===action.id),err=checkChoice(s,c,{ignoreCargo:true});if(err)return fail(err);
  const plan=plannedCargo(s,action);if(!plan.ok)return fail(plan.message);
  const before={money:s.money,fuel:s.fuel,hull:s.hull,cargoCount:s.cargo.length,cargoCells:used(s)};
  const cargoBefore=s.cargo.map(({uid,name,cells})=>({uid,name,cells}));
  for(const uid of plan.discardUids){const x=s.cargo.find(x=>x.uid===uid);if(x.contract)s.run.contractActive=false;log(s,`放弃：${x.name}`,'cargo');}
  s.cargo=s.cargo.filter(x=>!plan.discardUids.includes(x.uid));
  const e=clone(c.effect);if(c.risk)e.hull=(e.hull||0)-roll(s,c.risk[0],c.risk[1]);
  const changes=apply(s,e);s.cargoGrid.placements=plan.placements;
  s.run.spent=s.run.account.eventSpent;s.run.earned=s.run.account.eventIncome;
  const delta={money:s.money-before.money,fuel:s.fuel-before.fuel,hull:s.hull-before.hull,cargoCount:s.cargo.length-before.cargoCount,cargoCells:used(s)-before.cargoCells};
  const cargoChanges={added:s.cargo.filter(x=>!cargoBefore.some(old=>old.uid===x.uid)).map(({uid,name,cells,itemId,shapeId,shapeVersion})=>({uid,name,cells,itemId,shapeId,shapeVersion,rotation:s.cargoGrid.placements.find(placement=>placement.uid===uid)?.rotation??0})),removed:cargoBefore.filter(x=>!s.cargo.some(next=>next.uid===x.uid)).map(x=>({...x,reason:x.uid===e.remove?'sale':'discard'}))};
  s.result={...(ev.eggText?{eggText:ev.eggText}:{}),title:ev.title,text:c.out||(c.id==='leave'?'你记下坐标，把注意力放回前方航路。':'处理完成。咔哒检查了固定带。'),changes,delta,cargoChanges};s.phase='result';
  log(s,ev.title+' · '+c.label+(changes.length?'；'+changes.join('，'):''),'choice');telemetry(s,'choice',{event:ev.id,option:c.id,fuel:s.fuel,hull:s.hull,money:s.money,cargo:s.cargo.map(x=>x.uid),discarded:plan.discardUids});
  if(s.hull===0)finish(s,true);break;
 }
 case'layout':{
  if(action.discardUids?.length)return fail('整理位置不能丢弃货物，请使用明确的放弃操作');
  const v=Cargo.validate(s.cargo,action.layout,cargoSpace(s));if(!v.ok)return fail(v.message);
  s.cargoGrid.placements=clone(action.layout);break;
 }
 case'continue':if(s.phase!=='result')return fail('当前没有结果');s.phase='route';s.event=null;s.result=null;s.route=routeOptions(s);break;
 case'return': {
  if(!['route','event','result'].includes(s.phase)||!s.depth) return fail('尚未离港航行');
  const method=action.method??'normal';
  const quote=returnQuotes(s).find(value=>value.method===method);
  if(!quote) return fail('当前没有可用的折返信标');
  if(s.hull===0 || s.fuel<quote.cost) return fail(s.hull>0&&s.fuel>=safeReturnReserve(s)?'请选择当前可负担的返航方式':'当前需要普通拖航');
  finish(s,false,method);
  break;
 }
 case'abort':if(s.phase!=='route'||s.depth!==0)return fail('只能在未航行时取消');{const m=activeMission(s);if(m?.status==='active'){m.status='accepted';m.targetRun=s.runNo+1;if(s.missionSlot)s.missionSlot.acquiredRun=s.runNo+1;}}s.phase='port';s.run=null;s.voyageShip=null;s.route=[];log(s,'已取消出发，没有消耗燃料。');break;
 case'rescue':if(!['route','event','result'].includes(s.phase)||!s.depth)return fail('当前不需要救援');if(s.hull>0&&s.fuel>=safeReturnReserve(s))return fail('当前有可用返航方式，无需拖航');finish(s,true);break;
 case'port':if(s.phase!=='summary')return fail('尚未返港');s.phase='port';break;
 case'fillFuel':case'fillHull':{if(s.phase!=='port')return fail('请先回港');const type=action.type==='fillFuel'?'buyFuel':'repair',q=supplyQuote(s,type,true);if(!q.amount)return fail('已经补满');if(!q.enabled)return fail('余额不足以补满，请选择明示数量的少量补给');cash(s,-q.cost,type==='buyFuel'?'supplySpent':'repairSpent');s[q.field]=q.target;log(s,`一次补满${q.field==='fuel'?'燃料':'耐久'}${q.from}→${q.target}，实付${q.cost}零件。`);break;}
 case'buyFuel':case'repair':{if(s.phase!=='port')return fail('请先回港');const q=portQuote(s,action.type);if(!q.amount)return fail(s[q.field]===resourceLimit(s,q.field)?'已经补满':'零件不足');cash(s,-q.cost,action.type==='buyFuel'?'supplySpent':'repairSpent');s[q.field]+=q.amount;log(s,`${q.field==='fuel'?'补充燃料':'维修船体'}${q.amount}，实付${q.cost}零件。`);break;}
 case'sell':case'sellAll':{if(!['port','summary'].includes(s.phase))return fail('请先返港');const goods=s.cargo.filter(x=>!x.contract&&(action.type==='sellAll'||x.uid===action.id));if(!goods.length)return fail('没有可售货物');for(const x of goods)cash(s,x.value,'sale',x);s.cargo=s.cargo.filter(x=>!goods.some(g=>g.uid===x.uid));log(s,`售出${goods.length}件回收物，收到${goods.reduce((n,x)=>n+x.value,0)}零件。`);break;}
 case'discardMission':{const m=activeMission(s);if(!m||!s.missionSlot||action.id!==s.missionSlot.uid)return fail('任务记录箱已不在船上');m.status='abandoned';s.activeMissionId=null;s.missionSlot=null;if(s.run)s.run.contractActive=false;log(s,'已放弃委托，不结算任务报酬。','cargo');break;}
 case'discard':{if(!['route','event','result'].includes(s.phase))return fail('港口可以出售');const x=s.cargo.find(x=>x.uid===action.id);if(!x)return fail('物品已不在货舱');if(x.contract)s.run.contractActive=false;s.cargo=s.cargo.filter(x=>x.uid!==action.id);log(s,`放弃：${x.name}`,'cargo');break;}
 case'use':{const x=s.cargo.find(x=>x.uid===action.id);if(!x||!['patch','fuel'].includes(x.ability))return fail('物品不能直接使用');const field=x.ability==='patch'?'hull':'fuel';if(s[field]===resourceLimit(s,field))return fail('已经补满');s.cargo=s.cargo.filter(x=>x.uid!==action.id);s[field]=Math.min(resourceLimit(s,field),s[field]+(field==='hull'?22:20));log(s,field==='hull'?'修补用品已使用，按本船耐久上限恢复22点。':'燃料罐已使用，补充20燃料；航行距离不变。');break;}
 case'repay':{if(!['port','summary'].includes(s.phase))return fail('请先返港');if(![100,500,12000].includes(action.amount))return fail('还款金额无效');const amount=Math.min(action.amount,s.debt);if(!amount)return fail('船款已还清');if(s.money-amount<BALANCE.port.minimumMoneyAfterRepayment)return fail('至少保留50零件补给');cash(s,-amount,'debtPaid');s.debt-=amount;log(s,`归还船款${amount}，剩余${s.debt}。`);if(!s.debt)log(s,'船款已结清。失物号属于你。','milestone');break;}
 case'tool':{if(s.phase!=='port')return fail('只能在港口改装');const p=BALANCE.tools[action.id];if(!Number.isFinite(p)||s.tools.includes(action.id))return fail('设备已安装或不存在');if(s.money<p)return fail('零件不足');cash(s,-p,'toolSpent');s.tools.push(action.id);log(s,`设备安装完成，实付${p}零件。`);break;}
 case'acceptMission':{if(s.phase!=='port')return fail('请先回港');if(activeMission(s))return fail('同时只能接取一项任务');const spec=PORT.missions[action.id];if(!spec)return fail('未知委托');const m={uid:s.nextMissionUid++,type:action.id,status:'accepted',acceptedRun:s.runNo,targetRun:s.runNo+1,legacyAutoSettlement:false};s.missions.push(m);s.missions=s.missions.slice(-150);s.activeMissionId=m.uid;if(spec.recordBox)s.missionSlot={uid:s.nextUid++,name:'航区测绘记录箱',cells:4,value:0,contract:true,shapeId:'square4',shapeVersion:1,acquiredRun:s.runNo+1};log(s,'已接取：'+spec.name);break;}
 case'abandonMission':{const m=activeMission(s);if(!m||m.uid!==action.id||!['accepted','active'].includes(m.status))return fail('任务已变化');m.status='abandoned';s.activeMissionId=null;s.missionSlot=null;if(s.run)s.run.contractActive=false;log(s,'已放弃：'+PORT.missions[m.type].name);break;}
 case'claimMission':{const m=activeMission(s);if(!m||m.uid!==action.id||m.status!=='complete'||!['port','summary'].includes(s.phase))return fail('任务尚未完成或已领取');cash(s,PORT.missions[m.type].reward,'reward');s.ledger.at(-1).missionId=m.uid;m.status='claimed';m.claimedRun=s.runNo;s.activeMissionId=null;if(s.summary)s.summary.reward=s.run.account.reward;log(s,'委托已领取：'+PORT.missions[m.type].name);break;}
 case'buyShip':{if(s.phase!=='port')return fail('请先回港');const spec=PORT.ships[action.id];if(!spec||s.fleet.ownedShipIds.includes(action.id))return fail('已拥有或未知飞船');if(s.money<spec.price)return fail('零件不足');cash(s,-spec.price,'toolSpent');s.ledger.at(-1).category='shipPurchase';s.ledger.at(-1).shipId=action.id;s.fleet.ownedShipIds.push(action.id);s.fleet.cargoLevels[action.id]=0;s.fleet.fuelLevels[action.id]=0;s.fleet.hullLevels[action.id]=0;s.fleet.parked[action.id]={fuel:0,hull:spec.hullBase};log(s,'已购入：'+spec.name+'；可免费换装。');break;}
 case'equipShip':{if(s.phase!=='port'||!s.fleet.ownedShipIds.includes(action.id))return fail('请回港选择已拥有飞船');if(s.fleet.equippedShipId===action.id)return fail('已经装备');const spec=shipStats(s,action.id),space=Holds.space(action.id,spec.cargoLevel),dims={width:space.width,height:space.height},packed=Cargo.extend(s.cargo,s.cargoGrid.placements,space)||Cargo.solve(s.cargo,s.cargoGrid.placements,space);if(!packed)return fail('货物无法装入这艘船，请先出售或整理；不会吞货');s.fleet.parked[s.fleet.equippedShipId]={fuel:s.fuel,hull:s.hull};const stock=s.fleet.parked[action.id];s.fuel=stock.fuel;s.hull=stock.hull;delete s.fleet.parked[action.id];s.fleet.equippedShipId=action.id;s.hold={mode:'bc',topologyVersion:Holds.version};s.cargoGrid={...dims,placements:packed};log(s,'现役飞船：'+spec.name);break;}
 case'upgradeShip':{const q=shipUpgradeQuote(s,action.kind);if(!q.enabled)return fail(q.cost===null?'本项升级已完成或项目不存在':'请回港并准备足够零件');cash(s,-q.cost,'toolSpent');s.ledger.at(-1).category='shipUpgrade';s.ledger.at(-1).shipId=s.fleet.equippedShipId;s.ledger.at(-1).upgradeKind=action.kind;s.fleet[action.kind+'Levels'][s.fleet.equippedShipId]++;if(action.kind==='hull')s.hull+=q.to-q.from;log(s,(action.kind==='fuel'?'油箱容量':'船体耐久上限')+q.from+'→'+q.to+'，实付'+q.cost+'零件；'+(action.kind==='fuel'?'油量未自动增加。':'新增结构已装好，原损伤保留。'));break;}
 case'upgradeCargo': {
  const quote = cargoUpgradeQuote(s);
  if (!quote.enabled) return fail(quote.cost === null ? '货舱已完成结构扩容' : '请回港并准备足够零件');
  const shipId = s.fleet.equippedShipId;
  const level = shipStats(s).cargoLevel + 1;
  const space = s.hold.mode === 'legacy' ? { width: quote.width, height: quote.nextHeight } : Holds.space(shipId, level);
  if (!Cargo.validate(s.cargo, s.cargoGrid.placements, space).ok) return fail('原货物无法安全保留，扩容未扣款');
  cash(s, -quote.cost, 'toolSpent');
  Object.assign(s.ledger.at(-1), { category: 'cargoUpgrade', shipId });
  s.fleet.cargoLevels[shipId] = level;
  s.cargoGrid.width = space.width;
  s.cargoGrid.height = space.height;
  log(s, '固定货台扩容：' + quote.capacity + '→' + quote.nextCapacity + '格，实付' + quote.cost + '零件。');
  break;
 }
 case'marketQuote': {
  const error = Market.request(s, action, (fee, offerId) => {
   cash(s, -fee, 'eventSpent');
   Object.assign(s.ledger.at(-1), { category: 'marketListing', offerId });
  });
  if (error) return fail(error);
  log(s, '黑市报价已保存，物品仍在货舱。');
  break;
 }
 case'marketAccept': {
  const error = Market.accept(s, action.id, (good, amount, offerId) => {
   cash(s, amount, 'sale', good);
   Object.assign(s.ledger.at(-1), { category: 'marketSale', offerId });
   s.cargo = s.cargo.filter(item => item.uid !== good.uid);
  });
  if (error) return fail(error);
  log(s, '已按保存的报价成交。');
  break;
 }
 case'marketKeep': {
  const error = Market.keep(s, action.id);
  if (error) return fail(error);
  log(s, '已保留物品，原报价记录保留。');
  break;
 }
 case'buyProduct':{if(s.phase!=='port')return fail('请先回港');const p=PORT.products[action.id];if(!p||s.money<p.price)return fail('物资不存在或余额不足');const x={uid:s.nextUid,name:p.name,cells:p.cells,shapeId:p.shapeId,shapeVersion:1,value:p.value,ability:p.ability,itemId:p.itemId,acquiredRun:s.runNo},items=[...s.cargo,x],layout=Cargo.extend(items,s.cargoGrid.placements,cargoSpace(s));if(!layout)return fail('货舱没有合法位置，请先整理');cash(s,-p.price,'eventSpent');s.ledger.at(-1).category='portProduct';s.nextUid++;s.cargo.push(x);s.cargoGrid.placements=layout;log(s,'已购入：'+p.name);break;}
 case'feedback':{if(s.phase!=='summary'||!['steady','tense','unclear','skip'].includes(action.answer))return fail('无效反馈');s.telemetry=s.telemetry.filter(x=>!(x.kind==='feedback'&&x.run===s.runNo));telemetry(s,'feedback',{answer:action.answer});break;}
 case'aid':if(!preparation(s).needsAid)return fail('现有资源足以准备出航');s.fuel=Math.max(20,s.fuel);s.hull=Math.max(40,s.hull);s.helpUsed=true;log(s,'码头短工换取基本油料与船体修整，不支付现金。');break;
 default:return fail('未知操作');
 }
 pruneGrid(s);Market.prune(s);if(['sell','sellAll','marketAccept','use','port','upgradeCargo'].includes(action.type))tryHoldTransition(s);s.revision++;if(s.summary)s.summary={...s.summary,cashDelta:s.money-s.run.account.opening};assertState(s);return{state:s,ok:true,message:''};
}
const phases=['port','route','event','result','summary'];
function integer(n,low=0,high=1e9){return Number.isSafeInteger(n)&&n>=low&&n<=high;}
function text(v,max=300){return typeof v==='string'&&v.length<=max;}
function validateCargo(xs,runNo,legacy=false){
 if(!Array.isArray(xs)||xs.length>(legacy?8:30))throw Error('货舱字段无效');
 for(const x of xs){if(!x||!integer(x.uid,1)||!integer(x.value)||!text(x.name,100)||!integer(x.acquiredRun,0,runNo)||x.ability!=null&&!['patch','fuel'].includes(x.ability)||x.story!=null&&x.story!=='dream'||x.contract!=null&&typeof x.contract!=='boolean')throw Error('物品字段无效');if(legacy){if(!integer(x.size,1,4))throw Error('旧货体积无效');}else{const err=Cargo.itemError(x);if(err)throw Error(err);}}
 if(new Set(xs.map(x=>x.uid)).size!==xs.length)throw Error('重复货物');
}
function validateMission(x,runNo){if(x===null)return;if(!x||x.contract!==true||x.name!=='航区测绘记录箱'||x.cells!==4||x.value!==0||![runNo,runNo+1].includes(x.acquiredRun)||Cargo.itemError(x))throw Error('任务记录箱无效');}

function validateFleet(s){if(s.run&&!s.voyageShip)throw Error('缺少航次飞船');const f=s.fleet;if(!f||!Array.isArray(f.ownedShipIds)||f.ownedShipIds.length<1||f.ownedShipIds.length>4||new Set(f.ownedShipIds).size!==f.ownedShipIds.length||!f.ownedShipIds.includes('starter')||!f.ownedShipIds.includes(f.equippedShipId)||f.ownedShipIds.some(id=>!PORT.ships[id]||!integer(f.cargoLevels?.[id],0,PORT.ships[id].cargoUpgradeCosts.length))||Object.keys(f.cargoLevels).some(id=>!f.ownedShipIds.includes(id)))throw Error('飞船归属或升级无效');
 for(const kind of ['fuel','hull'])if(!f[kind+'Levels']||Object.keys(f[kind+'Levels']).length!==f.ownedShipIds.length||f.ownedShipIds.some(id=>!integer(f[kind+'Levels'][id],0,PORT.ships[id][kind+'UpgradeCosts'].length))||Object.keys(f[kind+'Levels']).some(id=>!f.ownedShipIds.includes(id)))throw Error('飞船本体升级无效');
 if(!f.parked||Object.keys(f.parked).length!==f.ownedShipIds.length-1||Object.keys(f.parked).some(id=>!f.ownedShipIds.includes(id)||id===f.equippedShipId)||f.ownedShipIds.filter(id=>id!==f.equippedShipId).some(id=>!f.parked[id]||!integer(f.parked[id].fuel,0,shipStats(s,id).maxFuel)||!integer(f.parked[id].hull,0,shipStats(s,id).maxHull)))throw Error('停泊船舶的油量或船况无效');
 if(!Array.isArray(s.missions)||s.missions.length>150||!integer(s.nextMissionUid,1)||new Set(s.missions.map(m=>m.uid)).size!==s.missions.length)throw Error('任务记录无效');
 for(const m of s.missions)if(!m||!integer(m.uid,1,s.nextMissionUid-1)||!PORT.missions[m.type]||!['accepted','active','complete','claimed','abandoned'].includes(m.status)||!integer(m.acceptedRun,0,s.runNo)||!integer(m.targetRun,0,s.runNo+1)||typeof m.legacyAutoSettlement!=='boolean')throw Error('任务字段无效');
 const open=s.missions.filter(m=>['accepted','active','complete'].includes(m.status));if(open.length>1||(open[0]?.uid??null)!==s.activeMissionId)throw Error('同时只能有一个真实任务');if(open[0]?.status==='active'&&!['route','event','result'].includes(s.phase))throw Error('在途任务阶段无效');
 if(s.voyageShip){const v=s.voyageShip,c=PORT.ships[v.shipId];if(!c||!f.ownedShipIds.includes(v.shipId)||!integer(v.cargoLevel,0,f.cargoLevels[v.shipId])||v.fuelPercent!==c.fuelPercent||v.damagePercent!==c.damagePercent||!integer(v.fuelLevel,0,f.fuelLevels[v.shipId])||!integer(v.hullLevel,0,f.hullLevels[v.shipId])||v.maxFuel!==c.fuelBase+v.fuelLevel*c.fuelStep||v.maxHull!==c.hullBase+v.hullLevel*c.hullStep)throw Error('航次船舶快照无效');}}
function assertState(s){
 if(!s||!text(s.version,40)||typeof s.helpUsed!=='boolean'||s.schema!==SCHEMA||!phases.includes(s.phase))throw Error('存档版本或阶段无效');for(const k of ['fuel','hull','money','debt','capacity','depth','distance','revision','seq','nextUid','runNo','lastLeg'])if(!integer(s[k]))throw Error('数值无效：'+k);
 if(!integer(s.rng,1,4294967295)||s.fuel>resourceLimit(s,'fuel')||s.hull>resourceLimit(s,'hull')||s.debt>12000||s.capacity!==4||s.depth>8||s.distance>300||s.lastLeg>40)throw Error('资源或距离越界');
 validateFleet(s);validateCargo(s.cargo,s.runNo);if(s.cargo.some(x=>!ITEM_IDS.includes(x.itemId)))throw Error('物品外观ID无效');if(s.cargo.some(x=>NewEncounters.curios[x.itemId]&&x.shapeId!==NewEncounters.curios[x.itemId].shapeId))throw Error('奇物形态与实际占格不符');validateMission(s.missionSlot,s.runNo);if(s.cargo.some(x=>x.contract)||s.missionSlot&&(!activeMission(s)||activeMission(s).type!=='survey'||!['accepted','active'].includes(activeMission(s).status)||s.missionSlot.uid>=s.nextUid||s.cargo.some(x=>x.uid===s.missionSlot.uid)))throw Error('任务槽与航次不一致');if(used(s)>capacityCells(s)||s.cargo.some(x=>x.uid>=s.nextUid))throw Error('货舱不一致');
 if(!s.hold||!['bc','legacy'].includes(s.hold.mode)||s.hold.topologyVersion!==Holds.version||Object.keys(s.hold).some(key=>!['mode','topologyVersion'].includes(key)))throw Error('货舱拓扑版本无效');
 const space=cargoSpace(s);if(!s.cargoGrid||s.cargoGrid.width!==space.width||s.cargoGrid.height!==space.height||Object.keys(s.cargoGrid).some(key=>!['width','height','placements'].includes(key)))throw Error('货舱尺寸无效');const layout=Cargo.validate(s.cargo,s.cargoGrid.placements,cargoSpace(s));if(!layout.ok)throw Error(layout.message);
 for(const k of ['route','history','legs','log','telemetry','archive','tools','ledger'])if(!Array.isArray(s[k])||s[k].length>500)throw Error('数组无效：'+k);
 if(s.tools.some(x=>!['scanner','winch'].includes(x))||new Set(s.tools).size!==s.tools.length)throw Error('设备无效');
 if(!s.flags||Object.keys(s.flags).some(k=>!['dream','dreamDone'].includes(k)||typeof s.flags[k]!=='boolean'))throw Error('标记无效');
 if(s.legs.length!==s.depth||s.legs.reduce((n,x)=>n+x,0)!==s.distance||(s.legs.at(-1)||0)!==s.lastLeg||s.legs.some((x,i)=>!integer(x,1,40)||x<forwardCost(i,s.legs[i-1]||0,0,s.voyageShip?.fuelPercent||100)||x>forwardCost(i,s.legs[i-1]||0,3,s.voyageShip?.fuelPercent||100)))throw Error('航行距离与逐跳费用不一致');
 if(s.history.length!==s.depth||s.history.some(x=>!Object.hasOwn(TYPES,x)))throw Error('航路历史无效');
 for(const x of s.archive)if(!text(x.name,100)||!integer(x.cells,1,16)||x.size!==undefined&&(!integer(x.size,1,4)||x.cells!==x.size*4)||!integer(x.value)||!integer(x.firstRun,0,s.runNo))throw Error('见闻无效');
 for(const x of s.log)if(!integer(x.seq)||!integer(x.run,0,s.runNo)||!integer(x.depth,0,8)||!text(x.text,1000)||!text(x.type,30))throw Error('航记无效');
 for(const x of s.telemetry)if(!x||typeof x!=='object'||!text(x.kind,40)||JSON.stringify(x).length>3000)throw Error('行为记录无效');
 for(const x of s.ledger)if(!integer(x.seq)||!integer(x.run)||!text(x.kind,30)||!Number.isSafeInteger(x.delta)||!integer(x.before)||!integer(x.after)||x.after-x.before!==x.delta)throw Error('流水无效');
 if(s.phase==='route'){if(s.route.length!==(s.depth===8?0:2))throw Error('候选数量无效');for(const[i,r]of s.route.entries())if(!Object.hasOwn(TYPES,r.id)||r.uid!==`${s.runNo}:${s.depth}:${i}`||!integer(r.extra,i===0?0:1,i===0?0:3)||r.fuel!==forwardCost(s.depth,s.lastLeg,r.extra,s.voyageShip?.fuelPercent||100)||r.name!==TYPES[r.id]||r.signal!==SIGNALS[r.id]||r.depth!==s.depth+1||r.risk!==riskFor(r.id))throw Error('航点费用/身份无效');}else if(s.route.length)throw Error('阶段与航路不一致');
 if(['route','event','result','summary'].includes(s.phase)&&!s.run)throw Error('航次缺失');
 if(s.run){if(!['v042','v05'].includes(s.run.contentPoolVersion)||s.run.eggId!==null&&!Object.hasOwn(NewEncounters.eggs,s.run.eggId))throw Error('航次内容池无效');for(const k of ['startMoney','startFuel','startHull','spent','earned'])if(!integer(s.run[k]))throw Error('航次字段无效');const a=s.run.account;if(!a||Object.keys(freshAccount(0)).some(k=>k==='legacy'?typeof a[k]!=='boolean':!integer(a[k])))throw Error('收支明细无效');const expected=a.opening+a.eventIncome+a.salesCurrent+a.salesCarried+a.reward-a.eventSpent-a.rescueFee-a.supplySpent-a.repairSpent-a.toolSpent-a.debtPaid;if(expected!==s.money)throw Error('现金与流水不一致');if(typeof s.run.contractActive!=='boolean')throw Error('委托无效');}
 if(s.event){if(!Object.hasOwn(EVENTS,s.event.id)||s.event.nonce!==`${s.runNo}/${s.depth}`||!s.event.context||!integer(s.event.context.fuel,0,s.voyageShip?.maxFuel??shipStats(s).maxFuel)||!integer(s.event.context.hull,0,s.voyageShip?.maxHull??shipStats(s).maxHull))throw Error('事件来源无效');validateCargo(s.event.context.cargo,s.runNo);if(s.event.context.cargo.some(x=>x.contract))throw Error('事件货舱不能占用任务槽');validateMission(s.event.context.missionSlot,s.runNo);}
 if(s.phase==='event'&&!s.event)throw Error('事件缺失');if(s.phase==='result'&&(!s.result||!text(s.result.text,2000)||!text(s.result.title,100)||!Array.isArray(s.result.changes)||s.result.changes.some(x=>!text(x,200))))throw Error('结果无效');
 if(s.result?.delta){const keys=['money','fuel','hull','cargoCount','cargoCells'];if(Object.keys(s.result.delta).length!==keys.length||keys.some(k=>!integer(s.result.delta[k],-1e9,1e9)))throw Error('结果资源变动无效');}
 if(s.result?.cargoChanges){const c=s.result.cargoChanges;if(!Array.isArray(c.added)||!Array.isArray(c.removed)||c.added.length>16||c.removed.length>16||[...c.added,...c.removed].some(x=>!x||!integer(x.uid,1)||!text(x.name,100)||!integer(x.cells,1,16))||c.removed.some(x=>!['discard','sale'].includes(x.reason))||new Set([...c.added,...c.removed].map(x=>x.uid)).size!==c.added.length+c.removed.length)throw Error('结果货物变动无效');}
 validateDiscoveries(s);Market.validate(s);validateProgress(s);
 if(s.phase==='summary'&&(!s.summary||!integer(s.summary.run,1,s.runNo)||typeof s.summary.rescue!=='boolean'||!integer(s.summary.depth,0,8)||!integer(s.summary.returnFuel,0,200)||!integer(s.summary.reward)||!Number.isSafeInteger(s.summary.cashDelta)))throw Error('返港明细无效');return true;
}
function validateDiscoveries(s) {
 const discoveries = s.discoveries;
 if (!discoveries || !Array.isArray(discoveries.encounters) || !Array.isArray(discoveries.eggs) || discoveries.encounters.length > 26 || discoveries.eggs.length > 6 || typeof discoveries.mementoClaimed !== 'boolean') throw Error('已见奇闻记录无效');
 for (const [kind, list] of [['encounters', discoveries.encounters], ['eggs', discoveries.eggs]]) {
  if (new Set(list.map(seen => seen.id)).size !== list.length) throw Error('重复奇闻记录');
  for (const seen of list) {
   if (!integer(seen.run, 1, s.runNo) || !integer(seen.depth, 1, 8)) throw Error('奇闻航次无效');
   if (kind === 'eggs' ? !Object.hasOwn(NewEncounters.eggs, seen.id) || seen.text !== NewEncounters.eggs[seen.id] : !Object.hasOwn(EVENTS, seen.id) || !text(seen.title, 100)) throw Error('未知奇闻记录');
  }
 }
 if (new Set(discoveries.eggs.map(seen => seen.run)).size !== discoveries.eggs.length) throw Error('同趟彩蛋超过一次');
 if(s.run){const current=s.run.returnRules.version==='v051'?s.run.eggOccurrence:discoveries.eggs.find(seen=>seen.run===s.runNo);if((current?.id??null)!==s.run.eggId)throw Error('本趟彩蛋与已见记录不一致');if(s.run.contentPoolVersion==='v042'&&[...s.history,...s.route.map(route=>route.id),s.event?.id].some(id=>NewEncounters.metadata[id]))throw Error('旧航次不能切换奇遇池');}
 if (discoveries.mementoClaimed && !discoveries.eggs.some(seen => seen.id === 'shifting_coordinates')) throw Error('纪念物缺少实际发现');
}
function validateProgress(s) {
 const p=s.progress;
 if(!p||!integer(p.eligibleVoyages,0,s.runNo)||typeof p.newOptionShown!=='boolean'||typeof p.eggSeen!=='boolean'||!integer(p.dryReturns,0,s.runNo)) throw Error('发现进度无效');
 if(!s.run) return;
 const rules=s.run.returnRules;
 if(!rules||!['v05','v051'].includes(rules.version)||rules.version==='v051'&&!V051.gate.candidateFuels.includes(rules.gateFuel)||rules.version==='v05'&&rules.gateFuel!==null) throw Error('返航规则快照无效');
 if(rules.version==='v05') {
  if(s.run.discovery!==null||s.run.eggOccurrence!==null) throw Error('旧航次不能切换发现保底');
  return;
 }
 const d=s.run.discovery;
 if(!d||['eligible','newCandidateShown','arrivedNew'].some(key=>typeof d[key]!=='boolean')||!integer(d.eligibleRolls,0,8)||d.eligible!==(s.depth>=2)) throw Error('本趟发现统计无效');
 const egg=s.run.eggOccurrence;
 if(egg!==null&&(!egg||!Object.hasOwn(NewEncounters.eggs,egg.id)||!integer(egg.depth,1,s.depth)||typeof egg.first!=='boolean'||!s.discoveries.eggs.some(seen=>seen.id===egg.id))) throw Error('航行异常来源无效');
 if(s.run.contentPoolVersion!=='v05') throw Error('新返航规则不能更换旧内容池');
 if(s.summary) {
  const method=s.summary.returnMethod;
  if(!['normal','gate','rescue'].includes(method)||s.summary.rescue!==(method==='rescue')) throw Error('返港方式无效');
  const price=method==='rescue'?0:returnQuotes(s).find(quote=>quote.method===method)?.cost;
  if(price===undefined||s.summary.returnFuel!==price) throw Error('返港实扣费用不一致');
  const receipt=[...s.telemetry].reverse().find(row=>row.kind==='return'&&row.run===s.runNo);
  if(!receipt||receipt.method!==method||receipt.fuelCost!==price) throw Error('返港记录与实扣不一致');
 }
}
function inferLegs(depth,distance,last){function visit(a,sum){if(a.length===depth)return sum===distance&&(a.at(-1)||0)===last?a:null;for(let e=0;e<=3;e++){const v=forwardCost(a.length,a.at(-1)||0,e);if(sum+v<=distance){const found=visit([...a,v],sum+v);if(found)return found;}}return null;}const found=visit([],0);if(!found)throw Error('旧航路费用无法核对');return found;}
function preserveMarketQuota(next,before){if(next.market.quota.key&&next.market.quota.key===before.market.quota.key&&before.market.quota.used)next.market.quota.used=true;return next;}
function restore(raw){
 if(typeof raw==='string'&&raw.length>2000000)throw Error('存档过大');const s=typeof raw==='string'?JSON.parse(raw):clone(raw);if(!s||![1,2,3,4,5,6,7,SCHEMA].includes(s.schema))throw Error('版本不支持');
 if(s.schema===1){s.schema=2;s.version=VERSION;s.ledger=[];s.legs=inferLegs(s.depth,s.distance,s.lastLeg);s.flags=s.flags||{};for(const x of s.cargo||[]){const seen=s.archive?.find(y=>y.name===x.name);x.acquiredRun=x.contract?s.runNo:seen?.firstRun<s.runNo?seen.firstRun:0;if(x.name==='梦话行李箱')x.story='dream';}for(const r of s.route||[])r.extra=r.fuel-Math.max(LEG[s.depth],s.lastLeg+1);if(s.run){s.run.account=freshAccount(s.money);s.run.account.legacy=true;}if(s.event){if(!Object.hasOwn(EVENTS,s.event.id))throw Error('旧事件不支持');s.event={id:s.event.id,nonce:`${s.runNo}/${s.depth}`,context:{fuel:s.fuel,hull:s.hull,cargo:clone(s.cargo)}};}s.migration='v01-preserved-balance; unknown cargo origin protected; historical cash detail unavailable';}
 // Keep only known structural fields. Event effects and hidden outcome text never come from imports.
 if(s.event){if(Object.keys(s.event).some(k=>!['id','nonce','context'].includes(k))||Object.keys(s.event.context||{}).some(k=>!['fuel','hull','cargo','missionSlot'].includes(k)))throw Error('事件包含非模型字段');const e=s.event;s.event={id:e.id,nonce:e.nonce,context:{fuel:e.context?.fuel,hull:e.context?.hull,cargo:e.context?.cargo,...(e.context?.missionSlot!==undefined?{missionSlot:e.context.missionSlot}:{})}};}
 if(s.schema===2){
  validateCargo(s.cargo,s.runNo,true);const packed=Cargo.legacyPack(s.cargo);s.cargo=packed.items;s.cargoGrid={width:4,height:4,placements:packed.placements};
  if(s.event){validateCargo(s.event.context.cargo,s.runNo,true);s.event.context.cargo=s.event.context.cargo.map(x=>({...x,shapeId:'legacy'+x.size*4,shapeVersion:1}));}
  s.schema=3;s.migration=(s.migration?s.migration+'; ':'')+'v2-to-v3: original cargo and balances preserved in legacy transport packing';
 }
 if(s.schema===3){
  validateCargo(s.cargo,s.runNo,true);
  function oldItem(x){if(!integer(x.size,1,4)||!Object.hasOwn(Cargo.SHAPES,x.shapeId)||x.shapeVersion!==1||Cargo.area(x)!==x.size*4||x.cells!==undefined&&x.cells!==x.size*4)throw Error('旧货原包装面积无效');return{...x,cells:x.size*4};}
  const all=s.cargo.map(oldItem);if(all.reduce((n,x)=>n+x.size,0)>s.capacity)throw Error('旧货舱超出原容量');
  const valid=Cargo.validate(all,s.cargoGrid?.placements);if(!valid.ok)throw Error(valid.message);
  const mission=all.filter(x=>x.contract);if(mission.length>1)throw Error('重复记录箱');s.missionSlot=mission[0]||null;
  s.cargo=all.filter(x=>!x.contract);s.cargoGrid.placements=s.cargoGrid.placements.filter(p=>s.cargo.some(x=>x.uid===p.uid));
  if(s.event){validateCargo(s.event.context.cargo,s.runNo,true);const snapshot=s.event.context.cargo.map(oldItem),records=snapshot.filter(x=>x.contract);if(records.length>1)throw Error('事件任务记录重复');s.event.context.cargo=snapshot.filter(x=>!x.contract);s.event.context.missionSlot=records[0]||null;}
  for(const x of s.archive||[]){if(!integer(x.size,1,4))throw Error('旧见闻体积无效');x.cells=x.size*4;}
  for(const x of [...(s.result?.cargoChanges?.added||[]),...(s.result?.cargoChanges?.removed||[])]){if(!integer(x.size,1,4))throw Error('旧结果货物无效');x.cells=x.size*4;}
  s.schema=4;s.version=VERSION;s.migration=(s.migration?s.migration+'; ':'')+'v3-to-v4: original cargo areas retained, actual record box moved once to mission slot';
 }
 if(s.schema===4){s.fleet={ownedShipIds:['starter'],equippedShipId:'starter',cargoLevels:{starter:0}};s.missions=[];s.activeMissionId=null;s.nextMissionUid=1;s.voyageShip=s.run?{shipId:'starter',cargoLevel:0,fuelPercent:100,damagePercent:100}:null;
  const record=s.missionSlot;const active=['route','event','result'].includes(s.phase);if(active&&record&&s.run?.contractActive){s.missions.push({uid:s.nextMissionUid++,type:'survey',status:'active',acceptedRun:Math.max(0,s.runNo-1),targetRun:s.runNo,legacyAutoSettlement:true});s.activeMissionId=s.missions.at(-1).uid;}else if(s.run){s.missions.push({uid:s.nextMissionUid++,type:'survey',status:s.run.account.reward>=180?'claimed':'abandoned',acceptedRun:Math.max(0,s.runNo-1),targetRun:s.runNo,legacyAutoSettlement:true,...(s.run.account.reward>=180?{completedRun:s.runNo,claimedRun:s.runNo}:{})});}
  for(const x of [...s.cargo,...(s.event?.context?.cargo||[])])x.itemId=LEGACY_ITEM_IDS[x.name]||'metal_crate';s.schema=5;s.version=VERSION;s.migration=(s.migration?s.migration+'; ':'')+'v4-to-v5: original ships/tools/geometry/cash preserved; existing survey rights honored, new missions explicit';}
 if(s.schema===5){const f=s.fleet,previousHull=s.hull;f.fuelLevels={};f.hullLevels={};f.parked={};for(const id of f.ownedShipIds){f.fuelLevels[id]=0;f.hullLevels[id]=0;if(id!==f.equippedShipId)f.parked[id]={fuel:0,hull:PORT.ships[id].hullBase-(100-previousHull)};}s.hull=PORT.ships[f.equippedShipId].hullBase-(100-previousHull);if(s.event)s.event.context.hull+=PORT.ships[f.equippedShipId].hullBase-100;if(s.voyageShip){const v=s.voyageShip,c=PORT.ships[v.shipId];Object.assign(v,{fuelLevel:0,hullLevel:0,maxFuel:c.fuelBase,maxHull:c.hullBase});}s.schema=6;s.version=VERSION;s.migration=(s.migration?s.migration+'; ':'')+'v5-to-v6: active fuel/hull and all purchased rights retained; all owned hulls preserve original damage points under their new base capacities, fuel stays on active vessel; per-ship caps and stocks';}
 if(s.schema===6){
  s.schema=7;
  s.version=VERSION;
  s.hold={mode:'legacy',topologyVersion:Holds.version};
  s.discoveries={encounters:[],eggs:[],mementoClaimed:false};
  s.market=Market.create(s.rng);
  if(s.run){s.run.contentPoolVersion='v042';s.run.eggId=null;}
   s.pendingHoldTransition=true;
  s.migration=(s.migration?s.migration+'; ':'')+'v6-to-v7: old voyage pool and RNG retained, original rectangular cargo protected until a safe port repack; purchased capacities and all goods preserved';
 }
 if(s.schema===7) {
  s.schema=8;
  s.version=VERSION;
  s.progress=freshProgress();
  Market.migrate(s);
  if(s.run) Object.assign(s.run,{returnRules:{version:'v05',gateFuel:null},discovery:null,eggOccurrence:null});
  assertState(s);
  if(s.pendingHoldTransition) tryHoldTransition(s);
  delete s.pendingHoldTransition;
  s.migration=(s.migration?s.migration+'; ':'')+'v7-to-v8: saved voyage return rules preserved; new signals begin next departure; consumed market opportunity retained';
 }
 const keys=Object.keys(create(1)),out={};for(const k of keys)out[k]=s[k];if(s.migration)out.migration=s.migration;assertState(out);return out;
}
return {Holds,Market,NewEncounters,V05,V051,VERSION,SCHEMA,KEY,LEG,BALANCE,PORT,ITEM_IDS,Cargo,shipStats,shipResources,resourceCaps,resourceLimit,shipUpgradeQuote,shipComparison,cargoSpace,capacityCells,activeMission,missionProgress,cargoUpgradeQuote,supplyQuote,create,dispatch,restore,assertState,preserveMarketQuota,homeCost,returnQuotes,returnHint,safeReturnReserve,spare,used,cargoValue,quote,checkChoice,encounter,summaryView,portQuote,preparation,cargoDraft,routeView};

});
