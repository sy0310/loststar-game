import {defineConfig} from 'vite';
import base from './vite.config';
export default defineConfig({...base,build:{outDir:'dist-night',rollupOptions:{input:'night-lab.html'}}});
