/* Original 4x4 cargo geometry. Pure, deterministic and independent of route RNG. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LostCargoLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const WIDTH=4,HEIGHT=4,VERSION=1,MAX_CELLS=16;
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
function validate(items,placements,options={}){
 const problem=itemSetError(items);if(problem)return{ok:false,message:problem};
 if(!Array.isArray(placements)||placements.length>items.length)return{ok:false,message:'摆放数量无效'};
 const byId=new Map(items.map(x=>[x.uid,x])),seen=new Set();let occupied=0;
 for(const p of placements){
  if(!p||!int(p.uid)||!byId.has(p.uid)||seen.has(p.uid))return{ok:false,message:'重复或未知的货物位置'};
  if(!int(p.x)||!int(p.y)||!int(p.rotation)||p.rotation<0||p.rotation>3)return{ok:false,message:'货物位置或旋转无效'};
  let mask=0;for(const [dx,dy]of cells(byId.get(p.uid),p.rotation)){const x=p.x+dx,y=p.y+dy;if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return{ok:false,message:'超出货舱边界'};mask|=1<<(y*WIDTH+x);}
  if(mask&occupied)return{ok:false,message:'货物位置重叠'};occupied|=mask;seen.add(p.uid);
 }
 if(!options.partial&&seen.size!==items.length)return{ok:false,message:'还有货物未放入，请先完成装载'};
 return{ok:true,message:'',occupied,cells:items.filter(x=>seen.has(x.uid)).reduce((n,x)=>n+area(x),0)};
}
function placementsFor(item,preferred){
 const candidates=[],seen=new Set();
 function add(p){const maskCells=cells(item,p.rotation);let mask=0;for(const[dx,dy]of maskCells){const x=p.x+dx,y=p.y+dy;if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return;mask|=1<<(y*WIDTH+x);}if(seen.has(mask))return;seen.add(mask);candidates.push({placement:{uid:item.uid,x:p.x,y:p.y,rotation:p.rotation},mask});}
 if(preferred&&int(preferred.x)&&int(preferred.y)&&int(preferred.rotation)&&preferred.rotation>=0&&preferred.rotation<4)add(preferred);
 for(let rotation=0;rotation<4;rotation++){const c=cells(item,rotation),w=Math.max(...c.map(p=>p[0]))+1,h=Math.max(...c.map(p=>p[1]))+1;for(let y=0;y<=HEIGHT-h;y++)for(let x=0;x<=WIDTH-w;x++)add({x,y,rotation});}
 return candidates;
}
function search(items,fixed=[],preferred=[]){
 if(itemSetError(items)||items.reduce((n,x)=>n+area(x),0)>16)return null;
 const v=validate(items,fixed,{partial:true});if(!v.ok)return null;
 const remaining=items.filter(x=>!fixed.some(p=>p.uid===x.uid)).map(item=>({item,options:placementsFor(item,preferred.find(p=>p.uid===item.uid))})).sort((a,b)=>b.item.cells-a.item.cells||a.options.length-b.options.length||a.item.uid-b.item.uid);
 const failed=new Set();
 function visit(index,occupied,placed){if(index===remaining.length)return placed;const key=index+':'+occupied;if(failed.has(key))return null;for(const c of remaining[index].options){if(c.mask&occupied)continue;const found=visit(index+1,occupied|c.mask,[...placed,c.placement]);if(found)return found;}failed.add(key);return null;}
 const result=visit(0,v.occupied,copy(fixed));return result?items.map(x=>result.find(p=>p.uid===x.uid)):null;
}
// Complete search; preferred positions are tried first but never treated as immovable.
function solve(items,preferred=[]){return search(items,[],preferred);}
// Acquisition only fills free space. It never rearranges a player's existing cargo.
function extend(items,placements=[]){return search(items,placements,placements);}
function place(items,placements,uid,x,y,rotation){
 if(!items.some(item=>item.uid===uid))return{ok:false,message:'货物已不在此次装载中',placements:copy(placements)};
 const next=[...placements.filter(p=>p.uid!==uid),{uid,x,y,rotation}],v=validate(items,next,{partial:true});
 return{ok:v.ok,message:v.message,placements:v.ok?copy(next):copy(placements)};
}
function legacyPack(items){
 if(!Array.isArray(items))throw Error('旧货舱字段无效');
 const next=items.map(x=>({...x,cells:x.size*4,shapeId:'legacy'+x.size*4,shapeVersion:VERSION}));
 const placements=solve(next);if(!placements)throw Error('旧货舱体积或身份无效，原档保留');
 return{items:next,placements};
}
return{WIDTH,HEIGHT,VERSION,MAX_CELLS,SHAPES,cells,area,itemError,validate,solve,arrange:solve,extend,place,legacyPack};
});
