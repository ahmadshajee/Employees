"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

export default function DashboardClient({ userName }: { userName: string }) {
  const [tab, setTab] = useState<TabKey>("dashboard");
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
    void loadAll();
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

  const monthMap = useMemo(() => {
    const map = new Map<string, AttendanceRow[]>();
    for (const row of attendance) {
      const month = row.date.slice(0, 7);
      const arr = map.get(month) || [];
      arr.push(row);
      map.set(month, arr);
    }
    return map;
  }, [attendance]);

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
    void postData("/api/emails", emailForm);
    setEmailForm({ to: "", cc: "", subject: "", body: "" });
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
    void postData("/api/followups", followupForm);
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
          <section className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <form className="rounded-xl bg-white p-4 shadow-sm" onSubmit={submitLead}>
                <h3 className="font-medium">Add Lead</h3>
                <div className="mt-3 grid gap-2">
                  <input className="rounded border px-3 py-2" placeholder="Lead Name" value={leadForm.name} onChange={(e) => setLeadForm((x) => ({ ...x, name: e.target.value }))} required />
                  <input className="rounded border px-3 py-2" placeholder="Company" value={leadForm.company} onChange={(e) => setLeadForm((x) => ({ ...x, company: e.target.value }))} required />
                  <input className="rounded border px-3 py-2" placeholder="Position" value={leadForm.position} onChange={(e) => setLeadForm((x) => ({ ...x, position: e.target.value }))} />
                  <input className="rounded border px-3 py-2" placeholder="Location" value={leadForm.location} onChange={(e) => setLeadForm((x) => ({ ...x, location: e.target.value }))} />
                  <input className="rounded border px-3 py-2" placeholder="Email" type="email" value={leadForm.email} onChange={(e) => setLeadForm((x) => ({ ...x, email: e.target.value }))} />
                  <select className="rounded border px-3 py-2" value={leadForm.status} onChange={(e) => setLeadForm((x) => ({ ...x, status: e.target.value }))}>
                    {statusOptions.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={busy}>Save Lead</button>
                </div>
              </form>

              <form className="rounded-xl bg-white p-4 shadow-sm" onSubmit={submitEmail}>
                <h3 className="font-medium">Compose Email</h3>
                <div className="mt-3 grid gap-2">
                  <input className="rounded border px-3 py-2" placeholder="To" value={emailForm.to} onChange={(e) => setEmailForm((x) => ({ ...x, to: e.target.value }))} required />
                  <input className="rounded border px-3 py-2" placeholder="CC" value={emailForm.cc} onChange={(e) => setEmailForm((x) => ({ ...x, cc: e.target.value }))} />
                  <input className="rounded border px-3 py-2" placeholder="Subject" value={emailForm.subject} onChange={(e) => setEmailForm((x) => ({ ...x, subject: e.target.value }))} required />
                  <textarea className="rounded border px-3 py-2" placeholder="Email body" rows={4} value={emailForm.body} onChange={(e) => setEmailForm((x) => ({ ...x, body: e.target.value }))} required />
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={busy}>Send</button>
                </div>
              </form>

              <form className="rounded-xl bg-white p-4 shadow-sm" onSubmit={submitDar}>
                <h3 className="font-medium">Daily Activity Report</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input className="rounded border px-3 py-2 sm:col-span-2" type="date" value={darForm.date} onChange={(e) => setDarForm((x) => ({ ...x, date: e.target.value }))} required />
                  <input className="rounded border px-3 py-2" type="number" placeholder="Cold Calls" value={darForm.coldCalls} onChange={(e) => setDarForm((x) => ({ ...x, coldCalls: Number(e.target.value) }))} />
                  <input className="rounded border px-3 py-2" type="number" placeholder="Emails Sent" value={darForm.emailsSent} onChange={(e) => setDarForm((x) => ({ ...x, emailsSent: Number(e.target.value) }))} />
                  <input className="rounded border px-3 py-2" type="number" placeholder="Followups" value={darForm.followupsDone} onChange={(e) => setDarForm((x) => ({ ...x, followupsDone: Number(e.target.value) }))} />
                  <input className="rounded border px-3 py-2" type="number" placeholder="Deals Closed" value={darForm.dealsClosed} onChange={(e) => setDarForm((x) => ({ ...x, dealsClosed: Number(e.target.value) }))} />
                  <textarea className="rounded border px-3 py-2 sm:col-span-2" rows={2} placeholder="Remarks" value={darForm.remarks} onChange={(e) => setDarForm((x) => ({ ...x, remarks: e.target.value }))} />
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white sm:col-span-2" disabled={busy}>Submit DAR</button>
                </div>
              </form>

              <form className="rounded-xl bg-white p-4 shadow-sm" onSubmit={submitDeal}>
                <h3 className="font-medium">Deal Closure</h3>
                <div className="mt-3 grid gap-2">
                  <input className="rounded border px-3 py-2" placeholder="Client Company" value={dealForm.clientCompany} onChange={(e) => setDealForm((x) => ({ ...x, clientCompany: e.target.value }))} required />
                  <input className="rounded border px-3 py-2" placeholder="Contact Person" value={dealForm.contactPerson} onChange={(e) => setDealForm((x) => ({ ...x, contactPerson: e.target.value }))} />
                  <input className="rounded border px-3 py-2" placeholder="Services (comma separated)" value={dealForm.services} onChange={(e) => setDealForm((x) => ({ ...x, services: e.target.value }))} />
                  <input className="rounded border px-3 py-2" type="number" placeholder="Total Value INR" value={dealForm.totalValueInr} onChange={(e) => setDealForm((x) => ({ ...x, totalValueInr: Number(e.target.value) }))} />
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={busy}>Submit Deal</button>
                </div>
              </form>

              <form className="rounded-xl bg-white p-4 shadow-sm" onSubmit={submitFollowup}>
                <h3 className="font-medium">Follow-up Log</h3>
                <div className="mt-3 grid gap-2">
                  <input className="rounded border px-3 py-2" type="date" value={followupForm.date} onChange={(e) => setFollowupForm((x) => ({ ...x, date: e.target.value }))} required />
                  <input className="rounded border px-3 py-2" placeholder="Client Name" value={followupForm.clientName} onChange={(e) => setFollowupForm((x) => ({ ...x, clientName: e.target.value }))} required />
                  <textarea className="rounded border px-3 py-2" rows={3} placeholder="Summary" value={followupForm.summary} onChange={(e) => setFollowupForm((x) => ({ ...x, summary: e.target.value }))} />
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={busy}>Submit Follow-up</button>
                </div>
              </form>

              <form className="rounded-xl bg-white p-4 shadow-sm" onSubmit={submitExpense}>
                <h3 className="font-medium">Expense Report</h3>
                <div className="mt-3 grid gap-2">
                  <input className="rounded border px-3 py-2" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((x) => ({ ...x, date: e.target.value }))} required />
                  <input className="rounded border px-3 py-2" placeholder="Expense Type" value={expenseForm.expenseType} onChange={(e) => setExpenseForm((x) => ({ ...x, expenseType: e.target.value }))} required />
                  <input className="rounded border px-3 py-2" type="number" placeholder="Amount INR" value={expenseForm.amountInr} onChange={(e) => setExpenseForm((x) => ({ ...x, amountInr: Number(e.target.value) }))} required />
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={busy}>Submit Expense</button>
                </div>
              </form>

              <form className="rounded-xl bg-white p-4 shadow-sm" onSubmit={submitAttendance}>
                <h3 className="font-medium">Attendance Entry</h3>
                <div className="mt-3 grid gap-2">
                  <input className="rounded border px-3 py-2" type="date" value={attendanceForm.date} onChange={(e) => setAttendanceForm((x) => ({ ...x, date: e.target.value }))} required />
                  <select className="rounded border px-3 py-2" value={attendanceForm.status} onChange={(e) => setAttendanceForm((x) => ({ ...x, status: e.target.value }))}>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="leave">On Leave</option>
                    <option value="halfday">Half Day</option>
                    <option value="weekend">Weekend</option>
                  </select>
                  <input className="rounded border px-3 py-2" placeholder="Tasks (comma separated)" value={attendanceForm.tasks} onChange={(e) => setAttendanceForm((x) => ({ ...x, tasks: e.target.value }))} />
                  <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={busy}>Save Attendance</button>
                </div>
              </form>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="font-medium">Lead Roster</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Company</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead._id} className="border-t border-slate-100">
                        <td className="py-2">{lead.name}</td>
                        <td className="py-2">{lead.company}</td>
                        <td className="py-2">{lead.location}</td>
                        <td className="py-2">{lead.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leads.length === 0 && <p className="py-2 text-sm text-slate-500">No leads added yet.</p>}
              </div>
            </div>
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
          <section className="space-y-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h3 className="font-medium">Attendance Calendar Data</h3>
              <p className="mt-1 text-sm text-slate-500">Entries are grouped by month and tied to your account.</p>
            </div>
            {[...monthMap.entries()].map(([month, rows]) => (
              <div key={month} className="rounded-xl bg-white p-4 shadow-sm">
                <h4 className="font-medium">{month}</h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Login</th>
                        <th className="pb-2">Logout</th>
                        <th className="pb-2">Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row._id} className="border-t border-slate-100">
                          <td className="py-2">{row.date}</td>
                          <td className="py-2">{row.status}</td>
                          <td className="py-2">{row.loginTime || "-"}</td>
                          <td className="py-2">{row.logoutTime || "-"}</td>
                          <td className="py-2">{row.tasks.join(", ") || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {attendance.length === 0 && (
              <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">No attendance rows yet.</div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
