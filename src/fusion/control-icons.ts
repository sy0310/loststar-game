/** Authored 48-unit pixel controls. Purposeful brass bevels and internal mechanics,
 * not scaled 24-unit silhouettes or a procedural noise layer. */
const ink='var(--fu-icon-ink,#271731)',shade='var(--fu-icon-shade,#75465e)',metal='var(--fu-icon-metal,#d49b5b)',light='var(--fu-icon-light,#ffe7b0)',violet='var(--fu-icon-violet,#855e9e)',panel='var(--fu-icon-panel,#432850)',paper='var(--fu-icon-paper,#f1d8ad)',cyan='var(--fu-icon-cyan,#7bdce7)';
const p=(fill:string,d:string)=>`<path fill="${fill}" d="${d}"/>`;
const r=(fill:string,x:number,y:number,w:number,h:number)=>`<rect fill="${fill}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const art:Record<string,string>={
 planet:
 p(ink,'M17 3h14v2h6v4h5v6h3v18h-3v6h-5v4h-6v2H17v-2h-6v-4H6v-6H3V15h3V9h5V5h6z')+
 p(shade,'M17 5h14v2h6v4h4v6h2v14h-2v6h-4v4h-6v2H17v-2h-6v-4H7v-6H5V17h2v-6h4V7h6z')+
 p(metal,'M17 5h14v2h6v4h4v6h2v12h-2v6h-4v4h-6v2H17v-2h-6v-4H7v-6H5V17h2v-6h4V7h6z')+
 p(panel,'M18 9h12v2h6v4h3v6h2v7h-2v6h-3v3h-6v2H18v-2h-6v-3H9v-6H7v-7h2v-6h3v-4h6z')+
 p(violet,'M18 10h6v2h-5v5h-3v7h-1v6h2v5h4v3h-4v-2h-4v-4h-2v-6H9v-5h2v-6h4v-3h3z M25 11h4v3h3v8h1v7h-2v7h-4v-3h2v-6h1v-6h-1v-6h-4z')+
 p(metal,'M23 9h2v30h-2z M9 23h30v2H9z M13 15h22v2H13z M12 32h24v2H12z')+
 p(light,'M17 6h13v1H17z M11 9h6v1h-5v4h-2v5H8v-5h2v-4h1z M24 11h1v10h-1z M10 23h12v1H10z')+
 r(cyan,30,18,4,3)+r(metal,33,28,3,3),
 radar:
 p(ink,'M15 3h18v3h6v4h4v6h2v16h-2v6h-4v4h-6v3H15v-3H9v-4H5v-6H3V16h2v-6h4V6h6z')+
 p(shade,'M15 5h18v3h6v4h3v5h2v14h-2v6h-3v3h-6v3H15v-3H9v-3H6v-6H4V17h2v-5h3V8h6z')+
 p(metal,'M16 4h16v3h6v4h4v6h2v13h-2v6h-4v4h-6v3H16v-3h-6v-4H6v-6H4V17h2v-6h4V7h6z')+
 p(panel,'M17 9h14v2h6v6h2v14h-2v5h-6v3H17v-3h-6v-5H9V17h2v-6h6z')+
 p(violet,'M17 13h14v2h4v5h2v9h-2v5h-4v2H17v-2h-4v-5h-2v-9h2v-5h4z')+
 p(panel,'M18 15h12v2h3v5h2v6h-2v4h-3v2H18v-2h-3v-4h-2v-6h2v-5h3z')+
 p(shade,'M23 10h2v28h-2z M10 23h28v2H10z')+
 p(cyan,'M23 24V12h2v9h3v-4h3v-3h2v4h-3v4h-3v4h-4z')+
 p(light,'M16 5h15v1H16z M10 8h5v2h-4v4H9v5H7v-7h3z M22 23h5v3h-5z')+r(metal,32,29,3,3)+r(paper,16,18,2,2),
 rocket:
 p(ink,'M30 3h15v14h-3v6h-4v6h-6v5h-5v5h-6v6H4V29h6v-6h6v-5h5v-6h5V7h4z')+
 p(shade,'M30 5h13v12h-3v5h-5v6h-5v5h-5v5h-7v5H6V30h6v-6h6v-5h5v-6h5V8h2z')+
 p(metal,'M31 5h12v11h-3v5h-5v5h-5v5h-5v-3h-6v-5h6v-6h5V9h1z')+
 p(paper,'M32 8h8v8h-3v4h-5v5h-5v-3h-3v-2h5v-5h5z')+
 p(violet,'M14 24h6v3h5v6h-6v5h-7v-9H8v3H6v-4h5v-4z M26 34h5v-4h5v8h-5v4h-8v-5h3z')+
 p(panel,'M29 12h7v8h-8v-6h1z')+p(cyan,'M30 13h5v5h-6v-4h1z')+r(light,30,13,2,2)+
 p(light,'M32 6h9v1h-8v3h-2V8h1z M11 31h2v4h-2z')+
 p(cyan,'M15 33h4v4h-3v4h-5v-4h4z')+p(paper,'M15 35h2v2h-2v2h-2v-2h2z'),
 book:
 p(ink,'M3 7h14v2h6v3h2V9h6V7h14v32H29v3H19v-3H3z')+
 p(shade,'M4 10h12v2h6v3h4v-3h6v-2h12v29H29v3H19v-3H4z')+
 p(metal,'M4 8h12v2h6v3h4v-3h6V8h12v28H29v3H19v-3H4z')+
 p(panel,'M6 11h11v2h5v22h-4v-2H6z M26 15h4v-2h11v20H29v2h-3z')+
 p(paper,'M7 10h9v2h5v21h-4v-2H7z M27 15h4v-3h10v20H30v2h-3z')+
 p(violet,'M10 15h7v2h-7z M10 20h8v1h-8z M10 24h8v1h-8z M31 17h7v2h-7z M31 22h7v1h-7z M31 26h7v1h-7z')+
 p(light,'M7 10h9v1H7z M27 15h1v17h-1z M31 12h9v1h-9z')+r(metal,23,16,2,22)+r(light,23,16,1,20),
 base:
 p(ink,'M21 3h6v3h4v4h5v4h5v5h4v26H3V19h4v-5h5v-4h5V6h4z')+
 p(shade,'M21 6h6v3h5v4h5v5h5v25H6V20h5v-5h5v-4h5z')+
 p(violet,'M21 5h6v3h4v4h5v4h5v4H7v-4h5v-4h5V8h4z')+
 p(light,'M21 5h6v1h-5v3h-4v4h-5v4H8v2H6v-3h5v-4h5V8h5z')+
 p(metal,'M8 20h32v22H8z')+p(shade,'M33 20h7v22h-7z M8 39h32v3H8z')+
 p(panel,'M18 27h12v15H18z M11 25h5v8h-5z M33 25h5v8h-5z')+
 p(paper,'M19 22h10v5H19z')+p(shade,'M20 23h8v1h-3v2h-2v-2h-3z')+
 r(cyan,12,26,3,5)+r(cyan,34,26,3,5)+r(light,9,21,2,17)+r(metal,27,35,1,3)+r(light,19,28,1,12),
 bolt:
 p(ink,'M24 2h17v5h-4v5h-4v5h-3v3h12v6h-5v5h-4v5h-4v5h-4v5H12V30H4v-6h4v-5h4v-5h4V9h4V5h4z')+
 p(shade,'M25 4h14v3h-4v5h-4v5h-4v5h13v3h-5v5h-4v5h-4v5h-4v4h-9V28H6v-3h4v-5h4v-5h4v-5h4V6h3z')+
 p(metal,'M25 3h13v3h-4v5h-4v5h-4v6h12v3h-5v5h-4v5h-4v5h-7V27H7v-3h4v-5h4v-5h4V9h4V5h2z')+
 p(light,'M25 4h10v1h-9v4h-3v5h-4v5h-4v5h-4v2H8v-2h3v-5h4v-5h4V9h4V5h2z')+
 p(paper,'M21 25h3v11h-2v4h-2V27h-5v-1h6z'),
 cube:
 p(ink,'M22 3h5v2h6v3h6v3h6v25h-5v3h-6v3h-6v3h-7v-3h-6v-3H9v-3H3V11h6V8h6V5h7z')+
 p(shade,'M23 6h3v2h7v3h6v3h4v20h-5v3h-6v3h-7v3h-3v-3h-6v-3h-6v-3H5V14h5v-3h6V8h7z')+
 p(metal,'M23 5h3v2h7v3h6v3h3v21h-5v3h-6v3h-7v2h-2v-2h-6v-3h-6v-3H6V14h4v-3h6V8h7z')+
 p(light,'M23 6h3v2h7v3h6v2h-7v3h-7v3h-3v-3h-7v-3h-5v-1h7V9h6z')+
 p(panel,'M25 21h6v-3h6v-3h4v18h-5v3h-6v3h-5z')+
 p(violet,'M27 23h5v-3h5v-2h2v5h-4v3h-5v9h-3z')+
 p(paper,'M7 16h2v16H7z M11 18h4v2h-4z M11 29h4v2h-4z')+r(shade,17,23,5,7)+r(light,18,24,2,4)+r(metal,34,29,3,4),
 gear:
 p(ink,'M18 2h12v6h6V5h6v7h-3v6h7v12h-7v6h3v7h-7v-4h-5v7H18v-7h-5v4H5v-7h4v-6H2V18h7v-6H5V5h7v3h6z')+
 p(shade,'M20 5h8v6h7V8h4v4h-3v8h7v8h-7v8h3v4h-4v-4h-7v7h-8v-7h-8v4H8v-4h4v-8H5v-8h7v-8H8V8h4v3h8z')+
 p(metal,'M20 3h8v7h7V7h5v4h-4v9h8v8h-8v8h4v5h-5v-5h-7v8h-8v-8h-8v5H7v-5h4v-8H3v-8h8v-9H7V7h5v3h8z')+
 p(light,'M20 4h7v1h-6v6H11v-1h9z M8 7h3v1H8z M4 20h7v1H5v6H4z M12 12h3v2h-3z M32 12h3v2h-3z')+
 p(panel,'M19 13h10v3h4v4h2v9h-3v4h-4v2h-9v-3h-4v-4h-2v-9h3v-4h3z')+
 p(violet,'M20 15h8v2h3v4h2v7h-3v3h-4v2h-6v-3h-3v-4h-2v-6h3v-3h2z')+
 p(metal,'M21 19h6v2h2v6h-2v2h-6v-2h-2v-6h2z')+
 r(panel,22,22,4,4)+r(light,21,19,5,1)+r(cyan,31,25,2,3),
 arrow:
 p(ink,'M24 6h7v4h4v4h4v4h6v12h-6v4h-4v4h-4v4h-7V31H3V17h21z')+
 p(shade,'M26 9h3v4h4v4h4v3h6v8h-6v4h-4v4h-4v3h-3V29H5V20h21z')+
 p(metal,'M25 7h4v4h4v4h4v4h6v8h-6v4h-4v4h-4v4h-4V28H4V19h21z')+
 p(light,'M26 8h2v4h4v4h4v4h5v1h-6v-4h-4v-4h-4V10h-1z M5 20h19v1H5z')+
 p(paper,'M9 23h20v-8h2v9h6v1h-8v7h-1v-7H9z'),
 close:
 p(ink,'M7 5h6v4h4v4h4v4h6v-4h4V9h4V5h6v8h-4v4h-4v4h-3v6h3v4h4v4h4v8h-7v-5h-4v-4h-4v-4h-4v4h-4v4h-4v5H5v-8h4v-4h4v-4h4v-6h-4v-4H9v-4H5V5z')+
 p(shade,'M8 8h3v4h4v4h4v4h10v-4h4v-4h4V8h3v4h-4v4h-4v4h-4v10h4v4h4v4h4v3h-4v-4h-4v-4h-4v-4H19v4h-4v4h-4v4H7v-3h4v-4h4v-4h4V20h-4v-4h-4v-4H7V8z')+
 p(metal,'M7 6h4v4h4v4h4v4h10v-4h4v-4h4V6h3v5h-4v4h-4v4h-4v10h4v4h4v4h4v4h-4v-4h-4v-4h-4v-4H19v4h-4v4h-4v4H7v-4h4v-4h4v-4h4V19h-4v-4h-4v-4H7z')+
 p(light,'M8 7h2v4h4v4h4v3h-1v-2h-4v-4H9v-4H8z M37 7h2v2h-2z M21 21h5v2h-5z'),
 receipt:
 p(ink,'M11 3h28v36h-4v6h-7v-3h-6v3h-7v-3H8V9h3z')+
 p(shade,'M12 6h25v31h-4v5h-4v-3h-8v3h-4v-3h-6V10h1z')+
 p(paper,'M12 5h24v31h-4v5h-3v-3h-9v3h-3v-3h-6V10h1z')+
 p(light,'M13 6h21v1H14v29h-2V10h1z')+
 p(violet,'M17 11h13v3H17z M17 18h14v2H17z M17 23h9v1h-9z M17 27h14v1H17z M17 32h6v2h-6z')+
 p(metal,'M31 5h5v6h-6V9h1z')+r(panel,27,31,6,4)+r(paper,28,32,4,2),
 tape:
 p(ink,'M20 3h14v3h7v6h4v19h-6v5h-8v9H3V28h7V13h4V7h6z')+
 p(shade,'M21 6h12v3h7v5h3v15h-6v5h-8v9H5V30h8V15h3v-5h5z')+
 p(metal,'M21 4h12v3h7v6h3v15h-6v5H17v-4h-5V15h4V9h5z')+
 p(light,'M21 5h11v1H22v3h-5v6h-3v7h-1v-8h3V8h5z')+
 p(violet,'M22 11h10v3h5v12h-5v3H22v-3h-5V15h5z')+
 p(ink,'M24 14h6v2h3v8h-3v2h-6v-2h-3v-8h3z')+
 p(paper,'M14 27h8v6h7v7H8v-8h6z')+p(shade,'M9 37h19v3H9z')+r(light,15,28,2,6)+r(cyan,33,29,3,2),
 nested:
 p(ink,'M20 3h9v3h7v4h8v28h-6v4h-8v3H18v-4h-8v-4H4V11h8V7h8z')+
 p(shade,'M20 6h9v3h7v4h6v23h-6v4h-8v3h-8v-4h-8v-4H6V14h7v-4h7z')+
 p(metal,'M20 4h8v3h7v4h7v23h-6v4h-8v3h-8v-4h-8v-4H6V13h7V9h7z')+
 p(light,'M20 5h7v3h7v4h5v2h-7v3h-7v3h-5v-3h-7v-3H8v-1h7V10h5z')+
 p(panel,'M25 21h7v-3h8v15h-6v4h-9z')+
 p(violet,'M27 23h6v-3h5v6h-5v3h-6z')+
 p(paper,'M10 17h7v3h6v16h-5v-3h-8z')+p(shade,'M13 22h6v2h-6z M13 27h6v2h-6z')+r(light,11,18,1,13),
 mouse:
 p(ink,'M8 4h10v7h13V4h10v14h-4v17h-7v8H18v-8h-7V18H7V4z')+
 p(shade,'M10 7h6v7h17V7h6v9h-4v17h-6v7H19v-7h-6V16h-3z')+
 p(paper,'M9 5h8v8h15V5h8v11h-4v17h-7v7H19v-7h-7V16H9z')+
 p(violet,'M11 7h4v7h-4z M34 7h4v7h-4z M15 17h19v14h-5v7h-9v-7h-5z')+
 p(metal,'M18 30h12v4h-5v3h-3v-3h-4z')+
 r(ink,17,21,5,6)+r(ink,28,21,5,6)+r(light,18,21,2,3)+r(light,29,21,2,3)+r(shade,8,28,8,1)+r(shade,33,28,8,1)+r(light,13,17,2,5),
 signal:
 p(ink,'M20 2h9v6h4v7h4v7h5v7h4v16H2V29h4v-7h5v-7h4V8h5z')+
 p(shade,'M21 5h7v6h4v6h4v7h4v7h3v12H5V31h4v-7h4v-7h4v-6h4z')+
 p(metal,'M21 3h6v7h4v7h4v6h5v7h3v12H5V30h4v-7h4v-6h4v-7h4z')+
 p(light,'M22 4h4v1h-3v6h-4v7h-4v6h-4v7H8v9H6V30h4v-7h4v-6h4v-7h4z')+
 p(panel,'M22 12h5v18h-5z M22 34h5v5h-5z')+r(cyan,23,14,2,13)+r(paper,23,35,2,2),
};
export const controlGlyphIds=Object.keys(art);
export function controlIcon(id:string,cls=''){
 const name=Object.prototype.hasOwnProperty.call(art,id)?id:'planet';
 return `<svg class="icon fu-pixel-icon ${cls.replace(/[^a-zA-Z0-9_ -]/g,'')}" viewBox="0 0 48 48" shape-rendering="crispEdges" aria-hidden="true" focusable="false" data-control-glyph="${name}">${art[name]}</svg>`;
}
