const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Cargo = require('../src/cargo-layout.js');
const Holds = require('../src/ship-holds.js');
const PORT = require('../../../design/star-salvage/v041/BALANCE_V041.json');

function item(shapeId, uid) {
  return { uid, shapeId, shapeVersion: 1, cells: Cargo.area(shapeId) };
}
function connected(cells) {
  const remaining = new Set(cells.map(cell => cell.join(',')));
  const queue = [cells[0]];
  remaining.delete(cells[0].join(','));
  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index];
    for (const next of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (remaining.delete(next.join(','))) queue.push(next);
    }
  }
  return remaining.size === 0;
}
let randomState = 5102026;
function random(max) {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) % max;
}
function simulateLoad(items, space) {
  const geometry = Cargo.dimensions(space);
  const capacity = space.usableCellMask
    ? space.usableCellMask.flat().filter(Boolean).length
    : geometry.width * geometry.height;
  let current = [];
  let placements = [];
  let rearranges = 0;
  let acceptedCells = 0;
  let declinedWithEnoughArea = 0;
  for (const next of items) {
    const all = [...current, next];
    let layout = Cargo.extend(all, placements, space);
    if (!layout) {
      layout = Cargo.solve(all, placements, space);
      if (layout) rearranges++;
    }
    if (layout) {
      current = all;
      placements = layout;
      acceptedCells += next.cells;
    } else if (capacity - acceptedCells >= next.cells) {
      declinedWithEnoughArea++;
    }
  }
  const occupied = new Set(placements.flatMap(placement =>
    Cargo.cells(current.find(entry => entry.uid === placement.uid), placement.rotation)
      .map(([x, y]) => [x + placement.x, y + placement.y].join(','))));
  const free = new Set();
  for (let y = 0; y < geometry.height; y++) {
    for (let x = 0; x < geometry.width; x++) {
      if ((!space.usableCellMask || space.usableCellMask[y][x]) && !occupied.has([x, y].join(','))) free.add([x, y].join(','));
    }
  }
  const isolatedFreeCells = [...free].filter(key => {
    const [x, y] = key.split(',').map(Number);
    return ![[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(cell => free.has(cell.join(',')));
  }).length;
  return { acceptedCells, rearranges, items: current.length, unusedCells: free.size,
    isolatedFreeCells, declinedWithEnoughArea };
}
const report = { isolatedOnly: true, seed: randomState, casesPerLevel: 120, levels: [] };
const normalShapes = ['point1', 'line2', 'ell3', 'line3', 'square4', 'tee4', 'ell5', 'rect6', 'ell7', 'rect8'];
for (const [shipId, spec] of Object.entries(PORT.ships)) {
  let previous = [];
  for (let level = 0; level <= spec.cargoUpgradeCosts.length; level++) {
    const space = Holds.space(shipId, level);
    const cells = [...space.mainHoldCells, ...space.fixedTrayCells];
    const capacity = spec.width * (spec.height + level);
    assert.equal(space.capacity, capacity);
    assert.equal(new Set(cells.map(cell => cell.join(','))).size, capacity);
    assert(connected(cells));
    assert(previous.every(([x, y]) => space.usableCellMask[y]?.[x]));
    assert(Cargo.solve([item('legacy16', 1)], [], space));
    const dominoes = Array.from({ length: Math.floor(capacity / 2) }, (_, index) => item('line2', index + 1));
    if (capacity % 2) dominoes.push(item('point1', dominoes.length + 1));
    assert(Cargo.solve(dominoes, [], space), 'whole two-cell goods must fill this hold');
    for (const shape of Object.keys(Cargo.SHAPES)) {
      const packed = Cargo.solve([item(shape, 1)], [], space);
      assert(packed && Cargo.validate([item(shape, 1)], packed, space).ok);
    }
    for (let y = 0; y < space.height; y++) {
      for (let x = 0; x < space.width; x++) {
        assert.equal(Cargo.place([item('point1', 1)], [], 1, x, y, 0, space).ok, space.usableCellMask[y][x]);
      }
    }
    assert(Cargo.validate([item('point1', 1), item('point1', 2)], [
      { uid: 1, x: cells[0][0], y: cells[0][1], rotation: 0 },
      { uid: 2, x: cells.at(-1)[0], y: cells.at(-1)[1], rotation: 0 }
    ], space).ok);
    const emptyMetrics = () => ({ packed: 0, acceptedCells: 0, rearranges: 0, items: 0,
      unusedCells: 0, isolatedFreeCells: 0, declinedWithEnoughArea: 0 });
    const metrics = { shipId, level, capacity, rows: space.usableCellMask.map(row => row.map(v => v ? '#' : '.').join('')),
      baseline: emptyMetrics(), bc: emptyMetrics() };
    for (let sample = 0; sample < report.casesPerLevel; sample++) {
      const items = [];
      let total = 0;
      while (total < capacity) {
        const shape = normalShapes[random(normalShapes.length)];
        const next = item(shape, items.length + 1);
        if (total + next.cells > capacity) break;
        items.push(next);
        total += next.cells;
      }
      for (const [name, geometry] of [['baseline', { width: spec.width, height: spec.height + level }], ['bc', space]]) {
        const packed = Cargo.solve(items, [], geometry);
        if (packed) {
          assert(Cargo.validate(items, packed, geometry).ok);
          metrics[name].packed++;
        }
        const load = simulateLoad(items, geometry);
        for (const key of Object.keys(load)) metrics[name][key] += load[key];
      }
    }
    report.levels.push(metrics);
    previous = cells;
  }
}
assert.throws(() => Cargo.dimensions({ width: 6, height: 6 }));
const output = path.resolve(__dirname, '../../../releases/v05-isolated-geometry.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log('PASS 11 ship levels: area, connected core, monotone upgrades, all shapes, blocked cells, 30 compressed bits.');
console.log(JSON.stringify(report.levels.map(({ shipId, level, capacity, baseline, bc }) => ({ shipId, level, capacity, baseline, bc })), null, 2));
