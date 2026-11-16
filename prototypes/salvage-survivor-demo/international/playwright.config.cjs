const path = require('node:path');
const base = require('../playwright.config.cjs');
module.exports = {
  ...base,
  testDir: './tests',
  outputDir: path.resolve('releases/survivor-global-private/test-results'),
  reporter: [['list'], ['json', { outputFile: path.resolve('artifacts/survivor-global/browser.json') }]],
  use: { ...base.use, baseURL: process.env.SURVIVOR_GLOBAL_URL || 'http://127.0.0.1:4460/' },
};
