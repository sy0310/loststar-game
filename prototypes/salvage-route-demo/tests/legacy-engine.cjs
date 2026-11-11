/* Load immutable runtime modules and JSON from one Git revision for compatibility checks. */
const vm = require('node:vm');
const childProcess = require('node:child_process');
const path = require('node:path');

module.exports = function loadLegacy(revision = 'b26455ada31fe1ab780905cdb1c26f1387c082bb') {
  const root = path.resolve(__dirname, '../../..');
  const context = vm.createContext({});
  const cache = new Map();
  function load(name) {
    const canonical = path.posix.normalize(name);
    if (canonical.startsWith('../') || path.posix.isAbsolute(canonical)) throw Error('Frozen dependency escapes repository');
    if (cache.has(canonical)) return cache.get(canonical).exports;
    const source = childProcess.execFileSync('git', ['show', revision+':'+canonical], { cwd:root, encoding:'utf8' });
    const module = { exports:{} };
    cache.set(canonical, module);
    if (canonical.endsWith('.json')) module.exports = JSON.parse(source);
    else {
      const wrapper = new vm.Script('(function(require,module,exports){\n'+source+'\n})', { filename:revision+':'+canonical }).runInContext(context);
      const requireFrozen = dependency => {
        if (!dependency.startsWith('.')) throw Error('Unsupported frozen dependency '+dependency);
        return load(path.posix.join(path.posix.dirname(canonical), dependency));
      };
      wrapper(requireFrozen, module, module.exports);
    }
    return module.exports;
  }
  return load('prototypes/salvage-route-demo/src/engine.js');
};
