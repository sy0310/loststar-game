import {defineConfig, mergeConfig} from 'vite';
import base from './vite.config';

export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'v036-isolated-art-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace('src="/src/main.ts"', 'src="/src/review/v036-entry.ts"'),
    },
  }],
  build: {outDir: 'dist-v036'},
}));
