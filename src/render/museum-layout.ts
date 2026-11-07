/** Pixel measurements in each original 320px cell. Transparent cell centres are not physical anchors.
 * x/y are contact points on museum-room-v02's six plinth tops; front glass contains no second base.
 */
export const exhibitIds=['receipt','tape','nested','stamp','cosmic-parcel','bell'] as const;
const measurements=[
 {x:175,y:526,width:98,base:{x:172,y:298,w:164},crop:{x:86,y:12,w:173,h:288},cavity:{x:108,y:70,w:128,h:183},front:{x:104,y:56,w:138,h:201},item:{x:172,y:164,size:112}},
 {x:389,y:526,width:102,base:{x:137,y:298,w:181},crop:{x:42,y:82,w:191,h:218},cavity:{x:58,y:139,w:158,h:114},front:{x:58,y:139,w:158,h:114},item:{x:137,y:196,size:96}},
 {x:606,y:527,width:112,base:{x:193,y:303,w:270},crop:{x:47,y:46,w:273,h:260},cavity:{x:76,y:88,w:231,h:147},front:{x:69,y:70,w:243,h:167},item:{x:193,y:161,size:126}},
 {x:156,y:774,width:96,base:{x:179,y:293,w:130},crop:{x:113,y:16,w:135,h:280},cavity:{x:127,y:95,w:104,h:133},front:{x:125,y:81,w:110,h:164},item:{x:179,y:162,size:94}},
 {x:389,y:774,width:120,base:{x:173,y:294,w:172},crop:{x:86,y:0,w:179,h:297},cavity:{x:122,y:80,w:103,h:166},front:{x:122,y:73,w:103,h:153},item:{x:173.5,y:170,size:86}},
 {x:622,y:774,width:124,base:{x:137,y:297,w:203},crop:{x:34,y:89,w:207,h:212},cavity:{x:60,y:132,w:156,h:108},front:{x:60,y:128,w:154,h:80},item:{x:138,y:184,size:92}},
];
export const exhibits=measurements.map((e,i)=>({...e,id:exhibitIds[i],scale:e.width/e.base.w}));
export type Exhibit=typeof exhibits[number];
export const layerPoint=(e:Exhibit,x:number,y:number)=>({x:e.x+(x-e.base.x)*e.scale,y:e.y+(y-e.base.y)*e.scale});
export const itemCenter=(e:Exhibit)=>layerPoint(e,e.item.x,e.item.y);
