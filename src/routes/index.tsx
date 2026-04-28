import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  Clock3,
  LogIn,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

type EntryStatus = "approved" | "draft" | "running" | "submitted";

interface Client {
  id: string;
  name: string;
}

interface Project {
  clientId: string;
  id: string;
  name: string;
}

interface Task {
  id: string;
  name: string;
}

interface TimeEntry {
  billable: boolean;
  clientId: string;
  date: string;
  hours: number;
  id: string;
  notes: string;
  personId: string;
  projectId: string;
  status: EntryStatus;
  taskId: string;
}

interface TimerState {
  billable: boolean;
  elapsedSeconds: number;
  idle: MiruTimerState["idle"];
  idleThresholdSeconds: number;
  notes: string;
  projectId: string;
  running: boolean;
  taskId: string;
}

interface EntryDraft {
  billable: boolean;
  date: string;
  hours: string;
  notes: string;
  projectId: string;
  taskId: string;
}

interface EntryDialogState {
  entryId?: string;
  mode: "edit" | "new";
}

type AuthMode = "login" | "signup";

interface AuthForm {
  baseUrl: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

const miruLogoUrl = new URL("../assets/miru-time-icon.svg", import.meta.url)
  .href;

const tasks: Task[] = [
  { id: "time", name: "Time entry" },
];

const todayIso = new Date().toISOString().slice(0, 10);

const initialTimer: TimerState = {
  billable: false,
  elapsedSeconds: 0,
  idle: null,
  idleThresholdSeconds: 300,
  notes: "",
  projectId: "",
  running: false,
  taskId: "time",
};

function newEntryDraft(date = todayIso): EntryDraft {
  return {
    billable: false,
    date,
    hours: "0:00",
    notes: "",
    projectId: "",
    taskId: "time",
  };
}

function HomePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [timer, setTimer] = useState<TimerState>(() => {
    const storedTimer = window.localStorage.getItem("pulse-timer");
    const parsedTimer = storedTimer ? JSON.parse(storedTimer) : {};

    return {
      ...initialTimer,
      notes: parsedTimer.notes ?? initialTimer.notes,
      projectId: parsedTimer.projectId ?? initialTimer.projectId,
      taskId: parsedTimer.taskId ?? initialTimer.taskId,
    };
  });
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [entryDialog, setEntryDialog] = useState<EntryDialogState | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(() =>
    newEntryDraft(todayIso)
  );
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthForm>({
    baseUrl: "http://127.0.0.1:3000",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
  });
  const [miruSession, setMiruSession] = useState<MiruSessionState | null>(null);
  const [showSync, setShowSync] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    window.localStorage.setItem("pulse-time-entries", JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    window.localStorage.setItem(
      "pulse-timer",
      JSON.stringify({
        billable: false,
        notes: timer.notes,
        projectId: timer.projectId,
        taskId: timer.taskId,
      })
    );
  }, [timer.notes, timer.projectId, timer.taskId]);

  useEffect(() => {
    window.miruTimer.getState().then(syncDesktopTimer).catch((error) => {
      console.error("Failed to load desktop timer state", error);
    });

    return window.miruTimer.onStateChange(syncDesktopTimer);
  }, []);

  useEffect(() => {
    window.miruApi
      .getSession()
      .then((session) => {
        setMiruSession(session);
        setAuthForm((current) => ({ ...current, baseUrl: session.baseUrl }));
      })
      .catch((error) => {
        console.error("Failed to load Miru session", error);
      });
  }, []);

  useEffect(() => {
    if (!miruSession?.signedIn) {
      return;
    }

    loadTimeTracking()
      .then(() => setSyncMessage(""))
      .catch((error) => {
        setSyncMessage(
          error instanceof Error ? error.message : "Failed to load Miru data."
        );
      });
  }, [miruSession?.signedIn]);

  useEffect(() => {
    if (!miruSession?.signedIn || projects.length === 0) {
      return;
    }

    const project = projectById(timer.projectId, projects) ?? projects[0];
    const task = taskById(timer.taskId) ?? tasks[0];

    window.miruTimer
      .setContext({
        billable: false,
        notes: timer.notes,
        projectName: `${clientById(project.clientId, clients)?.name ?? "Miru"} / ${project.name}`,
        taskName: task.name,
      })
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to sync desktop timer context", error);
      });
  }, [clients, miruSession?.signedIn, projects, timer.notes, timer.projectId, timer.taskId]);

  const selectedProject = projectById(timer.projectId, projects) ?? projects[0];
  const selectedClient = selectedProject
    ? clientById(selectedProject.clientId, clients)
    : null;
  const selectedTask = taskById(timer.taskId) ?? tasks[0];
  const selectedEntries = useMemo(
    () => entries.filter((entry) => entry.date === selectedDate),
    [entries, selectedDate]
  );
  const selectedDayHours = selectedEntries.reduce(
    (total, entry) => total + entry.hours,
    0
  );

  function syncDesktopTimer(state: MiruTimerState) {
    setTimer((current) => ({
      ...current,
      elapsedSeconds: state.elapsedSeconds,
      idle: state.idle,
      idleThresholdSeconds: state.idleThresholdSeconds,
      running: state.running,
    }));
  }

  async function loadTimeTracking() {
    const payload = await window.miruApi.getTimeTracking({
      from: shiftDate(todayIso, -45),
      to: shiftDate(todayIso, 45),
    });
    const nextClients = payload.clients.map((client) => ({
      id: String(client.id),
      name: client.name,
    }));
    const nextProjects = Object.values(payload.projects)
      .flat()
      .map((project) => ({
        clientId: String(project.client_id),
        id: String(project.id),
        name: project.name,
      }));
    const nextEntries = Object.entries(payload.entries).flatMap(
      ([date, dayEntries]) =>
        (Array.isArray(dayEntries) ? dayEntries : [])
          .filter((entry) => (entry.type ?? "timesheet") === "timesheet")
          .map((entry) => {
            const projectId = String(entry.project_id ?? "");
            const project = nextProjects.find((item) => item.id === projectId);

            return {
              billable: entry.bill_status !== "non_billable",
              clientId: project?.clientId ?? "",
              date,
              hours: entry.duration / 60,
              id: String(entry.id),
              notes: entry.note ?? "",
              personId: String(miruSession?.user?.id ?? ""),
              projectId,
              status: "draft" as const,
              taskId: "time",
            };
          })
    );

    setClients(nextClients);
    setProjects(nextProjects);
    setEntries(nextEntries);
    setTimer((current) => ({
      ...current,
      projectId:
        nextProjects.some((project) => project.id === current.projectId)
          ? current.projectId
          : nextProjects[0]?.id ?? "",
      taskId: "time",
    }));
  }

  function toggleTimer() {
    window.miruTimer.toggle().then(syncDesktopTimer).catch((error) => {
      console.error("Failed to toggle desktop timer", error);
    });
  }

  function resetTimer() {
    window.miruTimer.reset().then(syncDesktopTimer).catch((error) => {
      console.error("Failed to reset desktop timer", error);
    });
  }

  async function saveTimerEntry() {
    if (timer.elapsedSeconds < 60 || !selectedProject || !miruSession?.signedIn) {
      return;
    }

    const duration = Math.max(1, Math.round(timer.elapsedSeconds / 60));
    await window.miruApi.saveTimerEntry({
      duration,
      note: timer.notes || "Timer entry",
      projectId: selectedProject.id,
      userId: miruSession.user?.id as string | number | undefined,
      workDate: todayIso,
    });
    await loadTimeTracking();
    setSelectedDate(todayIso);
    setTimer((current) => ({ ...current, notes: "" }));
    resetTimer();
  }

  function openNewEntry(date = selectedDate) {
    setEntryDraft({
      ...newEntryDraft(date),
      notes: timer.notes,
      projectId: timer.projectId || projects[0]?.id || "",
      taskId: timer.taskId,
    });
    setEntryDialog({ mode: "new" });
  }

  function openEditEntry(entry: TimeEntry) {
    setEntryDraft({
      billable: false,
      date: entry.date,
      hours: formatEntryDuration(entry.hours),
      notes: entry.notes,
      projectId: entry.projectId,
      taskId: entry.taskId,
    });
    setEntryDialog({ entryId: entry.id, mode: "edit" });
  }

  async function saveEntryDraft(startAfterSave = false) {
    const project = projectById(entryDraft.projectId, projects) ?? projects[0];
    const hours = parseHoursInput(entryDraft.hours);

    if (!(project && miruSession?.signedIn) || (hours <= 0 && !startAfterSave)) {
      return;
    }

    if (entryDialog?.mode === "edit" && entryDialog.entryId) {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === entryDialog.entryId
            ? {
                ...entry,
                billable: false,
                clientId: project.clientId,
                date: entryDraft.date,
                hours,
                notes: entryDraft.notes || "Time entry",
                projectId: project.id,
                taskId: entryDraft.taskId,
              }
            : entry
        )
      );
    } else if (hours > 0) {
      await window.miruApi.saveTimerEntry({
        duration: Math.max(1, Math.round(hours * 60)),
        note: entryDraft.notes || "Time entry",
        projectId: project.id,
        userId: miruSession.user?.id as string | number | undefined,
        workDate: entryDraft.date,
      });
      await loadTimeTracking();
    }

    setTimer((current) => ({
      ...current,
      billable: false,
      notes: entryDraft.notes,
      projectId: entryDraft.projectId,
      taskId: entryDraft.taskId,
    }));
    setSelectedDate(entryDraft.date);
    setEntryDialog(null);

    if (startAfterSave) {
      window.miruTimer.start().then(syncDesktopTimer).catch((error) => {
        console.error("Failed to start desktop timer", error);
      });
    }
  }

  async function deleteEntry(entry: TimeEntry) {
    const confirmed = await window.nativeDialog.confirmDeleteTimeEntry();

    if (confirmed) {
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    }
  }

  function resumeEntry(entry: TimeEntry) {
    setTimer((current) => ({
      ...current,
      billable: false,
      notes: entry.notes,
      projectId: entry.projectId,
      taskId: entry.taskId,
    }));
    setSelectedDate(entry.date);
    window.miruTimer.start().then(syncDesktopTimer).catch((error) => {
      console.error("Failed to resume desktop timer", error);
    });
  }

  function changeIdleThreshold(seconds: number) {
    window.miruTimer
      .setIdleThreshold(seconds)
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to update idle threshold", error);
      });
  }

  function applyIdleAction(
    action: "ignore-continue" | "remove-continue" | "remove-start-new"
  ) {
    window.miruTimer
      .applyIdleAction(action)
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to apply idle action", error);
      });
  }

  async function submitMiruAuth() {
    setSyncMessage("Connecting to Miru...");

    try {
      const session =
        authMode === "login"
          ? await window.miruApi.login({
              baseUrl: authForm.baseUrl,
              email: authForm.email,
              password: authForm.password,
            })
          : await window.miruApi.signup({
              baseUrl: authForm.baseUrl,
              email: authForm.email,
              firstName: authForm.firstName,
              lastName: authForm.lastName,
              password: authForm.password,
            });

      setMiruSession(session);
      setSyncMessage("Connected.");
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Miru sync failed.");
    }
  }

  async function syncMiruTimer(action: "pull" | "push") {
    setSyncMessage(action === "pull" ? "Pulling timer..." : "Pushing timer...");

    try {
      const result = await window.miruApi.syncCurrentTimer(action);
      setMiruSession(result.session);
      syncDesktopTimer(result.timer);
      setSyncMessage(action === "pull" ? "Timer pulled." : "Timer pushed.");
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Timer sync failed.");
    }
  }

  async function logoutMiru() {
    const session = await window.miruApi.logout();
    setMiruSession(session);
    setClients([]);
    setProjects([]);
    setEntries([]);
    setSyncMessage("Logged out.");
  }

  async function openGoogleLogin() {
    await window.miruApi.googleLogin(authForm.baseUrl);
    setSyncMessage("Google sign-in opened in your browser. Return here after signing in.");
  }

  return (
    <div className="flex h-screen flex-col bg-[#f7f8fb] text-foreground">
      <header className="draglayer grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b bg-white/95 px-3">
        <div className="no-drag flex items-center gap-1.5 pr-1">
          <button
            aria-label="Close window"
            className="size-3 rounded-full bg-[#ff5f57] ring-1 ring-black/10"
            onClick={() => window.nativeDialog.closeWindow()}
            type="button"
          />
          <button
            aria-label="Minimize window"
            className="size-3 rounded-full bg-[#ffbd2e] ring-1 ring-black/10"
            onClick={() => window.nativeDialog.minimizeWindow()}
            type="button"
          />
          <span className="size-3 rounded-full bg-[#28c840] ring-1 ring-black/10" />
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <img
            alt=""
            className="size-7 shrink-0 rounded-md shadow-sm"
            src={miruLogoUrl}
          />
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-sm">Miru Time Tracking</h1>
            <p className="text-muted-foreground text-xs">Employee tracker</p>
          </div>
        </div>
        <button
          className="no-drag flex size-9 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setShowSync((visible) => !visible)}
          title="Settings"
          type="button"
        >
          <Settings className="size-4" />
        </button>
      </header>

      {!miruSession?.signedIn ? (
        <OnboardingPanel
          authForm={authForm}
          authMode={authMode}
          onAuthFormChange={setAuthForm}
          onAuthModeChange={setAuthMode}
          onGoogleLogin={openGoogleLogin}
          onSubmitAuth={submitMiruAuth}
          syncMessage={syncMessage}
        />
      ) : (
        <>

      <section className="shrink-0 border-b bg-background px-3 py-2">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  timer.running ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
              />
              <span className="text-muted-foreground text-xs">
                {timer.running ? "Tracking now" : "Ready to track"}
              </span>
            </div>
            <p className="mt-1 font-mono font-semibold text-2xl tabular-nums">
              {formatDuration(timer.elapsedSeconds)}
            </p>
            <p className="truncate text-muted-foreground text-xs">
              {selectedClient?.name ?? "Miru"} / {selectedProject?.name ?? "Select project"} / {selectedTask.name}
            </p>
          </div>
          <Button
            className="size-12 rounded-full"
            onClick={toggleTimer}
            size="icon"
            title={timer.running ? "Pause timer" : "Start timer"}
            type="button"
          >
            {timer.running ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Button
            className="h-8"
            disabled={timer.elapsedSeconds < 60 || !selectedProject}
            onClick={saveTimerEntry}
            variant="outline"
          >
            <Square />
            Stop and save
          </Button>
          <Button
            className="h-8"
            disabled={timer.elapsedSeconds === 0}
            onClick={resetTimer}
            title="Reset timer"
            variant="outline"
          >
            <RotateCcw />
          </Button>
        </div>
      </section>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        <section className="rounded-lg border bg-background shadow-sm">
          <div className="border-b p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">Time tracking</p>
                <p className="truncate font-semibold text-base">
                  {selectedClient?.name ?? "Miru"} / {selectedProject?.name ?? "Select project"}
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {selectedTask.name}
                </p>
              </div>
              <Clock3 className="mt-1 size-5 text-primary" />
            </div>
          </div>

          <div className="grid gap-3 p-3">
            <FieldLabel label="Project">
              <Select
                onChange={(value) => {
                  setTimer((current) => ({
                    ...current,
                    billable: false,
                    projectId: value,
                  }));
                }}
                value={timer.projectId}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {clientById(project.clientId, clients)?.name ?? "Miru"} / {project.name}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            <div className="grid grid-cols-[1fr_7.25rem] gap-2">
              <FieldLabel label="Task">
                <Select
                  onChange={(value) => {
                    setTimer((current) => ({
                      ...current,
                      billable: false,
                      taskId: value,
                    }));
                  }}
                  value={timer.taskId}
                >
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <FieldLabel label="Idle prompt">
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  onChange={(event) =>
                    changeIdleThreshold(Number(event.target.value))
                  }
                  value={timer.idleThresholdSeconds}
                >
                  <option value={60}>1 min</option>
                  <option value={300}>5 min</option>
                  <option value={600}>10 min</option>
                  <option value={900}>15 min</option>
                  <option value={1800}>30 min</option>
                </select>
              </FieldLabel>
            </div>
            <FieldLabel label="Notes">
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
                onChange={(event) =>
                  setTimer((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="What are you working on?"
                value={timer.notes}
              />
            </FieldLabel>
          </div>
        </section>

        {timer.idle && (
          <IdlePrompt
            durationMs={timer.idle.durationMs}
            onAction={applyIdleAction}
          />
        )}

        {showSync && (
          <SyncPanel
            authForm={authForm}
            authMode={authMode}
            miruSession={miruSession}
            onAuthFormChange={setAuthForm}
            onAuthModeChange={setAuthMode}
            onLogout={logoutMiru}
            onQuit={() => window.nativeDialog.quitApp()}
            onSubmitAuth={submitMiruAuth}
            onSyncTimer={syncMiruTimer}
            syncMessage={syncMessage}
          />
        )}

        <section className="mt-3 min-h-0 flex-1 rounded-lg border bg-background shadow-sm">
          <div className="flex items-center justify-between border-b p-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <p className="font-semibold text-sm">{dayTitle(selectedDate)}</p>
              </div>
              <p className="font-mono text-muted-foreground text-xs tabular-nums">
                {formatHours(selectedDayHours)}h total
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="h-8 w-32 rounded-md border bg-background px-2 text-xs outline-none"
                onChange={(event) => setSelectedDate(event.target.value)}
                type="date"
                value={selectedDate}
              />
              <Button
                className="h-8"
                onClick={() => openNewEntry(selectedDate)}
                type="button"
              >
                <Plus />
                Add New Entry
              </Button>
            </div>
          </div>

          {selectedEntries.length === 0 ? (
            <div className="grid min-h-36 place-items-center px-5 text-center">
              <div>
                <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Clock3 className="size-5" />
                </div>
                <p className="mt-3 font-semibold text-sm">
                  No time tracked for this day
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  Start the timer above or add a manual entry.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {selectedEntries.map((entry) => (
                <TimeEntryRow
                  clients={clients}
                  entry={entry}
                  key={entry.id}
                  onDelete={deleteEntry}
                  onEdit={openEditEntry}
                  onResume={resumeEntry}
                  projects={projects}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {entryDialog && (
        <EntryEditorDialog
          clients={clients}
          draft={entryDraft}
          mode={entryDialog.mode}
          onChange={setEntryDraft}
          onClose={() => setEntryDialog(null)}
          onSave={() => saveEntryDraft(false)}
          onStart={() => saveEntryDraft(true)}
          projects={projects}
        />
      )}
        </>
      )}
    </div>
  );
}

function OnboardingPanel({
  authForm,
  authMode,
  onAuthFormChange,
  onAuthModeChange,
  onGoogleLogin,
  onSubmitAuth,
  syncMessage,
}: {
  authForm: AuthForm;
  authMode: AuthMode;
  onAuthFormChange: (form: AuthForm) => void;
  onAuthModeChange: (mode: AuthMode) => void;
  onGoogleLogin: () => void;
  onSubmitAuth: () => void;
  syncMessage: string;
}) {
  return (
    <main className="grid min-h-0 flex-1 place-items-center p-5">
      <section className="w-full max-w-sm rounded-lg border bg-background p-4 shadow-sm">
        <div>
          <p className="font-semibold text-lg">Log in to Miru</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Connect to your workspace before tracking time.
          </p>
        </div>
        <div className="mt-4 grid gap-3">
          <Button
            className="h-10 w-full"
            onClick={onGoogleLogin}
            type="button"
            variant="outline"
          >
            <LogIn />
            Continue with Google
          </Button>
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-1">
            {(["login", "signup"] as const).map((mode) => (
              <button
                className={cn(
                  "h-8 rounded-sm px-3 text-sm",
                  authMode === mode
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground"
                )}
                key={mode}
                onClick={() => onAuthModeChange(mode)}
                type="button"
              >
                {mode === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
          <FieldLabel label="Miru URL">
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onAuthFormChange({ ...authForm, baseUrl: event.target.value })
              }
              value={authForm.baseUrl}
            />
          </FieldLabel>
          <FieldLabel label="Email">
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onAuthFormChange({ ...authForm, email: event.target.value })
              }
              type="email"
              value={authForm.email}
            />
          </FieldLabel>
          {authMode === "signup" && (
            <div className="grid grid-cols-2 gap-2">
              <FieldLabel label="First name">
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  onChange={(event) =>
                    onAuthFormChange({
                      ...authForm,
                      firstName: event.target.value,
                    })
                  }
                  value={authForm.firstName}
                />
              </FieldLabel>
              <FieldLabel label="Last name">
                <input
                  className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  onChange={(event) =>
                    onAuthFormChange({
                      ...authForm,
                      lastName: event.target.value,
                    })
                  }
                  value={authForm.lastName}
                />
              </FieldLabel>
            </div>
          )}
          <FieldLabel label="Password">
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onAuthFormChange({ ...authForm, password: event.target.value })
              }
              type="password"
              value={authForm.password}
            />
          </FieldLabel>
          <Button className="h-10 w-full" onClick={onSubmitAuth} type="button">
            {authMode === "login" ? "Log in" : "Create account"}
          </Button>
          {syncMessage && (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
              {syncMessage}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function TimeEntryRow({
  entry,
  clients,
  onDelete,
  onEdit,
  onResume,
  projects,
}: {
  clients: Client[];
  entry: TimeEntry;
  onDelete: (entry: TimeEntry) => void;
  onEdit: (entry: TimeEntry) => void;
  onResume: (entry: TimeEntry) => void;
  projects: Project[];
}) {
  return (
    <div className="group grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          <p className="truncate font-semibold text-sm">
            {projectById(entry.projectId, projects)?.name}
          </p>
        </div>
        <p className="mt-0.5 truncate text-muted-foreground text-xs">
          {clientById(entry.clientId, clients)?.name} / {taskById(entry.taskId)?.name}
        </p>
        {entry.notes && (
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {entry.notes}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="w-12 text-right font-mono font-semibold text-sm tabular-nums">
          {formatEntryDuration(entry.hours)}
        </span>
        <button
          className="flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:border-primary hover:text-primary"
          onClick={() => onResume(entry)}
          title="Resume timer"
          type="button"
        >
          <Play className="size-3.5" />
        </button>
        <button
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onEdit(entry)}
          title="Edit entry"
          type="button"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-rose-600"
          onClick={() => onDelete(entry)}
          title="Delete entry"
          type="button"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function IdlePrompt({
  durationMs,
  onAction,
}: {
  durationMs: number;
  onAction: (
    action: "ignore-continue" | "remove-continue" | "remove-start-new"
  ) => void;
}) {
  return (
    <section className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary">
      <p className="font-semibold text-sm">
        Idle time detected: {formatLongDuration(durationMs)}
      </p>
      <div className="mt-2 grid gap-2">
        <Button
          className="justify-start"
          onClick={() => onAction("remove-continue")}
          variant="outline"
        >
          <Check />
          Remove and continue
        </Button>
        <Button
          className="justify-start"
          onClick={() => onAction("remove-start-new")}
          variant="outline"
        >
          <RefreshCw />
          Remove and start new
        </Button>
        <Button
          className="justify-start"
          onClick={() => onAction("ignore-continue")}
        >
          <Play />
          Ignore and continue
        </Button>
      </div>
    </section>
  );
}

function SyncPanel({
  authForm,
  authMode,
  miruSession,
  onAuthFormChange,
  onAuthModeChange,
  onLogout,
  onQuit,
  onSubmitAuth,
  onSyncTimer,
  syncMessage,
}: {
  authForm: AuthForm;
  authMode: AuthMode;
  miruSession: MiruSessionState | null;
  onAuthFormChange: (form: AuthForm) => void;
  onAuthModeChange: (mode: AuthMode) => void;
  onLogout: () => void;
  onQuit: () => void;
  onSubmitAuth: () => void;
  onSyncTimer: (action: "pull" | "push") => void;
  syncMessage: string;
}) {
  return (
    <section className="mt-3 rounded-lg border bg-background p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">Miru sync</p>
          <p className="text-muted-foreground text-xs">
            {miruSession?.signedIn ? "Connected" : "Local-first"}
          </p>
        </div>
        <LogIn className="size-4 text-primary" />
      </div>
      <div className="mt-3 grid gap-2">
        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-1">
          {(["login", "signup"] as const).map((mode) => (
            <button
              className={cn(
                "h-8 rounded-sm px-3 text-sm",
                authMode === mode
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground"
              )}
              key={mode}
              onClick={() => onAuthModeChange(mode)}
              type="button"
            >
              {mode === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>
        <FieldLabel label="Miru URL">
          <input
            className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(event) =>
              onAuthFormChange({ ...authForm, baseUrl: event.target.value })
            }
            value={authForm.baseUrl}
          />
        </FieldLabel>
        <FieldLabel label="Email">
          <input
            className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(event) =>
              onAuthFormChange({ ...authForm, email: event.target.value })
            }
            type="email"
            value={authForm.email}
          />
        </FieldLabel>
        {authMode === "signup" && (
          <div className="grid grid-cols-2 gap-2">
            <FieldLabel label="First name">
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                onChange={(event) =>
                  onAuthFormChange({
                    ...authForm,
                    firstName: event.target.value,
                  })
                }
                value={authForm.firstName}
              />
            </FieldLabel>
            <FieldLabel label="Last name">
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                onChange={(event) =>
                  onAuthFormChange({
                    ...authForm,
                    lastName: event.target.value,
                  })
                }
                value={authForm.lastName}
              />
            </FieldLabel>
          </div>
        )}
        <FieldLabel label="Password">
          <input
            className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(event) =>
              onAuthFormChange({ ...authForm, password: event.target.value })
            }
            type="password"
            value={authForm.password}
          />
        </FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onSubmitAuth}>
            <LogIn />
            {authMode === "login" ? "Log in" : "Sign up"}
          </Button>
          <Button onClick={onLogout} variant="outline">
            Log out
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => onSyncTimer("push")} variant="outline">
            Push timer
          </Button>
          <Button onClick={() => onSyncTimer("pull")} variant="outline">
            Pull timer
          </Button>
        </div>
        <Button onClick={onQuit} variant="ghost">
          Quit app
        </Button>
        {syncMessage && (
          <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
            {syncMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function EntryEditorDialog({
  clients,
  draft,
  mode,
  onChange,
  onClose,
  onSave,
  onStart,
  projects,
}: {
  clients: Client[];
  draft: EntryDraft;
  mode: "edit" | "new";
  onChange: (draft: EntryDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onStart: () => void;
  projects: Project[];
}) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b p-3">
          <div />
          <h2 className="font-semibold text-sm">
            {mode === "edit" ? "Edit Time Entry" : "New Time Entry"}
          </h2>
          <div className="flex justify-end">
            <button
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4">
          <FieldLabel label="Date">
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onChange({ ...draft, date: event.target.value })
              }
              type="date"
              value={draft.date}
            />
          </FieldLabel>
          <FieldLabel label="Project">
            <Select
              onChange={(value) => onChange({ ...draft, projectId: value })}
              value={draft.projectId}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {clientById(project.clientId, clients)?.name ?? "Miru"} / {project.name}
                </option>
              ))}
            </Select>
          </FieldLabel>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <FieldLabel label="Task">
              <Select
                onChange={(value) => onChange({ ...draft, taskId: value })}
                value={draft.taskId}
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            <FieldLabel label="Time">
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                onChange={(event) =>
                  onChange({ ...draft, hours: event.target.value })
                }
                placeholder="0:00"
                value={draft.hours}
              />
            </FieldLabel>
          </div>
          <FieldLabel label="Notes">
            <textarea
              className="min-h-20 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onChange({ ...draft, notes: event.target.value })
              }
              placeholder="Notes (optional)"
              value={draft.notes}
            />
          </FieldLabel>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t p-3">
          <Button onClick={onSave} variant="outline">
            Save
          </Button>
          <Button onClick={onStart}>
            <Play />
            Start timer
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

function Select({
  children,
  onChange,
  value,
}: {
  children: ReactNode;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function clientById(id: string, collection: Client[]) {
  return collection.find((client) => client.id === id);
}

function projectById(id: string, collection: Project[]) {
  return collection.find((project) => project.id === id);
}

function taskById(id: string) {
  return tasks.find((task) => task.id === id);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
}

function formatEntryDuration(hours: number) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  return `${wholeHours}:${String(minutes).padStart(2, "0")}`;
}

function parseHoursInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  if (trimmed.includes(":")) {
    const [hours, minutes] = trimmed.split(":").map((part) => Number(part));
    return (Number.isFinite(hours) ? hours : 0) +
      (Number.isFinite(minutes) ? minutes / 60 : 0);
  }

  const decimal = Number(trimmed);
  return Number.isFinite(decimal) ? decimal : 0;
}

function roundToQuarter(value: number) {
  return Math.max(0.25, Math.round(value * 4) / 4);
}

function formatLongDuration(milliseconds: number) {
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

function formatHours(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function dayTitle(date: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
  return date === todayIso
    ? "Today"
    : formatter.format(new Date(`${date}T00:00:00`));
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
