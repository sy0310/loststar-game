import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='assets/source/visual-renewal/museum/pane-reflections-source.png',runtime='assets/runtime/visual-renewal/museum/pane-reflections.webp';
const crop={left:146,top:131,width:800,height:1174};
await mkdir('assets/runtime/visual-renewal/museum',{recursive:true});
const {data,info}=await sharp(source).extract(crop).resize(128,168,{kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
// The source is translucent glass, not opaque backdrop. Preserve those authored
// alpha values; the renderer applies a uniform physical-pane opacity of .30.
await sharp(data,{raw:info}).webp({lossless:true}).toFile(runtime);
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
await writeFile('assets/source/visual-renewal/museum/PANE_REGISTRATION.json',JSON.stringify({schema:1,source,runtime,tool:'image_gen built-in',sourceSha256:await hash(source),runtimeSha256:await hash(runtime),crop,size:[128,168],layers:['transparent glass tint','coherent middle-window reflection bands'],fixedStructure:false,rendererOpacity:.30,mechanism:'five 33.6px vertical telescoping panes, fully stored in original 36px+ hood; no horizontal travel',prompt:'Original high-precision pixel-art rectangular front-facing glass sheet; low-opacity lavender-blue tint with sparse coherent pale cyan diagonal reflections and upper-left amber glint. No frame, base, item or text. Transparent output.',review:'pending root review; material preview is not a runtime screenshot'},null,2)+'\n');
const specimen='assets/runtime/visual-renewal/curios/receipt-stabilized.png';
const paper=await sharp(specimen).resize(240,240,{kernel:'nearest'}).toBuffer();
const base=await sharp({create:{width:256,height:336,channels:4,background:'#241342'}}).composite([{input:paper,left:8,top:48}]).png().toBuffer();
const overlay=await sharp(runtime).resize(256,336,{kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let n=3;n<overlay.data.length;n+=4)overlay.data[n]=Math.round(overlay.data[n]*.30);
const pane=await sharp(overlay.data,{raw:overlay.info}).png().toBuffer();
const after=await sharp(base).composite([{input:pane}]).png().toBuffer();
await mkdir('releases/v042-space-static',{recursive:true});
await sharp({create:{width:540,height:336,channels:4,background:'#140b24'}}).composite([{input:base,left:0,top:0},{input:after,left:284,top:0}]).png().toFile('releases/v042-space-static/pane-material-before-after.png');
console.log('Exported physical glass material and internal readability comparison.');
