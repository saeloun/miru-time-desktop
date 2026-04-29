import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";

let electronApp: ElectronApplication;
const userDataDir = mkdtempSync(path.join(tmpdir(), "miru-time-desktop-e2e-"));

async function launchApp() {
  const latestBuild = findLatestBuild();
  const appInfo = parseElectronApp(latestBuild);
  process.env.CI = "e2e";
  process.env.MIRU_E2E = "true";
  process.env.MIRU_USER_DATA_DIR = userDataDir;

  electronApp = await electron.launch({
    args: [appInfo.main],
  });
  electronApp.on("window", (page) => {
    page.on("pageerror", (error) => {
      console.error(error);
    });
    page.on("console", (msg) => {
      console.log(msg.text());
    });
  });
}

test.beforeAll(async () => {
  await launchApp();
});

test.afterAll(async () => {
  await electronApp?.close();
  rmSync(userDataDir, { force: true, recursive: true });
});

test("renders the app shell", async () => {
  const page: Page = await electronApp.firstWindow();

  const title = await page.waitForSelector("h1");
  const text = await title.textContent();
  expect(text).toBe("Miru Time Tracking");
});

test("starts on onboarding when signed out", async () => {
  const page: Page = await electronApp.firstWindow();

  await page.waitForSelector("text=Log in to Miru");

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toContain("Employee tracker");
  expect(bodyText).toContain("Continue with Google");
  expect(bodyText).toContain("Connect to your workspace before tracking time.");
  expect(bodyText).not.toContain("Add New Entry");
  expect(bodyText).not.toContain("Northstar Labs");
  expect(bodyText).not.toContain("Platform redesign");
  expect(bodyText).not.toMatch(/\bDashboard\b/);
  expect(bodyText).not.toMatch(/\bBillable\b/);
  expect(bodyText).not.toMatch(/\bBilling\b/);
  expect(bodyText).not.toMatch(/\bInvoices?\b/);
  expect(bodyText).not.toMatch(/\bReports?\b/);
  expect(bodyText).not.toMatch(/\bTeam\b/);
  expect(bodyText).not.toMatch(/\$[0-9]/);
});

test("runs the shared desktop timer behind onboarding", async () => {
  const page: Page = await electronApp.firstWindow();

  await page.evaluate(() => window.miruTimer.reset());
  await page.evaluate(() => window.miruTimer.start());
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => window.miruTimer.getState());

  await page.evaluate(() => window.miruTimer.reset());

  expect(state.running).toBe(true);
  expect(state.elapsedMs).toBeGreaterThanOrEqual(1000);
});

test("keeps the native tray timer title visible", async () => {
  const page: Page = await electronApp.firstWindow();
  const trayTitle = () =>
    electronApp.evaluate(() => {
      const diagnostics = (
        globalThis as typeof globalThis & {
          __miruE2E?: { getTrayTitle: () => string };
        }
      ).__miruE2E;

      return diagnostics?.getTrayTitle() ?? "";
    });
  const trayImageState = () =>
    electronApp.evaluate(() => {
      const diagnostics = (
        globalThis as typeof globalThis & {
          __miruE2E?: {
            getTrayImageState: () => {
              empty: boolean;
              height: number;
              width: number;
            };
          };
        }
      ).__miruE2E;

      return (
        diagnostics?.getTrayImageState() ?? {
          empty: true,
          height: 0,
          width: 0,
        }
      );
    });

  await page.evaluate(() => window.miruTimer.reset());
  await expect.poll(trayTitle).toContain("Start");
  await expect.poll(trayTitle).toContain("--:--");
  await expect.poll(async () => (await trayImageState()).empty).toBe(false);

  await page.evaluate(() => window.miruTimer.start());
  await expect.poll(trayTitle).toContain("Pause");

  await page.evaluate(() => window.miruTimer.pause());
  await expect.poll(trayTitle).toContain("Resume");

  await page.evaluate(() => window.miruTimer.reset());
});

test("applies idle recovery branches through the desktop timer", async () => {
  const page: Page = await electronApp.firstWindow();

  await page.evaluate(() => window.miruTimer.reset());
  await page.evaluate(() => window.miruTimer.start());
  await page.waitForFunction(() =>
    window.miruTimer.getState().then((state) => state.running)
  );

  const idleState = await page.evaluate(() =>
    window.miruTimer.forceIdleForTesting?.(10 * 60 * 1000)
  );
  expect(idleState?.idle?.durationMs).toBeGreaterThanOrEqual(10 * 60 * 1000);

  const continued = await page.evaluate(() =>
    window.miruTimer.applyIdleAction("remove-continue")
  );
  expect(continued.running).toBe(true);
  expect(continued.idle).toBeNull();

  await page.evaluate(() =>
    window.miruTimer.forceIdleForTesting?.(5 * 60 * 1000)
  );
  const restarted = await page.evaluate(() =>
    window.miruTimer.applyIdleAction("remove-start-new")
  );
  expect(restarted.running).toBe(true);
  expect(restarted.elapsedSeconds).toBeLessThan(2);

  await page.evaluate(() => window.miruTimer.reset());
});

test("persists timer context across app relaunch", async () => {
  let page: Page = await electronApp.firstWindow();

  await page.evaluate(() =>
    window.miruTimer.setContext({
      billable: false,
      notes: "Persisted timer",
      projectName: "Miru / API project",
      taskName: "Time entry",
    })
  );
  await page.evaluate(() => window.miruTimer.start());
  await page.waitForFunction(() =>
    window.miruTimer.getState().then((state) => state.elapsedSeconds >= 1)
  );
  await page.waitForTimeout(1200);

  await electronApp.close();
  await launchApp();
  page = await electronApp.firstWindow();
  const state = await page.evaluate(() => window.miruTimer.getState());
  await page.evaluate(() => window.miruTimer.reset());

  expect(state.running).toBe(true);
  expect(state.elapsedSeconds).toBeGreaterThanOrEqual(1);
  expect(state.context.notes).toBe("Persisted timer");
  expect(state.context.billable).toBe(false);
});
