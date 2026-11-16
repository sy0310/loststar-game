/** World registrations, shared by rendering and source diagnostics only.
 * These are the existing contacts; no task, journey seed or saved coordinate moves.
 */
export const firstPlanetFacilities = {
  reception: {
    id: 'parcel/receiving-station',
    renderer: 'render/scene:visual-renewal/world/station.webp',
    anchor: {x: 315, y: 417},
    nativeSize: {width: 256, height: 235},
    sprite: {x: 230, y: 261, width: 170, height: 156},
    doorOpening: [{x:264.53,y:350.65},{x:306.37,y:351.31},{x:306.37,y:401.10},{x:264.53,y:399.80}],
    doorLight: {x:283,y:388},
    unload: {grip:{x:293,y:389},tray:{x:291,y:403}},
  },
  sortingMachine: {
    id: 'parcel/old-sorting',
    renderer: 'fusion/sorting-scene:visual-renewal/world/sorter',
    anchor: {x: 410, y: 315},
    width: 148,
    nativeSize: 320,
    contact: {x: 116, y: 279},
    layers: ['rear-and-rollers', 'paper-and-parcel', 'front-lip'],
  },
  securityMast: {
    id: 'parcel/security-mast',
    renderer: 'render/security-mast:visual-renewal/world/security-mast',
    anchor: {x: 568, y: 294},
    emitter: {x: 557.3, y: 208},
    layers: ['ground-shadow', 'braced-textured-post', 'beacon-head'],
  },
} as const;

export function sortingMachinePoint(x: number, y: number) {
  const machine = firstPlanetFacilities.sortingMachine;
  const scale = machine.width / machine.nativeSize;
  return {
    x: machine.anchor.x + (x - machine.contact.x) * scale,
    y: machine.anchor.y + (y - machine.contact.y) * scale,
  };
}
