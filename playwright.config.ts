import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e', fullyParallel:true, workers:2, retries:0,
  reporter:[['list'],['json',{outputFile:'artifacts/e2e-results.json'}]],
  use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[
    {name:'mobile-360',testIgnore:'**/mobile-touch.spec.ts',use:{browserName:'chromium',viewport:{width:360,height:800},deviceScaleFactor:2}},
    {name:'mobile-390',testIgnore:'**/mobile-touch.spec.ts',use:{browserName:'chromium',viewport:{width:390,height:844},deviceScaleFactor:2}},
    {name:'desktop',testIgnore:'**/mobile-touch.spec.ts',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},
    {name:'webkit-390',testIgnore:'**/mobile-touch.spec.ts',use:{browserName:'webkit',viewport:{width:390,height:844},deviceScaleFactor:2}},
    {name:'touch-chromium',testMatch:'**/mobile-touch.spec.ts',use:{browserName:'chromium',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}},
    {name:'touch-webkit',testMatch:'**/mobile-touch.spec.ts',use:{browserName:'webkit',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}},
  ],
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},
});
