import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  type ElectronApplication,
  _electron as electron,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { parseElectronApp } from "electron-playwright-helpers";

let electronApp: ElectronApplication;
const userDataDir = mkdtempSync(path.join(tmpdir(), "miru-time-desktop-e2e-"));
const ADMIN_SURFACE_PATTERNS = [
  /\bDashboard\b/,
  /\bBillable\b/,
  /\bBilling\b/,
  /\bInvoices?\b/,
  /\bReports?\b/,
  /\bTeam\b/,
  /\$[0-9]/,
];

async function launchApp() {
  const appInfo = parseElectronApp(
    path.join(process.cwd(), "out/Miru Time Tracking-darwin-arm64")
  );
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

function seedSignedInAccount(locale = "en-US") {
  writeFileSync(
    path.join(userDataDir, "miru-account.json"),
    JSON.stringify(
      {
        authEmail: "employee@miru.test",
        authToken: "test-token",
        baseUrl: "http://127.0.0.1:65535",
        currentWorkspaceId: 1,
        user: {
          avatar_url: "/rails/active_storage/avatars/mira.png",
          email: "employee@miru.test",
          first_name: "Mira",
          id: 1,
          last_name: "Employee",
          locale,
        },
        workspaces: [{ id: 1, name: "Miru QA" }],
      },
      null,
      2
    )
  );
}

function isoDateFromToday(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
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

  await page.waitForSelector("text=Log in");

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).toContain("Employee tracker");
  expect(bodyText).toContain("Open Google sign-in");
  expect(bodyText).toContain("Connect to your workspace before tracking time.");
  expect(bodyText).not.toContain("Miru URL");
  expect(bodyText).not.toContain("Add New Entry");
  expect(bodyText).not.toContain("Northstar Labs");
  expect(bodyText).not.toContain("Platform redesign");
  for (const pattern of ADMIN_SURFACE_PATTERNS) {
    expect(bodyText).not.toMatch(pattern);
  }

  const session = await page.evaluate(() => window.miruApi.getSession());
  expect(session.baseUrl).toBe("https://app.miru.so");
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
  const trayMenuLabels = () =>
    electronApp.evaluate(() => {
      const diagnostics = (
        globalThis as typeof globalThis & {
          __miruE2E?: { getTrayMenuLabels: () => string[] };
        }
      ).__miruE2E;

      return diagnostics?.getTrayMenuLabels() ?? [];
    });

  await page.evaluate(() => window.miruTimer.reset());
  await page.evaluate(() =>
    window.miruTimer.setSummary({
      entryCount: 3,
      selectedDateLabel: "Today",
      selectedDateMinutes: 120,
      syncStatus: "local",
      todayMinutes: 120,
      userLabel: "Miru Employee",
      weekMinutes: 540,
      workspaceName: "Saeloun Studio",
    })
  );
  await expect.poll(trayTitle).toBe("--:--:--");
  await expect.poll(async () => (await trayImageState()).empty).toBe(false);
  await expect.poll(trayMenuLabels).toContain("Today: 2h");
  await expect.poll(trayMenuLabels).toContain("Week: 9h");

  await page.evaluate(() => window.miruTimer.start());
  await expect.poll(trayTitle).toContain("00:00:");

  await page.evaluate(() => window.miruTimer.pause());
  await expect.poll(async () => (await trayTitle()).length).toBe(8);
  expect(await trayTitle()).not.toContain("Pause");
  expect(await trayTitle()).not.toContain("Resume");
  expect(await trayTitle()).not.toContain("Start");

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

test("closes account menu and logs out from signed-in state", async () => {
  await electronApp.close();
  seedSignedInAccount();
  await launchApp();

  const page: Page = await electronApp.firstWindow();
  const accountButton = page.getByLabel("Account menu");
  const accountMenu = page.getByRole("dialog", {
    name: "Account and sync menu",
  });

  await expect(accountButton).toBeVisible();
  await expect(accountButton.locator("img")).toHaveAttribute(
    "src",
    "http://127.0.0.1:65535/rails/active_storage/avatars/mira.png"
  );
  await accountButton.click();
  await expect(accountMenu).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(accountMenu).toBeHidden();

  await accountButton.click();
  await expect(accountMenu).toBeVisible();
  await page.mouse.click(12, 92);
  await expect(accountMenu).toBeHidden();

  await accountButton.click();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForSelector("text=Log in");
  await expect(accountButton).toBeHidden();
});

test("uses the signed-in Miru user locale", async () => {
  await electronApp.close();
  seedSignedInAccount("es");
  await launchApp();

  const page: Page = await electronApp.firstWindow();

  await page.waitForSelector("text=Hoy");
  await expect(page.getByText("Esta semana")).toBeVisible();
  await page.getByLabel("Account menu").click();
  await expect(page.getByText("Idioma")).toBeVisible();
});

test("falls back cleanly for every supported Miru locale", async () => {
  await electronApp.close();
  seedSignedInAccount("ko");
  await launchApp();

  const page: Page = await electronApp.firstWindow();

  await page.waitForSelector("text=Today");
  await expect(page.getByText("This week")).toBeVisible();
  await expect(page.getByRole("button", { name: "History" })).toBeVisible();
  await page.getByLabel("Account menu").click();
  await expect(page.getByText("Language:")).toBeVisible();
  await expect(page.getByText("ko", { exact: true })).toBeVisible();
});

test("shows live timesheet history across past days", async () => {
  await electronApp.close();
  seedSignedInAccount();
  await launchApp();

  const page: Page = await electronApp.firstWindow();
  const today = isoDateFromToday(0);
  const yesterday = isoDateFromToday(-1);

  await expect(page.getByLabel("Account menu")).toBeVisible();
  await page.evaluate(
    ([currentDate, pastDate]) => {
      window.localStorage.setItem(
        "pulse-time-entries",
        JSON.stringify([
          {
            billable: false,
            clientId: "client-1",
            date: currentDate,
            hours: 1,
            id: "today-entry",
            notes: "Today local task",
            personId: "1",
            projectId: "project-1",
            status: "draft",
            taskId: "time",
          },
          {
            billable: false,
            clientId: "client-1",
            date: pastDate,
            hours: 0.5,
            id: "past-entry",
            notes: "Past local task",
            personId: "1",
            projectId: "project-1",
            status: "draft",
            taskId: "time",
          },
        ])
      );
    },
    [today, yesterday]
  );
  await page.reload();

  await expect(page.getByText("Today local task")).toBeVisible();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Live timesheet")).toBeVisible();
  await expect(page.getByText("Past local task")).toBeVisible();
});
