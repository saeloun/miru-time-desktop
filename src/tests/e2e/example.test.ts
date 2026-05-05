import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
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

let electronApp: ElectronApplication | null = null;
let userDataDir = "";
const ADMIN_SURFACE_PATTERNS = [
  /\bDashboard\b/,
  /\bBillable\b/,
  /\bBilling\b/,
  /\bInvoices?\b/,
  /\bReports?\b/,
  /\bTeam\b/,
  /\$[0-9]/,
];
const PULL_TIMER_BUTTON_PATTERN = /Pull timer from Miru/;
const PUSH_TIMER_BUTTON_PATTERN = /Push timer to Miru/;
const RESUME_DESKTOP_QA_TIMER_PATTERN = /Resume Saeloun \/ Desktop QA/;
const SELECTED_BUTTON_CLASS_PATTERN = /shadow-sm/;
const TIME_TRACKING_RANGE_QUERY_PATTERN = /from=.*&to=/;
const TIMESHEET_ENTRY_PATH_PATTERN = /^\/timesheet_entry\/([^/]+)$/;

function packagedAppDirectory() {
  const platform = process.env.MIRU_E2E_PLATFORM ?? process.platform;
  const arch = process.env.MIRU_E2E_ARCH ?? process.arch;

  return path.join(process.cwd(), `out/Miru Time Tracking-${platform}-${arch}`);
}

interface RecordedApiRequest {
  body: unknown;
  method: string;
  pathname: string;
  query: string;
}

interface FakeMiruApiServer {
  baseUrl: string;
  close: () => Promise<void>;
  requests: RecordedApiRequest[];
}

type FakeTimeTrackingPayload = MiruTimeTrackingPayload;

