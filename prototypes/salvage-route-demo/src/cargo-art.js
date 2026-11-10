/* Whole physical cargo silhouettes follow the same immutable footprint as placement. */
(function(root){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function bounds(mask){return{width:Math.max(...mask.map(p=>p[0]))+1,height:Math.max(...mask.map(p=>p[1]))+1};}
 function metadata(item,rotation=0){const G=root.LostCargo.Cargo,base=bounds(G.cells(item)),turned=bounds(G.cells(item,rotation));return{...turned,baseWidth:base.width,baseHeight:base.height,rotation,...root.SalvageCargoIdentity.resolve(item)};}
 function render(item,rotation=0){const m=metadata(item,rotation);return '<span class="cargo-visual" style="aspect-ratio:'+m.width+'/'+m.height+'"><img class="item-sprite cargo-footprint" src="'+m.src+'" alt="" data-footprint="'+esc(item.shapeId)+'" data-appearance="'+m.kind+'" data-identity="'+esc(m.identity)+'" data-rotation="'+rotation+'" style="width:'+m.baseWidth/m.width*100+'%;height:'+m.baseHeight/m.height*100+'%;transform:translate(-50%,-50%) rotate('+rotation*90+'deg)"></span>';}
 root.SalvageCargoArt={metadata,render};
})(globalThis);
