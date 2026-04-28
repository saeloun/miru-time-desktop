import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  Filter,
  Gauge,
  Laptop,
  LayoutDashboard,
  Pause,
  Play,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  SquarePen,
  TimerReset,
  Users,
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
  running: boolean;
}

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
  running: false,
};

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

  function syncDesktopTimer(state: MiruTimerState) {
    setTimer((current) => ({
      ...current,
      elapsedSeconds: state.elapsedSeconds,
      running: state.running,
    }));
  }

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

  function addManualEntry() {
    const project = projectById(timer.projectId) ?? projects[0];
    setEntries((current) => [
      {
        id: `entry-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        personId: "vipul",
        clientId: project.clientId,
        projectId: project.id,
        taskId: timer.taskId,
        notes: timer.notes || "Manual time entry",
        hours: 1,
        billable: timer.billable,
        status: "draft",
      },
      ...current,
    ]);
  }

  function approveSubmittedEntries() {
    setEntries((current) =>
      current.map((entry) =>
        entry.status === "submitted" ? { ...entry, status: "approved" } : entry
      )
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[14rem_1fr] overflow-hidden rounded-md border bg-background text-foreground">
      <aside className="flex min-h-0 flex-col border-r bg-sidebar">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <TimerReset className="size-4" />
            </div>
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
                      <Button onClick={toggleTimer} size="lg">
                        {timer.running ? <Pause /> : <Play />}
                        {timer.running ? "Pause" : "Start"}
                      </Button>
                      <Button
                        disabled={timer.elapsedSeconds < 60}
                        onClick={saveTimerEntry}
                        size="lg"
                        variant="outline"
                      >
                        <Check />
                        Save
                      </Button>
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
            {activeTab === "time" && <TimePanel entries={filteredEntries} />}
            {activeTab === "projects" && <ProjectsPanel />}
            {activeTab === "team" && <TeamPanel />}
            {activeTab === "reports" && <ReportsPanel entries={filteredEntries} />}
            {activeTab === "invoices" && <InvoicesPanel />}
            {activeTab === "settings" && <SettingsPanel />}
          </div>
        </main>
      </section>
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

function TimePanel({ entries }: { entries: TimeEntry[] }) {
  const weekDays = ["2026-04-23", "2026-04-24", "2026-04-25", "2026-04-26", "2026-04-27"];
  const totalWeekHours = entries.reduce((total, entry) => total + entry.hours, 0);
  const unsubmittedHours = entries
    .filter((entry) => entry.status === "draft")
    .reduce((total, entry) => total + entry.hours, 0);

  return (
    <section className="grid gap-4">
      <div className="rounded-md border bg-background">
        <PanelHeader
          action={<Button variant="outline"><SquarePen />Edit week</Button>}
          description={
            <div className="mt-2 inline-flex rounded-md border bg-muted/40 p-0.5">
              {["Day", "Week", "Month"].map((view) => (
                <button
                  className={cn(
                    "h-7 rounded-sm px-3 font-medium text-xs",
                    view === "Week"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  key={view}
                  type="button"
                >
                  {view}
                </button>
              ))}
            </div>
          }
          title="Timesheet"
        />
        <div className="grid grid-cols-[1fr_12rem_12rem] gap-3 border-b p-4">
          <div>
            <p className="font-medium text-sm">This week</p>
            <p className="text-muted-foreground text-xs">
              Add time by project, review daily totals, then submit.
            </p>
          </div>
          <SummaryItem label="Tracked" value={`${formatHours(totalWeekHours)}h`} />
          <SummaryItem label="Unsubmitted" value={`${formatHours(unsubmittedHours)}h`} />
        </div>
        <div className="grid grid-cols-5 border-b">
          {weekDays.map((day) => {
            const dayHours = entries
              .filter((entry) => entry.date === day)
              .reduce((total, entry) => total + entry.hours, 0);

            return (
              <div className="border-r p-3 last:border-r-0" key={day}>
                <p className="font-medium text-sm">{weekdayLabel(day)}</p>
                <p className="font-mono text-muted-foreground text-xs tabular-nums">
                  {formatHours(dayHours)}h logged
                </p>
              </div>
            );
          })}
        </div>
        <EntryTable entries={entries} />
      </div>
    </section>
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

function SettingsPanel() {
  return (
    <section className="grid grid-cols-3 gap-4">
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
    </section>
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

function formatHours(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function roundToQuarter(value: number) {
  return Math.max(0.25, Math.round(value * 4) / 4);
}

function weekdayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
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
