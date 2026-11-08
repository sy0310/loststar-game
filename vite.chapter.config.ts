import {defineConfig,mergeConfig} from 'vite';
import reference from './prototypes/ref-ui/vite.config';
import {execFileSync} from 'node:child_process';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=!!execFileSync('git',['status','--porcelain','--','src','prototypes/ref-ui','vite.chapter.config.ts'],{encoding:'utf8'}).trim();
export default mergeConfig({...reference,plugins:reference.plugins?.filter((p:unknown)=>(p as {name?:string})?.name!=='isolated-reference-ui')},defineConfig({
 define:{__REFUI_BUILD__:JSON.stringify({version:'0.4.6-chapter.1',commit,dirty})},
 plugins:[{name:'parcel-chapter',transformIndexHtml:{order:'pre',handler:html=>html.replace('src="/src/main.ts"','src="/src/chapter/entry.ts"')}}],
 build:{outDir:'releases/chapter-dist'},
}));
