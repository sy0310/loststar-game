import {defineConfig, mergeConfig} from 'vite';
import base from '../../vite.config';
import {execFileSync} from 'node:child_process';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=!!execFileSync('git',['status','--porcelain','--','src','assets/runtime','assets/source','prototypes/ref-ui'],{encoding:'utf8'}).trim();
export default mergeConfig(base, defineConfig({
  define:{__REFUI_BUILD__:JSON.stringify({version:'0.4.5-ui-sample.1',commit,dirty})},
  plugins: [{name: 'isolated-reference-ui', transformIndexHtml: {order: 'pre', handler: html => html.replace('src="/src/main.ts"', 'src="/prototypes/ref-ui/entry.ts"')}}],
  build: {outDir: 'releases/ref-ui-dist'},
}));
