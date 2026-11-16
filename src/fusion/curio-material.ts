/** Physical condition only: the saved found/clean/stabilized entitlement is unchanged. */
export type CurioCondition = 'found' | 'clean' | 'stabilized';
export type CurioState = {condition: CurioCondition; action?: {kind: 'clean' | 'repair'; startedAt: number; endsAt: number}};
export type MaterialPoint = {x: number; y: number};
type Path = readonly [MaterialPoint, MaterialPoint];
export type MaterialCurioId = 'tape' | 'bell';
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const ease = (value: number) => {const p = clamp(value);return p * p * (3 - 2 * p);};

const profiles: Record<string, {
  details: Record<CurioCondition, string>;
  clean: string; repair: string; cleaning: string; repairing: string;
}> = {
  receipt: {
    details: {found: '纸污遮字 · 折痕卷边 · 两处缺角', clean: '原字露出 · 翘角与缺口仍在', stabilized: '纤维压平 · 卷边舒展 · 原签收仍空白'},
    clean: '清理纸面', repair: '压平补纤维', cleaning: '沿纸纹清污', repairing: '承托翘角 · 压平补纤维',
  },
  tape: {
    details: {found: '粘灰结团 · 翘边 · 断头错位', clean: '粘面已净 · 断头仍分离翘起', stabilized: '断头对齐 · 胶边压合 · 自行吐带'},
    clean: '去粘灰', repair: '对齐断头', cleaning: '挑除粘灰 · 清扫胶边', repairing: '夹回断头 · 顺边压合',
  },
  nested: {
    details: {found: '纸屑卡缝 · 箱角压瘪 · 套层歪斜', clean: '箱缝已净 · 箱盖与内层仍错位', stabilized: '导向归正 · 箱角压稳 · 套层依次开合'},
    clean: '挑出卡纸', repair: '校正套层', cleaning: '挑纸屑 · 清箱缝', repairing: '扶正箱盖 · 压稳箱角',
  },
  stamp: {
    details: {found: '残墨结块 · 柄轴歪卡 · 铜沿氧化', clean: '原日期露出 · 柄轴与轴环仍卡住', stabilized: '柄轴回正 · 轴环归位 · 昨日依旧'},
    clean: '去残墨', repair: '校准柄轴', cleaning: '清印面 · 拭铜沿', repairing: '扶正柄轴 · 归位轴环',
  },
  'cosmic-parcel': {
    details: {found: '封带松脱 · 封签卷起 · 箱缝错位', clean: '原地址露出 · 封带与封签仍松', stabilized: '封带张紧 · 原签压平 · 箱缝回应'},
    clean: '清理封签', repair: '张紧封带', cleaning: '拭原签 · 清带缝', repairing: '张紧封带 · 固定原签',
  },
  bell: {
    details: {found: '铜沿锈蚀 · 顶杆卡住 · 固定件松脱', clean: '锈斑已除 · 顶杆仍卡住 · 固定件待归槽', stabilized: '顶杆复位 · 固定件归槽 · 轻按应答'},
    clean: '除锈', repair: '复位铃机构', cleaning: '沿铜沿除锈', repairing: '紧固归槽 · 复位顶杆',
  },
};
const fallback = {
  details: {found: '发现时的原件', clean: '表面已清理 · 结构待整理', stabilized: '结构已稳定 · 可以展示'},
  clean: '清理', repair: '整理结构', cleaning: '清理接触面', repairing: '整理连接处',
};

export function curioConditionPresentation(id: string, condition: CurioCondition) {
  return {label: ({found: '刚获得', clean: '清理后', stabilized: '升级完成'} as const)[condition], detail: (profiles[id] ?? fallback).details[condition]};
}
export function curioTreatmentLabels(id: string) {
  const {clean, repair, cleaning, repairing} = profiles[id] ?? fallback;
  return {clean, repair: '零件升级', cleaning: '清理中', repairing: '升级中'};
}
export function isMaterialCurio(id: string): id is MaterialCurioId {return id === 'tape' || id === 'bell';}

