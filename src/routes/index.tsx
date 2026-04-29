import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock3,
  Cloud,
  CloudOff,
  FileText,
  FolderKanban,
  Link as LinkIcon,
  ListChecks,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  Square,
  Timer,
  TimerReset,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

interface TimeSummary {
  entryCount: number;
  selectedDayHours: number;
  todayHours: number;
  weekHours: number;
  weekRangeLabel: string;
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

const tasks: Task[] = [{ id: "time", name: "Time entry" }];

const todayIso = new Date().toISOString().slice(0, 10);
const INITIALS_SPLIT_PATTERN = /\s+/;

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
  const [entries, setEntries] = useState<TimeEntry[]>(() =>
    readStoredEntries()
  );
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
  const syncMenuRef = useRef<HTMLDivElement | null>(null);

  const syncDesktopTimer = useCallback((state: MiruTimerState) => {
    setTimer((current) => {
      const nextIdleDuration = state.idle
        ? Math.floor(state.idle.durationMs / 1000)
        : null;
      const currentIdleDuration = current.idle
        ? Math.floor(current.idle.durationMs / 1000)
        : null;
      const nextIdlePrompted = state.idle?.prompted ?? null;
      const currentIdlePrompted = current.idle?.prompted ?? null;

      if (
        current.elapsedSeconds === state.elapsedSeconds &&
        current.running === state.running &&
        current.idleThresholdSeconds === state.idleThresholdSeconds &&
        currentIdleDuration === nextIdleDuration &&
        currentIdlePrompted === nextIdlePrompted
      ) {
        return current;
      }

      return {
        ...current,
        elapsedSeconds: state.elapsedSeconds,
        idle: state.idle,
        idleThresholdSeconds: state.idleThresholdSeconds,
        running: state.running,
      };
    });
  }, []);

