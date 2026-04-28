import { createFileRoute } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Filter,
  Info,
  Laptop,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

type EntryStatus = "running" | "submitted" | "approved" | "draft";

interface Client {
  id: string;
  name: string;
  contact: string;
}

interface Project {
  id: string;
  clientId: string;
  name: string;
}

interface Task {
  id: string;
  name: string;
}

interface TimeEntry {
  id: string;
  date: string;
  personId: string;
  clientId: string;
  projectId: string;
  taskId: string;
  notes: string;
  hours: number;
  billable: boolean;
  status: EntryStatus;
}

interface TimerState {
  projectId: string;
  taskId: string;
  notes: string;
  billable: boolean;
  elapsedSeconds: number;
  idle: MiruTimerState["idle"];
  idleThresholdSeconds: number;
  running: boolean;
}

interface EntryDraft {
  billable: boolean;
  date: string;
  hours: string;
  notes: string;
  projectId: string;
  taskId: string;
}

type AuthMode = "login" | "signup";

interface AuthForm {
  baseUrl: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface EntryDialogState {
  entryId?: string;
  mode: "edit" | "new";
}

const miruLogoUrl = new URL("../assets/miru-time-icon.svg", import.meta.url)
  .href;

const clients: Client[] = [
  { id: "northstar", name: "Northstar Labs", contact: "Maya Shah" },
  { id: "atlas", name: "Atlas Foods", contact: "Jon Bell" },
  { id: "kinetic", name: "Kinetic Finance", contact: "Elena Cruz" },
];

const projects: Project[] = [
  {
    id: "northstar-platform",
    clientId: "northstar",
    name: "Platform redesign",
  },
  {
    id: "northstar-support",
    clientId: "northstar",
    name: "Retainer support",
  },
  {
    id: "atlas-mobile",
    clientId: "atlas",
    name: "Mobile ordering",
  },
  {
    id: "kinetic-audit",
    clientId: "kinetic",
    name: "Compliance audit",
  },
];

const tasks: Task[] = [
  { id: "design", name: "Design" },
  { id: "development", name: "Development" },
  { id: "qa", name: "QA" },
  { id: "pm", name: "Project management" },
];

const seededEntries: TimeEntry[] = [
  {
    id: "entry-1",
    date: "2026-04-27",
    personId: "vipul",
    clientId: "northstar",
    projectId: "northstar-platform",
    taskId: "development",
    notes: "Electron shell and timer layout",
    hours: 6.25,
    billable: false,
    status: "approved",
  },
  {
    id: "entry-2",
    date: "2026-04-27",
    personId: "ana",
    clientId: "northstar",
    projectId: "northstar-platform",
    taskId: "design",
    notes: "Timesheet review flow",
    hours: 4.5,
    billable: false,
    status: "submitted",
  },
  {
    id: "entry-3",
    date: "2026-04-26",
    personId: "sam",
    clientId: "atlas",
    projectId: "atlas-mobile",
    taskId: "development",
    notes: "Offline timer persistence",
    hours: 7.75,
    billable: false,
    status: "submitted",
  },
  {
    id: "entry-4",
    date: "2026-04-25",
    personId: "nora",
    clientId: "kinetic",
    projectId: "kinetic-audit",
    taskId: "qa",
    notes: "Audit evidence checks",
    hours: 5,
    billable: false,
    status: "draft",
  },
  {
    id: "entry-5",
    date: "2026-04-24",
    personId: "vipul",
    clientId: "northstar",
    projectId: "northstar-support",
    taskId: "pm",
    notes: "Retainer planning and client call",
    hours: 3.25,
    billable: false,
    status: "approved",
  },
];

const tabs = [
  { id: "time", label: "Time", icon: Clock3 },
  { id: "projects", label: "Projects", icon: BriefcaseBusiness },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = (typeof tabs)[number]["id"];

const initialTimer: TimerState = {
  projectId: projects[0].id,
  taskId: "development",
  notes: "",
  billable: false,
  elapsedSeconds: 0,
  idle: null,
  idleThresholdSeconds: 300,
  running: false,
};

const todayIso = new Date().toISOString().slice(0, 10);

function newEntryDraft(date = todayIso): EntryDraft {
  return {
    billable: false,
    date,
    hours: "0:00",
    notes: "",
    projectId: projects[0].id,
    taskId: "development",
  };
}

function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>("time");
  const [entries, setEntries] = useState<TimeEntry[]>(() => {
    const storedEntries = window.localStorage.getItem("pulse-time-entries");
    return storedEntries ? JSON.parse(storedEntries) : seededEntries;
  });
  const [timer, setTimer] = useState<TimerState>(() => {
    const storedTimer = window.localStorage.getItem("pulse-timer");
    const parsedTimer = storedTimer ? JSON.parse(storedTimer) : {};

    return {
      ...initialTimer,
      billable: false,
      notes: parsedTimer.notes ?? initialTimer.notes,
      projectId: parsedTimer.projectId ?? initialTimer.projectId,
      taskId: parsedTimer.taskId ?? initialTimer.taskId,
    };
  });
  const [clientFilter, setClientFilter] = useState("all");
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
  const [syncMessage, setSyncMessage] = useState("");
  const [query, setQuery] = useState("");

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
  }, [timer]);

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

  function syncDesktopTimer(state: MiruTimerState) {
    setTimer((current) => ({
      ...current,
      elapsedSeconds: state.elapsedSeconds,
      idle: state.idle,
      idleThresholdSeconds: state.idleThresholdSeconds,
      running: state.running,
    }));
  }

  useEffect(() => {
    const project = projectById(timer.projectId) ?? projects[0];
    const task = taskById(timer.taskId) ?? tasks[0];

    window.miruTimer
      .setContext({
        billable: false,
        notes: timer.notes,
        projectName: `${clientById(project.clientId)?.name} / ${project.name}`,
        taskName: task.name,
      })
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to sync desktop timer context", error);
      });
  }, [timer.notes, timer.projectId, timer.taskId]);

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const project = projectById(entry.projectId);
        const client = clientById(entry.clientId);
        const matchesClient =
          clientFilter === "all" || entry.clientId === clientFilter;
        const searchable = [
          entry.notes,
          project?.name,
          client?.name,
          taskById(entry.taskId)?.name,
        ]
          .join(" ")
          .toLowerCase();

        return matchesClient && searchable.includes(query.toLowerCase());
      }),
    [clientFilter, entries, query]
  );

  const selectedProject = projectById(timer.projectId) ?? projects[0];
  const selectedClient = clientById(selectedProject.clientId) ?? clients[0];
  const elapsedHours = timer.elapsedSeconds / 3600;

  function toggleTimer() {
    window.miruTimer.toggle().then(syncDesktopTimer).catch((error) => {
      console.error("Failed to toggle desktop timer", error);
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
    action: "remove-continue" | "remove-start-new" | "ignore-continue"
  ) {
    window.miruTimer
      .applyIdleAction(action)
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to apply idle action", error);
      });
  }

  function saveTimerEntry() {
    if (timer.elapsedSeconds < 60) {
      return;
    }

    const project = projectById(timer.projectId) ?? projects[0];
    const today = new Date().toISOString().slice(0, 10);

    setEntries((current) => [
      {
        id: `entry-${Date.now()}`,
        date: today,
        personId: "vipul",
        clientId: project.clientId,
        projectId: project.id,
        taskId: timer.taskId,
        notes: timer.notes || "Timer entry",
        hours: roundToQuarter(elapsedHours),
        billable: false,
        status: "draft",
      },
      ...current,
    ]);
    window.miruTimer.reset().then(syncDesktopTimer).catch((error) => {
      console.error("Failed to reset desktop timer", error);
    });
    setTimer((current) => ({
      ...current,
      notes: "",
      projectId: timer.projectId,
      taskId: timer.taskId,
    }));
  }

  function resetTimer() {
    window.miruTimer.reset().then(syncDesktopTimer).catch((error) => {
      console.error("Failed to reset desktop timer", error);
    });
  }

  function addManualEntry() {
    openNewEntry(selectedDate);
  }

  function openNewEntry(date = selectedDate) {
    setEntryDraft({
      ...newEntryDraft(date),
      billable: false,
      notes: timer.notes,
      projectId: timer.projectId,
      taskId: timer.taskId,
    });
    setEntryDialog({ mode: "new" });
  }

  function openEditEntry(entry: TimeEntry) {
    setEntryDraft({
      billable: entry.billable,
      date: entry.date,
      hours: formatHoursInput(entry.hours),
      notes: entry.notes,
      projectId: entry.projectId,
      taskId: entry.taskId,
    });
    setEntryDialog({ entryId: entry.id, mode: "edit" });
  }

  function saveEntryDraft(startAfterSave = false) {
    const project = projectById(entryDraft.projectId) ?? projects[0];
    const hours = parseHoursInput(entryDraft.hours);
    if (hours <= 0 && !startAfterSave) {
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
    } else {
      setEntries((current) => [
        {
          id: `entry-${Date.now()}`,
          billable: false,
          clientId: project.clientId,
          date: entryDraft.date,
          hours,
          notes: entryDraft.notes || "Time entry",
          personId: "vipul",
          projectId: project.id,
          status: "draft",
          taskId: entryDraft.taskId,
        },
        ...current,
      ]);
    }

    setTimer((current) => ({
      ...current,
      billable: false,
      notes: entryDraft.notes,
      projectId: entryDraft.projectId,
      taskId: entryDraft.taskId,
    }));
    setEntryDialog(null);

    if (startAfterSave) {
      window.miruTimer.start().then(syncDesktopTimer).catch((error) => {
        console.error("Failed to start desktop timer", error);
      });
    }
  }

  async function deleteEntry(entry: TimeEntry) {
    const confirmed = await window.nativeDialog.confirmDeleteTimeEntry();
    if (!confirmed) {
      return;
    }

    setEntries((current) => current.filter((item) => item.id !== entry.id));
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
      setSyncMessage("Miru account connected.");
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Miru login failed.");
    }
  }

  async function logoutMiru() {
    const session = await window.miruApi.logout();
    setMiruSession(session);
    setSyncMessage("Signed out. Time tracking stays local.");
  }

  async function switchMiruWorkspace(workspaceId: number | string) {
    setSyncMessage("Switching workspace...");
    try {
      const session = await window.miruApi.switchWorkspace(workspaceId);
      setMiruSession(session);
      setSyncMessage("Workspace switched.");
    } catch (error) {
      setSyncMessage(
        error instanceof Error ? error.message : "Workspace switch failed."
      );
    }
  }

  async function syncMiruTimer(action: "pull" | "push") {
    setSyncMessage(action === "pull" ? "Pulling current timer..." : "Pushing current timer...");
    const result = await window.miruApi.syncCurrentTimer(action);
    setMiruSession(result.session);
    syncDesktopTimer(result.timer);
    setSyncMessage(
      result.session.syncError || `Timer ${action === "pull" ? "pulled" : "pushed"}.`
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[12.5rem_1fr] overflow-hidden bg-background text-foreground">
      <aside className="flex min-h-0 flex-col border-r bg-sidebar">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              alt="Miru"
              className="size-8 rounded-md shadow-sm"
              src={miruLogoUrl}
            />
            <div>
              <h1 className="font-semibold text-sm">Miru Time Tracking</h1>
              <p className="text-muted-foreground text-xs">Employee tracker</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={cn(
                  "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm transition",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <div className="rounded-md border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Workspace</span>
              <ShieldCheck className="size-4 text-primary" />
            </div>
            <p className="mt-1 font-medium text-sm">Saeloun Studio</p>
            <p className="text-muted-foreground text-xs">
              Sync ready, local first
            </p>
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b bg-background/95 px-5 py-3">
          <div>
            <p className="text-muted-foreground text-xs uppercase">
              {clientFilter === "all" ? "All clients" : clientById(clientFilter)?.name}
            </p>
            <h2 className="font-semibold text-xl">{tabTitle(activeTab)}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2">
              <Clock3 className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-sm tabular-nums">
                {formatDuration(timer.elapsedSeconds)}
              </span>
              <button
                className="flex size-5 items-center justify-center rounded-sm hover:bg-muted"
                onClick={toggleTimer}
                title={timer.running ? "Pause timer" : "Start timer"}
                type="button"
              >
                {timer.running ? (
                  <Pause className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
              </button>
            </div>
            {activeTab !== "time" && (
              <>
                <div className="flex h-8 items-center gap-2 rounded-md border px-2">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input
                    className="w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search work"
                    value={query}
                  />
                </div>
                <label className="flex h-8 items-center gap-2 rounded-md border px-2 text-sm">
                  <Filter className="size-3.5 text-muted-foreground" />
                  <select
                    className="bg-transparent outline-none"
                    onChange={(event) => setClientFilter(event.target.value)}
                    value={clientFilter}
                  >
                    <option value="all">All clients</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <Button onClick={addManualEntry}>
              <Plus />
              Time
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          <div className="grid gap-4">
            {activeTab === "time" && (
              <>
                <section className="rounded-lg border bg-background p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-muted-foreground text-xs">
                        {timer.running ? "Tracking now" : "Ready"}
                      </p>
                      <p className="font-mono font-semibold text-3xl tabular-nums">
                        {formatDuration(timer.elapsedSeconds)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        className={cn(
                          "h-10 min-w-28",
                          timer.running
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-primary text-primary-foreground"
                        )}
                        onClick={toggleTimer}
                      >
                        {timer.running ? <Pause /> : <Play />}
                        {timer.running ? "Pause" : "Start"}
                      </Button>
                      <Button
                        disabled={timer.elapsedSeconds < 60}
                        onClick={saveTimerEntry}
                        variant="outline"
                      >
                        <Square />
                        Stop
                      </Button>
                      <Button
                        disabled={timer.elapsedSeconds === 0}
                        onClick={resetTimer}
                        title="Reset timer"
                        variant="ghost"
                      >
                        <RotateCcw />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] gap-2">
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
                          {clientById(project.clientId)?.name} / {project.name}
                        </option>
                      ))}
                    </Select>
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
                  </div>
                  <input
                    className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
                    onChange={(event) =>
                      setTimer((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="What are you working on?"
                    value={timer.notes}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                    <div className="text-muted-foreground text-sm">
                      {selectedClient.name}
                    </div>
                    <label className="flex h-8 items-center gap-2 rounded-md border px-2 text-xs">
                      Idle
                      <select
                        className="bg-transparent outline-none"
                        onChange={(event) =>
                          changeIdleThreshold(Number(event.target.value))
                        }
                        value={timer.idleThresholdSeconds}
                      >
                        <option value={60}>1m</option>
                        <option value={300}>5m</option>
                        <option value={600}>10m</option>
                        <option value={900}>15m</option>
                        <option value={1800}>30m</option>
                      </select>
                    </label>
                  </div>
                  {timer.idle && (
                    <div className="mt-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-primary">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm">
                          Idle time detected: {formatLongDuration(timer.idle.durationMs)}
                        </p>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            onClick={() => applyIdleAction("remove-continue")}
                            size="sm"
                            variant="outline"
                          >
                            Remove + continue
                          </Button>
                          <Button
                            onClick={() => applyIdleAction("remove-start-new")}
                            size="sm"
                            variant="outline"
                          >
                            Remove + new
                          </Button>
                          <Button
                            onClick={() => applyIdleAction("ignore-continue")}
                            size="sm"
                          >
                            Ignore
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
                <TimePanel
                  entries={filteredEntries}
                  onAddEntry={openNewEntry}
                  onDeleteEntry={deleteEntry}
                  onEditEntry={openEditEntry}
                  onResumeEntry={resumeEntry}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                />
              </>
            )}
            {activeTab === "projects" && <ProjectsPanel />}
            {activeTab === "settings" && (
              <SettingsPanel
                authForm={authForm}
                authMode={authMode}
                miruSession={miruSession}
                onAuthFormChange={setAuthForm}
                onAuthModeChange={setAuthMode}
                onLogout={logoutMiru}
                onQuit={() => window.nativeDialog.quitApp()}
                onSubmitAuth={submitMiruAuth}
                onSwitchWorkspace={switchMiruWorkspace}
                onSyncTimer={syncMiruTimer}
                syncMessage={syncMessage}
              />
            )}
          </div>
        </main>
      </section>
      {entryDialog && (
        <EntryEditorDialog
          draft={entryDraft}
          mode={entryDialog.mode}
          onChange={setEntryDraft}
          onClose={() => setEntryDialog(null)}
          onSave={() => saveEntryDraft(false)}
          onStart={() => saveEntryDraft(true)}
        />
      )}
    </div>
  );
}

function TimePanel({
  entries,
  onAddEntry,
  onDeleteEntry,
  onEditEntry,
  onResumeEntry,
  selectedDate,
  setSelectedDate,
}: {
  entries: TimeEntry[];
  onAddEntry: (date?: string) => void;
  onDeleteEntry: (entry: TimeEntry) => void;
  onEditEntry: (entry: TimeEntry) => void;
  onResumeEntry: (entry: TimeEntry) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}) {
  const weekDays = weekDates(selectedDate);
  const selectedEntries = entries.filter((entry) => entry.date === selectedDate);
  const totalWeekHours = entries
    .filter((entry) => weekDays.includes(entry.date))
    .reduce((total, entry) => total + entry.hours, 0);

  return (
    <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="flex h-14 items-center justify-between border-b bg-primary px-4 text-primary-foreground">
        <div className="flex items-center gap-2">
          <img alt="Miru" className="size-7 rounded-md" src={miruLogoUrl} />
          <span className="font-medium text-sm">Timesheet</span>
        </div>
        <div className="font-semibold text-lg">{dayTitle(selectedDate)}</div>
        <div className="flex items-center gap-2">
          <button
            className="flex size-8 items-center justify-center rounded-md hover:bg-white/15"
            title="Open calendar"
            type="button"
          >
            <CalendarDays className="size-5" />
          </button>
          <button
            className="flex size-8 items-center justify-center rounded-md hover:bg-white/15"
            title="Timesheet details"
            type="button"
          >
            <Info className="size-5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[2rem_repeat(7,1fr)_2rem] items-center border-b bg-muted/50 px-2 py-3">
        <button className="text-muted-foreground hover:text-foreground" type="button">
          ‹
        </button>
        {weekDays.map((day) => {
          const dayHours = entries
            .filter((entry) => entry.date === day)
            .reduce((total, entry) => total + entry.hours, 0);
          const selected = day === selectedDate;

          return (
            <button
              className="grid justify-items-center gap-1 text-muted-foreground"
              key={day}
              onClick={() => setSelectedDate(day)}
              type="button"
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full font-semibold text-lg transition",
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-background hover:text-foreground"
                )}
              >
                {weekdayShort(day)}
              </span>
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  selected ? "text-primary" : "text-muted-foreground"
                )}
              >
                {formatHours(dayHours)}
              </span>
            </button>
          );
        })}
        <button className="text-muted-foreground hover:text-foreground" type="button">
          ›
        </button>
      </div>
      <div className="min-h-[18rem] bg-background">
        {selectedEntries.length === 0 ? (
          <div className="flex min-h-[18rem] flex-col items-center justify-center px-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock3 className="size-6" />
            </div>
            <p className="mt-4 font-semibold text-lg">No time tracked for this day</p>
            <p className="mt-1 max-w-sm text-muted-foreground text-sm">
              Add a saved entry or start a timer from the current work bar.
            </p>
            <Button
              className="mt-5 h-10"
              onClick={() => onAddEntry(selectedDate)}
            >
              <Plus />
              Add New Entry
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {selectedEntries.map((entry) => (
              <div
                className="group grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 transition hover:bg-primary/5"
                key={entry.id}
              >
                <div>
                  <p className="font-semibold text-muted-foreground text-sm">
                    {clientById(entry.clientId)?.name}
                  </p>
                  <p className="font-medium text-lg">{projectById(entry.projectId)?.name}</p>
                  <p className="text-muted-foreground">{taskById(entry.taskId)?.name}</p>
                  {entry.notes && (
                    <p className="mt-1 text-muted-foreground text-sm">{entry.notes}</p>
                  )}
                </div>
                <div className="font-mono text-3xl tabular-nums">
                  {formatEntryDuration(entry.hours)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="flex size-9 items-center justify-center rounded-full border text-muted-foreground hover:border-primary hover:text-primary"
                    onClick={() => onResumeEntry(entry)}
                    title="Resume timer"
                    type="button"
                  >
                    <Play className="size-4" />
                  </button>
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    onClick={() => onEditEntry(entry)}
                    title="Edit entry"
                    type="button"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted hover:text-rose-600 group-hover:opacity-100"
                    onClick={() => onDeleteEntry(entry)}
                    title="Delete entry"
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-t bg-muted/40 px-5 py-3">
        <div className="flex items-center gap-6">
          <button
            className="text-muted-foreground hover:text-primary"
            onClick={() => onAddEntry(selectedDate)}
            title="Add entry"
            type="button"
          >
            <Plus className="size-7" />
          </button>
          <button className="text-muted-foreground hover:text-primary" title="Favorites" type="button">
            <Star className="size-7" />
          </button>
        </div>
        <div className="font-mono text-muted-foreground text-sm tabular-nums">
          Week total {formatHours(totalWeekHours)}h
        </div>
        <div className="flex justify-end">
          <button className="text-muted-foreground hover:text-primary" title="Settings" type="button">
            <Settings className="size-7" />
          </button>
        </div>
      </div>
    </section>
  );
}

function EntryEditorDialog({
  draft,
  mode,
  onChange,
  onClose,
  onSave,
  onStart,
}: {
  draft: EntryDraft;
  mode: "edit" | "new";
  onChange: (draft: EntryDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onStart: () => void;
}) {
  const selectedProject = projectById(draft.projectId) ?? projects[0];
  const selectedClient = clientById(selectedProject.clientId);

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
      <div className="w-[42rem] overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b bg-muted/50 px-4 py-3">
          <div />
          <h3 className="font-semibold text-lg">
            {mode === "edit" ? "Edit Time Entry" : "New Time Entry"}
          </h3>
          <button
            className="justify-self-end rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-4 p-6">
          <div className="grid grid-cols-[2rem_1fr] gap-4">
            <Star className="mt-8 size-6 text-muted-foreground" />
            <div className="grid gap-3 rounded-md border p-4">
              <label className="grid gap-1">
                <span className="text-muted-foreground text-xs">Project</span>
                <select
                  className="h-10 border-b bg-transparent text-lg outline-none focus:border-primary"
                  onChange={(event) => {
                    const project = projectById(event.target.value) ?? projects[0];
                    onChange({
                      ...draft,
                      billable: false,
                      projectId: project.id,
                    });
                  }}
                  value={draft.projectId}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {clientById(project.clientId)?.name} / {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-muted-foreground text-xs">Task</span>
                <select
                  className="h-10 bg-transparent text-lg outline-none focus:text-primary"
                  onChange={(event) => {
                    onChange({
                      ...draft,
                      billable: false,
                      taskId: event.target.value,
                    });
                  }}
                  value={draft.taskId}
                >
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_9rem] gap-4 pl-12">
            <input
              className="h-16 rounded-md border bg-transparent px-4 text-lg outline-none placeholder:text-muted-foreground focus:border-primary"
              onChange={(event) => onChange({ ...draft, notes: event.target.value })}
              placeholder="Notes (optional)"
              value={draft.notes}
            />
            <input
              className="h-16 rounded-md border bg-transparent px-4 text-right font-mono text-3xl outline-none focus:border-primary"
              onChange={(event) => onChange({ ...draft, hours: event.target.value })}
              placeholder="0:00"
              value={draft.hours}
            />
          </div>
          <div className="flex items-center justify-between pl-12">
            <div className="text-muted-foreground text-sm">
              {selectedClient?.name} / {selectedProject.name}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t bg-muted/40 px-6 py-4">
          <Button
            className="h-10 px-5"
            onClick={onClose}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="h-10 px-5"
            onClick={onSave}
            variant="outline"
          >
            Save
          </Button>
          <Button className="h-10 px-6" onClick={onStart}>
            <Play />
            {mode === "edit" ? "Save & resume" : "Start"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectsPanel() {
  const assignedTasks = tasks.filter((task) => task.id !== "internal");

  return (
    <section className="grid grid-cols-2 gap-4">
      {projects.map((project) => (
        <div className="rounded-md border bg-background p-4" key={project.id}>
          <div>
            <p className="text-muted-foreground text-xs">Assigned project</p>
            <p className="font-semibold">{project.name}</p>
            <p className="text-muted-foreground text-sm">
              {clientById(project.clientId)?.name}
            </p>
          </div>
          <div className="mt-4 grid gap-2">
            {assignedTasks.slice(0, 4).map((task) => (
              <div
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                key={`${project.id}-${task.id}`}
              >
                <span>{task.name}</span>
                <Clock3 className="size-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function SettingsPanel({
  authForm,
  authMode,
  miruSession,
  onAuthFormChange,
  onAuthModeChange,
  onLogout,
  onQuit,
  onSubmitAuth,
  onSwitchWorkspace,
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
  onSwitchWorkspace: (workspaceId: number | string) => void;
  onSyncTimer: (action: "pull" | "push") => void;
  syncMessage: string;
}) {
  return (
    <section className="grid grid-cols-[1.2fr_0.8fr] gap-4">
      <div className="rounded-md border bg-background">
        <PanelHeader
          description="Connect Miru web, switch workspaces, and sync the current timer."
          title="Miru account"
        />
        <div className="grid gap-3 p-4">
          <div className="flex rounded-md border bg-muted/40 p-1">
            {(["login", "signup"] as const).map((mode) => (
              <button
                className={cn(
                  "h-8 flex-1 rounded-sm px-3 text-sm",
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
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onAuthFormChange({ ...authForm, baseUrl: event.target.value })
              }
              value={authForm.baseUrl}
            />
          </FieldLabel>
          <FieldLabel label="Email">
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onAuthFormChange({ ...authForm, email: event.target.value })
              }
              type="email"
              value={authForm.email}
            />
          </FieldLabel>
          {authMode === "signup" && (
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="First name">
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
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
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
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
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onAuthFormChange({ ...authForm, password: event.target.value })
              }
              type="password"
              value={authForm.password}
            />
          </FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onSubmitAuth}>
              <ShieldCheck />
              {authMode === "login" ? "Log in" : "Create workspace"}
            </Button>
            <Button onClick={onLogout} variant="outline">
              Log out
            </Button>
            <Button onClick={onQuit} variant="ghost">
              Quit app
            </Button>
          </div>
          {syncMessage && (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
              {syncMessage}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-background">
        <PanelHeader
          description={miruSession?.signedIn ? "Connected" : "Local-first"}
          title="Workspace sync"
        />
        <div className="grid gap-3 p-4">
          <SummaryItem
            label="Status"
            value={miruSession?.syncStatus ?? "local"}
          />
          <SummaryItem
            label="Last sync"
            value={miruSession?.lastSyncAt || "Not synced"}
          />
          {miruSession?.workspaces.length ? (
            <FieldLabel label="Workspace">
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none"
                onChange={(event) => onSwitchWorkspace(event.target.value)}
                value={miruSession.currentWorkspaceId ?? ""}
              >
                {miruSession.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sign in to load workspaces from Miru web.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onSyncTimer("push")} variant="outline">
              Push timer
            </Button>
            <Button onClick={() => onSyncTimer("pull")} variant="outline">
              Pull timer
            </Button>
          </div>
        </div>
      </div>

      <div className="col-span-2 grid grid-cols-3 gap-4">
        {[
          ["Workspace", "Switch workspace and keep timer state synced", ShieldCheck],
          ["Timer", "Idle recovery, menu bar controls, and local persistence", Clock3],
          ["Integrations", "Connect Miru web current timer sync", Laptop],
        ].map(([title, description, Icon]) => (
          <div className="rounded-md border bg-background p-4" key={String(title)}>
            {typeof Icon !== "string" && <Icon className="size-5 text-primary" />}
            <p className="mt-3 font-semibold">{title}</p>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        ))}
      </div>
    </section>
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

function PanelHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between border-b p-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <div className="text-muted-foreground text-sm">{description}</div>
      </div>
      {action}
    </div>
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
      className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}

function clientById(id: string) {
  return clients.find((client) => client.id === id);
}

function projectById(id: string) {
  return projects.find((project) => project.id === id);
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

function formatHoursInput(hours: number) {
  return formatEntryDuration(hours);
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

function roundToQuarter(value: number) {
  return Math.max(0.25, Math.round(value * 4) / 4);
}

function weekdayShort(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  })
    .format(new Date(`${date}T00:00:00`))
    .slice(0, 1);
}

function dayTitle(date: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    weekday: "long",
  });
  const today = todayIso;
  const label = formatter.format(new Date(`${date}T00:00:00`));

  return date === today ? `Today, ${label.split(", ")[1]}` : label;
}

function weekDates(date: string) {
  const selected = new Date(`${date}T00:00:00`);
  const day = selected.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(selected);
    next.setDate(selected.getDate() + mondayOffset + index);
    return next.toISOString().slice(0, 10);
  });
}

function tabTitle(tab: TabId) {
  return {
    projects: "Projects",
    settings: "Settings",
    time: "Time tracking",
  }[tab];
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