async function launchApp() {
  if (electronApp) {
    return;
  }

  if (!userDataDir) {
    userDataDir = mkdtempSync(path.join(tmpdir(), "miru-time-desktop-e2e-"));
  }

  const appInfo = parseElectronApp(packagedAppDirectory());
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

async function firstWindow() {
  await launchApp();

  return getElectronApp().firstWindow();
}

function getElectronApp() {
  if (!electronApp) {
    throw new Error("Electron app is not running.");
  }

  return electronApp;
}

async function closeApp() {
  if (!electronApp) {
    return;
  }

  const appToClose = electronApp;
  electronApp = null;
  const childProcess = appToClose.process();

  try {
    await appToClose.evaluate(({ app }) => {
      app.exit(0);
    });
  } catch {
    // Some tests intentionally relaunch the app; a previous close may have won.
  }

  await Promise.race([
    new Promise<void>((resolve) => {
      childProcess.once("exit", () => resolve());
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 5000)),
  ]);

  if (childProcess.exitCode === null && !childProcess.killed) {
    childProcess.kill("SIGKILL");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

function seedSignedInAccount(
  locale = "en-US",
  overrides: Partial<{
    baseUrl: string;
    currentWorkspaceId: number | string;
    workspaces: Array<{ id: number | string; name: string; logo?: string }>;
  }> = {}
) {
  writeFileSync(
    path.join(userDataDir, "miru-account.json"),
    JSON.stringify(
      {
        authEmail: "employee@miru.test",
        authToken: "test-token",
        baseUrl: overrides.baseUrl ?? "http://127.0.0.1:65535",
        currentWorkspaceId: overrides.currentWorkspaceId ?? 1,
        user: {
          avatar_url: "/rails/active_storage/avatars/mira.png",
          email: "employee@miru.test",
          first_name: "Mira",
          id: 1,
          last_name: "Employee",
          locale,
        },
        workspaces: overrides.workspaces ?? [{ id: 1, name: "Miru QA" }],
      },
      null,
      2
    )
  );
}

function seedSignedOutAccount(baseUrl: string) {
  writeFileSync(
    path.join(userDataDir, "miru-account.json"),
    JSON.stringify(
      {
        authEmail: "",
        authToken: "",
        baseUrl,
        currentWorkspaceId: null,
        user: null,
        workspaces: [],
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

function defaultTimeTrackingPayload(
  entries: FakeTimeTrackingPayload["entries"] = {}
): FakeTimeTrackingPayload {
  return {
    clients: [{ id: 1, name: "Saeloun" }],
    entries,
    projects: {
      "1": [
        {
          client_id: 1,
          id: 101,
          name: "Desktop QA",
        },
      ],
    },
  };
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

async function createFakeMiruApiServer({
  currentUser = {
    avatar_url: "/avatars/live-profile.png",
    current_workspace_id: 11,
    email: "employee@miru.test",
    first_name: "Mira",
    id: 7,
    last_name: "Employee",
    locale: "en-US",
  },
  currentTimer = {
    billable: false,
    elapsed_ms: 3_720_000,
    notes: "Pulled web timer",
    project_name: "Saeloun / Desktop QA",
    running: true,
    started_at: new Date().toISOString(),
    task_name: "Time entry",
  },
  currentTimers = [],
  timeTracking = defaultTimeTrackingPayload(),
  workspacesStatus = 200,
}: {
  currentUser?: Record<string, unknown>;
  currentTimer?: Record<string, unknown>;
  currentTimers?: Record<string, unknown>[];
  timeTracking?: FakeTimeTrackingPayload;
  workspacesStatus?: number;
} = {}): Promise<FakeMiruApiServer> {
  const requests: RecordedApiRequest[] = [];
  let activeWorkspaceId: number | string = 11;
  let nextEntryId = 1000;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const body = await readRequestBody(request);
    requests.push({
      body,
      method: request.method ?? "GET",
      pathname: url.pathname,
      query: url.search,
    });

    const json = (status: number, payload: unknown) => {
      response.writeHead(status, {
        "Content-Type": "application/json",
      });
      response.end(JSON.stringify(payload));
    };
    const apiPath = url.pathname.replace("/api/v1", "");

    if (request.method === "POST" && apiPath === "/users/login") {
      json(200, {
        company: { id: activeWorkspaceId, name: "Miru QA" },
        user: {
          avatar_url: "/avatars/employee.png",
          current_workspace_id: activeWorkspaceId,
          email: "employee@miru.test",
          first_name: "Mira",
          id: 7,
          last_name: "Employee",
          locale: "fr",
          token: "login-token",
        },
      });
      return;
    }

    if (request.method === "GET" && apiPath === "/users/_me") {
      json(200, {
        company: { id: activeWorkspaceId, name: "Miru QA" },
        company_role: "employee",
        user: {
          ...currentUser,
          current_workspace_id: activeWorkspaceId,
        },
      });
      return;
    }

    if (request.method === "POST" && apiPath === "/users/signup") {
      json(200, {
        notice: "Account created. Confirm your email, then log in.",
        user: { email: "new.employee@miru.test" },
      });
      return;
    }

    if (request.method === "DELETE" && apiPath === "/users/logout") {
      json(200, {});
      return;
    }

    if (request.method === "GET" && apiPath === "/workspaces") {
      json(
        workspacesStatus,
        workspacesStatus === 200
          ? {
              workspaces: [
                { id: 11, name: "Miru QA" },
                { id: 12, name: "Saeloun Studio" },
              ],
            }
          : { error: "Workspace sync is temporarily unavailable." }
      );
      return;
    }

    if (request.method === "PUT" && apiPath === "/workspaces/12") {
      activeWorkspaceId = 12;
      json(200, {
        company: { id: 12, name: "Saeloun Studio" },
      });
      return;
    }

    if (request.method === "GET" && apiPath === "/time-tracking") {
      json(200, timeTracking);
      return;
    }

    if (request.method === "GET" && apiPath === "/desktop/current_timer") {
      json(200, { current_timer: currentTimer, current_timers: currentTimers });
      return;
    }

    if (request.method === "PUT" && apiPath === "/desktop/current_timer") {
      json(200, { current_timer: body });
      return;
    }

    if (request.method === "POST" && apiPath === "/timesheet_entry") {
      const payload = body as {
        project_id?: number | string;
        timesheet_entry?: {
          bill_status?: string;
          duration?: number;
          note?: string;
          work_date?: string;
        };
      };
      const entryDate =
        payload.timesheet_entry?.work_date ?? isoDateFromToday(0);
      const entry = {
        bill_status: payload.timesheet_entry?.bill_status ?? "non_billable",
        duration: payload.timesheet_entry?.duration ?? 1,
        id: String(nextEntryId++),
        note: payload.timesheet_entry?.note ?? "Time entry",
        project_id: payload.project_id ?? 101,
        type: "timesheet",
      };
      timeTracking.entries[entryDate] = [
        ...(timeTracking.entries[entryDate] ?? []),
        entry,
      ];
      json(200, entry);
      return;
    }

    const entryMatch = apiPath.match(TIMESHEET_ENTRY_PATH_PATTERN);
    if (entryMatch && request.method === "PUT") {
      const payload = body as {
        project_id?: number | string;
        timesheet_entry?: {
          bill_status?: string;
          duration?: number;
          note?: string;
          work_date?: string;
        };
      };
      for (const [date, entries] of Object.entries(timeTracking.entries)) {
        const entry = entries.find((item) => String(item.id) === entryMatch[1]);
        if (entry) {
          entry.bill_status =
            payload.timesheet_entry?.bill_status ?? entry.bill_status;
          entry.duration = payload.timesheet_entry?.duration ?? entry.duration;
          entry.note = payload.timesheet_entry?.note ?? entry.note;
          entry.project_id = payload.project_id ?? entry.project_id;
          if (
            payload.timesheet_entry?.work_date &&
            payload.timesheet_entry.work_date !== date
          ) {
            timeTracking.entries[date] = entries.filter(
              (item) => String(item.id) !== entryMatch[1]
            );
            timeTracking.entries[payload.timesheet_entry.work_date] = [
              ...(timeTracking.entries[payload.timesheet_entry.work_date] ??
                []),
              entry,
            ];
          }
          json(200, entry);
          return;
        }
      }
    }

    if (entryMatch && request.method === "DELETE") {
      for (const [date, entries] of Object.entries(timeTracking.entries)) {
        timeTracking.entries[date] = entries.filter(
          (entry) => String(entry.id) !== entryMatch[1]
        );
      }
      json(200, {});
      return;
    }

    json(404, { error: `Unhandled ${request.method} ${apiPath}` });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!(address && typeof address === "object")) {
    throw new Error("Fake Miru API server did not start.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    requests,
  };
}

function findApiRequest(
  server: FakeMiruApiServer,
  method: string,
  pathname: string
) {
  return server.requests.find(
    (request) => request.method === method && request.pathname === pathname
  );
}

async function clickAccountMenuAction(page: Page, name: RegExp | string) {
  const menu = page.getByRole("dialog", { name: "Account and sync menu" });
  await expect(menu).toBeVisible();

  const button = menu.getByRole("button", { name });
  await expect(button).toBeVisible();
  await button.click();
}

function formatShortDate(date: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

test.beforeEach(() => {
  userDataDir = mkdtempSync(path.join(tmpdir(), "miru-time-desktop-e2e-"));
});

test.afterEach(async () => {
  await closeApp();
  if (userDataDir) {
    rmSync(userDataDir, { force: true, recursive: true });
    userDataDir = "";
  }
});

test("renders the app shell", async () => {
  const page: Page = await firstWindow();

  const title = await page.waitForSelector("h1");
  const text = await title.textContent();
  expect(text).toBe("Miru Time Tracking");
});

test("starts on onboarding when signed out", async () => {
  const page: Page = await firstWindow();

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
  const page: Page = await firstWindow();

  await page.evaluate(() => window.miruTimer.reset());
  await page.evaluate(() => window.miruTimer.start());
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => window.miruTimer.getState());

  await page.evaluate(() => window.miruTimer.reset());

  expect(state.running).toBe(true);
  expect(state.elapsedMs).toBeGreaterThanOrEqual(1000);
});

test("keeps the native tray timer title visible", async () => {
  const page: Page = await firstWindow();
  const trayTitle = () =>
    getElectronApp().evaluate(() => {
      const diagnostics = (
        globalThis as typeof globalThis & {
          __miruE2E?: { getTrayTitle: () => string };
        }
      ).__miruE2E;

      return diagnostics?.getTrayTitle() ?? "";
    });
  const trayImageState = () =>
    getElectronApp().evaluate(() => {
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
    getElectronApp().evaluate(() => {
      const diagnostics = (
        globalThis as typeof globalThis & {
          __miruE2E?: { getTrayMenuLabels: () => string[] };
        }
      ).__miruE2E;

      return diagnostics?.getTrayMenuLabels() ?? [];
    });

  await page.waitForSelector("text=Log in");
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
  const page: Page = await firstWindow();

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

test("renders idle recovery actions in the signed-in tracker", async () => {
  await closeApp();
  seedSignedInAccount();
  await launchApp();

  const page: Page = await firstWindow();

  await expect(page.getByLabel("Account menu")).toBeVisible();
  await page.evaluate(() => window.miruTimer.reset());
  await page.evaluate(() => window.miruTimer.start());
  await page.waitForFunction(() =>
    window.miruTimer.getState().then((state) => state.running)
  );
  await page.evaluate(() =>
    window.miruTimer.forceIdleForTesting?.(15 * 60 * 1000)
  );

  const idleDialog = page.getByRole("dialog", {
    name: "Idle timer actions",
  });
  await expect(idleDialog).toBeVisible();
  await expect(page.getByLabel("Trim idle and continue")).toBeVisible();
  await expect(page.getByLabel("Trim idle and restart")).toBeVisible();
  await expect(page.getByLabel("Keep idle time")).toBeVisible();

  await page.getByLabel("Keep idle time").click();
  await expect(idleDialog).toBeHidden();

  const state = await page.evaluate(() => window.miruTimer.getState());
  await page.evaluate(() => window.miruTimer.reset());

  expect(state.running).toBe(true);
  expect(state.idle).toBeNull();
});

test("keeps the main timer controls clear of the elapsed time", async () => {
  await closeApp();
  seedSignedInAccount();
  await launchApp();

  const page: Page = await firstWindow();

  await expect(page.getByLabel("Account menu")).toBeVisible();
  await expect(page.getByTestId("timer-display")).toBeVisible();
  await expect(page.getByTestId("timer-controls")).toBeVisible();

  const layout = await page.evaluate(() => {
    const timer = document.querySelector("[data-testid='timer-display']");
    const controls = document.querySelector("[data-testid='timer-controls']");

    if (!(timer && controls)) {
      return null;
    }

    const timerBox = timer.getBoundingClientRect();
    const controlsBox = controls.getBoundingClientRect();
    const controlButtons = Array.from(controls.querySelectorAll("button")).map(
      (button) => {
        const box = button.getBoundingClientRect();
        return {
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          top: box.top,
        };
      }
    );

    return {
      controlButtons,
      controls: {
        bottom: controlsBox.bottom,
        left: controlsBox.left,
        right: controlsBox.right,
        top: controlsBox.top,
      },
      timer: {
        bottom: timerBox.bottom,
        left: timerBox.left,
        right: timerBox.right,
        top: timerBox.top,
      },
    };
  });

  expect(layout).not.toBeNull();
  expect(layout?.timer.right).toBeLessThanOrEqual(
    (layout?.controls.left ?? 0) - 8
  );
  expect(layout?.controlButtons).toHaveLength(4);
  for (const button of layout?.controlButtons ?? []) {
    expect(button.left).toBeGreaterThanOrEqual(layout?.controls.left ?? 0);
    expect(button.right).toBeLessThanOrEqual(layout?.controls.right ?? 0);
    expect(button.top).toBeGreaterThanOrEqual(layout?.controls.top ?? 0);
    expect(button.bottom).toBeLessThanOrEqual(layout?.controls.bottom ?? 0);
  }
});

test("persists timer context across app relaunch", async () => {
  let page: Page = await firstWindow();

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

  await closeApp();
  await launchApp();
  page = await firstWindow();
  const state = await page.evaluate(() => window.miruTimer.getState());
  await page.evaluate(() => window.miruTimer.reset());

  expect(state.running).toBe(true);
  expect(state.elapsedSeconds).toBeGreaterThanOrEqual(1);
  expect(state.context.notes).toBe("Persisted timer");
  expect(state.context.billable).toBe(false);
});

test("closes account menu and logs out from signed-in state", async () => {
  await closeApp();
  seedSignedInAccount();
  await launchApp();

  const page: Page = await firstWindow();
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
  await closeApp();
  seedSignedInAccount("es");
  await launchApp();

  const page: Page = await firstWindow();

  await page.waitForSelector("text=Hoy");
  await expect(page.getByText("Esta semana")).toBeVisible();
  await page.getByLabel("Account menu").click();
  await expect(page.getByText("Idioma")).toBeVisible();
});

test("falls back cleanly for every supported Miru locale", async () => {
  await closeApp();
  seedSignedInAccount("ko");
  await launchApp();

  const page: Page = await firstWindow();

  await page.waitForSelector("text=Today");
  await expect(page.getByText("This week")).toBeVisible();
  await expect(page.getByRole("button", { name: "History" })).toBeVisible();
  await page.getByLabel("Account menu").click();
  await expect(page.getByText("Language:")).toBeVisible();
  await expect(page.getByText("ko", { exact: true })).toBeVisible();
});

test("uses right-to-left layout for RTL Miru locales", async () => {
  await closeApp();
  seedSignedInAccount("ar");
  await launchApp();

  const page: Page = await firstWindow();

  await page.waitForSelector("text=اليوم");
  await expect(page.locator("[dir='rtl']")).toBeVisible();
  await page.getByLabel("Account menu").click();
  await expect(page.getByText("اللغة")).toBeVisible();
});

test("shows live timesheet history across past days", async () => {
  await closeApp();
  seedSignedInAccount();
  await launchApp();

  const page: Page = await firstWindow();
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
  await page.getByText("This week", { exact: true }).click();
  await expect(page.getByText("Past local task")).toBeVisible();
  await expect(page.getByText("Today local task")).toBeVisible();

  await page.getByText("Entries", { exact: true }).click();
  await expect(page.getByText("Live timesheet")).toBeVisible();
  await expect(page.getByText(formatShortDate(yesterday))).toBeVisible();
  await expect(page.getByText("Past local task")).toBeVisible();

  await page.getByText("Today", { exact: true }).first().click();
  await expect(page.getByText("Today local task")).toBeVisible();
  await expect(page.getByText("Past local task")).toBeHidden();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Live timesheet")).toBeVisible();
  await expect(page.getByText(formatShortDate(yesterday))).toBeVisible();
  await expect(page.getByText("Past local task")).toBeVisible();

  await page.locator("input[type='date']").fill(yesterday);
  await expect(page.getByText("Live timesheet")).toBeHidden();
  await expect(page.getByText("Past local task")).toBeVisible();
  await expect(page.getByText("Today local task")).toBeHidden();
});

test("loads Miru API projects and entries for a signed-in employee", async () => {
  await closeApp();
  const today = isoDateFromToday(0);
  const server = await createFakeMiruApiServer({
    timeTracking: defaultTimeTrackingPayload({
      [today]: [
        {
          bill_status: "non_billable",
          duration: 75,
          id: "api-entry",
          note: "Loaded from Miru API",
          project_id: 101,
          type: "timesheet",
        },
      ],
    }),
  });

  try {
    seedSignedInAccount("en-US", {
      baseUrl: server.baseUrl,
      currentWorkspaceId: 11,
      workspaces: [
        { id: 11, name: "Miru QA" },
        { id: 12, name: "Saeloun Studio" },
      ],
    });
    await launchApp();

    const page: Page = await firstWindow();

    await expect(page.getByLabel("Account menu")).toBeVisible();
    await expect(
      page.getByLabel("Account menu").locator("img")
    ).toHaveAttribute("src", `${server.baseUrl}/avatars/live-profile.png`);
    await expect(page.getByText("Desktop QA", { exact: true })).toBeVisible();
    await expect(page.getByText("Loaded from Miru API")).toBeVisible();
    await expect(page.getByText("1 entries · 1.25h tracked")).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    for (const pattern of ADMIN_SURFACE_PATTERNS) {
      expect(bodyText).not.toMatch(pattern);
    }
    expect(
      findApiRequest(server, "GET", "/api/v1/time-tracking")?.query
    ).toMatch(TIME_TRACKING_RANGE_QUERY_PATTERN);
    expect(findApiRequest(server, "GET", "/api/v1/users/_me")).toBeTruthy();
  } finally {
    await closeApp();
    await server.close();
  }
});

test("logs in through Miru API and switches workspaces", async () => {
  await closeApp();
  const server = await createFakeMiruApiServer({
    currentUser: {
      avatar_url: "/avatars/live-profile.png",
      current_workspace_id: 11,
      email: "employee@miru.test",
      first_name: "Mira",
      id: 7,
      last_name: "Employee",
      locale: "fr",
    },
  });

  try {
    seedSignedOutAccount(server.baseUrl);
    await launchApp();

    const page: Page = await firstWindow();

    await page.locator("input[type='email']").fill("employee@miru.test");
    await page.locator("input[type='password']").fill("password123");
    await page.locator("button").filter({ hasText: "Log in" }).last().click();

    await expect(page.getByLabel("Account menu")).toBeVisible();
    await expect(page.getByText("Aujourd'hui").first()).toBeVisible();
    expect(findApiRequest(server, "POST", "/api/v1/users/login")).toBeTruthy();

    await page.getByLabel("Account menu").click();
    await page
      .getByRole("dialog", { name: "Account and sync menu" })
      .locator("select")
      .first()
      .selectOption("12");
    await expect(page.getByText("Workspace switched.")).toBeVisible();

    expect(findApiRequest(server, "PUT", "/api/v1/workspaces/12")).toBeTruthy();
  } finally {
    await closeApp();
    await server.close();
  }
});

test("keeps a production login when workspace refresh is unavailable", async () => {
  await closeApp();
  const server = await createFakeMiruApiServer({ workspacesStatus: 500 });

  try {
    seedSignedOutAccount(server.baseUrl);
    await launchApp();

    const page: Page = await firstWindow();

    await page.locator("input[type='email']").fill("employee@miru.test");
    await page.locator("input[type='password']").fill("password123");
    await page.locator("button").filter({ hasText: "Log in" }).last().click();

    await expect(page.getByLabel("Account menu")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruApi.getSession().then((session) => ({
            signedIn: session.signedIn,
            syncError: session.syncError,
          }))
        )
      )
      .toEqual({
        signedIn: true,
        syncError: "Workspace sync is temporarily unavailable.",
      });
    expect(findApiRequest(server, "POST", "/api/v1/users/login")).toBeTruthy();
    expect(findApiRequest(server, "GET", "/api/v1/users/_me")).toBeTruthy();
    expect(findApiRequest(server, "GET", "/api/v1/workspaces")).toBeTruthy();
  } finally {
    await closeApp();
    await server.close();
  }
});

test("returns signup without token to login with a confirmation notice", async () => {
  await closeApp();
  const server = await createFakeMiruApiServer();

  try {
    seedSignedOutAccount(server.baseUrl);
    await launchApp();

    const page: Page = await firstWindow();

    await page.locator("button").filter({ hasText: "Sign up" }).first().click();
    await page.locator("input[type='email']").fill("new.employee@miru.test");
    await page.locator("input").nth(1).fill("New");
    await page.locator("input").nth(2).fill("Employee");
    await page.locator("input[type='password']").fill("password123");
    await page.locator("button").filter({ hasText: "Create account" }).click();

    await expect(
      page.getByText("Account created. Confirm your email, then log in.")
    ).toBeVisible();
    expect(findApiRequest(server, "POST", "/api/v1/users/signup")).toBeTruthy();
    await expect(
      page.locator("button").filter({ hasText: "Log in" }).first()
    ).toHaveClass(SELECTED_BUTTON_CLASS_PATTERN);
  } finally {
    await closeApp();
    await server.close();
  }
});

test("pulls and pushes the current web timer through Miru API", async () => {
  await closeApp();
  const server = await createFakeMiruApiServer();

  try {
    seedSignedInAccount("en-US", {
      baseUrl: server.baseUrl,
      currentWorkspaceId: 11,
      workspaces: [{ id: 11, name: "Miru QA" }],
    });
    await launchApp();

    const page: Page = await firstWindow();

    await expect(page.locator("select").first()).toHaveValue("101");
    await page.getByLabel("Account menu").click();
    await clickAccountMenuAction(page, PULL_TIMER_BUTTON_PATTERN);
    await expect(page.getByText("Timer pulled.")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruTimer.getState().then((state) => state.context.notes ?? "")
        )
      )
      .toBe("Pulled web timer");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruTimer.getState().then((state) => state.elapsedSeconds)
        )
      )
      .toBeGreaterThanOrEqual(3720);

    await clickAccountMenuAction(page, PUSH_TIMER_BUTTON_PATTERN);
    await expect(page.getByText("Timer pushed.")).toBeVisible();

    const pushRequest = findApiRequest(
      server,
      "PUT",
      "/api/v1/desktop/current_timer"
    );
    expect(pushRequest).toBeTruthy();
    expect(
      (pushRequest?.body as { current_timer?: { notes?: string } })
        .current_timer?.notes
    ).toBe("Pulled web timer");
  } finally {
    await closeApp();
    await server.close();
  }
});

test("starts a new timer while keeping the existing timer resumable and synced", async () => {
  await closeApp();
  const server = await createFakeMiruApiServer();

  try {
    seedSignedInAccount("en-US", {
      baseUrl: server.baseUrl,
      currentWorkspaceId: 11,
      workspaces: [{ id: 11, name: "Miru QA" }],
    });
    await launchApp();

    const page: Page = await firstWindow();

    await expect(page.locator("select").first()).toHaveValue("101");
    await page.getByPlaceholder("What are you working on?").fill("First timer");
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruTimer.getState().then((state) => state.elapsedSeconds)
        )
      )
      .toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: "Start new timer" }).click();
    await expect(page.getByLabel("Paused timers")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruTimer.getState().then((state) => state.timers.length)
        )
      )
      .toBe(1);

    await page.getByLabel("Account menu").click();
    await clickAccountMenuAction(page, PUSH_TIMER_BUTTON_PATTERN);

    const pushRequest = findApiRequest(
      server,
      "PUT",
      "/api/v1/desktop/current_timer"
    );
    const pushedTimers = (
      pushRequest?.body as { current_timers?: unknown[] } | undefined
    )?.current_timers;
    expect(pushedTimers?.length).toBeGreaterThanOrEqual(2);

    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: RESUME_DESKTOP_QA_TIMER_PATTERN })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruTimer.getState().then((state) => state.timers.length)
        )
      )
      .toBe(0);
  } finally {
    await closeApp();
    await server.close();
  }
});

