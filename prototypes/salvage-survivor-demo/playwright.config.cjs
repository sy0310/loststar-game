const { defineConfig } = require("@playwright/test");
const path = require("node:path");
module.exports = defineConfig({
  testDir: "./tests/browser",
  testMatch: "*.spec.cjs",
  workers: 2,
  retries: 0,
  timeout: 60000,
  outputDir: path.resolve(
    process.env.SURVIVOR_TEST_OUTPUT || "releases/survivor-browser-results",
  ),
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: path.resolve(
          process.env.SURVIVOR_REPORT || "releases/survivor-browser.json",
        ),
      },
    ],
  ],
  use: {
    baseURL: process.env.SURVIVOR_URL || "http://127.0.0.1:4398/",
    hasTouch: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium360",
      use: { browserName: "chromium", viewport: { width: 360, height: 800 } },
    },
    {
      name: "chromium390",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit360",
      use: { browserName: "webkit", viewport: { width: 360, height: 800 } },
    },
    {
      name: "webkit390",
      use: { browserName: "webkit", viewport: { width: 390, height: 844 } },
    },
  ],
});
