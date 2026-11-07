import {defineConfig, mergeConfig} from 'vite';
import postcss from 'postcss';
import base from '../../vite.config';
import {execFileSync} from 'node:child_process';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=!!execFileSync('git',['status','--porcelain','--','src','assets/runtime','assets/source','prototypes/ref-ui'],{encoding:'utf8'}).trim();
export default mergeConfig(base, defineConfig({
  define:{__REFUI_BUILD__:JSON.stringify({version:'0.4.5-ui-sample.5',commit,dirty})},
  plugins: [{name:'reference-quiet-material',enforce:'pre',transform(code,id){if(!id.endsWith('/src/fusion/ui.ts'))return;return code.replace("from './curio-condition'","from '../../prototypes/ref-ui/simple-material'");}},{name:'reference-layout-only',enforce:'pre',transform(code,id){if(!/\/src\/fusion\/(?:style|a-exploration)\.css(?:\?|$)/.test(id))return;const sheet=postcss.parse(code);sheet.walkDecls(decl=>{if(/^(?:background(?:-|$)|border(?:-|$)|color$|box-shadow$|text-shadow$|filter$|clip-path$)/.test(decl.prop))decl.remove();else decl.important=false;});return {code:`@layer legacy {${sheet.toString()}}`,map:null};}},{name: 'isolated-reference-ui', transformIndexHtml: {order: 'pre', handler: html => html.replace('src="/src/main.ts"', 'src="/prototypes/ref-ui/entry.ts"')}}],
  build: {outDir: 'releases/ref-ui-dist'},
}));