  const loadTimeTracking = useCallback(async () => {
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
      projectId: nextProjects.some(
        (project) => project.id === current.projectId
      )
        ? current.projectId
        : (nextProjects[0]?.id ?? ""),
      taskId: "time",
    }));
  }, [miruSession?.user?.id]);

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
    if (!showSync) {
      return;
    }

    syncMenuRef.current?.focus();

    // The account menu is an overlay; keep Escape scoped to the mounted menu.
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSync(false);
      }
    };

    window.addEventListener("keydown", handleEscapeKey);

    return () => window.removeEventListener("keydown", handleEscapeKey);
  }, [showSync]);

  useEffect(() => {
    window.miruTimer
      .getState()
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to load desktop timer state", error);
      });

    return window.miruTimer.onStateChange(syncDesktopTimer);
  }, [syncDesktopTimer]);

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
  }, [loadTimeTracking, miruSession?.signedIn]);

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
  }, [
    clients,
    miruSession?.signedIn,
    projects,
    timer.notes,
    timer.projectId,
    timer.taskId,
    syncDesktopTimer,
  ]);

  const selectedProject = projectById(timer.projectId, projects) ?? projects[0];
  const selectedClient = selectedProject
    ? clientById(selectedProject.clientId, clients)
    : null;
  const selectedTask = taskById(timer.taskId) ?? tasks[0];
  const selectedEntries = useMemo(
    () => entries.filter((entry) => entry.date === selectedDate),
    [entries, selectedDate]
  );
  const selectedDayHours = useMemo(
    () => selectedEntries.reduce((total, entry) => total + entry.hours, 0),
    [selectedEntries]
  );
  const weekRange = useMemo(() => getWeekRange(todayIso), []);
  const runningTimerHours = timer.elapsedSeconds / 3600;
  const todaySavedHours = useMemo(
    () => sumEntryHoursForRange(entries, todayIso, todayIso),
    [entries]
  );
  const weekSavedHours = useMemo(
    () => sumEntryHoursForRange(entries, weekRange.start, weekRange.end),
    [entries, weekRange.end, weekRange.start]
  );
  const timeSummary: TimeSummary = useMemo(
    () => ({
      entryCount: entries.length,
      selectedDayHours:
        selectedDate === todayIso
          ? selectedDayHours + runningTimerHours
          : selectedDayHours,
      todayHours: todaySavedHours + runningTimerHours,
      weekHours: weekSavedHours + runningTimerHours,
      weekRangeLabel: formatWeekRange(weekRange.start, weekRange.end),
    }),
    [
      entries.length,
      runningTimerHours,
      selectedDate,
      selectedDayHours,
      todaySavedHours,
      weekRange.end,
      weekRange.start,
      weekSavedHours,
    ]
  );
  const activeWorkspace = getActiveWorkspace(miruSession);
  const accountLabel = getAccountName(miruSession?.user);
  const accountEmail = getAccountEmail(miruSession?.user);

  const timerPanelClass = getTimerPanelClass(timer);
  const timerDotClass = getTimerDotClass(timer);
  const timerStatusLabel = getTimerStatusLabel(timer);

  useEffect(() => {
    window.miruTimer
      .setSummary({
        entryCount: timeSummary.entryCount,
        selectedDateLabel: dayTitle(selectedDate),
        selectedDateMinutes: Math.round(timeSummary.selectedDayHours * 60),
        syncStatus: miruSession?.syncStatus ?? "local",
        todayMinutes: Math.round(timeSummary.todayHours * 60),
        userLabel: accountLabel || accountEmail,
        weekMinutes: Math.round(timeSummary.weekHours * 60),
        workspaceName: activeWorkspace?.name ?? "",
      })
      .catch((error) => {
        console.error("Failed to sync desktop timer summary", error);
      });
  }, [
    accountEmail,
    accountLabel,
    activeWorkspace?.name,
    miruSession?.syncStatus,
    selectedDate,
    timeSummary.entryCount,
    timeSummary.selectedDayHours,
    timeSummary.todayHours,
    timeSummary.weekHours,
  ]);

  function toggleTimer() {
    window.miruTimer
      .toggle()
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to toggle desktop timer", error);
      });
  }

  function resetTimer() {
    window.miruTimer
      .reset()
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to reset desktop timer", error);
      });
  }

  async function saveTimerEntry() {
    if (
      timer.elapsedSeconds < 60 ||
      !selectedProject ||
      !miruSession?.signedIn
    ) {
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

    if (
      !(project && miruSession?.signedIn) ||
      (hours <= 0 && !startAfterSave)
    ) {
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
      window.miruTimer
        .start()
        .then(syncDesktopTimer)
        .catch((error) => {
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
    window.miruTimer
      .start()
      .then(syncDesktopTimer)
      .catch((error) => {
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
      setSyncMessage(
        error instanceof Error ? error.message : "Miru sync failed."
      );
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
      setSyncMessage(
        error instanceof Error ? error.message : "Timer sync failed."
      );
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
    setSyncMessage(
      "Google sign-in opened in your browser. Return here after signing in."
    );
  }

  async function switchWorkspace(workspaceId: string) {
    setSyncMessage("Switching workspace...");

    try {
      const session = await window.miruApi.switchWorkspace(workspaceId);
      setMiruSession(session);
      await loadTimeTracking();
      setSyncMessage("Workspace switched.");
    } catch (error) {
      setSyncMessage(
        error instanceof Error ? error.message : "Workspace switch failed."
      );
    }
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden rounded-xl border bg-[#f7f8fb]/95 text-foreground shadow-2xl backdrop-blur-xl">
      <header className="draglayer grid h-14 shrink-0 grid-cols-[1fr_auto] items-center gap-2 border-b bg-white/95 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <img
            alt=""
            className="motion-fade-up size-7 shrink-0 rounded-md shadow-sm"
            height={28}
            src={miruLogoUrl}
            width={28}
          />
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-sm">
              Miru Time Tracking
            </h1>
            <p className="text-muted-foreground text-xs">Employee tracker</p>
          </div>
        </div>
        {/* Signed-out users stay in onboarding; the header menu is only account actions. */}
        {miruSession?.signedIn && (
          <button
            aria-label="Account menu"
            className={cn(
              "no-drag interactive-lift icon-motion flex size-8 items-center justify-center rounded-md border text-muted-foreground transition",
              showSync
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-transparent hover:border-border hover:bg-muted hover:text-foreground"
            )}
            onClick={() => setShowSync((visible) => !visible)}
            title="Account menu"
            type="button"
          >
            <UserRound className="size-4" />
          </button>
        )}
      </header>

      {miruSession?.signedIn ? (
        <>
          <TimerHeroPanel
            onResetTimer={resetTimer}
            onSaveTimerEntry={saveTimerEntry}
            onToggleTimer={toggleTimer}
            selectedClient={selectedClient}
            selectedProject={selectedProject}
            selectedTask={selectedTask}
            timer={timer}
            timerDotClass={timerDotClass}
            timerPanelClass={timerPanelClass}
            timerStatusLabel={timerStatusLabel}
          />

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            <TimeSummaryStrip summary={timeSummary} />

            <WorkDetailsPanel
              clients={clients}
              onNotesChange={(notes) =>
                setTimer((current) => ({ ...current, notes }))
              }
              onProjectChange={(projectId) =>
                setTimer((current) => ({
                  ...current,
                  billable: false,
                  projectId,
                }))
              }
              projects={projects}
              selectedClient={selectedClient}
              selectedProject={selectedProject}
              selectedTask={selectedTask}
              timer={timer}
            />

            {timer.idle && (
              <IdlePrompt
                durationMs={timer.idle.durationMs}
                onAction={applyIdleAction}
              />
            )}

            <EntriesPanel
              clients={clients}
              entries={selectedEntries}
              onDateChange={setSelectedDate}
              onDelete={deleteEntry}
              onEdit={openEditEntry}
              onNewEntry={openNewEntry}
              onResume={resumeEntry}
              projects={projects}
              selectedDate={selectedDate}
              selectedDayHours={selectedDayHours}
            />
          </main>

          <AccountMenuOverlay
            authForm={authForm}
            authMode={authMode}
            idleThresholdSeconds={timer.idleThresholdSeconds}
            menuRef={syncMenuRef}
            miruSession={miruSession}
            onAuthFormChange={setAuthForm}
            onAuthModeChange={setAuthMode}
            onClose={() => setShowSync(false)}
            onIdleThresholdChange={changeIdleThreshold}
            onLogout={() => {
              logoutMiru().catch((error) => {
                console.error("Failed to log out of Miru", error);
              });
              setShowSync(false);
            }}
            onQuit={() => window.nativeDialog.quitApp()}
            onSubmitAuth={submitMiruAuth}
            onSyncTimer={syncMiruTimer}
            onWorkspaceChange={switchWorkspace}
            show={showSync}
            syncMessage={syncMessage}
          />

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
      ) : (
        <OnboardingPanel
          authForm={authForm}
          authMode={authMode}
          onAuthFormChange={setAuthForm}
          onAuthModeChange={setAuthMode}
          onGoogleLogin={openGoogleLogin}
          onSubmitAuth={submitMiruAuth}
          syncMessage={syncMessage}
        />
      )}
    </div>
  );
}

function TimerHeroPanel({
  onResetTimer,
  onSaveTimerEntry,
  onToggleTimer,
  selectedClient,
  selectedProject,
  selectedTask,
  timer,
  timerDotClass,
  timerPanelClass,
  timerStatusLabel,
}: {
  onResetTimer: () => void;
  onSaveTimerEntry: () => void;
  onToggleTimer: () => void;
  selectedClient: Client | null;
  selectedProject: Project | undefined;
  selectedTask: Task;
  timer: TimerState;
  timerDotClass: string;
  timerPanelClass: string;
  timerStatusLabel: string;
}) {
  const canSave = timer.elapsedSeconds >= 60 && Boolean(selectedProject);

  return (
    <section
      className={cn(
        "motion-fade-up border-b px-4 py-4 transition-colors",
        timerPanelClass
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <span className={cn("size-2.5 rounded-full", timerDotClass)} />
        <span>{timerStatusLabel}</span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono font-semibold text-4xl tabular-nums tracking-normal">
            {formatDuration(timer.elapsedSeconds)}
          </p>
          <p className="mt-1 truncate text-muted-foreground text-sm">
            {selectedClient?.name ?? "Choose a project"} /{" "}
            {selectedProject?.name ?? "No project"} / {selectedTask.name}
          </p>
        </div>
        <Button
          className={cn(
            "interactive-lift size-12 shrink-0 rounded-full shadow-lg",
            timer.running
              ? "bg-white text-[#211044] hover:bg-white/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          onClick={onToggleTimer}
          size="icon-lg"
          title={timer.running ? "Pause timer" : "Start timer"}
          type="button"
        >
          {timer.running ? (
            <Pause className="size-5" />
          ) : (
            <Play className="ml-0.5 size-5" />
          )}
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
        <Button
          className="interactive-lift h-9"
          disabled={!canSave}
          onClick={onSaveTimerEntry}
          type="button"
        >
          <Square />
          Stop and save
        </Button>
        <Button
          className="interactive-lift h-9"
          onClick={onToggleTimer}
          type="button"
          variant="outline"
        >
          {timer.running ? <Pause /> : <Play />}
          {timer.running ? "Pause" : "Start"}
        </Button>
        <Button
          className="interactive-lift h-9"
          onClick={onResetTimer}
          size="icon-lg"
          title="Reset timer"
          type="button"
          variant="outline"
        >
          <RotateCcw />
        </Button>
      </div>
    </section>
  );
}

function WorkDetailsPanel({
  clients,
  onNotesChange,
  onProjectChange,
  projects,
  selectedClient,
  selectedProject,
  selectedTask,
  timer,
}: {
  clients: Client[];
  onNotesChange: (notes: string) => void;
  onProjectChange: (projectId: string) => void;
  projects: Project[];
  selectedClient: Client | null;
  selectedProject: Project | undefined;
  selectedTask: Task;
  timer: TimerState;
}) {
  return (
    <section className="rounded-lg border bg-background p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FolderKanban className="size-4" />
        </span>
        <div>
          <p className="font-semibold text-sm">Work details</p>
          <p className="text-muted-foreground text-xs">
            {selectedClient?.name ?? "Select client"} /{" "}
            {selectedProject?.name ?? "Select project"}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <FieldLabel icon={<FolderKanban />} label="Project">
          <Select onChange={onProjectChange} value={timer.projectId}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {clientById(project.clientId, clients)?.name ?? "Miru"} /{" "}
                {project.name}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel icon={<ListChecks />} label="Task">
          <Select onChange={() => undefined} value={selectedTask.id}>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel icon={<FileText />} label="Notes">
          <textarea
            className="min-h-18 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="What are you working on?"
            value={timer.notes}
          />
        </FieldLabel>
      </div>
    </section>
  );
}

function EntriesPanel({
  clients,
  entries,
  onDateChange,
  onDelete,
  onEdit,
  onNewEntry,
  onResume,
  projects,
  selectedDate,
  selectedDayHours,
}: {
  clients: Client[];
  entries: TimeEntry[];
  onDateChange: (date: string) => void;
  onDelete: (entry: TimeEntry) => void;
  onEdit: (entry: TimeEntry) => void;
  onNewEntry: (date: string) => void;
  onResume: (entry: TimeEntry) => void;
  projects: Project[];
  selectedDate: string;
  selectedDayHours: number;
}) {
  return (
    <section className="mt-3 min-h-0 overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b p-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm">{dayTitle(selectedDate)}</p>
          <p className="text-muted-foreground text-xs">
            {entries.length} entries · {formatHours(selectedDayHours)}h tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(event) => onDateChange(event.target.value)}
            type="date"
            value={selectedDate}
          />
          <Button
            className="interactive-lift"
            onClick={() => onNewEntry(selectedDate)}
            type="button"
          >
            <CalendarPlus />
            Entry
          </Button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="divide-y">
          {entries.map((entry) => (
            <TimeEntryRow
              clients={clients}
              entry={entry}
              key={entry.id}
              onDelete={onDelete}
              onEdit={onEdit}
              onResume={onResume}
              projects={projects}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center p-6 text-center">
          <div>
            <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Timer className="size-5" />
            </div>
            <p className="mt-3 font-semibold text-sm">No time entries yet</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Start the timer or add an entry for this day.
            </p>
            <Button
              className="interactive-lift mt-4"
              onClick={() => onNewEntry(selectedDate)}
              type="button"
              variant="outline"
            >
              <Plus />
              Add entry
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function AccountMenuOverlay({
  authForm,
  authMode,
  idleThresholdSeconds,
  menuRef,
  miruSession,
  onAuthFormChange,
  onAuthModeChange,
  onClose,
  onIdleThresholdChange,
  onLogout,
  onQuit,
  onSubmitAuth,
  onSyncTimer,
  onWorkspaceChange,
  show,
  syncMessage,
}: {
  authForm: AuthForm;
  authMode: AuthMode;
  idleThresholdSeconds: number;
  menuRef: RefObject<HTMLDivElement | null>;
  miruSession: MiruSessionState | null;
  onAuthFormChange: (form: AuthForm) => void;
  onAuthModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onIdleThresholdChange: (seconds: number) => void;
  onLogout: () => void;
  onQuit: () => void;
  onSubmitAuth: () => void;
  onSyncTimer: (action: "pull" | "push") => void;
  onWorkspaceChange: (workspaceId: string) => void;
  show: boolean;
  syncMessage: string;
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-transparent"
        onClick={onClose}
      />
      <div
        aria-label="Account and sync menu"
        className="motion-popover no-drag absolute top-16 right-3 w-[22rem] max-w-[calc(100vw-1.5rem)]"
        ref={menuRef}
        role="dialog"
        tabIndex={-1}
      >
        <SyncPanel
          authForm={authForm}
          authMode={authMode}
          idleThresholdSeconds={idleThresholdSeconds}
          miruSession={miruSession}
          onAuthFormChange={onAuthFormChange}
          onAuthModeChange={onAuthModeChange}
          onIdleThresholdChange={onIdleThresholdChange}
          onLogout={onLogout}
          onQuit={onQuit}
          onSubmitAuth={onSubmitAuth}
          onSyncTimer={onSyncTimer}
          onWorkspaceChange={onWorkspaceChange}
          syncMessage={syncMessage}
        />
      </div>
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
      <section className="motion-dialog w-full max-w-sm rounded-lg border bg-background p-4 shadow-sm">
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
          <FieldLabel icon={<LinkIcon />} label="Miru URL">
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onAuthFormChange({ ...authForm, baseUrl: event.target.value })
              }
              value={authForm.baseUrl}
            />
          </FieldLabel>
          <FieldLabel icon={<Mail />} label="Email">
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
              <FieldLabel icon={<UserRound />} label="First name">
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
              <FieldLabel icon={<UserRound />} label="Last name">
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
          <FieldLabel icon={<LockKeyhole />} label="Password">
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
    <div className="group grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-3 py-3 transition-colors hover:bg-muted/40">
      <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
        <FolderKanban className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-semibold text-sm">
            {projectById(entry.projectId, projects)?.name}
          </p>
        </div>
        <p className="mt-0.5 truncate text-muted-foreground text-xs">
          {clientById(entry.clientId, clients)?.name} /{" "}
          {taskById(entry.taskId)?.name}
        </p>
        {entry.notes && (
          <p className="mt-1 flex items-center gap-1 truncate text-muted-foreground text-xs">
            <FileText className="size-3 shrink-0" />
            {entry.notes}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="w-12 text-right font-mono font-semibold text-sm tabular-nums">
          {formatEntryDuration(entry.hours)}
        </span>
        <button
          className="interactive-lift icon-motion flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:border-primary hover:text-primary"
          onClick={() => onResume(entry)}
          title="Resume timer"
          type="button"
        >
          <Play className="size-3.5" />
        </button>
        <button
          className="interactive-lift icon-motion flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onEdit(entry)}
          title="Edit entry"
          type="button"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          className="interactive-lift icon-motion flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-rose-600"
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
    <section className="motion-fade-up mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-amber-100 text-amber-700">
          <TimerReset className="size-4" />
        </span>
        <p className="font-semibold text-sm">
          Idle time detected: {formatLongDuration(durationMs)}
        </p>
      </div>
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

function TimeSummaryStrip({ summary }: { summary: TimeSummary }) {
  const items = [
    {
      icon: Clock3,
      label: "Today",
      value: formatEntryDuration(summary.todayHours),
    },
    {
      icon: CalendarDays,
      label: "This week",
      value: formatEntryDuration(summary.weekHours),
    },
    {
      icon: TimerReset,
      label: "Entries",
      value: String(summary.entryCount),
    },
  ];

  return (
    <section className="mb-3 grid grid-cols-3 gap-2">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div
            className="motion-fade-up interactive-lift min-w-0 rounded-lg border bg-background px-3 py-2 shadow-sm"
            key={item.label}
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-3.5" />
              </span>
              <p className="truncate text-[11px]">{item.label}</p>
            </div>
            <p className="mt-1 truncate font-mono font-semibold text-sm tabular-nums">
              {item.value}
            </p>
          </div>
        );
      })}
    </section>
  );
}

function SyncPanel({
  authForm,
  authMode,
  idleThresholdSeconds,
  miruSession,
  onAuthFormChange,
  onAuthModeChange,
  onIdleThresholdChange,
  onLogout,
  onQuit,
  onSubmitAuth,
  onSyncTimer,
  onWorkspaceChange,
  syncMessage,
}: {
  authForm: AuthForm;
  authMode: AuthMode;
  idleThresholdSeconds: number;
  miruSession: MiruSessionState | null;
  onAuthFormChange: (form: AuthForm) => void;
  onAuthModeChange: (mode: AuthMode) => void;
  onIdleThresholdChange: (seconds: number) => void;
  onLogout: () => void;
  onQuit: () => void;
  onSubmitAuth: () => void;
  onSyncTimer: (action: "pull" | "push") => void;
  onWorkspaceChange: (workspaceId: string) => void;
  syncMessage: string;
}) {
  const activeWorkspace = getActiveWorkspace(miruSession);
  const accountName = getAccountName(miruSession?.user) || "Miru user";
  const accountEmail = getAccountEmail(miruSession?.user);
  const status = miruSession?.syncStatus ?? "local";
  const StatusIcon =
    status === "offline" || status === "error" ? CloudOff : Cloud;
  const syncStatusClass = getSyncStatusClass(status);

  if (miruSession?.signedIn) {
    return (
      <section className="max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border bg-white p-2 shadow-2xl ring-1 ring-black/10">
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground text-sm shadow-sm">
                {getInitials(accountName || accountEmail || "M")}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-sm">{accountName}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {accountEmail || "Connected to Miru"}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-medium text-[11px]",
                syncStatusClass
              )}
            >
              <StatusIcon className="size-3" />
              {formatSyncStatus(status)}
            </span>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md border bg-background p-2">
            <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-muted-foreground text-xs">
                Workspace
              </p>
              {miruSession.workspaces.length > 1 ? (
                <select
                  className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  onChange={(event) => onWorkspaceChange(event.target.value)}
                  value={String(
                    miruSession.currentWorkspaceId ?? activeWorkspace?.id ?? ""
                  )}
                >
                  {miruSession.workspaces.map((workspace) => (
                    <option key={workspace.id} value={String(workspace.id)}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-0.5 truncate font-semibold text-sm">
                  {activeWorkspace?.name ?? "Miru workspace"}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 grid gap-1">
          <MenuAction
            description="Use the current web timer in this desktop tracker."
            icon={<ArrowDownToLine className="size-4" />}
            label="Pull timer from Miru"
            onClick={() => onSyncTimer("pull")}
          />
          <MenuAction
            description="Send this desktop timer state to Miru web."
            icon={<ArrowUpFromLine className="size-4" />}
            label="Push timer to Miru"
            onClick={() => onSyncTimer("push")}
          />
        </div>

        <div className="mt-2 rounded-lg border bg-background p-3">
          <FieldLabel icon={<TimerReset />} label="Idle prompt">
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onIdleThresholdChange(Number(event.target.value))
              }
              value={idleThresholdSeconds}
            >
              <option value={60}>After 1 min</option>
              <option value={300}>After 5 min</option>
              <option value={600}>After 10 min</option>
              <option value={900}>After 15 min</option>
              <option value={1800}>After 30 min</option>
            </select>
          </FieldLabel>
        </div>

        <div className="mt-2 grid gap-1 border-t pt-2">
          <MenuAction
            icon={<LogOut className="size-4" />}
            label="Log out"
            onClick={onLogout}
          />
          <MenuAction
            icon={<Power className="size-4" />}
            label="Quit Miru Time Tracking"
            onClick={onQuit}
          />
        </div>

        {syncMessage && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
            {syncMessage}
          </p>
        )}
      </section>
    );
  }

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
        <FieldLabel icon={<LinkIcon />} label="Miru URL">
          <input
            className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(event) =>
              onAuthFormChange({ ...authForm, baseUrl: event.target.value })
            }
            value={authForm.baseUrl}
          />
        </FieldLabel>
        <FieldLabel icon={<Mail />} label="Email">
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
            <FieldLabel icon={<UserRound />} label="First name">
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
            <FieldLabel icon={<UserRound />} label="Last name">
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
        <FieldLabel icon={<LockKeyhole />} label="Password">
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

function MenuAction({
  description,
  icon,
  label,
  onClick,
}: {
  description?: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="interactive-lift icon-motion grid grid-cols-[2rem_1fr] items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-muted"
      onClick={onClick}
      type="button"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-sm">{label}</span>
        {description && (
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">
            {description}
          </span>
        )}
      </span>
    </button>
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
      <div className="motion-dialog w-full max-w-sm overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b p-3">
          <div />
          <h2 className="font-semibold text-sm">
            {mode === "edit" ? "Edit Time Entry" : "New Time Entry"}
          </h2>
          <div className="flex justify-end">
            <button
              className="interactive-lift icon-motion flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4">
          <FieldLabel icon={<CalendarDays />} label="Date">
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onChange({ ...draft, date: event.target.value })
              }
              type="date"
              value={draft.date}
            />
          </FieldLabel>
          <FieldLabel icon={<FolderKanban />} label="Project">
            <Select
              onChange={(value) => onChange({ ...draft, projectId: value })}
              value={draft.projectId}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {clientById(project.clientId, clients)?.name ?? "Miru"} /{" "}
                  {project.name}
                </option>
              ))}
            </Select>
          </FieldLabel>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <FieldLabel icon={<ListChecks />} label="Task">
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
            <FieldLabel icon={<Timer />} label="Time">
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
          <FieldLabel icon={<FileText />} label="Notes">
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
            <Save />
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
  icon,
  label,
}: {
  children: ReactNode;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      {children}
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
      className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function readStoredEntries() {
  const storedEntries = window.localStorage.getItem("pulse-time-entries");

  if (!storedEntries) {
    return [];
  }

  try {
    const parsedEntries = JSON.parse(storedEntries);
    return Array.isArray(parsedEntries) ? (parsedEntries as TimeEntry[]) : [];
  } catch {
    return [];
  }
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

function getTimerPanelClass(timer: TimerState) {
  if (timer.idle) {
    return "border-amber-200 bg-amber-50";
  }

  if (timer.running) {
    return "border-[#261257] bg-[#211044] text-white";
  }

  if (timer.elapsedSeconds > 0) {
    return "border-[#d9d0ff] bg-[#f5f2ff]";
  }

  return "bg-background";
}

function getTimerDotClass(timer: TimerState) {
  if (timer.idle) {
    return "status-dot-idle bg-amber-500";
  }

  if (timer.running) {
    return "status-dot-running bg-emerald-500";
  }

  if (timer.elapsedSeconds > 0) {
    return "bg-primary";
  }

  return "bg-muted-foreground/40";
}

function getTimerStatusLabel(timer: TimerState) {
  if (timer.idle) {
    return "Idle detected";
  }

  if (timer.running) {
    return "Tracking now";
  }

  if (timer.elapsedSeconds > 0) {
    return "Paused";
  }

  return "Ready";
}

function getSyncStatusClass(status: MiruSessionState["syncStatus"]) {
  if (status === "synced") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "syncing") {
    return "bg-primary/10 text-primary";
  }

  return "bg-background text-muted-foreground";
}

function sumEntryHoursForRange(entries: TimeEntry[], from: string, to: string) {
  return entries
    .filter((entry) => entry.date >= from && entry.date <= to)
    .reduce((total, entry) => total + entry.hours, 0);
}

function getWeekRange(date: string) {
  const current = new Date(`${date}T00:00:00`);
  const day = current.getDay();
  const start = new Date(current);
  start.setDate(current.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    end: end.toISOString().slice(0, 10),
    start: start.toISOString().slice(0, 10),
  };
}

function formatWeekRange(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  });

  return `${formatter.format(new Date(`${from}T00:00:00`))} - ${formatter.format(new Date(`${to}T00:00:00`))}`;
}

function getActiveWorkspace(session: MiruSessionState | null) {
  if (!session?.workspaces.length) {
    return null;
  }

  return (
    session.workspaces.find(
      (workspace) => String(workspace.id) === String(session.currentWorkspaceId)
    ) ?? session.workspaces[0]
  );
}

function getAccountName(user: Record<string, unknown> | null | undefined) {
  if (!user) {
    return "";
  }

  const name =
    getStringValue(user, "name") ||
    [getStringValue(user, "first_name"), getStringValue(user, "last_name")]
      .filter(Boolean)
      .join(" ") ||
    [getStringValue(user, "firstName"), getStringValue(user, "lastName")]
      .filter(Boolean)
      .join(" ");

  return name.trim();
}

function getAccountEmail(user: Record<string, unknown> | null | undefined) {
  return user ? getStringValue(user, "email") : "";
}

function getStringValue(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function getInitials(value: string) {
  return (
    value
      .split(INITIALS_SPLIT_PATTERN)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "M"
  );
}

function formatSyncStatus(status: MiruSessionState["syncStatus"]) {
  const labels: Record<MiruSessionState["syncStatus"], string> = {
    error: "Error",
    local: "Local",
    offline: "Offline",
    synced: "Synced",
    syncing: "Syncing",
  };

  return labels[status];
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
    return (
      (Number.isFinite(hours) ? hours : 0) +
      (Number.isFinite(minutes) ? minutes / 60 : 0)
    );
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
