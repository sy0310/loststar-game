import backUrl from '../../assets/runtime/refinement/sorting-machine-back.webp';
import frontUrl from '../../assets/runtime/refinement/sorting-machine-front.webp';
import rollersUrl from '../../assets/runtime/refinement/sorting-rollers.webp';
import flap0Url from '../../assets/runtime/refinement/sorting-curtain-0.webp';
import flap1Url from '../../assets/runtime/refinement/sorting-curtain-1.webp';
import flap2Url from '../../assets/runtime/refinement/sorting-curtain-2.webp';
import jamUrl from '../../assets/runtime/refinement/sorting-paper-jam.webp';
import tapeUrl from '../../assets/runtime/tape.webp';
import {drawTapeBridge} from './curio-ability-rig';
import type {FusionSave} from './contracts';
import {refinementView} from './progression';
import {fusionCycleFraction} from './render-clock';
import {tuning} from '../game/engine';
import {robotScannerPoint, type robotPose} from '../render/motion';
import type {SceneEntity, SceneFrame} from '../render/scene';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {const t = clamp(value);return t * t * (3 - 2 * t);};
const anchor = {x: 410, y: 315};
const scale = 148 / 320;
const origin = {x: anchor.x - 116 * scale, y: anchor.y - 279 * scale};
const point = (x: number, y: number) => ({x: origin.x + x * scale, y: origin.y + y * scale});
const labels = {P03: point(87, 166), P30: point(213, 118)};
const mouth = point(90, 205);
const feet = [[52,259],[116,279],[194,249],[259,219]];
const flapPivots = [[114,144],[133,148],[153,152]];
const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();image.onload = () => resolve(image);image.onerror = reject;image.src = url;
});

