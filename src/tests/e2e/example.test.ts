import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";

/*
 * Using Playwright with Electron:
 * https://www.electronjs.org/pt/docs/latest/tutorial/automated-testing#using-playwright
 */

let electronApp: ElectronApplication;

test.beforeAll(async () => {
  const latestBuild = findLatestBuild();
  const appInfo = parseElectronApp(latestBuild);
  process.env.CI = "e2e";

  electronApp = await electron.launch({
    args: [appInfo.main],
  });
  electronApp.on("window", (page) => {
    const filename = page.url()?.split("/").pop();
    console.log(`Window opened: ${filename}`);

    page.on("pageerror", (error) => {
      console.error(error);
    });
    page.on("console", (msg) => {
      console.log(msg.text());
    });
  });
});

test("renders the first page", async () => {
  const page: Page = await electronApp.firstWindow();

  const title = await page.waitForSelector("h1");
  const text = await title.textContent();
  expect(text).toBe("Miru Time");
});

test("syncs desktop timer with the app timer", async () => {
  const page: Page = await electronApp.firstWindow();

  await page.evaluate(() => window.miruTimer.reset());
  await page.evaluate(() => window.miruTimer.start());
  await page.waitForFunction(
    () => document.body.innerText.includes("00:01"),
    null,
    { timeout: 3000 }
  );

  const state = await page.evaluate(() => window.miruTimer.getState());

  await page.evaluate(() => window.miruTimer.reset());

  expect(state.running).toBe(true);
  expect(state.elapsedSeconds).toBeGreaterThanOrEqual(1);
});
