import {defineConfig, mergeConfig} from 'vite';
import base from './vite.config';

export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'week-one-review-entry',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace('src="/src/main.ts"', 'src="/src/review/v034-entry.ts"'),
    },
  }],
  build: {outDir: 'dist-v034'},
}));
