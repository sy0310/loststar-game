import {defineConfig,mergeConfig} from 'vite';
import base from './vite.config';
export default mergeConfig(base,defineConfig({
  plugins:[{name:'d1-review-entry',transformIndexHtml:{order:'pre',handler:html=>html.replace('src="/src/main.ts"','src="/src/entry.ts"')}}],
  build:{outDir:'dist-d1'},
}));
