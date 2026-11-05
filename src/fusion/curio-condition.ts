import {itemCenter, type Exhibit} from '../render/museum-layout';
import {createReceiptRestorationAssets, receiptRestorationRegistration} from '../render/receipt-restoration';
import {restorationBrushPose, restorationBrushToolTransform} from '../render/restoration-brush';
import robotUrl from '../../assets/runtime/robot-empty-v3.webp';
import {drawLocalCurioRig} from './curio-local-rig';
import {textures} from '../ui/art';
import workbenchUrl from '../../assets/runtime/v036/restoration-workbench.webp';
import {curioActionProgress, curioPhysicalFrame,curioSupportContacts, isMaterialCurio, paintCurioPhysicalMaterial, type CurioState} from './curio-material';
export {curioConditionPresentation, curioTreatmentLabels, curioPhysicalFrame, curioMaterialRegistration} from './curio-material';
export type {CurioState} from './curio-material';

type Point = {x: number; y: number};
interface RepairSite extends Point {width: number; height: number; angle: number}
interface Material {
  original: HTMLCanvasElement;
  image: HTMLCanvasElement;
  mud: HTMLCanvasElement;
  remainingMud: HTMLCanvasElement;
  solid: Point[];
  rows: ({left: number; right: number} | undefined)[];
  revision: string;
}
const repairs: Record<string, RepairSite[]> = {
  nested: [{x: 47, y: 96, width: 31, height: 11, angle: .54}, {x: 143, y: 97, width: 31, height: 11, angle: -.52}],
  stamp: [{x: 100, y: 78, width: 29, height: 12, angle: .42}, {x: 87, y: 105, width: 26, height: 10, angle: .42}],
  'cosmic-parcel': [{x: 27, y: 91, width: 33, height: 13, angle: 1.4}, {x: 161, y: 145, width: 30, height: 13, angle: -.5}],
};
const materials = new WeakMap<HTMLImageElement, Material>();
const make = () => {const canvas = document.createElement('canvas');canvas.width = canvas.height = 192;return canvas;};
let tools: ReturnType<typeof createReceiptRestorationAssets> | undefined;
let toolsLoaded = false;
let toolRobot: HTMLImageElement | undefined;
let armJoint: HTMLCanvasElement | undefined;
let toolsPromise: Promise<void> | undefined;
let workbench: HTMLImageElement | undefined;
const specimens = new Map<string, HTMLImageElement>();
const treatmentLayers = new Map<string, HTMLImageElement>();
const treatmentUrls = import.meta.glob('../../assets/runtime/v039/*.webp', {eager: true, query: '?url', import: 'default'}) as Record<string,string>;
type TreatmentToolRegistration = {file: string;contact: Point; pivot: Point;width: number;height: number};
const treatmentRegistrations = import.meta.glob('../../assets/runtime/v039/registration.json', {eager: true, import: 'default'}) as Record<string,{tools?: Record<string,TreatmentToolRegistration>}>;

export function prepareCurioTools() {
  if (!toolsPromise) {
    tools = createReceiptRestorationAssets();
    toolRobot = new Image();toolRobot.src = robotUrl;
    workbench = new Image();workbench.src = workbenchUrl;
    for (const id of ['tape','bell','nested','stamp','cosmic-parcel']) {
      const image = new Image();image.src = textures[id as keyof typeof textures];specimens.set(id,image);
    }
    for (const [path,url] of Object.entries(treatmentUrls)) {
      const image = new Image();image.src = url;treatmentLayers.set(path.split('/').at(-1)!.replace('.webp',''),image);
    }
    for(const [name,registration] of Object.entries(treatmentRegistrations['../../assets/runtime/v039/registration.json']?.tools??{})){
      const image=treatmentLayers.get(registration.file.split('/').at(-1)!.replace('.webp',''));if(image)treatmentLayers.set(name,image);
    }
    toolsPromise = Promise.all([
      ...[...Object.values(tools), toolRobot, workbench, ...specimens.values()].map(image => image.decode()),
      // A failed optional detail layer uses the existing material/tool fallback.
      ...[...new Set(treatmentLayers.values())].map(image => image.decode().catch(() => {})),
    ])
      .then(() => {toolsLoaded = true;})
      .catch(error => {toolsPromise = undefined;throw error;});
  }
  return toolsPromise;
}