/** These measured paths are shared by the tool tip and the material erasure. */
export const curioMaterialRegistration = {
  size: 192,
  tape: {
    tail: [{x: 1,y: 154},{x: 14,y: 136},{x: 48,y: 124},{x: 76,y: 126},{x: 93,y: 137},{x: 73,y: 153},{x: 54,y: 160},{x: 45,y: 177},{x: 8,y: 176}],
    looseEnd: [{x: 0,y: 151},{x: 28,y: 135},{x: 45,y: 140},{x: 55,y: 152},{x: 45,y: 178},{x: 0,y: 177}],
    cleanPaths: [
      [{x: 20,y: 149},{x: 55,y: 143}], [{x: 57,y: 150},{x: 19,y: 159}],
      [{x: 15,y: 167},{x: 45,y: 160}], [{x: 57,y: 138},{x: 78,y: 130}],
      [{x: 133,y: 111},{x: 168,y: 111}], [{x: 168,y: 120},{x: 135,y: 123}],
      [{x: 130,y: 130},{x: 162,y: 130}], [{x: 50,y: 155},{x: 11,y: 172}],
    ] as Path[],
    repairContacts: [{x: 44,y: 155},{x: 66,y: 141}],
  },
  bell: {
    plunger: [{x: 58,y: 4},{x: 119,y: 4},{x: 120,y: 30},{x: 103,y: 40},{x: 103,y: 52},{x: 74,y: 54},{x: 74,y: 38},{x: 59,y: 29}],
    fastener: [{x: 106,y: 162},{x: 120,y: 162},{x: 120,y: 179},{x: 106,y: 179}],
    cleanPaths: [
      [{x: 69,y: 51},{x: 100,y: 56}], [{x: 104,y: 62},{x: 78,y: 65}],
      [{x: 24,y: 108},{x: 47,y: 125}], [{x: 43,y: 129},{x: 81,y: 135}],
      [{x: 85,y: 134},{x: 130,y: 129}], [{x: 138,y: 122},{x: 114,y: 116}],
      [{x: 137,y: 111},{x: 143,y: 135}], [{x: 108,y: 165},{x: 119,y: 175}],
    ] as Path[],
    repairContacts: [{x: 112,y: 169},{x: 87,y: 34}],
  },
} as const;

export function curioActionProgress(state: CurioState, now: number) {
  if (!state.action) return 0;
  const duration = state.action.endsAt - state.action.startedAt;
  return duration > 0 ? clamp((now - state.action.startedAt) / duration) : 1;
}

/** Pure motion metadata is also used by evidence capture, without creating a save. */
export function curioPhysicalFrame(id: MaterialCurioId, state: CurioState, now: number) {
  const progress = curioActionProgress(state, now);
  const cleaning = state.condition !== 'found' ? 1 : state.action?.kind === 'clean' ? progress : 0;
  const repairing = state.condition === 'stabilized' ? 1 : state.action?.kind === 'repair' ? progress : 0;
  const pass = Math.min(7, Math.floor(cleaning * 8));
  const local = cleaning >= 1 ? 1 : cleaning * 8 - pass;
  const paths = curioMaterialRegistration[id].cleanPaths;
  const [start, end] = paths[pass];
  const sweep = clamp(local / .72);
  let contact = {x: start.x + (end.x - start.x) * sweep,y: start.y + (end.y - start.y) * sweep};
  if (local > .72 && pass < 7) {
    const next = paths[pass + 1][0], transit = ease((local - .72) / .28);
    contact = {x: contact.x + (next.x - contact.x) * transit,y: contact.y + (next.y - contact.y) * transit};
  }
  const contacts = curioMaterialRegistration[id].repairContacts;
  const step = Math.min(contacts.length - 1, Math.floor(repairing * contacts.length));
  const repairLocal = repairing >= 1 ? 1 : repairing * contacts.length - step;
  // Each structural correction finishes while the matching tool is touching it.
  const first = ease((repairing * contacts.length - .23) / .44);
  const second = ease((repairing * contacts.length - 1.23) / .44);
  if(id==='tape'&&contact.x<55&&contact.y>140)contact=tapeLoosePoint(contact,first,second);
  return {progress, cleaning, repairing, pass, local, contact, step, repairLocal,
    repairContact: contacts[step], aligned: first, pressed: second,
    complete: state.condition === 'stabilized' || repairing === 1,
  };
}

function tapeLoosePoint(point:MaterialPoint, aligned:number, pressed:number){
  const loose=1-aligned,angle=-.24*loose+.075*(1-pressed),x=point.x-48,y=point.y-148;
  return {x:48-7*loose+x*Math.cos(angle)-y*Math.sin(angle),y:148+7*loose+x*Math.sin(angle)+y*Math.cos(angle)};
}

type Parts = {original: HTMLCanvasElement; body: HTMLCanvasElement; moving: HTMLCanvasElement; fastener?: HTMLCanvasElement; dust: HTMLCanvasElement; remaining: HTMLCanvasElement; movingDust: HTMLCanvasElement; bodyDust: HTMLCanvasElement};
const materialParts = new WeakMap<HTMLCanvasElement, {id: MaterialCurioId; parts: Parts}>();
const make = () => {const canvas = document.createElement('canvas');canvas.width = canvas.height = 192;return canvas;};

