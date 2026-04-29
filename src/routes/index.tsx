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
import { DEFAULT_MIRU_BASE_URL, showMiruBaseUrlField } from "@/constants";
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
  timers: TimerSlotState[];
}

interface TimerSlotState {
  context: MiruTimerState["context"];
  elapsedSeconds: number;
  formatted: string;
  id: string;
  updatedAt: string;
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

type EntriesViewMode = "day" | "history" | "week";

type AuthMode = "login" | "signup";

interface AuthForm {
  baseUrl: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

type I18nKey =
  | "account.menu"
  | "account.settings"
  | "account.logout"
  | "account.quit"
  | "app.subtitle"
  | "app.title"
  | "auth.connect"
  | "auth.createAccount"
  | "auth.email"
  | "auth.firstName"
  | "auth.google"
  | "auth.lastName"
  | "auth.login"
  | "auth.miruUrl"
  | "auth.password"
  | "auth.signup"
  | "entries.add"
  | "entries.day"
  | "entries.empty"
  | "entries.emptyHint"
  | "entries.edit"
  | "entries.history"
  | "entries.historyTitle"
  | "entries.live"
  | "entries.new"
  | "entries.save"
  | "entries.title"
  | "entries.week"
  | "field.date"
  | "field.notes"
  | "field.project"
  | "field.task"
  | "field.time"
  | "idle.aria"
  | "idle.keep"
  | "idle.restart"
  | "idle.title"
  | "idle.trim"
  | "settings.idlePrompt"
  | "settings.language"
  | "summary.entries"
  | "summary.thisWeek"
  | "summary.today"
  | "sync.offline"
  | "sync.pull"
  | "sync.pullHint"
  | "sync.push"
  | "sync.pushHint"
  | "sync.status.error"
  | "sync.status.local"
  | "sync.status.offline"
  | "sync.status.synced"
  | "sync.status.syncing"
  | "sync.workspace"
  | "task.timeEntry"
  | "timer.pause"
  | "timer.ready"
  | "timer.reset"
  | "timer.resume"
  | "timer.running"
  | "timer.start"
  | "timer.startNew"
  | "timer.stopSave"
  | "timer.timerStack"
  | "timer.idle"
  | "work.details";

type Translator = (
  key: I18nKey,
  values?: Record<string, number | string>
) => string;

const APP_TRANSLATIONS: Record<string, Partial<Record<I18nKey, string>>> = {
  "en-US": {
    "account.logout": "Log out",
    "account.menu": "Account menu",
    "account.quit": "Quit Miru Time Tracking",
    "account.settings": "Settings",
    "app.subtitle": "Employee tracker",
    "app.title": "Miru Time Tracking",
    "auth.connect": "Connect to your workspace before tracking time.",
    "auth.createAccount": "Create account",
    "auth.email": "Email",
    "auth.firstName": "First name",
    "auth.google": "Open Google sign-in",
    "auth.lastName": "Last name",
    "auth.login": "Log in",
    "auth.miruUrl": "Miru URL",
    "auth.password": "Password",
    "auth.signup": "Sign up",
    "entries.add": "Entry",
    "entries.day": "Day",
    "entries.empty": "No time entries yet",
    "entries.emptyHint": "Start the timer or add an entry for this day.",
    "entries.edit": "Edit entry",
    "entries.history": "History",
    "entries.historyTitle": "{count} entries · {hours}h total",
    "entries.live": "Live timesheet",
    "entries.new": "New entry",
    "entries.save": "Save",
    "entries.title": "{count} entries · {hours}h tracked",
    "entries.week": "Week",
    "field.date": "Date",
    "field.notes": "Notes",
    "field.project": "Project",
    "field.task": "Task",
    "field.time": "Time",
    "idle.aria": "Idle timer actions",
    "idle.keep": "Keep idle time",
    "idle.restart": "Trim idle and restart",
    "idle.title": "Idle",
    "idle.trim": "Trim idle and continue",
    "settings.idlePrompt": "Idle prompt",
    "settings.language": "Language",
    "summary.entries": "Entries",
    "summary.thisWeek": "This week",
    "summary.today": "Today",
    "sync.offline": "Offline",
    "sync.pull": "Pull timer from Miru",
    "sync.pullHint": "Use the current web timer in this desktop tracker.",
    "sync.push": "Push timer to Miru",
    "sync.pushHint": "Send this desktop timer state to Miru web.",
    "sync.status.error": "Error",
    "sync.status.local": "Local",
    "sync.status.offline": "Offline",
    "sync.status.synced": "Synced",
    "sync.status.syncing": "Syncing",
    "sync.workspace": "Workspace",
    "task.timeEntry": "Time entry",
    "timer.idle": "Idle",
    "timer.pause": "Pause",
    "timer.ready": "Ready",
    "timer.reset": "Reset timer",
    "timer.resume": "Resume",
    "timer.running": "Tracking now",
    "timer.start": "Start",
    "timer.startNew": "Start new timer",
    "timer.stopSave": "Stop and save",
    "timer.timerStack": "Paused timers",
    "work.details": "Work details",
  },
  "en-GB": {},
  ar: {
    "account.logout": "تسجيل الخروج",
    "account.settings": "الإعدادات",
    "app.subtitle": "متتبع الموظف",
    "auth.login": "تسجيل الدخول",
    "auth.signup": "إنشاء حساب",
    "field.notes": "ملاحظات",
    "field.project": "المشروع",
    "field.task": "المهمة",
    "idle.title": "خمول",
    "settings.language": "اللغة",
    "summary.entries": "الإدخالات",
    "summary.thisWeek": "هذا الأسبوع",
    "summary.today": "اليوم",
    "sync.workspace": "مساحة العمل",
    "task.timeEntry": "إدخال وقت",
    "timer.pause": "إيقاف مؤقت",
    "timer.ready": "جاهز",
    "timer.running": "جار التتبع",
    "timer.start": "بدء",
  },
  de: {
    "account.logout": "Abmelden",
    "account.settings": "Einstellungen",
    "app.subtitle": "Zeiterfassung",
    "auth.login": "Anmelden",
    "auth.signup": "Registrieren",
    "field.notes": "Notizen",
    "field.project": "Projekt",
    "field.task": "Aufgabe",
    "idle.title": "Inaktiv",
    "settings.language": "Sprache",
    "summary.entries": "Einträge",
    "summary.thisWeek": "Diese Woche",
    "summary.today": "Heute",
    "sync.workspace": "Arbeitsbereich",
    "task.timeEntry": "Zeiteintrag",
    "timer.pause": "Pause",
    "timer.ready": "Bereit",
    "timer.running": "Läuft",
    "timer.start": "Start",
  },
  es: {
    "account.logout": "Cerrar sesión",
    "account.settings": "Ajustes",
    "app.subtitle": "Registro de tiempo",
    "auth.login": "Iniciar sesión",
    "auth.signup": "Registrarse",
    "field.notes": "Notas",
    "field.project": "Proyecto",
    "field.task": "Tarea",
    "idle.title": "Inactivo",
    "settings.language": "Idioma",
    "summary.entries": "Entradas",
    "summary.thisWeek": "Esta semana",
    "summary.today": "Hoy",
    "sync.workspace": "Espacio",
    "task.timeEntry": "Entrada de tiempo",
    "timer.pause": "Pausar",
    "timer.ready": "Listo",
    "timer.running": "Registrando",
    "timer.start": "Iniciar",
  },
  fr: {
    "account.logout": "Déconnexion",
    "account.settings": "Réglages",
    "app.subtitle": "Suivi du temps",
    "auth.login": "Connexion",
    "auth.signup": "Créer un compte",
    "field.notes": "Notes",
    "field.project": "Projet",
    "field.task": "Tâche",
    "idle.title": "Inactif",
    "settings.language": "Langue",
    "summary.entries": "Entrées",
    "summary.thisWeek": "Cette semaine",
    "summary.today": "Aujourd'hui",
    "sync.workspace": "Espace",
    "task.timeEntry": "Saisie de temps",
    "timer.pause": "Pause",
    "timer.ready": "Prêt",
    "timer.running": "En cours",
    "timer.start": "Démarrer",
  },
  hi: {
    "account.logout": "लॉग आउट",
    "account.settings": "सेटिंग्स",
    "app.subtitle": "समय ट्रैकर",
    "auth.login": "लॉग इन",
    "auth.signup": "साइन अप",
    "field.notes": "नोट्स",
    "field.project": "प्रोजेक्ट",
    "field.task": "कार्य",
    "idle.title": "निष्क्रिय",
    "settings.language": "भाषा",
    "summary.entries": "एंट्री",
    "summary.thisWeek": "इस सप्ताह",
    "summary.today": "आज",
    "sync.workspace": "वर्कस्पेस",
    "task.timeEntry": "समय एंट्री",
    "timer.pause": "रोकें",
    "timer.ready": "तैयार",
    "timer.running": "ट्रैकिंग",
    "timer.start": "शुरू",
  },
  mr: {},
  bn: {},
  gu: {},
  kn: {},
  ml: {},
  pa: {},
  ta: {},
  te: {},
  ur: {},
  it: {},
  nl: {},
  id: {},
  tr: {},
  ja: {
    "account.logout": "ログアウト",
    "account.settings": "設定",
    "app.subtitle": "タイムトラッカー",
    "auth.login": "ログイン",
    "auth.signup": "登録",
    "field.notes": "メモ",
    "field.project": "プロジェクト",
    "field.task": "タスク",
    "idle.title": "離席",
    "settings.language": "言語",
    "summary.entries": "入力",
    "summary.thisWeek": "今週",
    "summary.today": "今日",
    "sync.workspace": "ワークスペース",
    "task.timeEntry": "時間入力",
    "timer.pause": "一時停止",
    "timer.ready": "準備完了",
    "timer.running": "記録中",
    "timer.start": "開始",
  },
  "pt-BR": {
    "account.logout": "Sair",
    "account.settings": "Configurações",
    "app.subtitle": "Controle de tempo",
    "auth.login": "Entrar",
    "auth.signup": "Cadastrar",
    "field.notes": "Notas",
    "field.project": "Projeto",
    "field.task": "Tarefa",
    "idle.title": "Inativo",
    "settings.language": "Idioma",
    "summary.entries": "Registros",
    "summary.thisWeek": "Esta semana",
    "summary.today": "Hoje",
    "sync.workspace": "Área",
    "task.timeEntry": "Registro de tempo",
    "timer.pause": "Pausar",
    "timer.ready": "Pronto",
    "timer.running": "Registrando",
    "timer.start": "Iniciar",
  },
  "zh-CN": {
    "account.logout": "退出登录",
    "account.settings": "设置",
    "app.subtitle": "时间追踪",
    "auth.login": "登录",
    "auth.signup": "注册",
    "field.notes": "备注",
    "field.project": "项目",
    "field.task": "任务",
    "idle.title": "空闲",
    "settings.language": "语言",
    "summary.entries": "记录",
    "summary.thisWeek": "本周",
    "summary.today": "今天",
    "sync.workspace": "工作区",
    "task.timeEntry": "时间记录",
    "timer.pause": "暂停",
    "timer.ready": "就绪",
    "timer.running": "记录中",
    "timer.start": "开始",
  },
  ko: {},
};

const DEFAULT_LOCALE = "en-US";
const SUPPORTED_LOCALES = [
  "en-GB",
  "en-US",
  "hi",
  "mr",
  "bn",
  "gu",
  "kn",
  "ml",
  "pa",
  "ta",
  "te",
  "ur",
  "es",
  "fr",
  "de",
  "it",
  "nl",
  "id",
  "pt-BR",
  "tr",
  "ar",
  "ja",
  "ko",
  "zh-CN",
] as const;

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const COMPLETE_APP_TRANSLATIONS = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [
    locale,
    {
      ...APP_TRANSLATIONS[DEFAULT_LOCALE],
      ...(APP_TRANSLATIONS[locale] ?? {}),
    },
  ])
) as Record<SupportedLocale, Record<I18nKey, string>>;