function materialFor(image: HTMLImageElement) {
  const cached = materials.get(image);
  if (cached) return cached;
  const original = make(), context = original.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  const scale = 192 / Math.max(image.naturalWidth, image.naturalHeight);
  context.drawImage(image, (192 - image.naturalWidth * scale) / 2, (192 - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  const alpha = context.getImageData(0, 0, 192, 192).data;
  const solid: Point[] = [];
  const rows = Array.from({length: 192}, (_, y) => {
    let left = 192, right = 0;
    for (let x = 0; x < 192; x++) {
      if (alpha[(y * 192 + x) * 4 + 3] < 210) continue;
      left = Math.min(left, x);right = Math.max(right, x + 1);
      if (x % 2 === 0 && y % 2 === 0) solid.push({x, y});
    }
    return right > left ? {left, right} : undefined;
  });
  const material = {original, image: make(), mud: make(), remainingMud: make(), solid, rows, revision: ''};
  materials.set(image, material);
  return material;
}

function sweepPoint(material: Material, pass: number, progress: number): Point {
  const y = 12 + pass * 24;
  const row = material.rows[Math.min(191, y)];
  const left = (row?.left ?? 65) - 8, right = (row?.right ?? 127) + 8;
  return {x: pass % 2 === 0 ? left + (right - left) * progress : right - (right - left) * progress, y};
}

function cleaningPose(material: Material, progress: number) {
  const pose = restorationBrushPose(progress);
  const sweep = Math.min(1, pose.local / .72);
  let point = sweepPoint(material, pose.pass, sweep);
  if (pose.local >= .72 && pose.pass < 7) {
    const next = sweepPoint(material, pose.pass + 1, 0);
    const transit = (pose.local - .72) / .28;
    point = {x: point.x + (next.x - point.x) * transit, y: point.y + (next.y - point.y) * transit};
  }
  return {...pose, point};
}

function drawFibrePatch(context: CanvasRenderingContext2D, site: RepairSite, installed: number, back: boolean) {
  if (!tools || !toolsLoaded || installed <= 0) return;
  const target = receiptRestorationRegistration().receipt.patchTargets.lower.srcRect;
  const descent = (1 - installed) * 13;
  context.save();context.translate(site.x - descent * .2, site.y - descent);context.rotate(site.angle);
  const width = site.width * (back ? 1.12 : 1), height = site.height * (back ? 1.2 : 1);
  context.drawImage(back ? tools.patchBack : tools.patchFront, target.x - 1, target.y - 1, target.width + 2, target.height + 2, -width / 2, -height / 2, width, height);
  context.restore();
}

/** The original mud texture is erased only by the same contact sweeps that drive the fan. */
export function prepareCurioMaterial(image: HTMLImageElement, state: CurioState, now: number, id: string) {
  const material = materialFor(image);
  const phase = curioActionProgress(state,now);
  const repaired = state.condition === 'stabilized' ? 1 : state.action?.kind === 'repair' ? phase : 0;
  const revision = `${id}/${state.condition}/${state.action?.kind ?? ''}/${state.action ? Math.round(phase * 120) : 0}/${toolsLoaded}`;
  if (material.revision !== revision) {
    const painter = material.image.getContext('2d')!;
    painter.clearRect(0, 0, 192, 192);
    if (isMaterialCurio(id)) {
      paintCurioPhysicalMaterial(material.image,material.original,id,state,now,{
        dust: treatmentLayers.get(id === 'tape' ? 'tape-adhesive-dust' : 'bell-rust'),
      });
      material.revision = revision;
      return {...material,phase,repaired,size:192 as const};
    }
    const sites = repairs[id] ?? [];
    for (const [index, site] of sites.entries()) drawFibrePatch(painter, site, Math.min(1, Math.max(0, (repaired - index * .45) / .48)), true);
    painter.drawImage(material.original, 0, 0);
    // Small open seams remain visible after cleaning and are bridged by the saved fibre repairs.
    if (repaired < 1) {
      painter.save();painter.globalCompositeOperation = 'destination-out';painter.lineWidth = 2.5 * (1 - repaired);
      for (const site of sites) {
        painter.save();painter.translate(site.x, site.y);painter.rotate(site.angle);
        painter.beginPath();painter.moveTo(-site.width * .32, -2);painter.lineTo(0, 1);painter.lineTo(site.width * .32, -1);painter.stroke();painter.restore();
      }
      painter.restore();
    }
    if (state.condition === 'found' && toolsLoaded && tools) {
      const dirt = material.mud.getContext('2d')!;
      dirt.clearRect(0, 0, 192, 192);
      dirt.globalAlpha = .88;
      dirt.drawImage(tools.mud, 0, 0, 192, 192);
      dirt.drawImage(tools.mud, 28, 2, 220, 234, 92, 42, 110, 135);
      dirt.globalAlpha = 1;dirt.globalCompositeOperation = 'destination-in';dirt.drawImage(material.original, 0, 0);dirt.globalCompositeOperation = 'source-over';
      const remaining = material.remainingMud.getContext('2d')!;
      remaining.clearRect(0, 0, 192, 192);remaining.drawImage(material.mud, 0, 0);
      if (state.action?.kind === 'clean') {
        remaining.save();remaining.globalCompositeOperation = 'destination-out';remaining.lineCap = 'round';remaining.lineWidth = 34;
        for (let pass = 0; pass < 8; pass++) {
          const amount = Math.min(1, Math.max(0, (phase * 8 - pass) / .72));
          if (!amount) continue;
          const start = sweepPoint(material, pass, 0), end = sweepPoint(material, pass, amount);
          remaining.beginPath();remaining.moveTo(start.x, start.y);remaining.lineTo(end.x, end.y);remaining.stroke();
        }
        remaining.restore();
      }
      painter.drawImage(material.remainingMud, 0, 0);
    }
    for (const [index, site] of sites.entries()) drawFibrePatch(painter, site, Math.min(1, Math.max(0, (repaired - index * .45) / .48)), false);
    material.revision = revision;
  }
  return {...material, phase, repaired, size: 192 as const};
}

export interface CurioPoseOptions {
  seconds?: number;
  trial?: number;
  reducedMotion?: boolean;
  serviceEnvelope?: number;
  drawAbility?: (context: CanvasRenderingContext2D, image: HTMLCanvasElement) => boolean;
}

function toolArm(context: CanvasRenderingContext2D, grip: Point, claw = false) {
  if (!toolRobot) return;
  if (claw) {
    // Register the hollow of the original C-shaped claw around the tool handle.
    context.drawImage(toolRobot, 189, 272, 32, 31, grip.x - 9.6, grip.y - 13.1, 22, 21.3);
    return;
  }
  if(!armJoint){
    // The copper ear bearing is an actual outlined part of the same original
    // robot. A measured contour removes adjacent head/neck pixels, not its rim.
    armJoint=document.createElement('canvas');armJoint.width=28;armJoint.height=35;
    const joint=armJoint.getContext('2d')!;joint.imageSmoothingEnabled=false;
    joint.drawImage(toolRobot,100,51,28,35,0,0,28,35);
    joint.globalCompositeOperation='destination-in';joint.beginPath();
    for(const [i,p]of [{x:9,y:0},{x:18,y:1},{x:26,y:8},{x:28,y:18},{x:24,y:28},{x:17,y:35},{x:8,y:34},{x:1,y:26},{x:0,y:14},{x:3,y:6}].entries()){
      if(i)joint.lineTo(p.x,p.y);else joint.moveTo(p.x,p.y);
    }
    joint.closePath();joint.fill();
  }
  const elbow = {x: Math.max(180, grip.x + 38), y: grip.y + 34};
  for (const [from, to] of [[{x: 286, y: 202}, elbow], [elbow, grip]]) {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    context.save();context.translate(from.x, from.y);context.rotate(Math.atan2(to.y - from.y, to.x - from.x) - Math.PI / 2);
    // (411,245,26,40) previously contained mostly transparent padding and the
    // narrow side of a purple arm. This tight cream/copper forearm is opaque
    // across its centre, keeping its bevel and warm original surface visible.
    context.drawImage(toolRobot,102,97,23,25,-9,-4,18,length+8);context.restore();
  }
  context.drawImage(armJoint,elbow.x-11,elbow.y-13.75,22,27.5);
  context.drawImage(armJoint,grip.x-8,grip.y-10,16,20);
}

function drawRegisteredTool(context: CanvasRenderingContext2D, name: string, tip: Point, angle: number) {
  if (!tools) return;
  const image = treatmentLayers.get(name);
  const registration = treatmentRegistrations['../../assets/runtime/v039/registration.json']?.tools?.[name];
  const fallback = receiptRestorationRegistration().tools.spatula;
  const available = !!image?.naturalWidth && !!registration;
  const tool = available ? registration : fallback;
  const sprite = available ? image : tools.spatula;
  const scale = available ? 72 / Math.max(registration.width,registration.height) : .33;
  const offset = {x: (tool.pivot.x-tool.contact.x)*scale,y: (tool.pivot.y-tool.contact.y)*scale};
  const grip = {x: tip.x+offset.x*Math.cos(angle)-offset.y*Math.sin(angle),y: tip.y+offset.x*Math.sin(angle)+offset.y*Math.cos(angle)};
  toolArm(context,grip);
  context.save();context.translate(tip.x,tip.y);context.rotate(angle);context.scale(scale,scale);
  context.drawImage(sprite,-tool.contact.x,-tool.contact.y);context.restore();toolArm(context,grip,true);
}

function drawTool(context: CanvasRenderingContext2D, material: Material, state: CurioState, phase: number, id: string) {
  if (!tools || !toolsLoaded || !state.action || phase >= 1) return;
  const registration = receiptRestorationRegistration().tools;
  const physical = isMaterialCurio(id) ? curioPhysicalFrame(id,state,state.action.startedAt+(state.action.endsAt-state.action.startedAt)*phase) : undefined;
  if (state.action.kind === 'clean') {
    const originalPose = cleaningPose(material, phase);
    const pose = physical ? {...originalPose,point:physical.contact} : originalPose;
    const matrix = restorationBrushToolTransform(pose.pressure);
    if (id === 'tape' && physical && physical.pass < 4 && treatmentLayers.has('tweezers')) {
      const point = {x: pose.point.x,y: pose.point.y-pose.lift*.55};
      drawRegisteredTool(context,'tweezers',point,-.28);
      return {tool:'tweezers',...pose.point,pressed:pose.contact};
    }
    const grip = {x: pose.point.x + matrix.handleGrip.x * .48, y: pose.point.y - pose.lift * .55 + matrix.handleGrip.y * .48};
    toolArm(context, grip);
    context.save();context.translate(pose.point.x, pose.point.y - pose.lift * .55);context.scale(.48, .48);
    context.save();context.transform(matrix.bristles.a, matrix.bristles.b, matrix.bristles.c, matrix.bristles.d, matrix.bristles.e, matrix.bristles.f);
    context.drawImage(tools.brushBristles, 0, 0);context.restore();
    context.drawImage(tools.brushHandle, matrix.handleOrigin.x, matrix.handleOrigin.y);context.restore();toolArm(context, grip, true);
    return {tool:'brush',...pose.point,pressed:pose.contact};
  }
  if (physical) {
    const local = physical.repairLocal;
    const press = Math.min(1,local/.23)*(1-Math.max(0,(local-.72)/.28));
    let site: Point = {...physical.repairContact};
    if (physical.step === 0) site = id === 'tape' ? {x:site.x-7*(1-physical.aligned),y:site.y+7*(1-physical.aligned)}
      : {x:site.x+5*(1-physical.aligned),y:site.y+4*(1-physical.aligned)};
    const tip = {x:site.x+(1-press)*23,y:site.y-(1-press)*20};
    const name = id === 'tape' ? physical.step === 0 ? 'tweezers' : 'spatula'
      : physical.step === 0 ? 'screwdriver' : 'spatula';
    const angle = name === 'screwdriver' ? -.35 + (press > .95 ? Math.sin(local*27)*.09 : 0) : -.16;
    drawRegisteredTool(context,name,tip,angle);
    return {tool:name,...site,pressed:press>.95};
  }
  const sites = repairs[id] ?? [];
  const index = phase < .5 ? 0 : 1, site = sites[index];
  if (!site) return;
  const local = phase * 2 - index;
  const press = Math.min(1, local / .23) * (1 - Math.max(0, (local - .72) / .28));
  const tool = registration.spatula;
  const tip = {x: site.x + (1 - press) * 20, y: site.y - (1 - press) * 18};
  const offset = {x: (tool.pivot.x - tool.contact.x) * .33, y: (tool.pivot.y - tool.contact.y) * .33};
  const grip = {x: tip.x + offset.x * Math.cos(-.16) - offset.y * Math.sin(-.16), y: tip.y + offset.x * Math.sin(-.16) + offset.y * Math.cos(-.16)};
  toolArm(context, grip);
  context.save();context.translate(tip.x, tip.y);context.rotate(-.16);context.scale(.33, .33);
  context.drawImage(tools.spatula, -tool.contact.x, -tool.contact.y);context.restore();toolArm(context, grip, true);
  return {tool:'spatula',...site,pressed:press>.95};
}

/** Registered specimen material and local joints remain behind the real foreground glass. */
export function drawCurioSpecimen(context: CanvasRenderingContext2D, exhibit: Exhibit, image: HTMLImageElement, state: CurioState, now: number, options: CurioPoseOptions = {}) {
  const material = prepareCurioMaterial(image, state, now, exhibit.id);
  const center = itemCenter(exhibit), size = exhibit.item.size * exhibit.scale;
  context.save();context.translate(center.x, center.y);context.scale(size / 192, size / 192);context.translate(-96, -96);
  if (state.action) context.drawImage(material.image, 0, 0);
  else if (!options.drawAbility?.(context, material.image)) drawLocalCurioRig(context, exhibit.id, material.image, material.revision, options.seconds ?? now / 1000,
    (options.trial ?? 0) * (options.serviceEnvelope ?? 1), options.reducedMotion, options.serviceEnvelope ?? 1, material.repaired);
  drawTool(context, material, state, material.phase, exhibit.id);
  context.restore();
}

/** The same actual specimen on the shared workbench, without a cabinet or save mutation. */
export function renderCurioTreatment(canvas: HTMLCanvasElement, id: string, state: CurioState, now: number, options: CurioPoseOptions = {}) {
  const context=canvas.getContext('2d'), image=specimens.get(id);
  if(!context||!toolsLoaded||!image)return false;
  const material=prepareCurioMaterial(image,state,now,id);
  context.save();context.clearRect(0,0,canvas.width,canvas.height);context.scale(canvas.width/640,canvas.height/700);context.imageSmoothingEnabled=false;
  if(workbench)context.drawImage(workbench,0,0,640,700);
  else {context.fillStyle='#30223f';context.fillRect(0,0,640,700);}
  const x=150,y=id==='bell'?159:id==='tape'?184:150,size=340;
  context.save();context.fillStyle='#24192b';context.globalAlpha=.40;
  if(isMaterialCurio(id)){
    for(const contact of curioSupportContacts(id,state,now)){
      context.beginPath();context.ellipse(x+contact.point.x*size/192,y+contact.point.y*size/192+1,contact.radiusX*size/192,contact.radiusY*size/192,0,0,Math.PI*2);context.fill();
    }
  }else{context.beginPath();context.ellipse(320,490,151,20,0,0,Math.PI*2);context.fill();}
  context.restore();
  const completed=state.condition==='stabilized';
  if(completed){
    // The original restoration tray provides a physical support, not a second case.
    const tray=receiptRestorationRegistration().tools.tray;
    if(tools)context.drawImage(tools.tray,0,0,tray.size.width,tray.size.height,134,470,372,69);
  }
  context.save();context.translate(x,y);context.scale(size/192,size/192);
  if(state.action)context.drawImage(material.image,0,0);
  else if(!options.drawAbility?.(context,material.image))drawLocalCurioRig(context,id,material.image,material.revision,options.seconds??now/1000,
    options.trial??0,options.reducedMotion,options.serviceEnvelope??1,material.repaired);
  const contact=drawTool(context,material,state,material.phase,id);
  context.restore();context.restore();
  const physical=isMaterialCurio(id)?curioPhysicalFrame(id,state,now):undefined;
  canvas.dataset.ready='true';canvas.dataset.materialStage=state.condition;canvas.dataset.condition=state.condition;
  canvas.dataset.type=id==='tape'?'adhesive':id==='bell'?'copper-mechanism':'original';
  canvas.dataset.cleanProgress=String(physical?.cleaning??(state.condition==='found'?material.phase:1));
  canvas.dataset.repairProgress=String(material.repaired);canvas.dataset.toolContact=contact?.pressed?contact.tool:'';
  canvas.dataset.contact=contact?.tool??'';
  canvas.dataset.contactX=contact?String(x+contact.x*size/192):'';canvas.dataset.contactY=contact?String(y+contact.y*size/192):'';
  canvas.dataset.structureAligned=String(physical?.aligned??material.repaired);canvas.dataset.structurePressed=String(physical?.pressed??material.repaired);
  canvas.dataset.lampAvailable='false';canvas.dataset.frame=String(Number(canvas.dataset.frame??0)+1);
  return true;
}

/** Copy because the live material canvas is intentionally reused by its renderer. */
export function exportCurioMaterial(id: string, state: CurioState, now: number) {
  const image=specimens.get(id);if(!image||!toolsLoaded)return undefined;
  const material=prepareCurioMaterial(image,state,now,id), canvas=make();canvas.getContext('2d')!.drawImage(material.image,0,0);return canvas;
}
