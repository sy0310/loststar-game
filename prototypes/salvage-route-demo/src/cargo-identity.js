/* Presentation-only inventory. Never changes item IDs, masks, value or saved data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SalvageCargoIdentity=api;})(globalThis,function(){
 'use strict';
 const variants={broken_engine:['line2','rect8','tee4'],energy_battery:['line2','ell3','line3'],nav_chip:['line2','ell5'],sample:['ell3','line3'],medkit:['line2']};
 const pairs=Object.entries(variants).flatMap(([itemId,shapes])=>shapes.map(shapeId=>({itemId,shapeId,id:'cargo_'+itemId+'_'+shapeId})));
 // These three actual metal cargo silhouettes already show one complete panel or case.
 const retained=[['metal_crate','line2'],['metal_crate','ell3'],['metal_crate','rect6']].map(([itemId,shapeId])=>({itemId,shapeId,id:'cargo_'+shapeId}));
 function resolve(item){
  if(item.shapeId==='point1')return{src:'./assets/v04/item_'+item.itemId+'@2x.png',kind:'item',identity:item.itemId};
  const pair=pairs.find(x=>x.itemId===item.itemId&&x.shapeId===item.shapeId);
  if(pair)return{src:'./assets/v042/'+pair.id+'@2x.png',kind:'identity',identity:item.itemId+':'+item.shapeId};
  const shape=({legacy4:'square4',legacy8:'rect8'})[item.shapeId]||item.shapeId;
  return{src:'./assets/v041/cargo_'+shape+'@2x.png',kind:item.itemId==='metal_crate'?'metal-body':'preserved-packaging',identity:item.itemId+':'+item.shapeId};
 }
 return{pairs,retained,resolve};
});