const miruLogoUrl = new URL("../assets/miru-time-icon.svg", import.meta.url)
  .href;

const tasks: Task[] = [{ id: "time", name: "Time entry" }];

const todayIso = new Date().toISOString().slice(0, 10);
const INITIALS_SPLIT_PATTERN = /\s+/;
const ABSOLUTE_ASSET_PATTERN = /^(?:https?:|data:|blob:)/i;
const RTL_LOCALES = new Set(["ar", "ur"]);

const initialTimer: TimerState = {
  billable: false,
  elapsedSeconds: 0,
  idle: null,
  idleThresholdSeconds: 300,
  notes: "",
  projectId: "",
  running: false,
  taskId: "time",
  timers: [],
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
  const [entriesViewMode, setEntriesViewMode] =
    useState<EntriesViewMode>("day");
  const [entryDialog, setEntryDialog] = useState<EntryDialogState | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft>(() =>
    newEntryDraft(todayIso)
  );
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthForm>({
    baseUrl: DEFAULT_MIRU_BASE_URL,
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
      const nextProjectId = state.context.projectId || current.projectId;
      const nextTaskId = state.context.taskId || current.taskId;
      const nextTimers = state.timers ?? [];

      if (
        current.elapsedSeconds === state.elapsedSeconds &&
        current.running === state.running &&
        current.idleThresholdSeconds === state.idleThresholdSeconds &&
        current.notes === state.context.notes &&
        current.projectId === nextProjectId &&
        current.taskId === nextTaskId &&
        current.timers.length === nextTimers.length &&
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
        notes: state.context.notes,
        projectId: nextProjectId,
        running: state.running,
        taskId: nextTaskId,
        timers: nextTimers,
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
      .setContext(buildDesktopTimerContext(project, task, clients, timer.notes))
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
  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (entry, nextEntry) =>
          nextEntry.date.localeCompare(entry.date) ||
          nextEntry.id.localeCompare(entry.id)
      ),
    [entries]
  );
  const weekRange = useMemo(() => getWeekRange(todayIso), []);
  const weekEntries = useMemo(
    () =>
      sortedEntries.filter(
        (entry) => entry.date >= weekRange.start && entry.date <= weekRange.end
      ),
    [sortedEntries, weekRange.end, weekRange.start]
  );
  const selectedDayHours = useMemo(
    () => selectedEntries.reduce((total, entry) => total + entry.hours, 0),
    [selectedEntries]
  );
  const totalTrackedHours = useMemo(
    () => entries.reduce((total, entry) => total + entry.hours, 0),
    [entries]
  );
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
  const accountAvatarUrl = getAccountAvatarUrl(
    miruSession?.user,
    miruSession?.baseUrl
  );
  const appLocale = useMemo(
    () => getAppLocale(miruSession?.user),
    [miruSession?.user]
  );
  const t = useMemo(() => createTranslator(appLocale), [appLocale]);
  const textDirection = RTL_LOCALES.has(appLocale) ? "rtl" : "ltr";

  useEffect(() => {
    window.localStorage.setItem("miru-time-locale", appLocale);
  }, [appLocale]);

  const timerPanelClass = getTimerPanelClass(timer);
  const timerDotClass = getTimerDotClass(timer);
  const timerStatusLabel = getTimerStatusLabel(timer, t);

  useEffect(() => {
    window.miruTimer
      .setSummary({
        entryCount: timeSummary.entryCount,
        selectedDateLabel: dayTitle(selectedDate, appLocale, t),
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
    appLocale,
    miruSession?.syncStatus,
    selectedDate,
    t,
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

  function startNewTimer() {
    window.miruTimer
      .setContext(
        buildDesktopTimerContext(
          selectedProject,
          selectedTask,
          clients,
          timer.notes
        )
      )
      .then(() => window.miruTimer.startNew())
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to start new desktop timer", error);
      });
  }

  function resumeTimerSlot(timerId: string) {
    window.miruTimer
      .resumeSlot(timerId)
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to resume desktop timer", error);
      });
  }

  function deleteTimerSlot(timerId: string) {
    window.miruTimer
      .deleteSlot(timerId)
      .then(syncDesktopTimer)
      .catch((error) => {
        console.error("Failed to remove desktop timer", error);
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
      await window.miruApi.updateTimerEntry({
        duration: Math.max(1, Math.round(hours * 60)),
        entryId: entryDialog.entryId,
        note: entryDraft.notes || "Time entry",
        projectId: project.id,
        workDate: entryDraft.date,
      });
      await loadTimeTracking();
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
        .setContext(
          buildDesktopTimerContext(
            project,
            taskById(entryDraft.taskId) ?? tasks[0],
            clients,
            entryDraft.notes
          )
        )
        .then(() => window.miruTimer.startNew())
        .then(syncDesktopTimer)
        .catch((error) => {
          console.error("Failed to start desktop timer", error);
        });
    }
  }

  async function deleteEntry(entry: TimeEntry) {
    const confirmed = await window.nativeDialog.confirmDeleteTimeEntry();

    if (confirmed) {
      try {
        await window.miruApi.deleteTimerEntry(entry.id);
        await loadTimeTracking();
        setSyncMessage("Entry deleted.");
      } catch (error) {
        setSyncMessage(
          error instanceof Error ? error.message : "Entry delete failed."
        );
      }
    }
  }

  function resumeEntry(entry: TimeEntry) {
    const entryProject = projectById(entry.projectId, projects);
    const entryTask = taskById(entry.taskId) ?? tasks[0];

    setTimer((current) => ({
      ...current,
      billable: false,
      notes: entry.notes,
      projectId: entry.projectId,
      taskId: entry.taskId,
    }));
    setSelectedDate(entry.date);
    window.miruTimer
      .setContext(
        buildDesktopTimerContext(entryProject, entryTask, clients, entry.notes)
      )
      .then(() => window.miruTimer.startNew())
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
      if (authMode === "signup" && !session.signedIn) {
        setAuthMode("login");
        setSyncMessage(
          session.syncError ||
            "Account created. Confirm your email, then log in."
        );
        return;
      }

      setSyncMessage(session.signedIn ? "Connected." : session.syncError);
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
      "Google sign-in opened in your browser. Use email login here after Miru web signs you in."
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

  function showTodayEntries() {
    setSelectedDate(todayIso);
    setEntriesViewMode("day");
  }

  function showWeekEntries() {
    setEntriesViewMode("week");
  }

  function showAllEntries() {
    setEntriesViewMode("history");
  }

  return (
    <div
      className="relative isolate flex h-screen flex-col overflow-hidden rounded-xl border bg-[#f7f8fb]/95 text-foreground shadow-2xl backdrop-blur-xl"
      dir={textDirection}
    >
      <header className="draglayer relative z-20 grid h-14 shrink-0 grid-cols-[1fr_auto] items-center gap-2 border-b bg-white/95 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <img
            alt=""
            className="motion-fade-up size-7 shrink-0 rounded-md shadow-sm"
            height={28}
            src={miruLogoUrl}
            width={28}
          />
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-sm">{t("app.title")}</h1>
            <p className="font-medium text-foreground/65 text-xs">
              {t("app.subtitle")}
            </p>
          </div>
        </div>
        {/* Signed-out users stay in onboarding; the header menu is only account actions. */}
        {miruSession?.signedIn && (
          <button
            aria-label="Account menu"
            className={cn(
              "no-drag interactive-lift icon-motion flex size-9 items-center justify-center overflow-hidden rounded-full border text-foreground/70 transition",
              showSync
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-transparent hover:border-border hover:bg-muted hover:text-foreground"
            )}
            onClick={() => setShowSync((visible) => !visible)}
            title={t("account.menu")}
            type="button"
          >
            <AccountAvatar
              avatarUrl={accountAvatarUrl}
              email={accountEmail}
              name={accountLabel}
              size="sm"
            />
          </button>
        )}
      </header>

      {miruSession?.signedIn ? (
        <>
          <TimerHeroPanel
            onDeleteTimerSlot={deleteTimerSlot}
            onResetTimer={resetTimer}
            onResumeTimerSlot={resumeTimerSlot}
            onSaveTimerEntry={saveTimerEntry}
            onStartNewTimer={startNewTimer}
            onToggleTimer={toggleTimer}
            selectedClient={selectedClient}
            selectedProject={selectedProject}
            selectedTask={selectedTask}
            t={t}
            timer={timer}
            timerDotClass={timerDotClass}
            timerPanelClass={timerPanelClass}
            timerStatusLabel={timerStatusLabel}
          />

          <main className="relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            <TimeSummaryStrip
              onShowAll={showAllEntries}
              onShowToday={showTodayEntries}
              onShowWeek={showWeekEntries}
              summary={timeSummary}
              t={t}
              viewMode={entriesViewMode}
            />

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
              t={t}
              timer={timer}
            />

            {timer.idle && (
              <IdlePrompt
                durationMs={timer.idle.durationMs}
                onAction={applyIdleAction}
                t={t}
              />
            )}

            <EntriesPanel
              allEntries={sortedEntries}
              clients={clients}
              entries={selectedEntries}
              locale={appLocale}
              onDateChange={setSelectedDate}
              onDelete={deleteEntry}
              onEdit={openEditEntry}
              onNewEntry={openNewEntry}
              onResume={resumeEntry}
              onViewModeChange={setEntriesViewMode}
              projects={projects}
              selectedDate={selectedDate}
              selectedDayHours={selectedDayHours}
              t={t}
              totalTrackedHours={totalTrackedHours}
              viewMode={entriesViewMode}
              weekEntries={weekEntries}
              weekHours={weekSavedHours}
              weekRangeLabel={timeSummary.weekRangeLabel}
            />
          </main>

          <AccountMenuOverlay
            appLocale={appLocale}
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
            t={t}
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
              t={t}
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
          t={t}
        />
      )}
    </div>
  );
}

function TimerHeroPanel({
  onDeleteTimerSlot,
  onResetTimer,
  onResumeTimerSlot,
  onSaveTimerEntry,
  onStartNewTimer,
  onToggleTimer,
  selectedClient,
  selectedProject,
  selectedTask,
  timer,
  timerDotClass,
  timerPanelClass,
  timerStatusLabel,
  t,
}: {
  onDeleteTimerSlot: (timerId: string) => void;
  onResetTimer: () => void;
  onResumeTimerSlot: (timerId: string) => void;
  onSaveTimerEntry: () => void;
  onStartNewTimer: () => void;
  onToggleTimer: () => void;
  selectedClient: Client | null;
  selectedProject: Project | undefined;
  selectedTask: Task;
  timer: TimerState;
  timerDotClass: string;
  timerPanelClass: string;
  timerStatusLabel: string;
  t: Translator;
}) {
  const canSave = timer.elapsedSeconds >= 60 && Boolean(selectedProject);
  const isRunning = timer.running;
  const canStartNew = timer.elapsedSeconds > 0 || timer.running;

  return (
    <section
      className={cn(
        "motion-fade-up border-b px-4 py-3 transition-colors",
        timerPanelClass
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              "mb-1 flex items-center gap-2 font-medium text-xs",
              isRunning ? "text-white/75" : "text-foreground/70"
            )}
          >
            <span className={cn("size-2.5 rounded-full", timerDotClass)} />
            <span>{timerStatusLabel}</span>
          </div>
          <p
            className={cn(
              "font-mono font-semibold text-4xl tabular-nums tracking-normal",
              isRunning ? "text-white" : "text-foreground"
            )}
          >
            {formatDuration(timer.elapsedSeconds)}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate font-medium text-xs",
              isRunning ? "text-white/70" : "text-foreground/65"
            )}
          >
            {selectedClient?.name ?? "Choose a project"} /{" "}
            {selectedProject?.name ?? "No project"} /{" "}
            {getTaskDisplayName(selectedTask, t)}
          </p>
        </div>

        <div className="grid w-[5.5rem] shrink-0 grid-cols-2 gap-2">
          <button
            aria-label={t("timer.stopSave")}
            className={cn(
              "interactive-lift icon-motion grid size-10 place-items-center rounded-lg border transition",
              isRunning
                ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                : "border-border bg-white text-foreground hover:bg-muted",
              !canSave && "opacity-45"
            )}
            disabled={!canSave}
            onClick={onSaveTimerEntry}
            title={t("timer.stopSave")}
            type="button"
          >
            <Square className="size-4" />
          </button>
          <button
            aria-label={timer.running ? t("timer.pause") : t("timer.start")}
            className={cn(
              "interactive-lift icon-motion grid size-10 place-items-center rounded-full shadow-lg transition",
              timer.running
                ? "bg-white text-[#261257] hover:bg-white/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            onClick={onToggleTimer}
            title={timer.running ? t("timer.pause") : t("timer.start")}
            type="button"
          >
            {timer.running ? (
              <Pause className="size-4" />
            ) : (
              <Play className="ml-0.5 size-4" />
            )}
          </button>
          <button
            aria-label={t("timer.reset")}
            className={cn(
              "interactive-lift icon-motion grid size-10 place-items-center rounded-lg border transition",
              isRunning
                ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                : "border-border bg-white text-foreground hover:bg-muted"
            )}
            onClick={onResetTimer}
            title={t("timer.reset")}
            type="button"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            aria-label={t("timer.startNew")}
            className={cn(
              "interactive-lift icon-motion grid size-10 place-items-center rounded-lg border transition",
              isRunning
                ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                : "border-border bg-white text-foreground hover:bg-muted",
              !canStartNew && "opacity-45"
            )}
            disabled={!canStartNew}
            onClick={onStartNewTimer}
            title={t("timer.startNew")}
            type="button"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {timer.timers.length > 0 && (
        <section
          aria-label={t("timer.timerStack")}
          className={cn(
            "mt-3 grid gap-1.5 rounded-lg border p-2",
            isRunning
              ? "border-white/15 bg-white/10"
              : "border-border bg-white/70"
          )}
        >
          {timer.timers.slice(0, 3).map((slot) => (
            <div
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
              key={slot.id}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate font-semibold text-xs",
                    isRunning ? "text-white" : "text-foreground"
                  )}
                >
                  {slot.context.projectName}
                </p>
                <p
                  className={cn(
                    "truncate font-mono text-[11px] tabular-nums",
                    isRunning ? "text-white/65" : "text-foreground/55"
                  )}
                >
                  {formatDuration(slot.elapsedSeconds)} ·{" "}
                  {slot.context.notes || slot.context.taskName}
                </p>
              </div>
              <button
                aria-label={`${t("timer.resume")} ${slot.context.projectName}`}
                className={cn(
                  "interactive-lift icon-motion grid size-8 place-items-center rounded-md border transition",
                  isRunning
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-border bg-background text-foreground"
                )}
                onClick={() => onResumeTimerSlot(slot.id)}
                title={t("timer.resume")}
                type="button"
              >
                <Play className="size-3.5" />
              </button>
              <button
                aria-label={`Remove ${slot.context.projectName}`}
                className={cn(
                  "interactive-lift icon-motion grid size-8 place-items-center rounded-md border transition",
                  isRunning
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-border bg-background text-foreground"
                )}
                onClick={() => onDeleteTimerSlot(slot.id)}
                title="Remove"
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </section>
      )}
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
  t,
  timer,
}: {
  clients: Client[];
  onNotesChange: (notes: string) => void;
  onProjectChange: (projectId: string) => void;
  projects: Project[];
  selectedClient: Client | null;
  selectedProject: Project | undefined;
  selectedTask: Task;
  t: Translator;
  timer: TimerState;
}) {
  return (
    <section className="rounded-lg border bg-background p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FolderKanban className="size-4" />
        </span>
        <div>
          <p className="font-semibold text-sm">{t("work.details")}</p>
          <p className="font-medium text-foreground/60 text-xs">
            {selectedClient?.name ?? "Select client"} /{" "}
            {selectedProject?.name ?? "Select project"}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <FieldLabel icon={<FolderKanban />} label={t("field.project")}>
          <Select onChange={onProjectChange} value={timer.projectId}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {clientById(project.clientId, clients)?.name ?? "Miru"} /{" "}
                {project.name}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel icon={<ListChecks />} label={t("field.task")}>
          <Select onChange={() => undefined} value={selectedTask.id}>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {getTaskDisplayName(task, t)}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel icon={<FileText />} label={t("field.notes")}>
          <textarea
            className="min-h-18 resize-none rounded-md border bg-background px-3 py-2 font-medium text-foreground text-sm outline-none placeholder:text-foreground/50 focus:ring-2 focus:ring-primary/30"
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
  allEntries,
  clients,
  entries,
  onDateChange,
  onDelete,
  onEdit,
  onNewEntry,
  onResume,
  onViewModeChange,
  locale,
  projects,
  selectedDate,
  selectedDayHours,
  t,
  totalTrackedHours,
  viewMode,
  weekEntries,
  weekHours,
  weekRangeLabel,
}: {
  allEntries: TimeEntry[];
  clients: Client[];
  entries: TimeEntry[];
  onDateChange: (date: string) => void;
  onDelete: (entry: TimeEntry) => void;
  onEdit: (entry: TimeEntry) => void;
  onNewEntry: (date: string) => void;
  onResume: (entry: TimeEntry) => void;
  onViewModeChange: (mode: EntriesViewMode) => void;
  locale: string;
  projects: Project[];
  selectedDate: string;
  selectedDayHours: number;
  t: Translator;
  totalTrackedHours: number;
  viewMode: EntriesViewMode;
  weekEntries: TimeEntry[];
  weekHours: number;
  weekRangeLabel: string;
}) {
  const visibleEntries = getVisibleEntriesForMode(
    viewMode,
    entries,
    weekEntries,
    allEntries
  );
  const visibleHours = getVisibleHoursForMode(
    viewMode,
    selectedDayHours,
    weekHours,
    totalTrackedHours
  );
  const visibleTitle =
    viewMode === "day"
      ? t("entries.title", {
          count: visibleEntries.length,
          hours: formatHours(visibleHours),
        })
      : t("entries.historyTitle", {
          count: visibleEntries.length,
          hours: formatHours(visibleHours),
        });

  return (
    <section className="mt-3 min-h-0 overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="grid gap-2 border-b p-3">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm">
              {getEntriesPanelTitle(
                viewMode,
                selectedDate,
                weekRangeLabel,
                locale,
                t
              )}
            </p>
            <p className="font-medium text-foreground/60 text-xs">
              {visibleTitle}
            </p>
          </div>
          <Button
            className="interactive-lift"
            onClick={() => onNewEntry(selectedDate)}
            type="button"
          >
            <CalendarPlus />
            {t("entries.add")}
          </Button>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted/40 p-1">
            {(["day", "week", "history"] as const).map((mode) => (
              <button
                className={cn(
                  "h-8 rounded-sm px-3 font-medium text-xs transition",
                  viewMode === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                )}
                key={mode}
                onClick={() => onViewModeChange(mode)}
                type="button"
              >
                {getEntriesViewModeLabel(mode, t)}
              </button>
            ))}
          </div>
          <input
            className="h-9 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(event) => {
              onDateChange(event.target.value);
              onViewModeChange("day");
            }}
            type="date"
            value={selectedDate}
          />
        </div>
      </div>

      {visibleEntries.length > 0 ? (
        <div className="max-h-[18rem] divide-y overflow-y-auto">
          {visibleEntries.map((entry) => (
            <TimeEntryRow
              clients={clients}
              entry={entry}
              key={entry.id}
              locale={locale}
              onDelete={onDelete}
              onEdit={onEdit}
              onResume={onResume}
              projects={projects}
              showDate={viewMode !== "day"}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center p-6 text-center">
          <div>
            <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Timer className="size-5" />
            </div>
            <p className="mt-3 font-semibold text-sm">{t("entries.empty")}</p>
            <p className="mt-1 font-medium text-foreground/60 text-xs">
              {t("entries.emptyHint")}
            </p>
            <Button
              className="interactive-lift mt-4"
              onClick={() => onNewEntry(selectedDate)}
              type="button"
              variant="outline"
            >
              <Plus />
              {t("entries.add")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function getEntriesPanelTitle(
  viewMode: EntriesViewMode,
  selectedDate: string,
  weekRangeLabel: string,
  locale: string,
  t: Translator
) {
  if (viewMode === "day") {
    return dayTitle(selectedDate, locale, t);
  }

  if (viewMode === "week") {
    return weekRangeLabel;
  }

  return t("entries.live");
}

function getVisibleEntriesForMode(
  viewMode: EntriesViewMode,
  dayEntries: TimeEntry[],
  weekEntries: TimeEntry[],
  allEntries: TimeEntry[]
) {
  if (viewMode === "day") {
    return dayEntries;
  }

  if (viewMode === "week") {
    return weekEntries;
  }

  return allEntries;
}

function getVisibleHoursForMode(
  viewMode: EntriesViewMode,
  dayHours: number,
  weekHours: number,
  allHours: number
) {
  if (viewMode === "day") {
    return dayHours;
  }

  if (viewMode === "week") {
    return weekHours;
  }

  return allHours;
}

function getEntriesViewModeLabel(mode: EntriesViewMode, t: Translator) {
  if (mode === "day") {
    return t("entries.day");
  }

  if (mode === "week") {
    return t("entries.week");
  }

  return t("entries.history");
}

function AccountMenuOverlay({
  appLocale,
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
  t,
}: {
  appLocale: string;
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
  t: Translator;
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[80]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-white/10 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        aria-label="Account and sync menu"
        className="motion-popover no-drag absolute top-16 right-3 z-[90] w-[22rem] max-w-[calc(100vw-1.5rem)]"
        ref={menuRef}
        role="dialog"
        tabIndex={-1}
      >
        <SyncPanel
          appLocale={appLocale}
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
          t={t}
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
  t,
}: {
  authForm: AuthForm;
  authMode: AuthMode;
  onAuthFormChange: (form: AuthForm) => void;
  onAuthModeChange: (mode: AuthMode) => void;
  onGoogleLogin: () => void;
  onSubmitAuth: () => void;
  syncMessage: string;
  t: Translator;
}) {
  return (
    <main className="grid min-h-0 flex-1 place-items-center p-5">
      <section className="motion-dialog w-full max-w-sm rounded-lg border bg-background p-4 shadow-sm">
        <div>
          <p className="font-semibold text-lg">{t("auth.login")}</p>
          <p className="mt-1 font-medium text-foreground/60 text-sm">
            {t("auth.connect")}
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
            {t("auth.google")}
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
                {mode === "login" ? t("auth.login") : t("auth.signup")}
              </button>
            ))}
          </div>
          {showMiruBaseUrlField && (
            <FieldLabel icon={<LinkIcon />} label={t("auth.miruUrl")}>
              <input
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                onChange={(event) =>
                  onAuthFormChange({
                    ...authForm,
                    baseUrl: event.target.value,
                  })
                }
                value={authForm.baseUrl}
              />
            </FieldLabel>
          )}
          <FieldLabel icon={<Mail />} label={t("auth.email")}>
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
              <FieldLabel icon={<UserRound />} label={t("auth.firstName")}>
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
              <FieldLabel icon={<UserRound />} label={t("auth.lastName")}>
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
          <FieldLabel icon={<LockKeyhole />} label={t("auth.password")}>
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
            {authMode === "login" ? t("auth.login") : t("auth.createAccount")}
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
  locale,
  onDelete,
  onEdit,
  onResume,
  projects,
  showDate = false,
}: {
  clients: Client[];
  entry: TimeEntry;
  locale: string;
  onDelete: (entry: TimeEntry) => void;
  onEdit: (entry: TimeEntry) => void;
  onResume: (entry: TimeEntry) => void;
  projects: Project[];
  showDate?: boolean;
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
          {showDate ? `${formatShortDate(entry.date, locale)} · ` : ""}
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
  t,
}: {
  durationMs: number;
  onAction: (
    action: "ignore-continue" | "remove-continue" | "remove-start-new"
  ) => void;
  t: Translator;
}) {
  const actions = [
    {
      action: "remove-continue" as const,
      className: "bg-emerald-500 text-white shadow-emerald-500/25",
      icon: Check,
      label: t("idle.trim"),
    },
    {
      action: "remove-start-new" as const,
      className: "bg-primary text-primary-foreground shadow-primary/25",
      icon: RefreshCw,
      label: t("idle.restart"),
    },
    {
      action: "ignore-continue" as const,
      className: "bg-foreground text-background shadow-foreground/15",
      icon: Play,
      label: t("idle.keep"),
    },
  ];

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-white/55 p-5 backdrop-blur-[2px]">
      <section
        aria-label={t("idle.aria")}
        className="motion-dialog w-full max-w-[19rem] rounded-xl border bg-white p-4 text-center shadow-2xl ring-1 ring-black/5"
        role="dialog"
      >
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-50 text-amber-600">
          <span className="motion-idle-orbit grid size-11 place-items-center rounded-full bg-amber-100">
            <TimerReset className="size-5" />
          </span>
        </div>
        <p className="mt-3 font-semibold text-muted-foreground text-xs uppercase tracking-[0.18em]">
          {t("idle.title")}
        </p>
        <p className="mt-1 font-mono font-semibold text-5xl tabular-nums">
          {formatCompactDuration(durationMs)}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {actions.map((item) => {
            const Icon = item.icon;

            return (
              <button
                aria-label={item.label}
                className={cn(
                  "interactive-lift icon-motion grid aspect-square place-items-center rounded-xl shadow-lg transition",
                  item.className
                )}
                key={item.action}
                onClick={() => onAction(item.action)}
                title={item.label}
                type="button"
              >
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TimeSummaryStrip({
  onShowAll,
  onShowToday,
  onShowWeek,
  summary,
  t,
  viewMode,
}: {
  onShowAll: () => void;
  onShowToday: () => void;
  onShowWeek: () => void;
  summary: TimeSummary;
  t: Translator;
  viewMode: EntriesViewMode;
}) {
  const items = [
    {
      active: viewMode === "day",
      icon: Clock3,
      label: t("summary.today"),
      onClick: onShowToday,
      value: formatEntryDuration(summary.todayHours),
    },
    {
      active: viewMode === "week",
      icon: CalendarDays,
      label: t("summary.thisWeek"),
      onClick: onShowWeek,
      value: formatEntryDuration(summary.weekHours),
    },
    {
      active: viewMode === "history",
      icon: TimerReset,
      label: t("summary.entries"),
      onClick: onShowAll,
      value: String(summary.entryCount),
    },
  ];

  return (
    <section className="mb-3 grid grid-cols-3 gap-2">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            aria-pressed={item.active}
            className={cn(
              "motion-fade-up interactive-lift min-w-0 rounded-lg border px-3 py-2 text-left shadow-sm transition",
              item.active
                ? "border-primary/30 bg-primary/10"
                : "bg-background hover:border-primary/20 hover:bg-primary/5"
            )}
            key={item.label}
            onClick={item.onClick}
            type="button"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md text-primary",
                  item.active ? "bg-background" : "bg-primary/10"
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <p className="truncate text-[11px]">{item.label}</p>
            </div>
            <p className="mt-1 truncate font-mono font-semibold text-sm tabular-nums">
              {item.value}
            </p>
          </button>
        );
      })}
    </section>
  );
}

function SyncPanel({
  appLocale,
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
  t,
}: {
  appLocale: string;
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
  t: Translator;
}) {
  const activeWorkspace = getActiveWorkspace(miruSession);
  const accountName = getAccountName(miruSession?.user) || "Miru user";
  const accountEmail = getAccountEmail(miruSession?.user);
  const accountAvatarUrl = getAccountAvatarUrl(
    miruSession?.user,
    miruSession?.baseUrl
  );
  const status = miruSession?.syncStatus ?? "local";
  const StatusIcon =
    status === "offline" || status === "error" ? CloudOff : Cloud;
  const syncStatusClass = getSyncStatusClass(status);

  if (miruSession?.signedIn) {
    return (
      <section className="max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border bg-white p-2 shadow-2xl ring-1 ring-black/10">
        <div className="rounded-lg bg-[#f6f4ff] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AccountAvatar
                avatarUrl={accountAvatarUrl}
                email={accountEmail}
                name={accountName}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-sm">{accountName}</p>
                <p className="truncate font-medium text-foreground/60 text-xs">
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
              {formatSyncStatus(status, t)}
            </span>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md border bg-background p-2">
            <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground/60 text-xs">
                {t("sync.workspace")}
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
            description={t("sync.pullHint")}
            icon={<ArrowDownToLine className="size-4" />}
            label={t("sync.pull")}
            onClick={() => onSyncTimer("pull")}
          />
          <MenuAction
            description={t("sync.pushHint")}
            icon={<ArrowUpFromLine className="size-4" />}
            label={t("sync.push")}
            onClick={() => onSyncTimer("push")}
          />
        </div>

        <div className="mt-2 grid gap-2 rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserRound className="size-4" />
              </span>
              <div>
                <p className="font-semibold text-sm">{t("account.settings")}</p>
                <p className="font-medium text-foreground/60 text-xs">
                  {t("settings.language")}: {getLocaleDisplayName(appLocale)}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 font-semibold text-[11px] text-foreground/70">
              {appLocale}
            </span>
          </div>
          <FieldLabel icon={<TimerReset />} label={t("settings.idlePrompt")}>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 font-medium text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
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
            label={t("account.logout")}
            onClick={onLogout}
          />
          <MenuAction
            icon={<Power className="size-4" />}
            label={t("account.quit")}
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
        {showMiruBaseUrlField && (
          <FieldLabel icon={<LinkIcon />} label="Miru URL">
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onAuthFormChange({ ...authForm, baseUrl: event.target.value })
              }
              value={authForm.baseUrl}
            />
          </FieldLabel>
        )}
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
  t,
}: {
  clients: Client[];
  draft: EntryDraft;
  mode: "edit" | "new";
  onChange: (draft: EntryDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onStart: () => void;
  projects: Project[];
  t: Translator;
}) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="motion-dialog w-full max-w-sm overflow-hidden rounded-lg border bg-background shadow-2xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b p-3">
          <div />
          <h2 className="font-semibold text-sm">
            {mode === "edit" ? t("entries.edit") : t("entries.new")}
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
          <FieldLabel icon={<CalendarDays />} label={t("field.date")}>
            <input
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onChange({ ...draft, date: event.target.value })
              }
              type="date"
              value={draft.date}
            />
          </FieldLabel>
          <FieldLabel icon={<FolderKanban />} label={t("field.project")}>
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
            <FieldLabel icon={<ListChecks />} label={t("field.task")}>
              <Select
                onChange={(value) => onChange({ ...draft, taskId: value })}
                value={draft.taskId}
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {getTaskDisplayName(task, t)}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            <FieldLabel icon={<Timer />} label={t("field.time")}>
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
          <FieldLabel icon={<FileText />} label={t("field.notes")}>
            <textarea
              className="min-h-20 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
              onChange={(event) =>
                onChange({ ...draft, notes: event.target.value })
              }
              placeholder={t("field.notes")}
              value={draft.notes}
            />
          </FieldLabel>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t p-3">
          <Button onClick={onSave} variant="outline">
            <Save />
            {t("entries.save")}
          </Button>
          <Button onClick={onStart}>
            <Play />
            {t("timer.start")}
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
      <span className="flex items-center gap-1.5 font-semibold text-foreground/70 text-xs [&_svg]:size-3.5">
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
      className="h-9 w-full rounded-md border bg-background px-3 font-medium text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function AccountAvatar({
  avatarUrl,
  email,
  name,
  size = "md",
}: {
  avatarUrl: string;
  email: string;
  name: string;
  size?: "lg" | "md" | "sm";
}) {
  const sizeClass = {
    lg: "size-12 rounded-xl text-sm",
    md: "size-10 rounded-lg text-sm",
    sm: "size-8 rounded-full text-xs",
  }[size];
  const pixelSize = {
    lg: 48,
    md: 40,
    sm: 32,
  }[size];

  if (avatarUrl) {
    return (
      <img
        alt=""
        className={cn("shrink-0 object-cover shadow-sm", sizeClass)}
        height={pixelSize}
        src={avatarUrl}
        width={pixelSize}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-primary font-semibold text-primary-foreground shadow-sm",
        sizeClass
      )}
    >
      {getInitials(name || email || "M")}
    </span>
  );
}

function createTranslator(locale: string): Translator {
  const normalizedLocale = normalizeLocale(locale);
  const baseLocale = normalizedLocale.split("-")[0];
  const fallback = COMPLETE_APP_TRANSLATIONS[DEFAULT_LOCALE];
  const localized =
    COMPLETE_APP_TRANSLATIONS[normalizedLocale as SupportedLocale] ?? {};
  const baseLocalized =
    COMPLETE_APP_TRANSLATIONS[baseLocale as SupportedLocale] ?? {};

  return (key, values = {}) => {
    const template =
      localized[key] ?? baseLocalized[key] ?? fallback[key] ?? key;

    return Object.entries(values).reduce(
      (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
      template
    );
  };
}

function getAppLocale(user: Record<string, unknown> | null | undefined) {
  const userLocale =
    user &&
    (getStringValue(user, "locale") ||
      getNestedStringValue(user, ["settings", "locale"]) ||
      getNestedStringValue(user, ["settings", "language"]));
  const storedLocale = window.localStorage.getItem("miru-time-locale") ?? "";
  const browserLocale = navigator.language;

  return normalizeLocale(userLocale || storedLocale || browserLocale);
}

function normalizeLocale(value: string) {
  const candidate = value.trim();

  if (!candidate || candidate.toLowerCase() === "en") {
    return DEFAULT_LOCALE;
  }

  const exact = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === candidate.toLowerCase()
  );

  if (exact) {
    return exact;
  }

  const base = candidate.split("-")[0]?.toLowerCase();
  const baseMatch = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === base
  );

  return baseMatch ?? DEFAULT_LOCALE;
}

function getNestedStringValue(source: Record<string, unknown>, keys: string[]) {
  let current: unknown = source;

  for (const key of keys) {
    if (!(current && typeof current === "object")) {
      return "";
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : "";
}

function getLocaleDisplayName(locale: string) {
  try {
    const names = new Intl.DisplayNames([locale], { type: "language" });
    return names.of(locale) ?? locale;
  } catch {
    return locale;
  }
}

function getTaskDisplayName(task: Task, t: Translator) {
  return task.id === "time" ? t("task.timeEntry") : task.name;
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

function buildDesktopTimerContext(
  project: Project | undefined,
  task: Task,
  clients: Client[],
  notes: string
) {
  return {
    billable: false,
    notes,
    projectId: project?.id ?? "",
    projectName: project
      ? `${clientById(project.clientId, clients)?.name ?? "Miru"} / ${project.name}`
      : "No project selected",
    taskId: task.id,
    taskName: task.name,
  };
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

function getTimerStatusLabel(timer: TimerState, t: Translator) {
  if (timer.idle) {
    return t("timer.idle");
  }

  if (timer.running) {
    return t("timer.running");
  }

  if (timer.elapsedSeconds > 0) {
    return t("timer.pause");
  }

  return t("timer.ready");
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

function formatWeekRange(from: string, to: string, locale = DEFAULT_LOCALE) {
  const formatter = new Intl.DateTimeFormat(locale, {
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

function getAccountAvatarUrl(
  user: Record<string, unknown> | null | undefined,
  baseUrl = ""
) {
  if (!user) {
    return "";
  }

  const avatarUrl =
    getStringValue(user, "avatar_url") ||
    getStringValue(user, "avatarUrl") ||
    getStringValue(user, "profile_image_url") ||
    getStringValue(user, "profileImageUrl") ||
    getStringValue(user, "image_url") ||
    getStringValue(user, "imageUrl") ||
    getStringValue(user, "photo_url") ||
    getStringValue(user, "photoUrl");

  return resolveMiruAssetUrl(avatarUrl, baseUrl);
}

function resolveMiruAssetUrl(value: string, baseUrl: string) {
  if (!value || ABSOLUTE_ASSET_PATTERN.test(value)) {
    return value;
  }

  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
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

function formatSyncStatus(
  status: MiruSessionState["syncStatus"],
  t: Translator
) {
  return t(`sync.status.${status}` as I18nKey);
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

function formatCompactDuration(milliseconds: number) {
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatHours(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function dayTitle(date: string, locale: string, t: Translator) {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
  return date === todayIso
    ? t("summary.today")
    : formatter.format(new Date(`${date}T00:00:00`));
}

function formatShortDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
