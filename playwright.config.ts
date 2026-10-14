import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/ui',
  workers:1,
  use:{baseURL:'http://127.0.0.1:1427',viewport:{width:1050,height:720},channel:process.platform==='win32'?'chrome':undefined,trace:'retain-on-failure'},
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 1427',url:'http://127.0.0.1:1427',reuseExistingServer:false},
});