test("pulls multiple Miru web timers into the desktop timer stack", async () => {
  await closeApp();
  const server = await createFakeMiruApiServer({
    currentTimer: {
      billable: false,
      elapsed_ms: 240_000,
      notes: "Active web timer",
      project_id: 101,
      project_name: "Saeloun / Desktop QA",
      running: true,
      started_at: new Date().toISOString(),
      task_id: "time",
      task_name: "Time entry",
    },
    currentTimers: [
      {
        billable: false,
        elapsed_ms: 240_000,
        id: "web-active",
        notes: "Active web timer",
        project_id: 101,
        project_name: "Saeloun / Desktop QA",
        running: true,
        started_at: new Date().toISOString(),
        task_id: "time",
        task_name: "Time entry",
      },
      {
        billable: false,
        elapsed_ms: 1_800_000,
        id: "web-paused",
        notes: "Paused web timer",
        project_id: 101,
        project_name: "Saeloun / Desktop QA",
        running: false,
        started_at: null,
        task_id: "time",
        task_name: "Time entry",
      },
    ],
  });

  try {
    seedSignedInAccount("en-US", {
      baseUrl: server.baseUrl,
      currentWorkspaceId: 11,
      workspaces: [{ id: 11, name: "Miru QA" }],
    });
    await launchApp();

    const page: Page = await firstWindow();

    await page.getByLabel("Account menu").click();
    await clickAccountMenuAction(page, PULL_TIMER_BUTTON_PATTERN);
    await expect(page.getByText("Timer pulled.")).toBeVisible();
    await expect(page.getByLabel("Paused timers")).toBeVisible();
    await expect(page.getByText("Paused web timer")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruTimer.getState().then((state) => state.timers.length)
        )
      )
      .toBe(1);
  } finally {
    await closeApp();
    await server.close();
  }
});

