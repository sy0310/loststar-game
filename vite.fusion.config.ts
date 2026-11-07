import {defineConfig, mergeConfig} from 'vite';
import base from './vite.config';

export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'fusion-play-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace('src="/src/main.ts"', 'src="/src/fusion/entry.ts"'),
    },
  }],
  build: {outDir: 'dist-fusion'},
}));
