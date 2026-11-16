import { defineConfig } from 'vitest/config';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const version=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).version;
const commit=execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim();
let dirty=false;try{execFileSync('git',['diff','--quiet','--','src','package.json','package-lock.json','vite.config.ts']);}catch{dirty=true;}
export default defineConfig({
  define:{__BUILD_INFO__:JSON.stringify({version,commit,dirty})},
  plugins:[{name:'d1-development-entry',apply:'serve',transformIndexHtml:{order:'pre',handler(html,context){
    const sample=new URL(context.originalUrl??context.path,'http://localhost').searchParams.get('sample');
    if(sample==='art-v036')return html.replace('src="/src/main.ts"','src="/src/review/v036-entry.ts"');
    if(sample==='fusion'||sample==='refinement'||sample==='first-planet')return html.replace('src="/src/main.ts"','src="/src/fusion/entry.ts"');
    if(sample==='week1')return html.replace('src="/src/main.ts"','src="/src/review/v034-entry.ts"');
    return sample==='night-d1'||sample==='receipt-d1'?html.replace('src="/src/main.ts"','src="/src/entry.ts"'):html;
  }}}],
  build:{rollupOptions:{input:{game:new URL('./index.html',import.meta.url).pathname}}},
  server: { host: '127.0.0.1' },
  test: { include: ['tests/*.test.ts'], coverage: { provider: 'v8', include: ['src/game/**','src/prototype/guard-engine.ts','src/prototype/night-model.ts','src/render/base-motion.ts','src/render/museum-layout.ts','src/review/receipt-restoration.ts','src/review/v034-night-model.ts','src/review/resident-daily.ts','src/review/v034-budget.ts'], thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 } } },
});
