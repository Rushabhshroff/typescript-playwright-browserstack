import * as base from '@playwright/test'
const cp = require('child_process');
const clientPlaywrightVersion = cp
  .execSync('npx playwright --version')
  .toString()
  .trim()
  .split(' ')[1];
const BrowserStackLocal = require('browserstack-local');

// BrowserStack Specific Capabilities.
// Set 'browserstack.local:true For Local testing
const caps: any = {
  browser: 'chrome',
  os: 'osx',
  os_version: 'catalina',
  name: 'My first playwright test',
  build: 'playwright-build',
  'browserstack.username': process.env.BROWSERSTACK_USERNAME || 'USERNAME',
  'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY || 'ACCESSKEY',
  'browserstack.local': process.env.BROWSERSTACK_LOCAL || true,
  'client.playwrightVersion': clientPlaywrightVersion,
};

const device_caps: any = {
  osVersion: "13.0",
  deviceName: "Samsung Galaxy S23", // "Samsung Galaxy S22 Ultra", "Google Pixel 7 Pro", "OnePlus 9", etc.
  browserName: "chrome",
  realMobile: "true",
  name: "My android playwright test",
  build: "playwright-build",
  'browserstack.username': process.env.BROWSERSTACK_USERNAME || 'YOUR_USERNAME',
  'browserstack.accessKey':
    process.env.BROWSERSTACK_ACCESS_KEY || 'YOUR_ACCESS_KEY',
};

exports.bsLocal = new BrowserStackLocal.Local();

// replace YOUR_ACCESS_KEY with your key. You can also set an environment variable - "BROWSERSTACK_ACCESS_KEY".
exports.BS_LOCAL_ARGS = {
  key: process.env.BROWSERSTACK_ACCESS_KEY || 'ACCESSKEY',
};

// Patching the capabilities dynamically according to the project name.
const patchCaps = (name, title) => {
  let combination = name.split(/@browserstack/)[0];
  let [browerCaps, osCaps] = combination.split(/:/);
  let [browser, browser_version] = browerCaps.split(/@/);
  let osCapsSplit = osCaps.split(/ /);
  let os = osCapsSplit.shift();
  let os_version = osCapsSplit.join(' ');
  caps.browser = browser ? browser : 'chrome';
  caps.os_version = browser_version ? browser_version : 'latest';
  caps.os = os ? os : 'osx';
  caps.os_version = os_version ? os_version : 'catalina';
  caps.name = title;
};

const patchMobileCaps = (name, title) => {
  let split = name.split(/:/);
  let device = split[1]
  let [deviceName, osVersion] = device.split(/-/);
  device_caps.deviceName = deviceName ? deviceName : "Samsung Galaxy S22 Ultra";
  device_caps.osVersion = osVersion ? osVersion : "12.0";
  device_caps.name = title;
  device_caps.realMobile = "true";
};

exports.getCdpEndpoint = (name, title) => {
  if (name.startsWith('mobile')) {
    patchMobileCaps(name, title)
    const cdpUrl = `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(device_caps))}`
    return cdpUrl;
  } else {
    patchCaps(name, title)
    const cdpUrl = `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`
    return cdpUrl;
  }

}
const isHash = (entity) => Boolean(entity && typeof (entity) === "object" && !Array.isArray(entity));
const nestedKeyValue = (hash, keys) => keys.reduce((hash, key) => (isHash(hash) ? hash[key] : undefined), hash);
const isUndefined = val => (val === undefined || val === null || val === '');
const evaluateSessionStatus = (status) => {
  if (!isUndefined(status)) {
    status = status.toLowerCase();
  }
  if (status === "passed") {
    return "passed";
  } else if (status === "failed" || status === "timedout") {
    return "failed";
  } else {
    return "";
  }
}
exports.test = base.test.extend({
  page: async ({ page, playwright }, use, testInfo) => {
    if (testInfo.project.name.startsWith('mobile')) {
      const cdpEndpoint = exports.getCdpEndpoint(testInfo.project.name, `${testInfo.file}-${testInfo.project.name}`)
      const device = await base._android.connect(cdpEndpoint)
      await device.shell("am force-stop com.android.chrome")
      const context = await device.launchBrowser();
      const mPage = await context.newPage();
      try {
        await use(mPage)
      } catch {

      }
      const testResult = {
        action: 'setSessionStatus',
        arguments: {
          status: evaluateSessionStatus(testInfo.status),
          reason: nestedKeyValue(testInfo, ['error', 'message'])
        },
      };
      await page.evaluate(() => { },
        `browserstack_executor: ${JSON.stringify(testResult)}`);
      await mPage.close()
      device.close()
    } else {
      await use(page)
    }
  }
})