test("saves a running desktop timer through Miru API and refreshes the sheet", async () => {
  await closeApp();
  const server = await createFakeMiruApiServer({
    currentTimer: {
      billable: false,
      elapsed_ms: 125_000,
      notes: "Save from desktop timer",
      project_name: "Saeloun / Desktop QA",
      running: true,
      started_at: new Date().toISOString(),
      task_name: "Time entry",
    },
  });

  try {
    seedSignedInAccount("en-US", {
      baseUrl: server.baseUrl,
      currentWorkspaceId: 11,
      workspaces: [{ id: 11, name: "Miru QA" }],
    });
    await launchApp();

    const page: Page = await firstWindow();

    await expect(page.locator("select").first()).toHaveValue("101");
    await page.getByLabel("Account menu").click();
    await clickAccountMenuAction(page, PULL_TIMER_BUTTON_PATTERN);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Stop and save" }).click();

    await expect(
      page.locator("p").filter({ hasText: "Save from desktop timer" })
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruTimer.getState().then((state) => state.running)
        )
      )
      .toBe(false);

    const createRequest = findApiRequest(
      server,
      "POST",
      "/api/v1/timesheet_entry"
    );
    expect(createRequest).toBeTruthy();
    expect(
      (createRequest?.body as { timesheet_entry?: { duration?: number } })
        .timesheet_entry?.duration
    ).toBe(2);
  } finally {
    await closeApp();
    await server.close();
  }
});

