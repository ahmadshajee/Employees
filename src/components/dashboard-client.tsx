"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "next-auth/react";

type TabKey = "dashboard" | "workspace" | "leaderboard" | "history" | "calendar";

type Lead = {
  _id: string;
  name: string;
  position: string;
  company: string;
  location: string;
  email: string;
  platform: string;
  status: string;
  logs?: LeadLog[];
  createdAt?: string;
};

type LeadLog = {
  type: string;
  note: string;
  createdAt: string;
};

type DashboardStats = {
  callsToday: number;
  emailsSent: number;
  demosToday: number;
  dealsClosed: number;
  formsSubmitted: number;
  totalLeads: number;
  totalEmails: number;
  totalFollowups: number;
};

type LeaderboardRow = {
  userId: string;
  name: string;
  deals: number;
  calls: number;
  followups: number;
  score: number;
};

type HistoryRow = {
  date: string;
  type: string;
  status: string;
};

type AttendanceRow = {
  _id: string;
  date: string;
  status: string;
  loginTime: string;
  logoutTime: string;
  tasks: string[];
};

type AttendanceStatus = "present" | "absent" | "leave" | "halfday" | "weekend";

type LeadContext = {
  leadId: string;
  name: string;
  company: string;
  email: string;
};

async function readErrorMessage(res: Response, fallback: string) {
  const text = await res.text();
  if (!text) return fallback;

  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error || data.message || fallback;
  } catch {
    return text.slice(0, 180) || fallback;
  }
}

const statusOptions = [
  "Connect Request Sent",
  "Contacted",
  "Demo Scheduled",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Not Interested",
];

const logIconMap = {
  create: "📋",
  connect: "🔗",
  email: "✉️",
  followup: "🔄",
  status: "📌",
  note: "📝",
};

const logColorMap = {
  create: "#7c5cfc",
  connect: "#1565c0",
  email: "#7c5cfc",
  followup: "#e65100",
  status: "#2e7d32",
  note: "#6a1b9a",
};

const statusLabelMap: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  leave: "On Leave",
  halfday: "Half Day",
  weekend: "Weekend",
};

const statusColorClassMap: Record<AttendanceStatus, string> = {
  present: "calendar-day-present",
  absent: "calendar-day-absent",
  leave: "calendar-day-leave",
  halfday: "calendar-day-halfday",
  weekend: "calendar-day-weekend",
};

function normalizeAttendanceStatus(status: string): AttendanceStatus {
  const key = status.trim().toLowerCase();
  if (key === "present") return "present";
  if (key === "absent") return "absent";
  if (key === "leave") return "leave";
  if (key === "halfday") return "halfday";
  return "weekend";
}

function parseClockToMinutes(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const match24Hour = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24Hour) {
    const hour = Number(match24Hour[1]);
    const minute = Number(match24Hour[2]);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return hour * 60 + minute;
    }
  }

  const match12Hour = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12Hour) {
    let hour = Number(match12Hour[1]);
    const minute = Number(match12Hour[2]);
    const period = match12Hour[3].toUpperCase();
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute < 60) {
      if (hour === 12) hour = 0;
      if (period === "PM") hour += 12;
      return hour * 60 + minute;
    }
  }

  return null;
}

