import { defineConfig } from 'vitest/config';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const version=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).version;
const commit=execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim();
let dirty=false;try{execFileSync('git',['diff','--quiet','--','src','package.json','package-lock.json','vite.config.ts']);}catch{dirty=true;}
export default defineConfig({
  define:{__BUILD_INFO__:JSON.stringify({version,commit,dirty})},
  build:{rollupOptions:{input:{game:new URL('./index.html',import.meta.url).pathname}}},
  server: { host: '127.0.0.1' },
  test: { include: ['tests/*.test.ts'], coverage: { provider: 'v8', include: ['src/game/**','src/prototype/guard-engine.ts','src/prototype/night-model.ts','src/render/base-motion.ts','src/render/museum-layout.ts'], thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 } } },
});
