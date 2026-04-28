import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Filter,
  Gauge,
  Info,
  Laptop,
  LayoutDashboard,
  Pause,
  Pencil,
  Play,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

type EntryStatus = "running" | "submitted" | "approved" | "draft";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
type ProjectHealth = "healthy" | "watch" | "risk";

interface Client {
  id: string;
  name: string;
  contact: string;
}

interface Project {
  id: string;
  clientId: string;
  name: string;
  budgetHours: number;
  rate: number;
  spentHours: number;
  health: ProjectHealth;
  billable: boolean;
}

interface Task {
  id: string;
  name: string;
  defaultBillable: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  capacityHours: number;
  trackedHours: number;
  submittedHours: number;
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

interface Invoice {
  id: string;
  clientId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  hours: number;
  amount: number;
}

interface Expense {
  id: string;
  clientId: string;
  projectId: string;
  category: string;
  amount: number;
  status: "approved" | "pending";
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
    budgetHours: 420,
    rate: 160,
    spentHours: 276,
    health: "healthy",
    billable: true,
  },
  {
    id: "northstar-support",
    clientId: "northstar",
    name: "Retainer support",
    budgetHours: 120,
    rate: 135,
    spentHours: 98,
    health: "watch",
    billable: true,
  },
  {
    id: "atlas-mobile",
    clientId: "atlas",
    name: "Mobile ordering",
    budgetHours: 260,
    rate: 150,
    spentHours: 246,
    health: "risk",
    billable: true,
  },
  {
    id: "kinetic-audit",
    clientId: "kinetic",
    name: "Compliance audit",
    budgetHours: 180,
    rate: 175,
    spentHours: 82,
    health: "healthy",
    billable: true,
  },
];

const tasks: Task[] = [
  { id: "design", name: "Design", defaultBillable: true },
  { id: "development", name: "Development", defaultBillable: true },
  { id: "qa", name: "QA", defaultBillable: true },
  { id: "pm", name: "Project management", defaultBillable: true },
  { id: "internal", name: "Internal admin", defaultBillable: false },
];

const team: TeamMember[] = [
  {
    id: "vipul",
    name: "Vipul A M",
    role: "Engineering lead",
    capacityHours: 40,
    trackedHours: 34.5,
    submittedHours: 32,
  },
  {
    id: "ana",
    name: "Ana Rodrigues",
    role: "Product designer",
    capacityHours: 36,
    trackedHours: 29,
    submittedHours: 29,
  },
  {
    id: "sam",
    name: "Sam Patel",
    role: "Full-stack engineer",
    capacityHours: 40,
    trackedHours: 41.25,
    submittedHours: 38,
  },
  {
    id: "nora",
    name: "Nora Chen",
    role: "QA analyst",
    capacityHours: 32,
    trackedHours: 24,
    submittedHours: 20,
  },
];

const seededEntries: TimeEntry[] = [
  {
    id: "entry-1",
    date: "2026-04-27",
    personId: "vipul",
    clientId: "northstar",
    projectId: "northstar-platform",
    taskId: "development",
    notes: "Electron shell and dashboard layout",
    hours: 6.25,
    billable: true,
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
    billable: true,
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
    billable: true,
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
    billable: true,
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
    billable: true,
    status: "approved",
  },
  {
    id: "entry-6",
    date: "2026-04-24",
    personId: "sam",
    clientId: "northstar",
    projectId: "northstar-support",
    taskId: "internal",
    notes: "Team retro and estimates",
    hours: 1.5,
    billable: false,
    status: "approved",
  },
];

const invoices: Invoice[] = [
  {
    id: "INV-1048",
    clientId: "northstar",
    status: "sent",
    issueDate: "2026-04-20",
    dueDate: "2026-05-05",
    hours: 72.5,
    amount: 11_240,
  },
  {
    id: "INV-1047",
    clientId: "atlas",
    status: "overdue",
    issueDate: "2026-04-10",
    dueDate: "2026-04-25",
    hours: 48,
    amount: 7200,
  },
  {
    id: "INV-1046",
    clientId: "kinetic",
    status: "paid",
    issueDate: "2026-04-02",
    dueDate: "2026-04-17",
    hours: 36,
    amount: 6300,
  },
];

