import {defineConfig,mergeConfig} from 'vite';
import base from './vite.config';
export default mergeConfig(base,defineConfig({define:{__D1_PREVIEW__:true},build:{outDir:'dist-d1'}}));