function cut(original: HTMLCanvasElement, polygon: readonly MaterialPoint[]) {
  const part = make(), c = part.getContext('2d')!;
  c.drawImage(original, 0, 0);c.globalCompositeOperation = 'destination-in';
  c.beginPath();polygon.forEach((p, i) => i ? c.lineTo(p.x,p.y) : c.moveTo(p.x,p.y));c.closePath();c.fill();
  return part;
}

function prepareParts(original: HTMLCanvasElement, id: MaterialCurioId) {
  const old = materialParts.get(original);
  if (old?.id === id) return old.parts;
  const moving = cut(original, id === 'tape' ? curioMaterialRegistration.tape.looseEnd : curioMaterialRegistration.bell.plunger);
  const body = make(), c = body.getContext('2d')!;c.drawImage(original,0,0);
  c.globalCompositeOperation = 'destination-out';c.drawImage(moving,0,0);
  const fastener = id === 'bell' ? cut(original, curioMaterialRegistration.bell.fastener) : undefined;
  if (fastener) c.drawImage(fastener,0,0);
  c.globalCompositeOperation = 'source-over';
  const parts = {original,body,moving,fastener,dust: make(),remaining: make(),movingDust:make(),bodyDust:make()};
  materialParts.set(original,{id,parts});return parts;
}

/** Only authored translucent dust/rust layers are accepted here, never a new specimen. */
export interface CurioMaterialLayers {dust?: HTMLImageElement}

function prepareDirt(parts: Parts, id: MaterialCurioId, layer?: HTMLImageElement) {
  const c = parts.dust.getContext('2d')!;c.clearRect(0,0,192,192);
  if (layer?.complete && layer.naturalWidth) c.drawImage(layer,0,0,192,192);
  else {
    // Fallback deposits are sampled individual grains on actual material, with
    // different distributions for adhesive fibres and oxidised copper.
    const source = parts.original.getContext('2d')!.getImageData(0,0,192,192);
    const result = c.createImageData(192,192);
    for (let y = 0;y < 192;y++) for (let x = 0;x < 192;x++) {
      const i = (y * 192 + x) * 4;if (source.data[i + 3] < 120) continue;
      const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const active = id === 'tape' ? (y > 136 && x < 79) || (y > 108 && y < 137 && x > 128)
        : (y > 109 && y < 139 && x > 18 && x < 145) || (y > 47 && y < 65 && x > 66 && x < 105);
      if (!active || seed % 11 > 7) continue;
      const color = id === 'tape' ? (seed % 3 ? [97,89,82] : [190,180,152]) : (seed % 3 ? [111,69,49] : [119,124,88]);
      result.data.set([...color,120 + seed % 113],i);
    }
    c.putImageData(result,0,0);
  }
  c.save();c.globalCompositeOperation = 'destination-in';c.drawImage(parts.original,0,0);c.restore();
}

function removeContactDirt(parts: Parts, id: MaterialCurioId, progress: number) {
  const c = parts.remaining.getContext('2d')!;c.clearRect(0,0,192,192);c.drawImage(parts.dust,0,0);
  c.save();c.globalCompositeOperation = 'destination-out';c.lineCap = 'round';c.lineWidth = id === 'tape' ? 25 : 24;
  curioMaterialRegistration[id].cleanPaths.forEach(([a,b],i) => {
    const amount = clamp((progress * 8 - i) / .72);if (!amount) return;
    c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x + (b.x-a.x)*amount,a.y+(b.y-a.y)*amount);c.stroke();
  });
  c.restore();
  // The final pass collects loose grains at the edge of the cleaned track.
  if (progress === 1) c.clearRect(0,0,192,192);
  if(id==='tape'){
    const moving=parts.movingDust.getContext('2d')!;moving.clearRect(0,0,192,192);moving.drawImage(parts.remaining,0,0);
    moving.save();moving.globalCompositeOperation='destination-in';moving.drawImage(parts.moving,0,0);moving.restore();
    const body=parts.bodyDust.getContext('2d')!;body.clearRect(0,0,192,192);body.drawImage(parts.remaining,0,0);
    body.save();body.globalCompositeOperation='destination-out';body.drawImage(parts.moving,0,0);body.restore();
  }
}