const expenses: Expense[] = [
  {
    id: "EXP-221",
    clientId: "northstar",
    projectId: "northstar-platform",
    category: "Research tools",
    amount: 248,
    status: "approved",
  },
  {
    id: "EXP-222",
    clientId: "atlas",
    projectId: "atlas-mobile",
    category: "Device lab",
    amount: 640,
    status: "pending",
  },
  {
    id: "EXP-223",
    clientId: "kinetic",
    projectId: "kinetic-audit",
    category: "Travel",
    amount: 1180,
    status: "approved",
  },
];

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "time", label: "Time", icon: Clock3 },
  { id: "projects", label: "Projects", icon: BriefcaseBusiness },
  { id: "team", label: "Team", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "invoices", label: "Invoices", icon: ReceiptText },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = (typeof tabs)[number]["id"];

const initialTimer: TimerState = {
  projectId: projects[0].id,
  taskId: "development",
  notes: "",
  billable: true,
  elapsedSeconds: 0,
  idle: null,
  idleThresholdSeconds: 300,
  running: false,
};

const todayIso = new Date().toISOString().slice(0, 10);

function newEntryDraft(date = todayIso): EntryDraft {
  return {
    billable: true,
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
      billable: parsedTimer.billable ?? initialTimer.billable,
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
        billable: timer.billable,
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
        billable: timer.billable,
        notes: timer.notes,
        projectName: `${clientById(project.clientId)?.name} / ${project.name}`,
        taskName: task.name,
      })
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to sync desktop timer context", error);
      });
  }, [timer.billable, timer.notes, timer.projectId, timer.taskId]);

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
          memberById(entry.personId)?.name,
        ]
          .join(" ")
          .toLowerCase();

        return matchesClient && searchable.includes(query.toLowerCase());
      }),
    [clientFilter, entries, query]
  );

  const metrics = useMemo(() => {
    const totalHours = entries.reduce((total, entry) => total + entry.hours, 0);
    const billableHours = entries.reduce(
      (total, entry) => total + (entry.billable ? entry.hours : 0),
      0
    );
    const billableAmount = entries.reduce((total, entry) => {
      const project = projectById(entry.projectId);
      return total + (entry.billable && project ? entry.hours * project.rate : 0);
    }, 0);
    const pendingApprovals = entries.filter(
      (entry) => entry.status === "submitted"
    ).length;

    return { billableAmount, billableHours, pendingApprovals, totalHours };
  }, [entries]);

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
        billable: timer.billable,
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
      billable: timer.billable,
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
                billable: entryDraft.billable,
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
          billable: entryDraft.billable,
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
      billable: entryDraft.billable,
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
      billable: entry.billable,
      notes: entry.notes,
      projectId: entry.projectId,
      taskId: entry.taskId,
    }));
    setSelectedDate(entry.date);
    window.miruTimer.start().then(syncDesktopTimer).catch((error) => {
      console.error("Failed to resume desktop timer", error);
    });
  }

  function approveSubmittedEntries() {
    setEntries((current) =>
      current.map((entry) =>
        entry.status === "submitted" ? { ...entry, status: "approved" } : entry
      )
    );
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
    <div className="grid h-full min-h-0 grid-cols-[14rem_1fr] overflow-hidden rounded-md border bg-background text-foreground">
      <aside className="flex min-h-0 flex-col border-r bg-sidebar">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              alt="Miru"
              className="size-8 rounded-md shadow-sm"
              src={miruLogoUrl}
            />
            <div>
              <h1 className="font-semibold text-sm">Miru Time</h1>
              <p className="text-muted-foreground text-xs">Billable work</p>
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
                    ? "bg-foreground text-background"
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
        <header className="flex items-center justify-between border-b px-5 py-3">
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
            <Button onClick={addManualEntry}>
              <Plus />
              Time
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-muted/30 p-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-4 gap-3">
              <Metric
                icon={Clock3}
                label="Tracked"
                value={`${formatHours(metrics.totalHours)}h`}
                detail={`${formatHours(metrics.billableHours)} billable`}
              />
              <Metric
                icon={CircleDollarSign}
                label="Billable value"
                value={formatCurrency(metrics.billableAmount)}
                detail="Based on project rates"
              />
              <Metric
                icon={Gauge}
                label="Utilization"
                value={`${Math.round((metrics.totalHours / 180) * 100)}%`}
                detail="Team capacity this week"
              />
              <Metric
                icon={ShieldCheck}
                label="Approvals"
                value={String(metrics.pendingApprovals)}
                detail="Timesheets pending"
              />
            </div>

            <div className="grid grid-cols-[1.1fr_0.9fr] gap-4">
              <section className="rounded-md border bg-background">
                <div className="flex items-center justify-between border-b p-4">
                  <div>
                    <h3 className="font-semibold">Timer</h3>
                    <p className="text-muted-foreground text-sm">
                      Track work against clients, projects, tasks, and notes.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-3xl tabular-nums">
                      {formatDuration(timer.elapsedSeconds)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {timer.running ? "Running in menu bar" : "Paused"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 p-4">
                  {timer.idle && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">Idle time detected</p>
                          <p className="text-xs">
                            Remove {formatLongDuration(timer.idle.durationMs)} or keep tracking.
                          </p>
                        </div>
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Project">
                      <Select
                        onChange={(value) => {
                          const project = projectById(value) ?? projects[0];
                          setTimer((current) => ({
                            ...current,
                            billable: project.billable,
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
                    </Field>
                    <Field label="Task">
                      <Select
                        onChange={(value) => {
                          const task = taskById(value) ?? tasks[0];
                          setTimer((current) => ({
                            ...current,
                            billable: task.defaultBillable,
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
                    </Field>
                  </div>
                  <Field label="Notes">
                    <input
                      className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                      onChange={(event) =>
                        setTimer((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="What are you working on?"
                      value={timer.notes}
                    />
                  </Field>
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">
                          {timer.running ? "Timer is running" : "Ready to track"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {timer.running
                            ? "Pause for interruptions, or stop when this work is done."
                            : "Start from the desktop app or the macOS menu bar."}
                        </p>
                      </div>
                      <div className="font-mono text-2xl tabular-nums">
                        {formatDuration(timer.elapsedSeconds)}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Button
                        className={cn(
                          "h-11 text-sm",
                          timer.running
                            ? "bg-amber-600 text-white hover:bg-amber-600/90"
                            : "bg-primary text-primary-foreground"
                        )}
                        onClick={toggleTimer}
                        size="lg"
                      >
                        {timer.running ? <Pause /> : <Play />}
                        {timer.running ? "Pause" : "Start"}
                      </Button>
                      <Button
                        className="h-11 text-sm"
                        disabled={timer.elapsedSeconds < 60}
                        onClick={saveTimerEntry}
                        size="lg"
                        variant="outline"
                      >
                        <Square />
                        Stop & save
                      </Button>
                      <Button
                        className="h-11"
                        disabled={timer.elapsedSeconds === 0}
                        onClick={resetTimer}
                        size="lg"
                        title="Reset timer"
                        variant="ghost"
                      >
                        <RotateCcw />
                        Reset
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        checked={timer.billable}
                        className="size-4 accent-primary"
                        onChange={(event) =>
                          setTimer((current) => ({
                            ...current,
                            billable: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      Billable at {formatCurrency(selectedProject.rate)}/hour
                    </label>
                    <div className="flex items-center gap-2">
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
                  </div>
                  <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/60 p-3 text-sm">
                    <SummaryItem label="Client" value={selectedClient.name} />
                    <SummaryItem label="Contact" value={selectedClient.contact} />
                    <SummaryItem
                      label="Budget used"
                      value={`${Math.round(
                        (selectedProject.spentHours / selectedProject.budgetHours) *
                          100
                      )}%`}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-md border bg-background">
                <div className="flex items-center justify-between border-b p-4">
                  <div>
                    <h3 className="font-semibold">Timesheet approvals</h3>
                    <p className="text-muted-foreground text-sm">
                      Review submitted time before invoices are generated.
                    </p>
                  </div>
                  <Button onClick={approveSubmittedEntries} variant="outline">
                    <ShieldCheck />
                    Approve
                  </Button>
                </div>
                <div className="divide-y">
                  {team.map((member) => (
                    <div className="grid grid-cols-[1fr_auto] gap-3 p-4" key={member.id}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{member.name}</p>
                          <Badge tone={member.trackedHours > member.capacityHours ? "amber" : "green"}>
                            {formatHours(member.trackedHours)}h
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">{member.role}</p>
                        <Progress
                          value={member.trackedHours}
                          max={member.capacityHours}
                          tone={member.trackedHours > member.capacityHours ? "amber" : "green"}
                        />
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-medium">{formatHours(member.submittedHours)}h</p>
                        <p className="text-muted-foreground">submitted</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {activeTab === "dashboard" && (
              <DashboardPanel entries={filteredEntries} />
            )}
            {activeTab === "time" && (
              <TimePanel
                entries={filteredEntries}
                onAddEntry={openNewEntry}
                onDeleteEntry={deleteEntry}
                onEditEntry={openEditEntry}
                onResumeEntry={resumeEntry}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            )}
            {activeTab === "projects" && <ProjectsPanel />}
            {activeTab === "team" && <TeamPanel />}
            {activeTab === "reports" && <ReportsPanel entries={filteredEntries} />}
            {activeTab === "invoices" && <InvoicesPanel />}
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

function DashboardPanel({ entries }: { entries: TimeEntry[] }) {
  return (
    <section className="grid grid-cols-[1fr_18rem] gap-4">
      <div className="rounded-md border bg-background">
        <PanelHeader
          action={<Button variant="outline"><Download />Export</Button>}
          description="Recent time across the workspace"
          title="Activity"
        />
        <EntryTable entries={entries.slice(0, 6)} />
      </div>
      <div className="rounded-md border bg-background">
        <PanelHeader description="Billable pipeline" title="Revenue forecast" />
        <div className="space-y-4 p-4">
          {clients.map((client) => {
            const clientProjects = projects.filter(
              (project) => project.clientId === client.id
            );
            const forecast = clientProjects.reduce(
              (total, project) => total + project.spentHours * project.rate,
              0
            );

            return (
              <div key={client.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{client.name}</span>
                  <span>{formatCurrency(forecast)}</span>
                </div>
                <Progress value={forecast} max={70_000} tone="blue" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
    <section className="overflow-hidden rounded-md border bg-[#1f1f1f] text-zinc-100">
      <div className="flex h-14 items-center justify-between bg-orange-600 px-5">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-rose-400" />
          <span className="size-3 rounded-full bg-amber-300" />
          <span className="size-3 rounded-full bg-green-500" />
        </div>
        <div className="font-semibold text-lg">{dayTitle(selectedDate)}</div>
        <div className="flex items-center gap-3">
          <CalendarDays className="size-5" />
          <Info className="size-5" />
        </div>
      </div>
      <div className="grid grid-cols-[2rem_repeat(7,1fr)_2rem] items-center border-zinc-800 border-b bg-[#171717] px-2 py-3">
        <button className="text-zinc-400 hover:text-white" type="button">
          ‹
        </button>
        {weekDays.map((day) => {
          const dayHours = entries
            .filter((entry) => entry.date === day)
            .reduce((total, entry) => total + entry.hours, 0);
          const selected = day === selectedDate;

          return (
            <button
              className="grid justify-items-center gap-1 text-zinc-400"
              key={day}
              onClick={() => setSelectedDate(day)}
              type="button"
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full font-semibold text-xl",
                  selected && "bg-orange-600 text-white"
                )}
              >
                {weekdayShort(day)}
              </span>
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  selected ? "text-orange-500" : "text-zinc-500"
                )}
              >
                {formatHours(dayHours)}
              </span>
            </button>
          );
        })}
        <button className="text-zinc-400 hover:text-white" type="button">
          ›
        </button>
      </div>
      <div className="min-h-[21rem] bg-[#242424]">
        {selectedEntries.length === 0 ? (
          <div className="flex min-h-[21rem] flex-col items-center justify-center px-8 text-center">
            <p className="max-w-md font-semibold text-xl">
              Don’t judge each day by the harvest you reap but by the seeds that you plant.
            </p>
            <p className="mt-1 text-zinc-300">- Robert Louis Stevenson</p>
            <Button
              className="mt-8 h-10 border-zinc-500 text-zinc-200 hover:bg-zinc-800"
              onClick={() => onAddEntry(selectedDate)}
              variant="outline"
            >
              Add New Entry
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {selectedEntries.map((entry) => (
              <div
                className="group grid grid-cols-[1fr_auto_auto] items-center gap-4 bg-[#333] px-5 py-4 hover:bg-[#3b3b3b]"
                key={entry.id}
              >
                <div>
                  <p className="font-semibold text-zinc-400">
                    {clientById(entry.clientId)?.name}
                  </p>
                  <p className="font-medium text-lg">{projectById(entry.projectId)?.name}</p>
                  <p className="text-zinc-400">{taskById(entry.taskId)?.name}</p>
                  {entry.notes && (
                    <p className="mt-1 text-sm text-zinc-500">{entry.notes}</p>
                  )}
                </div>
                <div className="font-mono text-3xl tabular-nums text-zinc-100">
                  {formatEntryDuration(entry.hours)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="flex size-9 items-center justify-center rounded-full border border-zinc-500 text-zinc-300 hover:border-orange-500 hover:text-orange-500"
                    onClick={() => onResumeEntry(entry)}
                    title="Resume timer"
                    type="button"
                  >
                    <Play className="size-4" />
                  </button>
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-zinc-500 opacity-0 hover:bg-zinc-700 hover:text-zinc-100 group-hover:opacity-100"
                    onClick={() => onEditEntry(entry)}
                    title="Edit entry"
                    type="button"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-zinc-500 opacity-0 hover:bg-zinc-700 hover:text-rose-400 group-hover:opacity-100"
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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-zinc-800 border-t bg-[#171717] px-5 py-3">
        <div className="flex items-center gap-6">
          <button
            className="text-zinc-500 hover:text-zinc-100"
            onClick={() => onAddEntry(selectedDate)}
            title="Add entry"
            type="button"
          >
            <Plus className="size-7" />
          </button>
          <button className="text-zinc-500 hover:text-zinc-100" title="Favorites" type="button">
            <Star className="size-7" />
          </button>
        </div>
        <div className="font-mono text-zinc-400 text-sm tabular-nums">
          Week total {formatHours(totalWeekHours)}h
        </div>
        <div className="flex justify-end">
          <button className="text-zinc-500 hover:text-zinc-100" title="Settings" type="button">
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
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/35">
      <div className="w-[42rem] overflow-hidden rounded-xl border border-zinc-700 bg-[#252525] text-zinc-100 shadow-2xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-zinc-800 border-b bg-[#171717] px-4 py-3">
          <div />
          <h3 className="font-semibold text-lg">
            {mode === "edit" ? "Edit Time Entry" : "New Time Entry"}
          </h3>
          <button
            className="justify-self-end rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-4 p-6">
          <div className="grid grid-cols-[2rem_1fr] gap-4">
            <Star className="mt-8 size-6 text-zinc-500" />
            <div className="grid gap-3 rounded-md border border-zinc-700 p-4">
              <label className="grid gap-1">
                <span className="text-zinc-500 text-xs">Project</span>
                <select
                  className="h-10 border-zinc-700 border-b bg-transparent text-lg outline-none"
                  onChange={(event) => {
                    const project = projectById(event.target.value) ?? projects[0];
                    onChange({
                      ...draft,
                      billable: project.billable,
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
                <span className="text-zinc-500 text-xs">Task</span>
                <select
                  className="h-10 bg-transparent text-lg outline-none"
                  onChange={(event) => {
                    const task = taskById(event.target.value) ?? tasks[0];
                    onChange({
                      ...draft,
                      billable: task.defaultBillable,
                      taskId: task.id,
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
              className="h-16 rounded-md border border-zinc-700 bg-transparent px-4 text-lg outline-none placeholder:text-zinc-500 focus:border-orange-500"
              onChange={(event) => onChange({ ...draft, notes: event.target.value })}
              placeholder="Notes (optional)"
              value={draft.notes}
            />
            <input
              className="h-16 rounded-md border border-zinc-700 bg-transparent px-4 text-right font-mono text-3xl outline-none focus:border-orange-500"
              onChange={(event) => onChange({ ...draft, hours: event.target.value })}
              placeholder="0:00"
              value={draft.hours}
            />
          </div>
          <div className="flex items-center justify-between pl-12">
            <div className="text-zinc-500 text-sm">
              {selectedClient?.name} / {selectedProject.name}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={draft.billable}
                className="size-4 accent-orange-600"
                onChange={(event) =>
                  onChange({ ...draft, billable: event.target.checked })
                }
                type="checkbox"
              />
              Billable
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 bg-[#202020] px-6 py-4">
          <Button
            className="h-10 border-zinc-600 px-5 text-zinc-200 hover:bg-zinc-800"
            onClick={onClose}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="h-10 bg-zinc-700 px-5 text-white hover:bg-zinc-600"
            onClick={onSave}
          >
            Save
          </Button>
          <Button className="h-10 bg-green-600 px-6 text-white hover:bg-green-600/90" onClick={onStart}>
            <Play />
            {mode === "edit" ? "Save & resume" : "Start"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectsPanel() {
  return (
    <section className="grid grid-cols-2 gap-4">
      {projects.map((project) => (
        <div className="rounded-md border bg-background p-4" key={project.id}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{project.name}</p>
              <p className="text-muted-foreground text-sm">
                {clientById(project.clientId)?.name}
              </p>
            </div>
            <Badge tone={healthTone(project.health)}>{project.health}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <SummaryItem label="Budget" value={`${project.budgetHours}h`} />
            <SummaryItem label="Tracked" value={`${formatHours(project.spentHours)}h`} />
            <SummaryItem label="Rate" value={`${formatCurrency(project.rate)}/h`} />
          </div>
          <Progress
            max={project.budgetHours}
            tone={project.health === "risk" ? "red" : project.health === "watch" ? "amber" : "green"}
            value={project.spentHours}
          />
        </div>
      ))}
    </section>
  );
}

function TeamPanel() {
  return (
    <section className="rounded-md border bg-background">
      <PanelHeader
        action={<Button variant="outline"><CalendarDays />Schedule</Button>}
        description="Capacity, utilization, and approval status"
        title="Team"
      />
      <div className="grid grid-cols-4 gap-3 p-4">
        {team.map((member) => (
          <div className="rounded-md border p-3" key={member.id}>
            <p className="font-semibold text-sm">{member.name}</p>
            <p className="text-muted-foreground text-xs">{member.role}</p>
            <Progress
              max={member.capacityHours}
              tone={member.trackedHours > member.capacityHours ? "amber" : "green"}
              value={member.trackedHours}
            />
            <div className="mt-3 flex justify-between text-xs">
              <span>{formatHours(member.trackedHours)}h tracked</span>
              <span>{member.capacityHours}h cap</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportsPanel({ entries }: { entries: TimeEntry[] }) {
  const taskTotals = tasks.map((task) => ({
    ...task,
    hours: entries
      .filter((entry) => entry.taskId === task.id)
      .reduce((total, entry) => total + entry.hours, 0),
  }));
  const maxHours = Math.max(...taskTotals.map((task) => task.hours), 1);

  return (
    <section className="grid grid-cols-[1fr_20rem] gap-4">
      <div className="rounded-md border bg-background">
        <PanelHeader
          action={<Button variant="outline"><Download />CSV</Button>}
          description="Hours by task, client, billable status, and project"
          title="Reports"
        />
        <div className="space-y-4 p-4">
          {taskTotals.map((task) => (
            <div className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3" key={task.id}>
              <span className="text-sm">{task.name}</span>
              <Progress max={maxHours} tone={task.defaultBillable ? "blue" : "amber"} value={task.hours} />
              <span className="text-right font-mono text-sm">
                {formatHours(task.hours)}h
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border bg-background">
        <PanelHeader description="Saved views" title="Report library" />
        <div className="space-y-2 p-4">
          {["Uninvoiced billable time", "Project budget burn", "Team utilization", "Client profitability"].map((report) => (
            <button
              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              key={report}
              type="button"
            >
              <span>{report}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function InvoicesPanel() {
  return (
    <section className="grid grid-cols-[1fr_18rem] gap-4">
      <div className="rounded-md border bg-background">
        <PanelHeader
          action={<Button><FileText />New invoice</Button>}
          description="Create invoices from approved billable time and expenses"
          title="Invoices"
        />
        <div className="divide-y">
          {invoices.map((invoice) => (
            <div className="grid grid-cols-[8rem_1fr_8rem_8rem] items-center gap-3 p-4 text-sm" key={invoice.id}>
              <div>
                <p className="font-semibold">{invoice.id}</p>
                <p className="text-muted-foreground text-xs">{invoice.issueDate}</p>
              </div>
              <div>
                <p>{clientById(invoice.clientId)?.name}</p>
                <p className="text-muted-foreground text-xs">Due {invoice.dueDate}</p>
              </div>
              <Badge tone={invoiceTone(invoice.status)}>{invoice.status}</Badge>
              <p className="text-right font-semibold">{formatCurrency(invoice.amount)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border bg-background">
        <PanelHeader description="Receipts and reimbursements" title="Expenses" />
        <div className="divide-y">
          {expenses.map((expense) => (
            <div className="p-4 text-sm" key={expense.id}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{expense.category}</p>
                <Badge tone={expense.status === "approved" ? "green" : "amber"}>
                  {expense.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {clientById(expense.clientId)?.name} / {projectById(expense.projectId)?.name}
              </p>
              <p className="mt-1 font-semibold">{formatCurrency(expense.amount)}</p>
            </div>
          ))}
        </div>
      </div>
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
          ["Workspace", "Roles, permissions, approval rules", ShieldCheck],
          ["Billing", "Rates, tax, invoice numbering", CircleDollarSign],
          ["Notifications", "Weekly reminders and nudges", CalendarDays],
          ["Integrations", "Calendar, GitHub, Slack, accounting", Laptop],
          ["Import", "CSV imports from other time systems", Download],
          ["Security", "Audit log and session controls", Settings],
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

function EntryTable({ entries }: { entries: TimeEntry[] }) {
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[6rem_1fr_9rem_7rem_6rem_7rem] gap-3 border-b bg-muted/50 px-4 py-2 text-muted-foreground text-xs">
        <span>Date</span>
        <span>Work</span>
        <span>Person</span>
        <span>Task</span>
        <span>Hours</span>
        <span>Status</span>
      </div>
      <div className="divide-y">
        {entries.map((entry) => (
          <div
            className="grid grid-cols-[6rem_1fr_9rem_7rem_6rem_7rem] items-center gap-3 px-4 py-3 text-sm"
            key={entry.id}
          >
            <span className="font-mono text-xs">{entry.date.slice(5)}</span>
            <div>
              <p className="font-medium">{projectById(entry.projectId)?.name}</p>
              <p className="text-muted-foreground text-xs">
                {clientById(entry.clientId)?.name} / {entry.notes}
              </p>
            </div>
            <span>{memberById(entry.personId)?.name}</span>
            <span>{taskById(entry.taskId)?.name}</span>
            <span className="font-mono">{formatHours(entry.hours)}</span>
            <Badge tone={statusTone(entry.status)}>{entry.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 font-semibold text-2xl">{value}</p>
      <p className="text-muted-foreground text-xs">{detail}</p>
    </div>
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

function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
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
      className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "amber" | "blue" | "green" | "neutral" | "red";
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-sm border px-2 py-0.5 font-medium text-xs capitalize",
        tone === "amber" && "border-amber-300 bg-amber-50 text-amber-700",
        tone === "blue" && "border-sky-300 bg-sky-50 text-sky-700",
        tone === "green" && "border-emerald-300 bg-emerald-50 text-emerald-700",
        tone === "red" && "border-rose-300 bg-rose-50 text-rose-700",
        tone === "neutral" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

function Progress({
  max,
  tone,
  value,
}: {
  max: number;
  tone: "amber" | "blue" | "green" | "red";
  value: number;
}) {
  const percentage = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-sm bg-muted">
      <div
        className={cn(
          "h-full rounded-sm",
          tone === "amber" && "bg-amber-500",
          tone === "blue" && "bg-sky-500",
          tone === "green" && "bg-emerald-600",
          tone === "red" && "bg-rose-600"
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
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

function memberById(id: string) {
  return team.find((member) => member.id === id);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
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
    dashboard: "Dashboard",
    invoices: "Invoices and expenses",
    projects: "Projects and clients",
    reports: "Reports",
    settings: "Settings",
    team: "Team management",
    time: "Time tracking",
  }[tab];
}

function statusTone(status: EntryStatus) {
  return {
    approved: "green",
    draft: "neutral",
    running: "blue",
    submitted: "amber",
  }[status] as "amber" | "blue" | "green" | "neutral";
}

function healthTone(status: ProjectHealth) {
  return {
    healthy: "green",
    risk: "red",
    watch: "amber",
  }[status] as "amber" | "green" | "red";
}

function invoiceTone(status: InvoiceStatus) {
  return {
    draft: "neutral",
    overdue: "red",
    paid: "green",
    sent: "blue",
  }[status] as "blue" | "green" | "neutral" | "red";
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
