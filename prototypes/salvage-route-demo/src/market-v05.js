/* Local fictional-NPC quotes. Only the engine's saved transaction calls mutations. */
(function (root, factory) {
  const config = typeof module === 'object' && module.exports
    ? require('../../../design/star-salvage/v05/BALANCE_V05.json')
    : root.LostCargoV05Balance;
  const api = factory(config.market);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SalvageMarket = api;
})(globalThis, function (config) {
  'use strict';
  const curioIds = ['echo_brood_capsule', 'hull_clinger', 'time_measure', 'gravity_faceter'];
  const npcNames = ['灯塔研究员', '旧件收购员', '轨道收藏家'];

  function create(seed) {
    return { rng: ((seed >>> 0) ^ 0x75ac981b) >>> 0 || 1, nextId: 1, offers: [], quota: {returnRun:0,key:null,used:true} };
  }
  function returnKey(record) {
    return [record.run,record.seq,record.depth,record.fuel,record.hull,record.money,record.rng??0].join('/');
  }
  function safeReturn(state) {
    const record=state.telemetry.at(-1);
    if(record?.kind!=='return'||record.rescue||!record.depth) throw Error('特殊交易机会缺少真实归航');
    state.market.quota={returnRun:state.runNo,key:returnKey(record),used:false};
  }
  function migrate(state) {
    const record=[...state.telemetry].reverse().find(row=>row.kind==='return'&&!row.rescue&&row.depth>0);
    let returnRun=record?.run??0;
    let key=record?returnKey(record):null;
    if(!record&&state.summary&&!state.summary.rescue&&state.summary.depth>0) {
      returnRun=state.summary.run;
      key=['legacy',returnRun,state.summary.depth,state.summary.distance,state.run?.startFuel,state.run?.startMoney].join('/');
    }
    const used=!returnRun||state.market.offers.some(offer=>offer.run>=returnRun);
    state.market.quota={returnRun,key,used};
  }
  function available(state) {
    return state.phase==='port'&&state.market.quota.returnRun>0&&!state.market.quota.used;
  }
  function random(market, max) {
    let value = market.rng >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    market.rng = value >>> 0 || 1;
    return market.rng % max;
  }
  function offerFor(state, uid) {
    return state.market.offers.find(offer => offer.uid === uid) || null;
  }
  function listingFee(item) {
    return Math.min(config.auctionFeeCap, Math.ceil(item.value * config.auctionFeePercent / 100));
  }
  function request(state, action, payFee) {
    if (state.phase !== 'port') return '请先回港';
    const item = state.cargo.find(item => item.uid === action.uid && !item.contract);
    if (!item) return '物件已不在货舱';
    if (offerFor(state, item.uid)) return '这件物品已经询过价，原报价已保存';
    if(!available(state)) return state.market.quota.returnRun?'本趟特殊交易机会已使用，请等待下一趟安全归航':'安全归航后获得一次特殊交易机会';
    if (!['cautious', 'bold', 'auction'].includes(action.style)) return '请选择一次谈价或NPC快拍';
    const isAuction = action.style === 'auction';
    if (isAuction && !config.reservePercent.includes(action.reservePercent)) return '底价无效';
    const fee = isAuction ? listingFee(item) : 0;
    if (state.money < fee) return '零件不足以支付挂牌费';

    const percentages = isAuction ? config.auctionPercent : config[action.style + 'Percent'];
    const interest = isAuction && curioIds.includes(item.itemId) ? config.curioInterestPercent : 0;
    const percent = percentages[random(state.market, percentages.length)] + interest;
    const amount = Math.floor(item.value * percent / 100);
    const reserve = isAuction ? Math.ceil(item.value * action.reservePercent / 100) : 0;
    const bids = isAuction ? npcNames.map((name, index) => ({
      name,
      amount: index === 2 ? amount : Math.max(0, amount - Math.ceil(item.value * (2 - index) * (3 + random(state.market, 4)) / 100))
    })) : [];
    const offer = {
      id: state.market.nextId++, uid: item.uid, run: state.runNo, style: action.style,
      baseValue: item.value, amount, fee, reserve, bids, returnKey:state.market.quota.key,
      status: isAuction && amount < reserve ? 'noSale' : 'open'
    };
    if (fee) payFee(fee, offer.id);
    state.market.offers.push(offer);
    state.market.quota.used=true;
    return null;
  }
  function accept(state, id, sell) {
    if (state.phase !== 'port') return '请先回港';
    const offer = state.market.offers.find(offer => offer.id === id);
    if (!offer || offer.status !== 'open') return '报价已结束或已经结算';
    const item = state.cargo.find(item => item.uid === offer.uid && !item.contract);
    if (!item || item.value !== offer.baseValue) return '物件已变化，不能成交';
    sell(item, offer.amount, offer.id);
    offer.status = 'sold';
    return null;
  }
  function keep(state, id) {
    if (state.phase !== 'port') return '请先回港';
    const offer = state.market.offers.find(offer => offer.id === id);
    if (!offer || !['open', 'noSale'].includes(offer.status)) return '报价已结束';
    offer.status = 'kept';
    return null;
  }
  function prune(state) {
    for (const offer of state.market.offers) {
      if (['open', 'noSale', 'kept'].includes(offer.status) && !state.cargo.some(item => item.uid === offer.uid)) offer.status = 'void';
    }
    // Keep every still-carried UID, preserving its lifetime one-attempt rule.
    const recent = new Set(state.market.offers.slice(-150).map(offer => offer.id));
    state.market.offers = state.market.offers.filter(offer => recent.has(offer.id) || state.cargo.some(item => item.uid === offer.uid));
  }
  function validate(state) {
    const market = state.market;
    const integer = (value, min = 0, max = 1e9) => Number.isSafeInteger(value) && value >= min && value <= max;
    if (!market || !integer(market.rng, 1, 4294967295) || !integer(market.nextId, 1) || !Array.isArray(market.offers) || market.offers.length > 180) throw Error('黑市记录无效');
    const quota=market.quota;
    if(!quota||!integer(quota.returnRun,0,state.runNo)||typeof quota.used!=='boolean'||
      (quota.returnRun===0?quota.key!==null:typeof quota.key!=='string'||!quota.key.length||quota.key.length>200)||!quota.returnRun&&!quota.used) throw Error('特殊交易机会无效');
    const witness=[...state.telemetry].reverse().find(row=>row.kind==='return'&&!row.rescue&&row.depth>0);
    if(witness&&(quota.returnRun!==witness.run||quota.key!==returnKey(witness))) throw Error('特殊交易机会缺少对应归航');
    if(!quota.used&&market.offers.some(offer=>offer.returnKey===undefined&&offer.run>=quota.returnRun)) throw Error('旧报价已消耗特殊交易机会');
    const quotaKeys=new Set();
    for(const offer of market.offers) if(offer.returnKey!==undefined) {
      if(typeof offer.returnKey!=='string'||!offer.returnKey.length||quotaKeys.has(offer.returnKey)) throw Error('同次归航特殊交易重复');
      quotaKeys.add(offer.returnKey);
      if(offer.returnKey===quota.key&&!quota.used) throw Error('已报价的机会不能重置');
    }
    const ids = new Set();
    const uids = new Set();
    for (const offer of market.offers) {
      if (!offer || !integer(offer.id, 1, market.nextId - 1) || !integer(offer.uid, 1, state.nextUid - 1) || ids.has(offer.id) || uids.has(offer.uid) ||
          !integer(offer.run, 0, state.runNo) || !['cautious', 'bold', 'auction'].includes(offer.style) || !['open', 'noSale', 'sold', 'void', 'kept'].includes(offer.status) ||
          !integer(offer.baseValue) || !integer(offer.amount, 0, Math.floor(offer.baseValue * 1.4)) || !integer(offer.fee, 0, 5) || !integer(offer.reserve, 0, Math.ceil(offer.baseValue * 1.1)) || !Array.isArray(offer.bids)) throw Error('黑市报价无效');
      if (offer.style === 'auction') {
        if (offer.bids.length !== 3 || offer.fee !== Math.min(5, Math.ceil(offer.baseValue * config.auctionFeePercent / 100)) ||
            offer.bids.some((bid, index) => bid.name !== npcNames[index] || !integer(bid.amount, 0, offer.amount)) || offer.bids[2].amount !== offer.amount ||
            offer.status === 'open' && offer.amount < offer.reserve) throw Error('NPC快拍账目无效');
      } else if (offer.bids.length || offer.fee || offer.reserve || offer.status === 'noSale') throw Error('谈价账目无效');
      const item = state.cargo.find(item => item.uid === offer.uid);
      if (['open', 'noSale', 'kept'].includes(offer.status) && (!item || item.value !== offer.baseValue)) throw Error('报价与实际货物不符');
      ids.add(offer.id);
      uids.add(offer.uid);
    }
  }
  return { create, safeReturn, migrate, available, request, accept, keep, prune, validate, offerFor, listingFee, npcNames };
});
