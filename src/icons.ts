const paths:Record<string,string>={
  planet:'<ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-28 12 12)"/><path d="M6 8a7 7 0 0 1 13 5M18 16A7 7 0 0 1 5 11"/>',
  rocket:'<path d="m14 5 5-2 2 2-2 5-8 8-5-5zM13 6l5 5M6 13l-3 1 1 6 6 1 1-3M8 17l-4 4"/><circle cx="16" cy="8" r="2"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7M12 3v2M3 12h2M12 19v2M19 12h2"/>',
  book:'<path d="M12 5c-4-3-8-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zm0 0v15M6 8h3M15 8h3M6 12h3M15 12h3"/>',
  base:'<path d="M3 21V10l9-7 9 7v11zM9 21v-7h6v7M7 10h10M12 3V1"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-8z"/>',
  cube:'<path d="m12 2 9 5v10l-9 5-9-5V7zm0 10 9-5M12 12 3 7m9 5v10M7 4l10 6"/>',
  gear:'<path d="m9 3 1-2h4l1 2 3 2 3 1v4l-2 2 2 3v4l-4 1-2 3h-4l-2-3-4-1v-4l2-3-2-2V6l3-1z"/><circle cx="12" cy="12" r="4"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
  receipt:'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 6h6M9 10h6M9 14h4"/>',
  tape:'<ellipse cx="12" cy="9" rx="9" ry="6"/><ellipse cx="12" cy="9" rx="4" ry="2"/><path d="M3 9v7c0 4 18 4 18 0V9M5 18l-3 4h6l4-3"/>',
  nested:'<path d="m12 3 9 5v12H3V8zm0 0v10M3 8l9 5 9-5M8 16h8"/><path d="m7 1 5 2 5-2"/>',
  mouse:'<circle cx="5" cy="6" r="4"/><circle cx="19" cy="6" r="4"/><path d="M4 13c0-9 16-9 16 0 0 11-16 11-16 0zM8 13h1M15 13h1m-5 3 1 1 1-1"/>',
  signal:'<path d="m12 3 10 18H2zM12 8v6m0 3v1"/>',
};
export const icon=(id:string,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]??paths.planet}</svg>`;