type Pose = ReturnType<typeof robotPose>;
/** Registered machine parts share one ground contact and the existing core work clock. */
export function createSortingScene(getFusion?: () => FusionSave) {
  let art: HTMLImageElement[] = [];
  const ready = Promise.all([backUrl,frontUrl,rollersUrl,flap0Url,flap1Url,flap2Url,jamUrl,tapeUrl].map(load)).then(images => {art = images;});
  const belt = document.createElement('canvas');belt.width = 128;belt.height = 96;
  const beltContext = belt.getContext('2d')!;
  let offset = {x: 0, y: 0};
  let lastPoseAt = 0;
  const view = () => getFusion ? refinementView(getFusion()).sorting : undefined;
  const active = () => {const state = view();return !!state && (['surveying','building','working'].includes(state.phase) || !!state.researchActive);};
  function clock(frame: SceneFrame) {
    const state = getFusion!();
    const sorting = refinementView(state).sorting;
    const projected = frame.environment.period === 'night' ? 0
      : Math.max(0, fusionCycleFraction(state.game, Date.now()) - state.game.cycleMs / tuning(state.game).scanner);
    return (sorting.researchActive?.workDone ?? sorting.workDone) + projected;
  }
  function target() {
    const sorting = view();
    const study = sorting?.researchActive;
    if (study?.id === 'paper-fibres') return point(234,155);
    if (study?.id === 'label-orientation') return study.workDone < 1 ? labels.P03 : labels.P30;
    if (sorting?.stage === 'verify') return labels.P30;
    if (sorting?.phase === 'surveying') return labels.P03;
    return {x: mouth.x + 7, y: mouth.y - 3};
  }
  function pose(base: Pose, fraction: number, night: boolean): Pose {
    const now = performance.now();
    const delta = lastPoseAt ? Math.min(.05, (now - lastPoseAt) / 1000) : 0;
    lastPoseAt = now;
    const sorting = view();
    const envelope = smooth((fraction - .16) / .14) * (1 - smooth((fraction - .64) / .20));
    const study = sorting?.researchActive;
    const sideScan = sorting?.stage === 'verify' || study?.id === 'paper-fibres'
      || study?.id === 'label-orientation' && study.workDone >= 1;
    const stance = sideScan ? {x:35,y:-30} : {x:-34,y:-19};
    const desired = active() && !night ? {x:stance.x * envelope,y:stance.y * envelope} : {x:0,y:0};
    const distance = Math.hypot(desired.x - offset.x, desired.y - offset.y);
    const blend = distance > 0 ? Math.min(1, delta * 110 / distance) : 1;
    offset = {x: offset.x + (desired.x - offset.x) * blend, y: offset.y + (desired.y - offset.y) * blend};
    if (!sorting) return base;
    const result = {...base, x: base.x + offset.x, y: base.y + offset.y, parcel: {...base.parcel}};
    if (night || !active()) return result;
    if (study) {
      result.parcel = {...result.parcel,...target(),visible:false,held:false};
      result.carrying = false;
      if (base.action === 'scan' || base.action === 'pickup') result.action = distance > 3 ? 'walk' : 'scan';
      return result;
    }
    if (base.action === 'scan') result.parcel = {...result.parcel, ...target(), visible: false};
    else if (base.action === 'pickup') {
      const pickup = {x: mouth.x + 8, y: mouth.y + 4};
      const hand = {x: result.x - 22, y: result.y - 28};
      result.parcel = {...result.parcel, x: pickup.x + (hand.x - pickup.x) * base.lift,
        y: pickup.y + (hand.y - pickup.y) * base.lift};
    } else if (base.action === 'return') {
      result.parcel.x += offset.x;result.parcel.y += offset.y;
    }
    return result;
  }
  function machine(context: CanvasRenderingContext2D, frame: SceneFrame) {
    const sorting = view()!;
    const moving = ['day','dusk'].includes(frame.environment.period) && active()
      && (!sorting.researchActive || sorting.researchActive.id === 'belt-direction');
    const work = clock(frame);
    const rotation = moving ? work * 24 : Math.floor(work * 24);
    context.save();context.translate(origin.x, origin.y);context.scale(scale, scale);
    context.fillStyle = '#302736b0';
    for (const [x,y] of feet) {context.beginPath();context.ellipse(x,y + 1,14,4,0,0,Math.PI*2);context.fill();}
    context.drawImage(art[0],0,0);
    // The original belt pixels were removed from the rear shell. Each anchored
    // roller rotates within its own strip, then the complete plane is projected.
    beltContext.clearRect(0,0,128,96);beltContext.imageSmoothingEnabled = false;
    for (let roller = 0; roller < 8; roller++) {
      const top = roller * 12, shift = Math.floor(rotation % 12);
      beltContext.drawImage(art[2],0,top,128,12,0,top - shift,128,12);
      if (shift) beltContext.drawImage(art[2],0,top,128,12,0,top + 12 - shift,128,12);
    }
    context.save();
    context.transform(57/128,19/128,60/96,-36/96,43,213);
    context.drawImage(belt,0,0);context.restore();
    context.fillStyle = '#332b3d';context.beginPath();context.moveTo(104,140);context.lineTo(164,154);
    context.lineTo(161,194);context.lineTo(103,176);context.closePath();context.fill();
    for (let index = 0; index < 3; index++) {
      const [x,y] = flapPivots[index];
      const angle = moving ? Math.sin(rotation * .6 - index * .8) * .12 : 0;
      context.save();context.translate(x,y);context.rotate(angle);context.translate(-x,-y);
      context.drawImage(art[3 + index],0,0);context.restore();
    }
    if (sorting.phase === 'observed' || sorting.phase === 'surveying') {
      context.fillStyle = '#81664e66';context.fillRect(178,127,29,7);context.fillRect(218,169,25,5);
    }
    const built = sorting.phase === 'building' ? sorting.stageProgress : ['ready','working','cleared'].includes(sorting.phase) ? 1 : 0;
    if (built > 0) {
      // New braced feet and clamped hose are installed at the registered body.
      const count = Math.ceil(built * 3);
      for (let index = 0; index < count; index++) {
        const x = 176 + index * 23;
        context.fillStyle = '#443447';context.fillRect(x,219 - index * 8,11,26);
        context.fillStyle = '#ab865e';context.fillRect(x+2,219-index*8,6,24);
        context.fillStyle = '#e5bc80';context.fillRect(x+2,219-index*8,3,2);
      }
      context.strokeStyle = '#3f3549';context.lineWidth = 9;context.beginPath();context.moveTo(209,195);context.lineTo(238,188);context.lineTo(243,168);context.stroke();
      context.strokeStyle = '#b79565';context.lineWidth = 5;context.stroke();
      context.fillStyle = '#78c5b2';context.fillRect(239,165,7,4);
    }
    const tapeLevel = getFusion!().progression.sorting.buildTapeLevel;
    if (built > .66 && tapeLevel > 0) {
      drawTapeBridge(context,art[7],[{x:222,y:176},{x:239,y:181},{x:248,y:190},{x:238,y:199},{x:220,y:194}],1,9);
      if (tapeLevel === 2) drawTapeBridge(context,art[7],
        [{x:122,y:219},{x:142,y:223},{x:155,y:220},{x:162,y:211},{x:155,y:206}],1,9);
    }
    for (const code of ['P03','P30'] as const) {
      const fact = sorting.sourceFacts.find(item => item.kind === 'label' && item.code === code);
      if (!fact) continue;
      const native = code === 'P03' ? {x:87,y:166} : {x:213,y:118};
      context.save();context.translate(native.x,native.y);if (fact.orientation === 'inverted') context.rotate(Math.PI);
      context.fillStyle = '#443448';context.fillRect(-23,-10,46,20);
      context.fillStyle = '#e5c792';context.fillRect(-21,-9,42,16);
      context.fillStyle = '#5c414a';context.font = 'bold 13px monospace';context.textAlign = 'center';context.fillText(code,0,3);
      context.fillStyle = '#a88666';context.fillRect(-19,6,37,2);context.restore();
    }
    if (sorting.phase === 'cleared') {
      // A retained edge from the original jam remains on the same side panel.
      // Its material and folds can be observed without implying a new record.
      context.fillStyle='#382d3eaa';context.fillRect(215,143,43,29);
      context.drawImage(art[6],40,15,132,85,216,143,40,26);
      context.fillStyle='#5d4754';context.fillRect(215,143,4,28);context.fillRect(253,143,4,28);
      context.fillStyle='#cfac73';context.fillRect(216,143,2,24);context.fillRect(254,143,2,24);
      // Each indicator corresponds to a completed, persisted study fact.
      context.fillStyle='#44374e';context.fillRect(184,176,40,17);
      context.fillStyle='#b6926d';context.fillRect(185,176,38,2);
      for(let index=0;index<3;index++) {
        context.fillStyle=index<sorting.researchCompleted?'#bddab1':'#655666';
        context.fillRect(188+index*11,181,8,7);
        if(index<sorting.researchCompleted){context.fillStyle='#e2ebbd';context.fillRect(189+index*11,181,5,2);}
      }
    }
    context.restore();
  }
  function paper(context: CanvasRenderingContext2D, frame: SceneFrame) {
    const sorting = view()!;
    if (sorting.phase === 'cleared') return;
    const progress = sorting.stage === 'clear-paper' ? sorting.stageProgress : 0;
    const width = 74 * (1 - .72 * progress);
    const working = active() && ['day','dusk'].includes(frame.environment.period);
    const peel = working && sorting.stage === 'clear-paper' ? Math.sin(clock(frame) * Math.PI * 2) : 0;
    const x = mouth.x - 22, y = mouth.y + 15;
    context.save();
    context.fillStyle = '#4030437a';context.beginPath();context.ellipse(x+width/2,y+1,width*.45,5,0,0,Math.PI*2);context.fill();
    // Separate upper curls hinge while the lower mass remains registered to the rollers.
    context.drawImage(art[6],0,40,224,72,x,y-24,width,24);
    context.translate(x+width*.25,y-22);context.rotate(peel*.12);
    context.drawImage(art[6],0,0,224,49,-width*.25,-14,width,17);context.restore();
  }
  function box(context: CanvasRenderingContext2D, frame: SceneFrame) {
    const sorting = view()!;
    if (sorting.stage !== 'hauling' || sorting.phase !== 'working') return;
    const amount = 1 - sorting.stageProgress;
    const distance = frame.environment.period === 'night' ? 0 : clock(frame) % 1;
    const x = mouth.x + 17 - distance * 22, y = mouth.y - distance * 7;
    context.save();context.translate(x,y);
    context.fillStyle = '#51364a';context.fillRect(-12,-20,25,22);
    context.fillStyle = '#bf7c4f';context.fillRect(-10,-18,21,18);
    context.fillStyle = '#f1c27e';context.fillRect(-10,-18,18,5);
    context.fillStyle = '#ead9ab';context.fillRect(-2,-18,4,18);
    if (amount > .5) {context.fillStyle = '#704550';context.fillRect(5,-29,17,18);context.fillStyle = '#d7a26b';context.fillRect(6,-28,14,14);}
    context.restore();
  }
  return {
    ready, active, target, pose,
    entities(context: CanvasRenderingContext2D, frame: SceneFrame): SceneEntity[] {
      if (!getFusion || !art.length || view()?.phase === 'unknown' && !getFusion().journey) return [];
      return [
        {depth:anchor.y,hitTarget:{kind:'site',id:'sorting'},draw:()=>machine(context,frame)},
        {depth:anchor.y+.1,hitTarget:{kind:'site',id:'sorting'},draw:()=>{paper(context,frame);box(context,frame);}},
        {depth:anchor.y+.2,hitTarget:{kind:'site',id:'sorting'},draw:()=>context.drawImage(art[1],origin.x,origin.y,148,148)},
      ];
    },
    afterWorld(context: CanvasRenderingContext2D, frame: SceneFrame) {
      const sorting = view();
      if (!sorting || !active() || !['day','dusk'].includes(frame.environment.period)) return;
      if (frame.robot.action === 'scan') {
        const targetPoint = target();
        const source = robotScannerPoint(frame.robot, frame.t);
        context.save();context.fillStyle = '#a0ddbf2b';context.beginPath();context.moveTo(source.x,source.y);
        context.lineTo(targetPoint.x-14,targetPoint.y-7);context.lineTo(targetPoint.x+14,targetPoint.y+7);context.closePath();context.fill();
        context.strokeStyle = '#c3f1ce';context.lineWidth = 1.7;context.strokeRect(targetPoint.x-13,targetPoint.y-9,26,18);
        context.fillStyle = '#e3e9ae';context.fillRect(targetPoint.x-9,targetPoint.y-6+((clock(frame)*16)%11),18,2);context.restore();
      }
      frame.output.dataset.sortingPhase = sorting.phase;
      frame.output.dataset.sortingStage = sorting.stage ?? '';
      frame.output.dataset.sortingWork = String(sorting.workDone);
    },
  };
}
