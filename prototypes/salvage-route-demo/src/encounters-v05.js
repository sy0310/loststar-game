/* Short encounters and discovered-only flavor. Effects use the existing transaction. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SalvageEncounters = api;
})(globalThis, function () {
  'use strict';
  const curios = {
    echo_brood_capsule: { name: '回声孵囊', cells: 4, shapeId: 'square4', value: 85 },
    hull_clinger: { name: '吸舱幼体', cells: 3, shapeId: 'ell3', value: 75 },
    time_measure: { name: '折时计量盒', cells: 2, shapeId: 'line2', value: 65 },
    gravity_faceter: { name: '引力折面器', cells: 4, shapeId: 'tee4', value: 95 }
  };
  const metadata = {
    comet_label: ['彗星快递标签', '快递标签回波', '低', 1, 4],
    ring_sampler: ['行星环采样器', '环带微粒回波', '低—中', 1, 5],
    silent_fuel: ['无声补给机', '自动补给频段', '低', 1, 6],
    drifting_cup: ['漂流咖啡杯', '客舱弱重力信号', '低', 1, 4],
    frozen_freight: ['冰封转运柜', '低温货柜回波', '中', 2, 7],
    reverse_beacon: ['反向航标', '方向相反的航标', '中', 2, 6],
    lost_probe: ['失联探测球', '失联探测器应答', '低—中', 2, 7],
    magnetic_blind: ['磁暴盲区', '磁场遮蔽信号', '中', 2, 7],
    backwards_clock: ['倒走的时钟', '错位计时信号', '低', 2, 8],
    orbital_archive_vendor: ['轨道档案售货员', '档案交易频段', '低', 2, 8],
    darkside_signal: ['背光信标', '背光闪烁信号', '中', 3, 8, true],
    foldback_marker: ['折返标记', '偏移的导航记录', '低—中', 3, 8, true]
  };

  function factories({ item, option, resourceLimit, depthValuePerCell }) {
    const leave = () => option('leave', '继续航行', '保留现有资源', {});
    const curio = (id, depth) => ({ ...curios[id], value: curios[id].value + depth * 8, itemId: id, shapeVersion: 1 });
    const sample = (name, value, cells = 1, shape) => ({ ...item(name, value, cells, null, shape), itemId: 'sample' });
    const events = {
      comet_label: s => ({
        title: '彗星快递标签', kind: 'wreck',
        text: '标签绕着空箱转圈。派送状态写着“正在原地赶来”。',
        choices: [option('take', '收下彗星邮戳', '1格 · 可出售', { loot: [sample('彗星邮戳', 32 + s.depth * 6)] }), option('scrap', '回收标签金属', '直接取得20零件', { money: 20 }), leave()]
      }),
      ring_sampler: s => ({
        title: '行星环采样器', kind: 'wreck',
        text: '两颗晶粒仍在采样钳里打转。说明书提醒你“请勿把整条环带装进口袋”。',
        choices: [option('sample', '带走两份微粒', '消耗3探索油 · 1＋2格', { fuel: -3, loot: [sample('环带晶粒', 24 + s.depth * 5), { ...item('已找回的信标', 35 + s.depth * 7, 2), name: '环带记录模块' }] }), option('read', '只出售采样数据', '取得24零件', { money: 24 }), leave()]
      }),
      silent_fuel: s => {
        const fuel = Math.min(20, resourceLimit(s, 'fuel') - s.fuel);
        const hull = Math.min(18, resourceLimit(s, 'hull') - s.hull);
        return {
          title: '无声补给机', kind: 'station', text: '机器没有扬声器，只有一张“谢谢惠顾”的小纸。纸上的感叹号已经磨平。',
          choices: [option('fuel', '补充燃料', '+' + fuel + '燃料 · ' + fuel * 2 + '零件', { money: -fuel * 2, fuel }, { blocked: fuel ? null : '燃料已满' }), option('repair', '修复船壳', '+' + hull + '耐久 · ' + hull * 2 + '零件', { money: -hull * 2, hull }, { blocked: hull ? null : '船体完好' }), leave()]
        };
      },
      drifting_cup: s => ({
        title: '漂流咖啡杯', kind: 'cabin', text: '杯子里没有咖啡，只有一颗拒绝落底的晶粒。咔哒决定把它登记为杯底意见。',
        choices: [option('take', '收下杯底晶粒', '1格 · 可出售', { loot: [sample('不落底的晶粒', 36 + s.depth * 6)] }), option('leave', '记下这个现象', '留下一条航记', {}, { out: '杯子继续空着，晶粒继续坚持。你留下了这条观察。' })]
      }),
      frozen_freight: s => ({
        title: '冰封转运柜', kind: 'wreck', text: '柜内的矿壳一明一暗，像在等回声。安全封条仍然完整。',
        choices: [option('small', '拆下外侧小件', '消耗3探索油 · 1＋2格', { fuel: -3, loot: [item('绝缘端帽', 30, 1), item('散落接头', 38 + s.depth * 6, 2)] }), option('capsule', '封存矿质孵囊', '可能损失8–14耐久 · 4格', { loot: [curio('echo_brood_capsule', s.depth)] }, { risk: [8, 14], out: '封存箱扣好，呼吸孔的光环仍在缓缓收缩。' }), leave()]
      }),
      reverse_beacon: s => ({
        title: '反向航标', kind: 'anomaly', text: '箭头指着来路，底座却写着“前方”。一组金属折面把光线送回了自己。',
        choices: [option('recover', '固定引力折面器', '消耗4探索油 · T形4格', { fuel: -4, loot: [curio('gravity_faceter', s.depth)] }), option('record', '出售方向校核记录', '取得28零件', { money: 28 }), leave()]
      }),
      lost_probe: s => ({
        title: '失联探测球', kind: 'cabin', text: '探测球终于接通了自己的留言信箱。第一条留言是“别再撞到自己”。',
        choices: [option('chip', '拆下导航电路', '2格 · 可出售', { loot: [{ ...item('已找回的信标', 52 + s.depth * 9, 2), name: '探测球电路' }] }), option('data', '出售已读数据', '取得26零件', { money: 26 }), leave()]
      }),
      magnetic_blind: s => ({
        title: '磁暴盲区', kind: 'anomaly', text: '一只封存样本匣贴在残板背面，六片短肢正有节奏地吸住玻璃。警告灯只写了“有点黏”。',
        choices: [option('sample', '带走吸舱幼体样本', '可能损失8–16耐久 · L形3格', { loot: [curio('hull_clinger', s.depth)] }, { risk: [8, 16], out: '样本匣进入货舱。它把玻璃擦出了六枚小圆印。' }), option('detour', '绕开并记录磁场', '消耗2探索油 · 取得24零件', { fuel: -2, money: 24 }), leave()]
      }),
      backwards_clock: s => ({
        title: '倒走的时钟', kind: 'anomaly', text: '两根秒针各走各的，玻璃陀螺却保持平衡。铭牌提醒“请以实际到达为准”。',
        choices: [option('take', '收下折时计量盒', '消耗2探索油 · 2格', { fuel: -2, loot: [curio('time_measure', s.depth)] }), option('record', '出售时差读数', '取得25零件', { money: 25 }), leave()]
      }),
      orbital_archive_vendor: s => {
        const good = s.cargo.filter(x => !x.contract).sort((a, b) => b.value - a.value)[0];
        return {
          title: '轨道档案售货员', kind: 'station', text: '自动售货员将收款口擦得很亮。它的营业时间是“还没关”。',
          choices: [option('patch', '买一卷修补用品', '花35零件 · 1格', { money: -35, loot: [item('船用修补卷', 55, 1, 'patch')] }), option('sell', '卖掉一件已有货物', good ? good.name + ' · ' + good.value + '零件' : '没有可售货物', { money: good?.value || 0, remove: good?.uid }, { blocked: good ? null : '没有可售货物' }), leave()]
        };
      },
      darkside_signal: s => ({
        title: '背光信标', kind: 'anomaly', text: '灯在背光面闪了一下。矿质外壳里，一颗晶粒跟着亮了一下。',
        choices: [option('sample', '封存回声样本', '消耗4探索油 · 4格', { fuel: -4, loot: [curio('echo_brood_capsule', s.depth)] }), option('record', '保存并出售信号副本', '取得42零件', { money: 42 }), leave()]
      }),
      foldback_marker: () => ({
        title: '折返标记', kind: 'anomaly', text: '导航盘保存着一条反复涂改的归航线。咔哒把它记在纸上，暂时仍按实际油量返港。',
        choices: [option('record', '记下偏移坐标', '保存本次观察', {}, { out: '偏移记录已保存。现有返港预算保持实际读数。' }), leave()]
      })
    };
    return Object.fromEntries(Object.entries(events).map(([id, create]) => [id, state => {
      const event = create(state);
      const depthBonus = Math.max(0, state.depth - 3) * depthValuePerCell;
      if (depthBonus && id !== 'orbital_archive_vendor') {
        for (const choice of event.choices) {
          if (choice.effect.loot) choice.effect.loot = choice.effect.loot.map(item => ({ ...item, value: item.value + item.cells * depthBonus }));
        }
      }
      return event;
    }]));
  }

  const eggs = {
    early_signal: '“这趟航行已记录归港。”咔哒看了眼舷窗：“可我们还在途中呀。”',
    unmapped_blank: '星星绕开了一片空白。扫描仪把它标为“暂不命名”。',
    reverse_droplet: '水珠向上坠了两秒。咔哒把原因记为“杯子态度不好”。',
    empty_passenger: '空座上的票写着“乘客预计在你离开后抵达”。',
    following_light: '左后方的灯跟了三次转向。你闪了闪船灯，它熄了。',
    shifting_coordinates: '老导航盘上的字挪了一格，像是在给归航线让座。'
  };

  function eggCandidates(state) {
    const id = state.event.id;
    const candidates = [];
    if (['comet_label', 'lost_probe', 'beacon', 'backwards_clock'].includes(id)) candidates.push('early_signal');
    if (['mirror', 'reverse_beacon', 'darkside_signal'].includes(id)) candidates.push('unmapped_blank');
    if (state.depth >= 2 && ['magnetic_blind', 'workshop', 'ring_sampler'].includes(id)) candidates.push('reverse_droplet');
    if (['cabin', 'drifting_cup', 'luggage'].includes(id)) candidates.push('empty_passenger');
    if (state.depth >= 3) candidates.push('following_light');
    if (state.depth >= 3 && id === 'foldback_marker' && !state.discoveries.mementoClaimed) candidates.push('shifting_coordinates');
    return candidates.filter(key => !state.discoveries.eggs.some(seen => seen.id === key));
  }

  return { curios, metadata, factories, eggs, eggCandidates };
});