function displaced(c: CanvasRenderingContext2D, image: HTMLCanvasElement, pivot: MaterialPoint, dx: number, dy: number, angle: number) {
  c.save();c.translate(pivot.x+dx,pivot.y+dy);c.rotate(angle);c.translate(-pivot.x,-pivot.y);c.drawImage(image,0,0);c.restore();
}

const rigSource = new WeakMap<HTMLCanvasElement, {id: MaterialCurioId;original: HTMLCanvasElement;frame: ReturnType<typeof curioPhysicalFrame>;layers: CurioMaterialLayers}>();

export function paintCurioPhysicalMaterial(output: HTMLCanvasElement, original: HTMLCanvasElement, id: MaterialCurioId, state: CurioState, now: number, layers: CurioMaterialLayers = {}) {
  const parts = prepareParts(original,id), frame = curioPhysicalFrame(id,state,now);
  prepareDirt(parts,id,layers.dust);removeContactDirt(parts,id,frame.cleaning);
  const c = output.getContext('2d')!;c.clearRect(0,0,192,192);c.imageSmoothingEnabled = false;
  drawParts(c,parts,id,frame,layers,0,0,true);
  rigSource.set(output,{id,original,frame,layers});return frame;
}

function drawParts(c: CanvasRenderingContext2D, parts: Parts, id: MaterialCurioId, frame: ReturnType<typeof curioPhysicalFrame>, layers: CurioMaterialLayers, seconds: number, trial: number, reduced: boolean) {
  const active = trial > 0 && trial < 1 ? Math.sin(trial * Math.PI) : 0;
  const motion = reduced ? 0 : 1;
  c.drawImage(parts.body,0,0);
  if (id === 'tape') {
    // A real piece of the original torn end returns to the source silhouette.
    const loose = 1 - frame.aligned, curl = 1 - frame.pressed;
    const tipLoop = frame.complete ? (Math.sin(seconds*1.35)*.032 + active*.15)*motion : 0;
    displaced(c,parts.moving,{x: 48,y: 148},-7*loose,7*loose,-.24*loose + .075*curl + tipLoop);
    if (curl > .01) {
      c.save();c.beginPath();c.moveTo(48,144);c.lineTo(59,154);c.lineTo(53,162);c.lineTo(43,155);c.closePath();c.clip();
      c.globalAlpha = .45*curl;c.drawImage(parts.original,0,-2);c.restore();
    }
  } else {
    const stuck = 1 - frame.pressed;
    const press = frame.complete ? ((Math.sin(seconds*1.7)+1)*.6 + active*2.7)*motion : 0;
    displaced(c,parts.moving,{x: 87,y: 34},-3*stuck,4*stuck+press,-.12*stuck);
    if (parts.fastener) displaced(c,parts.fastener,{x: 112,y: 169},5*(1-frame.aligned),4*(1-frame.aligned),.42*(1-frame.aligned));
    if (frame.complete) {
      if(active>0){c.save();c.globalAlpha=active*.55;c.strokeStyle='#ead4a1';c.lineWidth=.8;
        for(let i=0;i<2;i++){const wave=(trial*2+i*.5)%1;c.beginPath();c.ellipse(83,132,23+wave*48,7+wave*12,0,0,Math.PI*2);c.stroke();}c.restore();}
    }
  }
  if(frame.cleaning<1){
    if(id==='tape'){
      c.drawImage(parts.bodyDust,0,0);
      displaced(c,parts.movingDust,{x:48,y:148},-7*(1-frame.aligned),7*(1-frame.aligned),-.24*(1-frame.aligned)+.075*(1-frame.pressed));
    }else c.drawImage(parts.remaining,0,0);
  }
}

/** Two contact planes keep the roll's rear foot and the forward loose end grounded. */
export function curioSupportContacts(id: MaterialCurioId,state:CurioState,now:number){
  if(id==='bell')return [{point:{x:96,y:185},radiusX:66,radiusY:3}];
  const frame=curioPhysicalFrame(id,state,now);
  return [
    {point:{x:128,y:147},radiusX:42,radiusY:3.2},
    {point:tapeLoosePoint({x:25,y:176},frame.aligned,frame.pressed),radiusX:20,radiusY:2.4},
  ];
}

/** Uses the exact prepared physical layers, with a local tip/plunger loop only. */
export function drawPhysicalCurioRig(c: CanvasRenderingContext2D, id: string, image: HTMLCanvasElement, seconds: number, trial: number, reduced = false, envelope = 1) {
  const source = rigSource.get(image);if (!source || source.id !== id) return false;
  const parts=prepareParts(source.original,source.id);
  drawParts(c,parts,source.id,source.frame,source.layers,seconds,trial*envelope,reduced||envelope<.01);return true;
}
