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

/*
 * Using Playwright with Electron:
 * https://www.electronjs.org/pt/docs/latest/tutorial/automated-testing#using-playwright
 */

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
    const filename = page.url()?.split("/").pop();
    console.log(`Window opened: ${filename}`);

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

test("renders the first page", async () => {
  const page: Page = await electronApp.firstWindow();

  const title = await page.waitForSelector("h1");
  const text = await title.textContent();
  expect(text).toBe("Miru Time Tracking");
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

test("adds a time entry through the Harvest-style entry flow", async () => {
  const page: Page = await electronApp.firstWindow();

  await page.evaluate(() => {
    window.localStorage.removeItem("pulse-time-entries");
    window.localStorage.removeItem("pulse-timer");
  });
  await page.reload();
  await page.waitForSelector("text=Miru Time Tracking");

  await expect(page.getByText("Add New Entry")).toBeVisible();
  await page.getByText("Add New Entry").click();
  await expect(page.getByText("New Time Entry")).toBeVisible();

  await page.getByPlaceholder("Notes (optional)").fill("Integration spec entry");
  await page.getByPlaceholder("0:00").fill("1:15");
  await page.getByRole("button", { name: "Save" }).last().click();

  await expect(page.getByText("Integration spec entry")).toBeVisible();
  await expect(page.getByText("1:15")).toBeVisible();

  const storedEntries = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("pulse-time-entries") || "[]")
  );
  expect(storedEntries[0].notes).toBe("Integration spec entry");
  expect(storedEntries[0].hours).toBe(1.25);
});

test("resumes an existing entry into the shared desktop timer", async () => {
  const page: Page = await electronApp.firstWindow();

  await page.evaluate(() => {
    window.localStorage.setItem(
      "pulse-time-entries",
      JSON.stringify([
        {
          id: "resume-entry",
          billable: true,
          clientId: "northstar",
          date: new Date().toISOString().slice(0, 10),
          hours: 0.5,
          notes: "Resume me",
          personId: "vipul",
          projectId: "northstar-platform",
          status: "draft",
          taskId: "development",
        },
      ])
    );
  });
  await page.reload();
  await page.waitForSelector("text=Resume me");

  await page.getByTitle("Resume timer").click();
  await page.waitForFunction(() => window.miruTimer.getState().then((state) => state.running));

  const timerState = await page.evaluate(() => window.miruTimer.getState());
  await page.evaluate(() => window.miruTimer.reset());

  expect(timerState.running).toBe(true);
  expect(timerState.context.notes).toBe("Resume me");
  expect(timerState.context.projectName).toContain("Northstar Labs");
});

test("applies idle recovery branches through the desktop timer", async () => {
  const page: Page = await electronApp.firstWindow();

  await page.evaluate(() => window.miruTimer.reset());
  await page.evaluate(() => window.miruTimer.start());
  await page.waitForFunction(() => window.miruTimer.getState().then((state) => state.running));

  const idleState = await page.evaluate(() =>
    window.miruTimer.forceIdleForTesting?.(10 * 60 * 1000)
  );
  expect(idleState?.idle?.durationMs).toBeGreaterThanOrEqual(10 * 60 * 1000);

  const continued = await page.evaluate(() =>
    window.miruTimer.applyIdleAction("remove-continue")
  );
  expect(continued.running).toBe(true);
  expect(continued.idle).toBeNull();

  await page.evaluate(() => window.miruTimer.forceIdleForTesting?.(5 * 60 * 1000));
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
      projectName: "Northstar Labs / Platform redesign",
      taskName: "Design",
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