test("creates, edits, and resumes manual entries through the live sheet", async () => {
  await closeApp();
  const server = await createFakeMiruApiServer();

  try {
    seedSignedInAccount("en-US", {
      baseUrl: server.baseUrl,
      currentWorkspaceId: 11,
      workspaces: [{ id: 11, name: "Miru QA" }],
    });
    await launchApp();

    const page: Page = await firstWindow();

    await expect(page.locator("select").first()).toHaveValue("101");
    await page.getByRole("button", { name: "Entry" }).first().click();

    let dialog = page
      .locator(".motion-dialog")
      .filter({ hasText: "New entry" });
    await dialog.locator("input").last().fill("0:30");
    await dialog.locator("textarea").fill("Manual API entry");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(
      page.locator("p").filter({ hasText: "Manual API entry" })
    ).toBeVisible();
    const createRequest = findApiRequest(
      server,
      "POST",
      "/api/v1/timesheet_entry"
    );
    expect(
      (createRequest?.body as { timesheet_entry?: { duration?: number } })
        .timesheet_entry?.duration
    ).toBe(30);

    await page.getByTitle("Edit entry").first().click();
    dialog = page.locator(".motion-dialog").filter({ hasText: "Edit entry" });
    await dialog.locator("input").last().fill("0:45");
    await dialog.locator("textarea").fill("Edited API entry");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(
      page.locator("p").filter({ hasText: "Edited API entry" })
    ).toBeVisible();
    const updateRequest = server.requests.find(
      (request) =>
        request.method === "PUT" &&
        request.pathname.startsWith("/api/v1/timesheet_entry/")
    );
    expect(updateRequest).toBeTruthy();
    expect(
      (updateRequest?.body as { timesheet_entry?: { duration?: number } })
        .timesheet_entry?.duration
    ).toBe(45);

    await page.getByTitle("Resume timer").first().click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.miruTimer.getState().then((state) => state.running)
        )
      )
      .toBe(true);

    await page.evaluate(() => window.miruTimer.reset());
  } finally {
    await closeApp();
    await server.close();
  }
});
