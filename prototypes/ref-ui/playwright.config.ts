import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({testDir:'.',testMatch:['reference.spec.ts','light-treatment.spec.ts'],workers:2,retries:0,timeout:45000,
 reporter:[['list'],['json',{outputFile:root+'releases/ref-ui-e2e-results.json'}]],
 use:{baseURL:'http://127.0.0.1:4256',hasTouch:true,deviceScaleFactor:2,screenshot:'only-on-failure'},
 outputDir:root+'releases/ref-ui-test-results',
 projects:[{name:'ref-360',use:{browserName:'chromium',viewport:{width:360,height:800}}},{name:'ref-390',use:{browserName:'chromium',viewport:{width:390,height:844}}},{name:'ref-webkit',use:{browserName:'webkit',viewport:{width:390,height:844}}},{name:'ref-desktop',use:{browserName:'chromium',viewport:{width:1440,height:1000}}}],
 webServer:{cwd:root,command:'npx vite --config prototypes/ref-ui/vite.config.ts --port 4256 --strictPort',url:'http://127.0.0.1:4256',reuseExistingServer:!process.env.CI}});
