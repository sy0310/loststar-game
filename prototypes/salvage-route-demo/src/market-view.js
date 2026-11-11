(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

  function render(state, selectedUid, disabled) {
    const E = root.LostCargo;
    const goods = state.cargo.filter(item => !item.contract);
    const selected = goods.find(item => item.uid === selectedUid) || [...goods].sort((a, b) => b.value - a.value)[0];
    const back = '<button class="full" data-act="shop">返回商店</button>';
    const quota=state.market.quota;
    const quotaText=quota.returnRun?'本趟特殊交易：'+(quota.used?'已使用':'剩余1次'):'安全归航后获得1次特殊交易';
    const heading = '<div class="section-head"><h1>港口黑市</h1><span class="tag">虚构NPC · 即时报价</span></div><p class="market-quota" role="status">'+quotaText+'</p>';
    if (!selected) return heading + '<section class="panel"><p>货舱里没有待售物品。</p></section>' + back;
    const offer = E.Market.offerFor(state, selected.uid);
    const fee = E.Market.listingFee(selected);
    const cautiousMax = Math.max(...E.V05.market.cautiousPercent) - 100;
    const boldMax = Math.max(...E.V05.market.boldPercent) - 100;
    const block = disabled || state.phase !== 'port' ? ' disabled' : '';
    let interaction;
    if(!offer&&!E.Market.available(state)) {
      interaction='<p class="note">'+(quota.returnRun?'本趟机会已使用，下一次安全归航后恢复。':'先完成一趟航行并安全归港。')+'其他货物可按普通价出售。</p>';
    } else if (!offer) {
      interaction = '<p class="note">本趟只能选一件谈价或快拍，报价会保存。低价留货也消耗机会。</p>' +
        '<div class="split"><button data-market-style="cautious" data-market-uid="'+selected.uid+'"'+block+'>谨慎开价<br><small>争取 +'+cautiousMax+'%</small></button>' +
        '<button data-market-style="bold" data-market-uid="'+selected.uid+'"'+block+'>大胆开价<br><small>争取 +'+boldMax+'%</small></button></div>' +
        '<div class="market-auction"><h2>NPC快拍</h2><p>挂牌费 '+fee+' 零件，确认开始时收取。</p><div class="split">' +
        '<button data-market-style="auction" data-market-reserve="100" data-market-uid="'+selected.uid+'"'+(block || (state.money < fee ? ' disabled' : ''))+'>底价 '+selected.value+'</button>' +
        '<button data-market-style="auction" data-market-reserve="110" data-market-uid="'+selected.uid+'"'+(block || (state.money < fee ? ' disabled' : ''))+'>底价 '+Math.ceil(selected.value*1.1)+'</button></div></div>';
    } else {
      const auction = offer.style === 'auction';
      const bids = auction ? '<ol class="npc-bids">' + offer.bids.map(bid => '<li><span>'+esc(bid.name)+'</span><b>'+bid.amount+'</b></li>').join('') + '</ol>' : '';
      const status = { open: '报价已保存', noSale: '未达底价 · 流拍', kept: '已选择留货', sold: '已成交', void: '报价已失效' }[offer.status];
      interaction = '<section class="market-quote" aria-live="polite"><h2>'+status+'</h2>'+bids+'<p>'+(auction?'最高出价':'对方还价')+' <strong>'+offer.amount+' 零件</strong></p>' +
        (auction?'<p class="note">底价 '+offer.reserve+' · 已付挂牌费 '+offer.fee+'</p>':'') +
        (offer.status==='open'?'<div class="split"><button class="primary" data-market-accept="'+offer.id+'"'+block+'>接受 · '+offer.amount+'</button><button data-market-keep="'+offer.id+'"'+block+'>保留物品</button></div>':
         offer.status==='noSale'?'<button data-market-keep="'+offer.id+'"'+block+'>保留物品</button>':'') + '</section>';
    }
    return heading + '<div class="market-goods" aria-label="选择待售物品">' + goods.map(item => '<button data-market-select="'+item.uid+'" aria-pressed="'+(item.uid===selected.uid)+'">'+root.SalvageArt.item(item)+'<span>'+esc(item.name)+'</span></button>').join('') + '</div>' +
      '<section class="panel market-item"><div class="market-item-heading">'+root.SalvageArt.item(selected)+'<div><h2>'+esc(selected.name)+'</h2><p>'+selected.cells+'格 · 普通售价 '+selected.value+' 零件</p></div></div>' + interaction + '</section>' +
      '<button class="full" data-market-sell="'+selected.uid+'"'+block+'>按普通价卖出 · '+selected.value+'</button>' + back;
  }
  root.SalvageMarketView = { render };
})(window);
