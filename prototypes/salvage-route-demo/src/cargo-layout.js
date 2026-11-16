/* Original 4x4 cargo geometry. Pure, deterministic and independent of route RNG. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LostCargoLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const WIDTH=4,HEIGHT=4,VERSION=1,MAX_CELLS=30;
const rect=(w,h)=>Array.from({length:w*h},(_,i)=>[i%w,Math.floor(i/w)]);
const SHAPES={point1:rect(1,1),line2:rect(2,1),line3:rect(3,1),ell3:[[0,0],[0,1],[1,1]],square4:rect(2,2),line4:rect(4,1),ell4:[[0,0],[0,1],[0,2],[1,2]],tee4:[[0,0],[1,0],[2,0],[1,1]],ell5:[[0,0],[0,1],[0,2],[1,2],[2,2]],rect6:rect(3,2),ell7:[...rect(3,2),[0,2]],rect8:rect(4,2),legacy4:rect(2,2),legacy8:rect(4,2),legacy12:[...rect(4,2),[0,2],[1,2],[0,3],[1,3]],legacy16:rect(4,4)};
for(const mask of Object.values(SHAPES)){for(const p of mask)Object.freeze(p);Object.freeze(mask);}Object.freeze(SHAPES);
const copy=xs=>xs.map(x=>({...x}));
const int=n=>Number.isSafeInteger(n);
function cells(item,rotation=0){
 const id=typeof item==='string'?item:item?.shapeId,mask=SHAPES[id];
 if(!mask||!int(rotation)||rotation<0||rotation>3)throw Error('货物形状或旋转无效');
 let out=mask.map(([x,y])=>[x,y]);
 for(let r=0;r<rotation;r++)out=out.map(([x,y])=>[-y,x]);
 const minX=Math.min(...out.map(p=>p[0])),minY=Math.min(...out.map(p=>p[1]));
 return out.map(([x,y])=>[x-minX,y-minY]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
}
function area(item){return cells(item).length;}
function itemError(item){
 if(!item||!int(item.uid)||item.uid<1||!int(item.cells)||item.cells<1||item.cells>MAX_CELLS)return'货物身份或面积无效';
 if(!Object.hasOwn(SHAPES,item.shapeId)||item.shapeVersion!==VERSION)return'货物形状版本无效';
 if(item.mask!==undefined||item.shape!==undefined)return'货物轮廓必须来自已登记形状';
 if(area(item)!==item.cells)return'货物面积与登记形状不一致';
 if(item.size!==undefined&&(!int(item.size)||item.size<1||item.size>4||item.cells!==item.size*4))return'旧货体积与原包装面积不一致';
 if(item.cells>8&&!item.shapeId.startsWith('legacy'))return'大型旧货必须保留原运输包装';
 if(item.contract&&item.shapeId!=='square4'&&item.shapeId!=='legacy4')return'记录箱必须占2×2格';
 return null;
}
function itemSetError(items){
 if(!Array.isArray(items)||items.length>MAX_CELLS*2)return'货舱物件无效';
 const seen=new Set();for(const x of items){const e=itemError(x);if(e)return e;if(seen.has(x.uid))return'重复货物身份';seen.add(x.uid);}return null;
}
function dimensions(options = {}) {
 const width = options.width ?? 4;
 const height = options.height ?? 4;
 if (!int(width) || !int(height) || width < 4 || width > 6 || height < 4 || height > 6) throw Error('货舱尺寸无效');
 const rows = options.usableCellMask;
 if (rows !== undefined && (!Array.isArray(rows) || rows.length !== height || rows.some(row => !Array.isArray(row) || row.length !== width || row.some(cell => typeof cell !== 'boolean')))) throw Error('货舱有效格无效');
 const count = rows ? rows.flat().filter(Boolean).length : width * height;
 if (count < 1 || count > MAX_CELLS) throw Error('货舱有效面积无效');
 return { width, height };
}

function board(options = {}) {
 const { width, height } = dimensions(options);
 const indices = new Map();
 for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
   if (!options.usableCellMask || options.usableCellMask[y][x]) indices.set(y * width + x, indices.size);
  }
 }
 // At most 30 usable cells get bits, including on a 6x6 canvas.
 let evenMask = 0;
 for (const [cell, index] of indices) if (((cell % width) + Math.floor(cell / width)) % 2 === 0) evenMask |= 1 << index;
 return { width, height, indices, capacity: indices.size, evenMask };
}

function placementMask(item, placement, grid) {
 let mask = 0;
 for (const [dx, dy] of cells(item, placement.rotation)) {
  const x = placement.x + dx;
  const y = placement.y + dy;
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return null;
  const index = grid.indices.get(y * grid.width + x);
  if (index === undefined) return null;
  mask |= 1 << index;
 }
 return mask;
}

function validate(items, placements, options = {}) {
 const grid = board(options);
 const problem = itemSetError(items);
 if (problem) return { ok: false, message: problem };
 if (!Array.isArray(placements) || placements.length > items.length) return { ok: false, message: '摆放数量无效' };
 const byId = new Map(items.map(item => [item.uid, item]));
 const seen = new Set();
 let occupied = 0;
 for (const placement of placements) {
  if (!placement || !int(placement.uid) || !byId.has(placement.uid) || seen.has(placement.uid)) return { ok: false, message: '重复或未知的货物位置' };
  if (!int(placement.x) || !int(placement.y) || !int(placement.rotation) || placement.rotation < 0 || placement.rotation > 3) return { ok: false, message: '货物位置或旋转无效' };
  const mask = placementMask(byId.get(placement.uid), placement, grid);
  if (mask === null) return { ok: false, message: '超出货舱边界或占用未开放格' };
  if (mask & occupied) return { ok: false, message: '货物位置重叠' };
  occupied |= mask;
  seen.add(placement.uid);
 }
 if (!options.partial && seen.size !== items.length) return { ok: false, message: '还有货物未放入，请先完成装载' };
 return { ok: true, message: '', occupied, cells: items.filter(item => seen.has(item.uid)).reduce((sum, item) => sum + area(item), 0) };
}

function placementsFor(item, preferred, grid) {
 const candidates = [];
 const seen = new Set();
 function add(placement) {
  const mask = placementMask(item, placement, grid);
  if (mask === null || seen.has(mask)) return;
  seen.add(mask);
  candidates.push({ placement: { uid: item.uid, x: placement.x, y: placement.y, rotation: placement.rotation }, mask });
 }
 if (preferred && int(preferred.x) && int(preferred.y) && int(preferred.rotation) && preferred.rotation >= 0 && preferred.rotation < 4) add(preferred);
 for (let rotation = 0; rotation < 4; rotation++) {
  const rotated = cells(item, rotation);
  const width = Math.max(...rotated.map(point => point[0])) + 1;
  const height = Math.max(...rotated.map(point => point[1])) + 1;
  for (let y = 0; y <= grid.height - height; y++) {
   for (let x = 0; x <= grid.width - width; x++) add({ x, y, rotation });
  }
 }
 return candidates;
}

function search(items, fixed = [], preferred = [], options = {}) {
 const grid = board(options);
 if (itemSetError(items) || items.reduce((sum, item) => sum + area(item), 0) > grid.capacity) return null;
 const initial = validate(items, fixed, { ...options, partial: true });
 if (!initial.ok) return null;
 const remaining = items.filter(item => !fixed.some(placement => placement.uid === item.uid))
  .map(item => ({ item, options: placementsFor(item, preferred.find(placement => placement.uid === item.uid), grid) }))
  .sort((a, b) => b.item.cells - a.item.cells || a.options.length - b.options.length || a.item.uid - b.item.uid);
 const fullCoverage = items.reduce((sum, item) => sum + area(item), 0) === grid.capacity;
 function bitCount(value) {
  let count = 0;
  while (value) { value &= value - 1; count++; }
  return count;
 }
 const colorDifference = mask => 2 * bitCount(mask & grid.evenMask) - bitCount(mask);
 const boardDifference = 2 * bitCount(grid.evenMask) - grid.capacity;
 const possibleDifferences = Array(remaining.length + 1);
 possibleDifferences[remaining.length] = new Set([0]);
 if (fullCoverage) {
  for (let index = remaining.length - 1; index >= 0; index--) {
   const differences = new Set(remaining[index].options.map(candidate => colorDifference(candidate.mask)));
   possibleDifferences[index] = new Set();
   for (const current of differences) for (const suffix of possibleDifferences[index + 1]) possibleDifferences[index].add(current + suffix);
  }
 }
 const failed = new Set();
 function visit(index, occupied, placed) {
  // A necessary checkerboard condition prunes impossible full tilings without a search limit.
  if (fullCoverage && !possibleDifferences[index].has(boardDifference - colorDifference(occupied))) return null;
  if (index === remaining.length) return placed;
  const key = index + ':' + occupied;
  if (failed.has(key)) return null;
  for (const candidate of remaining[index].options) {
   if (candidate.mask & occupied) continue;
   const result = visit(index + 1, occupied | candidate.mask, [...placed, candidate.placement]);
   if (result) return result;
  }
  failed.add(key);
  return null;
 }
 const result = visit(0, initial.occupied, copy(fixed));
 return result ? items.map(item => result.find(placement => placement.uid === item.uid)) : null;
}

// Complete search; preferred positions are tried first but never treated as immovable.
function solve(items, preferred = [], options = {}) { return search(items, [], preferred, options); }
// Acquisition fills free space, preserving the existing arrangement.
function extend(items, placements = [], options = {}) { return search(items, placements, placements, options); }
function place(items, placements, uid, x, y, rotation, options = {}) {
 if (!items.some(item => item.uid === uid)) return { ok: false, message: '货物已不在此次装载中', placements: copy(placements) };
 const next = [...placements.filter(placement => placement.uid !== uid), { uid, x, y, rotation }];
 const valid = validate(items, next, { ...options, partial: true });
 return { ok: valid.ok, message: valid.message, placements: valid.ok ? copy(next) : copy(placements) };
}
function legacyPack(items){
 if(!Array.isArray(items))throw Error('旧货舱字段无效');
 const next=items.map(x=>({...x,cells:x.size*4,shapeId:'legacy'+x.size*4,shapeVersion:VERSION}));
 const placements=solve(next);if(!placements)throw Error('旧货舱体积或身份无效，原档保留');
 return{items:next,placements};
}
return{WIDTH,HEIGHT,VERSION,MAX_CELLS,dimensions,SHAPES,cells,area,itemError,validate,solve,arrange:solve,extend,place,legacyPack};
});
