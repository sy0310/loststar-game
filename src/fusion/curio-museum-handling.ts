/** Unique read-only 192px handling anchors. Hands grip fixed structure, never active caps/lids/paper.
 * Tape/bell coordinates are the v042 static proposal until root approves final physical registration. */
export type CurioHandlingPoint=Readonly<{x:number;y:number}>;
export interface CurioHandling{left:readonly[CurioHandlingPoint,CurioHandlingPoint];right:readonly[CurioHandlingPoint,CurioHandlingPoint];bounds:Readonly<{left:number;top:number;right:number;bottom:number}>;contactSurface:string}
export const renewalCurioMuseumHandling:Readonly<Record<'receipt'|'tape'|'nested'|'stamp'|'cosmic-parcel'|'bell',CurioHandling>>={
 receipt:{left:[{x:36,y:167},{x:50,y:168}],right:[{x:125,y:169},{x:137,y:165}],bounds:{left:29,top:5.5,right:159.5,bottom:195},contactSurface:'fixed archival lower brass ledge, not paper'},
 tape:{left:[{x:48,y:148},{x:60,y:151}],right:[{x:130,y:149},{x:140,y:143}],bounds:{left:16,top:12,right:164,bottom:163},contactSurface:'fixed lower dispenser frame'},
 nested:{left:[{x:36,y:148},{x:47,y:151}],right:[{x:126,y:158},{x:136,y:153}],bounds:{left:30,top:32.5,right:174.5,bottom:172},contactSurface:'fixed box body lower reinforced corner, not lid'},
 stamp:{left:[{x:48,y:171},{x:59,y:174}],right:[{x:155,y:160},{x:163,y:151}],bounds:{left:43,top:4,right:173,bottom:183},contactSurface:'fixed copper side/base, not handle or date roller'},
 'cosmic-parcel':{left:[{x:24,y:151},{x:36,y:156}],right:[{x:162,y:137},{x:166,y:125}],bounds:{left:17,top:20,right:177,bottom:174},contactSurface:'lower box body corner, not band/tag'},
 bell:{left:[{x:40,y:150},{x:52,y:155}],right:[{x:141,y:156},{x:154,y:151}],bounds:{left:28,top:30.5,right:168,bottom:168.5},contactSurface:'fixed lower purple base'},
};
