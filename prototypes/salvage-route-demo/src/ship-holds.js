/* Trusted ship geometry shared by the pure model and the browser. */
(function (root, factory) {
  const config = typeof module === 'object' && module.exports
    ? require('../../../design/star-salvage/v05/ship-holds-approved.json')
    : root.LostCargoHoldConfig;
  const api = factory(config);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LostCargoHolds = api;
})(globalThis, function (config) {
  'use strict';

  function space(shipId, level) {
    const ship = config.ships[shipId];
    const rows = ship?.levels[level];
    if (!rows || !Number.isInteger(level)) throw Error('未知货舱结构或等级');
    const width = rows[0].length;
    const height = rows.length;
    const usableCellMask = rows.map(row => row.split('').map(cell => cell === '#'));
    const [left, top, mainWidth, mainHeight] = ship.main;
    const mainHoldCells = [];
    const fixedTrayCells = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!usableCellMask[y][x]) continue;
        const inMain = x >= left && x < left + mainWidth && y >= top && y < top + mainHeight;
        (inMain ? mainHoldCells : fixedTrayCells).push([x, y]);
      }
    }
    return {
      width, height, usableCellMask, mainHoldCells, fixedTrayCells,
      capacity: mainHoldCells.length + fixedTrayCells.length,
      topologyVersion: config.topologyVersion, shipId, cargoLevel: level, label: ship.label
    };
  }

  return { space, version: config.topologyVersion };
});