function formatWorkedHours(loginTime: string, logoutTime: string): string {
  const login = parseClockToMinutes(loginTime);
  const logout = parseClockToMinutes(logoutTime);
  if (login === null || logout === null || logout <= login) return "-";

  const workedMinutes = logout - login;
  const hours = Math.floor(workedMinutes / 60);
  const minutes = workedMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export default function DashboardClient({ userName }: { userName: string }) {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [workspaceView, setWorkspaceView] = useState<"roster" | "forms">("roster");
  const [workspaceModal, setWorkspaceModal] = useState<"email" | "lead" | "dar" | "deal" | "followup" | "expense" | "attendance" | null>(null);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [workspaceStatus, setWorkspaceStatus] = useState("");
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [activeLeadContext, setActiveLeadContext] = useState<LeadContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);

  const [leadForm, setLeadForm] = useState({
    name: "",
    company: "",
    position: "",
    location: "",
    email: "",
    platform: "LinkedIn",
    status: "Contacted",
  });

  const [emailForm, setEmailForm] = useState({ to: "", cc: "", subject: "", body: "" });
  const [darForm, setDarForm] = useState({
    date: "",
    coldCalls: 0,
    emailsSent: 0,
    linkedInMessages: 0,
    newLeads: 0,
    followupsDone: 0,
    demosScheduled: 0,
    demosCompleted: 0,
    proposalsSent: 0,
    dealsClosed: 0,
    dealValueInr: 0,
    remarks: "",
  });
  const [dealForm, setDealForm] = useState({
    clientCompany: "",
    contactPerson: "",
    services: "",
    pricingPerCheck: 0,
    monthlyVolume: 0,
    contractDuration: "",
    totalValueInr: 0,
    paymentTerms: "",
    specialTerms: "",
    onboardingDate: "",
  });
  const [followupForm, setFollowupForm] = useState({
    date: "",
    clientName: "",
    contactPerson: "",
    mode: "Phone Call",
    summary: "",
    responseStatus: "No Response",
    nextAction: "",
    nextFollowUpDate: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    date: "",
    expenseType: "",
    amountInr: 0,
    paymentMethod: "",
    description: "",
  });
  const [attendanceForm, setAttendanceForm] = useState({
    date: "",
    status: "present",
    loginTime: "",
    logoutTime: "",
    tasks: "",
  });

  async function loadAll() {
    setError("");
    try {
      const [dashboardRes, leadsRes, leaderboardRes, historyRes, attendanceRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/leads"),
        fetch("/api/leaderboard"),
        fetch("/api/history"),
        fetch("/api/attendance"),
      ]);

      if (!dashboardRes.ok) throw new Error("Session expired. Please login again.");

      setStats(await dashboardRes.json());
      setLeads(await leadsRes.json());
      setLeaderboard(await leaderboardRes.json());
      setHistory(await historyRes.json());
      setAttendance(await attendanceRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }

  useEffect(() => {
    const initialize = async () => {
      await loadAll();
    };

    void initialize();
  }, []);

  async function postData(url: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = await readErrorMessage(res, "Unable to submit");
        throw new Error(message);
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit");
    } finally {
      setBusy(false);
    }
  }

  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const currentMonthKey = `${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth() + 1).padStart(2, "0")}`;

  const rowsInCurrentMonth = useMemo(
    () =>
      attendance
        .filter((row) => row.date.slice(0, 7) === currentMonthKey)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [attendance, currentMonthKey],
  );

  const attendanceByDay = useMemo(() => {
    const map = new Map<number, AttendanceRow>();
    for (const row of rowsInCurrentMonth) {
      const day = Number(row.date.slice(8, 10));
      if (!Number.isNaN(day)) map.set(day, row);
    }
    return map;
  }, [rowsInCurrentMonth]);

  const calendarStats = useMemo(() => {
    const stats: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      leave: 0,
      halfday: 0,
      weekend: 0,
    };

    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const row = attendanceByDay.get(day);
      if (row) {
        stats[normalizeAttendanceStatus(row.status)] += 1;
        continue;
      }

      const weekDay = new Date(year, month, day).getDay();
      if (weekDay === 0 || weekDay === 6) stats.weekend += 1;
    }

    return stats;
  }, [attendanceByDay, calendarCursor]);

  const loginHoursRows = useMemo(
    () =>
      rowsInCurrentMonth
        .filter((row) => row.loginTime && row.logoutTime)
        .map((row) => ({
          id: row._id,
          dayLabel: new Date(row.date).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
          workedHours: formatWorkedHours(row.loginTime, row.logoutTime),
        }))
        .filter((item) => item.workedHours !== "-"),
    [rowsInCurrentMonth],
  );

  const filteredLeads = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesQuery =
        !query ||
        lead.name.toLowerCase().includes(query) ||
        lead.company.toLowerCase().includes(query) ||
        lead.location.toLowerCase().includes(query) ||
        lead.position.toLowerCase().includes(query);
      const matchesStatus = !workspaceStatus || lead.status === workspaceStatus;
      return matchesQuery && matchesStatus;
    });
  }, [leads, workspaceSearch, workspaceStatus]);

  function openWorkspaceModal(modal: "email" | "lead" | "dar" | "deal" | "followup" | "expense" | "attendance") {
    setActiveLeadContext(null);
    setWorkspaceModal(modal);
  }

  function openEmailModalForLead(lead: Lead) {
    setActiveLeadContext({ leadId: lead._id, name: lead.name, company: lead.company, email: lead.email });
    setEmailForm((current) => ({
      ...current,
      to: lead.email || current.to,
      subject: current.subject || `Regarding ${lead.company} background verification`,
      body: current.body || `Hi ${lead.name},\n\n`,
    }));
    setWorkspaceModal("email");
  }

  function openFollowupModalForLead(lead: Lead) {
    setActiveLeadContext({ leadId: lead._id, name: lead.name, company: lead.company, email: lead.email });
    setFollowupForm((current) => ({
      ...current,
      clientName: lead.company,
      contactPerson: lead.name,
    }));
    setWorkspaceModal("followup");
  }

  function closeWorkspaceModal() {
    setWorkspaceModal(null);
  }

  useEffect(() => {
    if (!workspaceModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWorkspaceModal();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [workspaceModal]);

  function submitLead(e: FormEvent) {
    e.preventDefault();
    void postData("/api/leads", {
      ...leadForm,
      logs: [{ type: "create", note: "Lead added", createdAt: new Date().toISOString() }],
    });
    setLeadForm({ name: "", company: "", position: "", location: "", email: "", platform: "LinkedIn", status: "Contacted" });
  }

  function submitEmail(e: FormEvent) {
    e.preventDefault();
    void postData("/api/emails", {
      ...emailForm,
      leadId: activeLeadContext?.leadId,
    });
    setEmailForm({ to: "", cc: "", subject: "", body: "" });
    setActiveLeadContext(null);
  }

  function submitDar(e: FormEvent) {
    e.preventDefault();
    void postData("/api/daily-reports", darForm);
    setDarForm({
      date: "",
      coldCalls: 0,
      emailsSent: 0,
      linkedInMessages: 0,
      newLeads: 0,
      followupsDone: 0,
      demosScheduled: 0,
      demosCompleted: 0,
      proposalsSent: 0,
      dealsClosed: 0,
      dealValueInr: 0,
      remarks: "",
    });
  }

  function submitDeal(e: FormEvent) {
    e.preventDefault();
    void postData("/api/deals", {
      ...dealForm,
      services: dealForm.services
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    });
    setDealForm({
      clientCompany: "",
      contactPerson: "",
      services: "",
      pricingPerCheck: 0,
      monthlyVolume: 0,
      contractDuration: "",
      totalValueInr: 0,
      paymentTerms: "",
      specialTerms: "",
      onboardingDate: "",
    });
  }

  function submitFollowup(e: FormEvent) {
    e.preventDefault();
    void postData("/api/followups", {
      ...followupForm,
      leadId: activeLeadContext?.leadId,
    });
    setFollowupForm({
      date: "",
      clientName: "",
      contactPerson: "",
      mode: "Phone Call",
      summary: "",
      responseStatus: "No Response",
      nextAction: "",
      nextFollowUpDate: "",
    });
    setActiveLeadContext(null);
  }

  function submitExpense(e: FormEvent) {
    e.preventDefault();
    void postData("/api/expenses", expenseForm);
    setExpenseForm({ date: "", expenseType: "", amountInr: 0, paymentMethod: "", description: "" });
  }

  function submitAttendance(e: FormEvent) {
    e.preventDefault();
    void postData("/api/attendance", {
      ...attendanceForm,
      tasks: attendanceForm.tasks
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    });
    setAttendanceForm({ date: "", status: "present", loginTime: "", logoutTime: "", tasks: "" });
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="w-60 border-r border-slate-800 bg-slate-900 p-5 text-slate-100">
        <h2 className="text-xl font-semibold">SalesQuest</h2>
        <p className="mt-1 text-xs text-slate-400">Employee Tracker</p>

        <nav className="mt-8 space-y-2 text-sm">
          {[
            ["dashboard", "Dashboard"],
            ["workspace", "Workspace"],
            ["leaderboard", "Leaderboard"],
            ["history", "My History"],
            ["calendar", "Calendar"],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`block w-full rounded-md px-3 py-2 text-left ${tab === k ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}
              onClick={() => setTab(k as TabKey)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-6">
        <header className="mb-5 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold">Welcome, {userName}</h1>
            <p className="text-sm text-slate-500">Each account has separate data storage in MongoDB.</p>
          </div>
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
            type="button"
          >
            Logout
          </button>
        </header>

        {error && <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

        {tab === "dashboard" && (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              {[
                ["Calls Today", stats?.callsToday || 0],
                ["Emails Sent", stats?.emailsSent || 0],
                ["Demos Today", stats?.demosToday || 0],
                ["Deals Closed", stats?.dealsClosed || 0],
                ["Forms Submitted", stats?.formsSubmitted || 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <h3 className="font-medium">Lead Pipeline</h3>
                <p className="mt-2 text-sm text-slate-600">Total leads: {stats?.totalLeads || 0}</p>
                <p className="text-sm text-slate-600">Total follow-ups: {stats?.totalFollowups || 0}</p>
                <p className="text-sm text-slate-600">Total emails: {stats?.totalEmails || 0}</p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <h3 className="font-medium">Recent Leads</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-700">
                  {leads.slice(0, 5).map((lead) => (
                    <li key={lead._id} className="flex items-center justify-between border-b border-slate-100 pb-1">
                      <span>{lead.name} - {lead.company}</span>
                      <span className="text-xs text-slate-500">{lead.status}</span>
                    </li>
                  ))}
                  {leads.length === 0 && <li className="text-slate-500">No leads yet.</li>}
                </ul>
              </div>
            </div>
          </section>
        )}

        {tab === "workspace" && (
          <section className="workspace-shell space-y-4">
            <div className="workspace-hero">
              <div>
                <p className="workspace-kicker">💼 Workspace</p>
                <h3 className="workspace-title">Lead Roster</h3>
                <p className="workspace-subtitle">Manage leads, send emails, and submit proof of work.</p>
              </div>
              <div className="workspace-actions">
                <button className="workspace-btn workspace-btn-primary" type="button" onClick={() => openWorkspaceModal("email")}>✉️ Compose Email</button>
                <button className="workspace-btn workspace-btn-secondary" type="button" onClick={() => openWorkspaceModal("lead")}>+ Add Lead</button>
              </div>
            </div>

            <div className="workspace-tabs">
              <button
                className={`workspace-tab ${workspaceView === "roster" ? "active" : ""}`}
                onClick={() => setWorkspaceView("roster")}
                type="button"
              >
                👥 Lead Roster
              </button>
              <button
                className={`workspace-tab ${workspaceView === "forms" ? "active" : ""}`}
                onClick={() => setWorkspaceView("forms")}
                type="button"
              >
                📋 Forms
              </button>
            </div>

            {workspaceView === "roster" && (
              <div className="workspace-panel space-y-4">
                <div className="workspace-toolbar">
                  <div className="workspace-search-wrap">
                    <span className="workspace-search-icon">🔍</span>
                    <input
                      className="workspace-search"
                      placeholder="Search name, company, location..."
                      value={workspaceSearch}
                      onChange={(e) => setWorkspaceSearch(e.target.value)}
                    />
                  </div>
                  <select className="workspace-filter" value={workspaceStatus} onChange={(e) => setWorkspaceStatus(e.target.value)}>
                    <option value="">All Status</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="workspace-table-wrap">
                  <table className="workspace-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Company</th>
                        <th>Location</th>
                        <th>Platform</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead, index) => {
                        const isOpen = expandedLeadId === lead._id;
                        return (
                          <Fragment key={lead._id}>
                            <tr className="lead-row" onClick={() => setExpandedLeadId((current) => (current === lead._id ? null : lead._id))}>
                              <td className="workspace-index">
                                <span className="workspace-index-arrow" style={{ transform: `rotate(${isOpen ? 90 : 0}deg)` }}>▶</span>
                                {index + 1}
                              </td>
                              <td>
                                <div className="workspace-person">
                                  <div className="workspace-avatar">{lead.name.charAt(0)}</div>
                                  <span>{lead.name}</span>
                                </div>
                              </td>
                              <td><div className="workspace-text-ellipsis" title={lead.position}>{lead.position}</div></td>
                              <td><div className="workspace-text-ellipsis" title={lead.company}>{lead.company}</div></td>
                              <td><div className="workspace-text-ellipsis" title={lead.location || "-"}>{lead.location || "-"}</div></td>
                              <td><span className="workspace-platform">{lead.platform || "Direct"}</span></td>
                              <td><span className="workspace-status-pill">{lead.status || "Contacted"}</span></td>
                              <td>
                                <div className="workspace-actions-cell">
                                  <button
                                    type="button"
                                    className="workspace-action-btn workspace-action-btn-email"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openEmailModalForLead(lead);
                                    }}
                                  >
                                    ✉ Email
                                  </button>
                                  <button
                                    type="button"
                                    className="workspace-action-btn workspace-action-btn-follow"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openFollowupModalForLead(lead);
                                    }}
                                  >
                                    🔄 Follow Up
                                  </button>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={8} className="workspace-detail-cell">
                                <div className="workspace-activity" style={{ maxHeight: isOpen ? 600 : 0, opacity: isOpen ? 1 : 0 }}>
                                  <div className="workspace-activity-inner">
                                    <div className="workspace-activity-title">📋 Activity History ({lead.logs?.length || 0})</div>
                                    {lead.logs?.length ? lead.logs.map((log) => (
                                      <div className="workspace-activity-item" key={`${lead._id}-${log.createdAt}-${log.type}`}>
                                        <div className="workspace-activity-icon" style={{ background: `${logColorMap[log.type as keyof typeof logColorMap] || "#999"}15`, color: logColorMap[log.type as keyof typeof logColorMap] || "#999" }}>
                                          {logIconMap[log.type as keyof typeof logIconMap] || "📋"}
                                        </div>
                                        <div className="workspace-activity-copy">
                                          <div className="workspace-activity-type">{log.type}</div>
                                          <div className="workspace-activity-note">{log.note}</div>
                                          <div className="workspace-activity-date">🕐 {new Date(log.createdAt).toLocaleString()}</div>
                                        </div>
                                      </div>
                                    )) : <div className="workspace-empty-state">No activity logged yet.</div>}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredLeads.length === 0 && <div className="workspace-empty-state">No leads found. Add your first lead using the + Add Lead button.</div>}
              </div>
            )}

            {workspaceView === "forms" && (
              <div className="workspace-panel space-y-6">
                <div className="forms-grid workspace-form-tiles">
                  {[
                    ["Daily Activity Report", "📋", "Log calls, emails, demos, and daily sales activity", "dar"],
                    ["Lead Entry Form", "🎯", "Add new leads with company details and services interest", "lead"],
                    ["Deal Closure Form", "💰", "Record closed deals with pricing and contract details", "deal"],
                    ["Client Follow-up Log", "🔄", "Track follow-up calls, emails and client responses", "followup"],
                    ["Expense Report", "🧾", "Submit work-related expenses with receipts", "expense"],
                    ["Attendance Entry", "📅", "Log attendance and daily working hours", "attendance"],
                  ].map(([title, emoji, description, modalKey]) => (
                    <button key={String(title)} type="button" className="workspace-form-tile" onClick={() => openWorkspaceModal(modalKey as "dar" | "lead" | "deal" | "followup" | "expense" | "attendance")}>
                      <div className="workspace-form-emoji">{emoji}</div>
                      <h4>{title}</h4>
                      <p>{description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {typeof document !== "undefined" && workspaceModal === "email" && createPortal(
              <div className="workspace-modal-overlay" onClick={closeWorkspaceModal}>
                <div className="workspace-modal workspace-modal-email" onClick={(event) => event.stopPropagation()}>
                  <button className="workspace-modal-close" type="button" onClick={closeWorkspaceModal}>×</button>
                  <div className="workspace-modal-head">
                    <div className="workspace-modal-icon">✉️</div>
                    <div>
                      <h3>New Email</h3>
                      <p>
                        {activeLeadContext
                          ? `To: ${activeLeadContext.name} (${activeLeadContext.company})`
                          : "Sent from your registered work email"}
                      </p>
                    </div>
                  </div>
                  <form className="workspace-modal-form" onSubmit={(event) => { submitEmail(event); closeWorkspaceModal(); }}>
                    <div className="workspace-modal-field">
                      <label>To</label>
                      <input className="workspace-input" placeholder="client@company.com" value={emailForm.to} onChange={(e) => setEmailForm((x) => ({ ...x, to: e.target.value }))} required />
                    </div>
                    <div className="workspace-modal-field">
                      <label>CC (optional)</label>
                      <input className="workspace-input" placeholder="manager@company.com" value={emailForm.cc} onChange={(e) => setEmailForm((x) => ({ ...x, cc: e.target.value }))} />
                    </div>
                    <div className="workspace-modal-field">
                      <label>Subject</label>
                      <input className="workspace-input" placeholder="e.g. Background Verification Proposal — TCS" value={emailForm.subject} onChange={(e) => setEmailForm((x) => ({ ...x, subject: e.target.value }))} required />
                    </div>
                    <div className="workspace-modal-field">
                      <label>Body</label>
                      <textarea className="workspace-input workspace-modal-textarea" rows={8} placeholder="Dear [Client Name]," value={emailForm.body} onChange={(e) => setEmailForm((x) => ({ ...x, body: e.target.value }))} required />
                    </div>
                    <div className="workspace-modal-actions">
                      <button className="workspace-submit workspace-modal-submit" type="submit" disabled={busy}>Send Email ✉️</button>
                      <button className="workspace-modal-discard" type="button" onClick={closeWorkspaceModal}>Discard</button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}

            {typeof document !== "undefined" && workspaceModal === "lead" && createPortal(
              <div className="workspace-modal-overlay" onClick={closeWorkspaceModal}>
                <div className="workspace-modal" onClick={(event) => event.stopPropagation()}>
                  <button className="workspace-modal-close" type="button" onClick={closeWorkspaceModal}>×</button>
                  <div className="workspace-modal-head">
                    <div className="workspace-modal-icon">🎯</div>
                    <div>
                      <h3>Lead Entry Form</h3>
                      <p>Each lead is tracked and reviewed by your manager</p>
                    </div>
                  </div>
                  <form className="workspace-modal-form" onSubmit={(event) => { submitLead(event); closeWorkspaceModal(); }}>
                    <div className="workspace-modal-grid">
                      <div className="workspace-modal-field workspace-span-2">
                        <label>Lead Source</label>
                        <select className="workspace-input" defaultValue="LinkedIn">
                          <option>LinkedIn</option>
                          <option>Website Inquiry</option>
                          <option>Referral</option>
                          <option>Cold Call</option>
                          <option>Event</option>
                        </select>
                      </div>
                      <div className="workspace-modal-field">
                        <label>Company Name</label>
                        <input className="workspace-input" placeholder="e.g. TCS, Infosys" value={leadForm.company} onChange={(e) => setLeadForm((x) => ({ ...x, company: e.target.value }))} required />
                      </div>
                      <div className="workspace-modal-field">
                        <label>Industry</label>
                        <select className="workspace-input" defaultValue="IT/Software">
                          <option>IT/Software</option>
                          <option>BPO/KPO</option>
                          <option>Banking/Finance</option>
                          <option>Healthcare</option>
                          <option>Staffing Agency</option>
                          <option>Manufacturing</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div className="workspace-modal-field">
                        <label>Contact Person</label>
                        <input className="workspace-input" placeholder="Name" value={leadForm.name} onChange={(e) => setLeadForm((x) => ({ ...x, name: e.target.value }))} required />
                      </div>
                      <div className="workspace-modal-field">
                        <label>Designation</label>
                        <input className="workspace-input" placeholder="HR Manager, TA Lead..." value={leadForm.position} onChange={(e) => setLeadForm((x) => ({ ...x, position: e.target.value }))} />
                      </div>
                      <div className="workspace-modal-field">
                        <label>Phone</label>
                        <input className="workspace-input" placeholder="+91..." />
                      </div>
                      <div className="workspace-modal-field">
                        <label>Email</label>
                        <input className="workspace-input" type="email" placeholder="email@company.com" value={leadForm.email} onChange={(e) => setLeadForm((x) => ({ ...x, email: e.target.value }))} />
                      </div>
                      <div className="workspace-modal-field workspace-span-2">
                        <label>Company Size</label>
                        <select className="workspace-input" defaultValue="1-50">
                          <option>1-50</option>
                          <option>51-200</option>
                          <option>201-500</option>
                          <option>500+</option>
                          <option>1000+</option>
                        </select>
                      </div>
                      <div className="workspace-modal-field workspace-span-2">
                        <label>Lead Status</label>
                        <select className="workspace-input" value={leadForm.status} onChange={(e) => setLeadForm((x) => ({ ...x, status: e.target.value }))}>
                          {statusOptions.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <button className="workspace-submit workspace-span-2" type="submit" disabled={busy}>Submit Lead</button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}

            {typeof document !== "undefined" && workspaceModal === "dar" && createPortal(
              <div className="workspace-modal-overlay" onClick={closeWorkspaceModal}>
                <div className="workspace-modal workspace-modal-wide" onClick={(event) => event.stopPropagation()}>
                  <button className="workspace-modal-close" type="button" onClick={closeWorkspaceModal}>×</button>
                  <div className="workspace-modal-head">
                    <div className="workspace-modal-icon">📋</div>
                    <div>
                      <h3>Daily Activity Report</h3>
                      <p>Submit daily to keep your streak active</p>
                    </div>
                  </div>
                  <form className="workspace-modal-form" onSubmit={(event) => { submitDar(event); closeWorkspaceModal(); }}>
                    <div className="workspace-modal-grid">
                      <div className="workspace-modal-field workspace-span-2">
                        <label>Date</label>
                        <input className="workspace-input" type="date" value={darForm.date} onChange={(e) => setDarForm((x) => ({ ...x, date: e.target.value }))} required />
                      </div>
                      <div className="workspace-modal-field"><label>Cold Calls Made</label><input className="workspace-input" type="number" value={darForm.coldCalls} onChange={(e) => setDarForm((x) => ({ ...x, coldCalls: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Emails Sent</label><input className="workspace-input" type="number" value={darForm.emailsSent} onChange={(e) => setDarForm((x) => ({ ...x, emailsSent: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>LinkedIn Messages</label><input className="workspace-input" type="number" value={darForm.linkedInMessages} onChange={(e) => setDarForm((x) => ({ ...x, linkedInMessages: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>New Leads Identified</label><input className="workspace-input" type="number" value={darForm.newLeads} onChange={(e) => setDarForm((x) => ({ ...x, newLeads: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Follow-ups Done</label><input className="workspace-input" type="number" value={darForm.followupsDone} onChange={(e) => setDarForm((x) => ({ ...x, followupsDone: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Demos Scheduled</label><input className="workspace-input" type="number" value={darForm.demosScheduled} onChange={(e) => setDarForm((x) => ({ ...x, demosScheduled: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Demos Completed</label><input className="workspace-input" type="number" value={darForm.demosCompleted} onChange={(e) => setDarForm((x) => ({ ...x, demosCompleted: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Proposals Sent</label><input className="workspace-input" type="number" value={darForm.proposalsSent} onChange={(e) => setDarForm((x) => ({ ...x, proposalsSent: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Deals Closed</label><input className="workspace-input" type="number" value={darForm.dealsClosed} onChange={(e) => setDarForm((x) => ({ ...x, dealsClosed: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Deal Value (INR)</label><input className="workspace-input" type="number" value={darForm.dealValueInr} onChange={(e) => setDarForm((x) => ({ ...x, dealValueInr: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field workspace-span-2">
                        <label>Remarks / Challenges</label>
                        <textarea className="workspace-input workspace-modal-textarea" rows={3} value={darForm.remarks} onChange={(e) => setDarForm((x) => ({ ...x, remarks: e.target.value }))} />
                      </div>
                      <button className="workspace-submit workspace-span-2" type="submit" disabled={busy}>Submit Report</button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}

            {typeof document !== "undefined" && workspaceModal === "deal" && createPortal(
              <div className="workspace-modal-overlay" onClick={closeWorkspaceModal}>
                <div className="workspace-modal" onClick={(event) => event.stopPropagation()}>
                  <button className="workspace-modal-close" type="button" onClick={closeWorkspaceModal}>×</button>
                  <div className="workspace-modal-head">
                    <div className="workspace-modal-icon">💰</div>
                    <div>
                      <h3>Deal Closure Form</h3>
                      <p>Requires manager approval · Upload contract to complete</p>
                    </div>
                  </div>
                  <form className="workspace-modal-form" onSubmit={(event) => { submitDeal(event); closeWorkspaceModal(); }}>
                    <div className="workspace-modal-grid">
                      <div className="workspace-modal-field"><label>Client Company</label><input className="workspace-input" value={dealForm.clientCompany} onChange={(e) => setDealForm((x) => ({ ...x, clientCompany: e.target.value }))} required /></div>
                      <div className="workspace-modal-field"><label>Contact Person</label><input className="workspace-input" value={dealForm.contactPerson} onChange={(e) => setDealForm((x) => ({ ...x, contactPerson: e.target.value }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Services Agreed</label><input className="workspace-input" placeholder="Employment Verification, Criminal Check" value={dealForm.services} onChange={(e) => setDealForm((x) => ({ ...x, services: e.target.value }))} /></div>
                      <div className="workspace-modal-field"><label>Pricing (Per Check INR)</label><input className="workspace-input" type="number" value={dealForm.pricingPerCheck} onChange={(e) => setDealForm((x) => ({ ...x, pricingPerCheck: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Est. Monthly Volume</label><input className="workspace-input" type="number" value={dealForm.monthlyVolume} onChange={(e) => setDealForm((x) => ({ ...x, monthlyVolume: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field"><label>Contract Duration</label><select className="workspace-input" value={dealForm.contractDuration} onChange={(e) => setDealForm((x) => ({ ...x, contractDuration: e.target.value }))}><option value="">Select</option><option>6 Months</option><option>1 Year</option><option>2 Years</option><option>Custom</option></select></div>
                      <div className="workspace-modal-field"><label>Total Contract Value (INR)</label><input className="workspace-input" type="number" value={dealForm.totalValueInr} onChange={(e) => setDealForm((x) => ({ ...x, totalValueInr: Number(e.target.value) }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Payment Terms</label><input className="workspace-input" value={dealForm.paymentTerms} onChange={(e) => setDealForm((x) => ({ ...x, paymentTerms: e.target.value }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Special Terms / SLAs</label><textarea className="workspace-input workspace-modal-textarea" rows={3} value={dealForm.specialTerms} onChange={(e) => setDealForm((x) => ({ ...x, specialTerms: e.target.value }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Client Onboarding Date</label><input className="workspace-input" type="date" value={dealForm.onboardingDate} onChange={(e) => setDealForm((x) => ({ ...x, onboardingDate: e.target.value }))} /></div>
                      <button className="workspace-submit workspace-span-2" type="submit" disabled={busy}>Submit Deal</button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}

            {typeof document !== "undefined" && workspaceModal === "followup" && createPortal(
              <div className="workspace-modal-overlay" onClick={closeWorkspaceModal}>
                <div className="workspace-modal" onClick={(event) => event.stopPropagation()}>
                  <button className="workspace-modal-close" type="button" onClick={closeWorkspaceModal}>×</button>
                  <div className="workspace-modal-head">
                    <div className="workspace-modal-icon">🔄</div>
                    <div>
                      <h3>Client Follow-up Log</h3>
                      <p>
                        {activeLeadContext
                          ? `Linked to lead: ${activeLeadContext.name} · ${activeLeadContext.company}`
                          : "Log every follow-up to maintain accurate pipeline records"}
                      </p>
                    </div>
                  </div>
                  <form className="workspace-modal-form" onSubmit={(event) => { submitFollowup(event); closeWorkspaceModal(); }}>
                    <div className="workspace-modal-grid">
                      <div className="workspace-modal-field workspace-span-2"><label>Date</label><input className="workspace-input" type="date" value={followupForm.date} onChange={(e) => setFollowupForm((x) => ({ ...x, date: e.target.value }))} required /></div>
                      <div className="workspace-modal-field"><label>Client Name</label><input className="workspace-input" value={followupForm.clientName} onChange={(e) => setFollowupForm((x) => ({ ...x, clientName: e.target.value }))} required /></div>
                      <div className="workspace-modal-field"><label>Contact Person</label><input className="workspace-input" value={followupForm.contactPerson} onChange={(e) => setFollowupForm((x) => ({ ...x, contactPerson: e.target.value }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Mode of Follow-up</label><select className="workspace-input" value={followupForm.mode} onChange={(e) => setFollowupForm((x) => ({ ...x, mode: e.target.value }))}><option>Phone Call</option><option>Email</option><option>LinkedIn</option><option>WhatsApp</option><option>Video Call</option></select></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Discussion Summary</label><textarea className="workspace-input workspace-modal-textarea" rows={3} value={followupForm.summary} onChange={(e) => setFollowupForm((x) => ({ ...x, summary: e.target.value }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Client Response / Status</label><select className="workspace-input" value={followupForm.responseStatus} onChange={(e) => setFollowupForm((x) => ({ ...x, responseStatus: e.target.value }))}><option>Interested — Moving Forward</option><option>Needs More Time</option><option>Asked for Revised Quote</option><option>Not Interested</option><option>No Response</option></select></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Next Action Required</label><textarea className="workspace-input workspace-modal-textarea" rows={3} value={followupForm.nextAction} onChange={(e) => setFollowupForm((x) => ({ ...x, nextAction: e.target.value }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Next Follow-up Date</label><input className="workspace-input" type="date" value={followupForm.nextFollowUpDate} onChange={(e) => setFollowupForm((x) => ({ ...x, nextFollowUpDate: e.target.value }))} /></div>
                      <button className="workspace-submit workspace-span-2" type="submit" disabled={busy}>Submit Follow-up</button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}

            {typeof document !== "undefined" && workspaceModal === "expense" && createPortal(
              <div className="workspace-modal-overlay" onClick={closeWorkspaceModal}>
                <div className="workspace-modal" onClick={(event) => event.stopPropagation()}>
                  <button className="workspace-modal-close" type="button" onClick={closeWorkspaceModal}>×</button>
                  <div className="workspace-modal-head">
                    <div className="workspace-modal-icon">🧾</div>
                    <div>
                      <h3>Expense Report</h3>
                      <p>Attach receipt for reimbursement approval</p>
                    </div>
                  </div>
                  <form className="workspace-modal-form" onSubmit={(event) => { submitExpense(event); closeWorkspaceModal(); }}>
                    <div className="workspace-modal-grid">
                      <div className="workspace-modal-field workspace-span-2"><label>Date</label><input className="workspace-input" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((x) => ({ ...x, date: e.target.value }))} required /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Expense Type</label><input className="workspace-input" value={expenseForm.expenseType} onChange={(e) => setExpenseForm((x) => ({ ...x, expenseType: e.target.value }))} required /></div>
                      <div className="workspace-modal-field"><label>Amount (INR)</label><input className="workspace-input" type="number" value={expenseForm.amountInr} onChange={(e) => setExpenseForm((x) => ({ ...x, amountInr: Number(e.target.value) }))} required /></div>
                      <div className="workspace-modal-field"><label>Payment Method</label><input className="workspace-input" value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm((x) => ({ ...x, paymentMethod: e.target.value }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Description</label><textarea className="workspace-input workspace-modal-textarea" rows={3} value={expenseForm.description} onChange={(e) => setExpenseForm((x) => ({ ...x, description: e.target.value }))} /></div>
                      <button className="workspace-submit workspace-span-2" type="submit" disabled={busy}>Submit Expense</button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}

            {typeof document !== "undefined" && workspaceModal === "attendance" && createPortal(
              <div className="workspace-modal-overlay" onClick={closeWorkspaceModal}>
                <div className="workspace-modal" onClick={(event) => event.stopPropagation()}>
                  <button className="workspace-modal-close" type="button" onClick={closeWorkspaceModal}>×</button>
                  <div className="workspace-modal-head">
                    <div className="workspace-modal-icon">📅</div>
                    <div>
                      <h3>Attendance Entry</h3>
                      <p>Log attendance and daily working hours</p>
                    </div>
                  </div>
                  <form className="workspace-modal-form" onSubmit={(event) => { submitAttendance(event); closeWorkspaceModal(); }}>
                    <div className="workspace-modal-grid">
                      <div className="workspace-modal-field workspace-span-2"><label>Date</label><input className="workspace-input" type="date" value={attendanceForm.date} onChange={(e) => setAttendanceForm((x) => ({ ...x, date: e.target.value }))} required /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Status</label><select className="workspace-input" value={attendanceForm.status} onChange={(e) => setAttendanceForm((x) => ({ ...x, status: e.target.value }))}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">On Leave</option><option value="halfday">Half Day</option><option value="weekend">Weekend</option></select></div>
                      <div className="workspace-modal-field"><label>Login Time</label><input className="workspace-input" value={attendanceForm.loginTime} onChange={(e) => setAttendanceForm((x) => ({ ...x, loginTime: e.target.value }))} /></div>
                      <div className="workspace-modal-field"><label>Logout Time</label><input className="workspace-input" value={attendanceForm.logoutTime} onChange={(e) => setAttendanceForm((x) => ({ ...x, logoutTime: e.target.value }))} /></div>
                      <div className="workspace-modal-field workspace-span-2"><label>Tasks</label><textarea className="workspace-input workspace-modal-textarea" rows={3} value={attendanceForm.tasks} onChange={(e) => setAttendanceForm((x) => ({ ...x, tasks: e.target.value }))} /></div>
                      <button className="workspace-submit workspace-span-2" type="submit" disabled={busy}>Save Attendance</button>
                    </div>
                  </form>
                </div>
              </div>
            , document.body)}
          </section>
        )}

        {tab === "leaderboard" && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="font-medium">Team Leaderboard</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Deals</th>
                    <th className="pb-2">Calls</th>
                    <th className="pb-2">Follow-ups</th>
                    <th className="pb-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, idx) => (
                    <tr key={row.userId} className="border-t border-slate-100">
                      <td className="py-2">{idx + 1}</td>
                      <td className="py-2">{row.name}</td>
                      <td className="py-2">{row.deals}</td>
                      <td className="py-2">{row.calls}</td>
                      <td className="py-2">{row.followups}</td>
                      <td className="py-2 font-medium">{row.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaderboard.length === 0 && <p className="py-2 text-sm text-slate-500">No leaderboard data yet.</p>}
            </div>
          </section>
        )}

        {tab === "history" && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="font-medium">Submission History</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Form</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, idx) => (
                    <tr key={`${row.type}-${idx}`} className="border-t border-slate-100">
                      <td className="py-2">{row.date}</td>
                      <td className="py-2">{row.type}</td>
                      <td className="py-2">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length === 0 && <p className="py-2 text-sm text-slate-500">No submissions yet.</p>}
            </div>
          </section>
        )}

        {tab === "calendar" && (
          <section className="calendar-shell">
            <div className="calendar-header-card">
              <h3>📅 Attendance Calendar</h3>
              <div className="calendar-legend">
                {(["present", "absent", "leave", "halfday", "weekend"] as AttendanceStatus[]).map((statusKey) => (
                  <div key={statusKey} className="calendar-legend-item">
                    <span className={`calendar-legend-dot ${statusColorClassMap[statusKey]}`} />
                    <span>{statusLabelMap[statusKey]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="calendar-board">
              <div className="calendar-board-top">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                >
                  ← Prev
                </button>
                <h4>
                  {calendarCursor.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h4>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                >
                  Next →
                </button>
              </div>

              <div className="calendar-weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="calendar-grid">
                {(() => {
                  const year = calendarCursor.getFullYear();
                  const month = calendarCursor.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
                  const today = new Date();
                  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

                  return Array.from({ length: totalCells }, (_, index) => {
                    const day = index - firstDay + 1;
                    if (day < 1 || day > daysInMonth) {
                      return <div key={`empty-${index}`} className="calendar-day calendar-day-empty" />;
                    }

                    const row = attendanceByDay.get(day);
                    const weekDay = new Date(year, month, day).getDay();
                    const status = row ? normalizeAttendanceStatus(row.status) : (weekDay === 0 || weekDay === 6 ? "weekend" : undefined);
                    const isToday = isCurrentMonth && today.getDate() === day;

                    return (
                      <div
                        key={`day-${day}`}
                        className={`calendar-day ${status ? statusColorClassMap[status] : "calendar-day-neutral"} ${isToday ? "calendar-day-today" : ""}`}
                        title={row ? `${statusLabelMap[normalizeAttendanceStatus(row.status)]}${row.loginTime ? ` · Login ${row.loginTime}` : ""}${row.logoutTime ? ` · Logout ${row.logoutTime}` : ""}` : undefined}
                      >
                        {day}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="calendar-bottom-grid">
              <div className="calendar-metrics-card">
                <h4>📊 Monthly Summary</h4>
                <div className="calendar-summary-list">
                  {(["present", "absent", "leave", "halfday", "weekend"] as AttendanceStatus[]).map((statusKey) => (
                    <div key={`summary-${statusKey}`} className="calendar-summary-item">
                      <div className="calendar-summary-name">
                        <span className={`calendar-legend-dot ${statusColorClassMap[statusKey]}`} />
                        <span>{statusLabelMap[statusKey]}:</span>
                      </div>
                      <strong>{calendarStats[statusKey]}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="calendar-hours-card">
                <h4>⏱️ Login Hours This Month</h4>
                {loginHoursRows.length > 0 ? (
                  <div className="calendar-hours-list">
                    {loginHoursRows.map((row) => (
                      <div key={row.id} className="calendar-hours-row">
                        <span>{row.dayLabel}</span>
                        <strong>{row.workedHours}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="calendar-hours-empty">No login/logout pairs available for this month.</p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
