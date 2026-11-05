/** World registrations, shared by rendering and source diagnostics only.
 * These are the existing contacts; no task, journey seed or saved coordinate moves.
 */
export const firstPlanetFacilities = {
  reception: {
    id: 'parcel/receiving-station',
    renderer: 'render/scene:warehouse.webp',
    anchor: {x: 315, y: 417},
  },
  sortingMachine: {
    id: 'parcel/old-sorting',
    renderer: 'fusion/sorting-scene:refinement/sorting-machine',
    anchor: {x: 410, y: 315},
    width: 148,
    nativeSize: 320,
    contact: {x: 116, y: 279},
    layers: ['rear-and-rollers', 'paper-and-parcel', 'front-lip'],
  },
  securityMast: {
    id: 'parcel/security-mast',
    renderer: 'render/security-mast:original-material-assembly',
    anchor: {x: 568, y: 294},
    emitter: {x: 559, y: 208},
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
