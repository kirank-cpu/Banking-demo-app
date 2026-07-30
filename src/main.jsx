import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  Ban,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  FileX2,
  Home,
  Landmark,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import { api, clearAccessCode, setAccessCode } from "./api.js";
import { accountTypes, branches, closureReasons, payoutMethods, tellerTransactionTypes, transactionTypes, transferTypes, validateApplication, validateClosureRequest, validateTransfer } from "../server/rules.js";
import "../styles.css";
import "./react.css";

const users = [
  { username: "applicant", password: "demo123", name: "Avery Stone", role: "applicant", label: "Customer Applicant" },
  { username: "reviewer", password: "demo123", name: "Mina Patel", role: "reviewer", label: "Bank Reviewer" },
  { username: "teller", password: "demo123", name: "Jon Mercer", role: "teller", label: "Teller Operations" },
  { username: "customer", password: "demo123", name: "Girish Uppar", role: "customer", label: "Account Holder", customerId: "C1001" },
  { username: "admin", password: "demo123", name: "Sam Rivera", role: "admin", label: "Admin" }
];

const navByRole = {
  applicant: [["dashboard", "Overview", Home], ["apply", "New Application", Plus], ["myApplications", "My Applications", ClipboardList]],
  reviewer: [["dashboard", "Review Queue", FileCheck2], ["applications", "Applications", ClipboardList], ["closures", "Closure Requests", FileX2], ["audit", "Audit Trail", CheckCircle2]],
  teller: [["dashboard", "Operations", Home], ["funding", "Fund Account", BadgeDollarSign], ["transactions", "Transactions", CircleDollarSign]],
  customer: [["dashboard", "Accounts", Landmark], ["transfer", "Transfer Funds", ArrowLeftRight], ["transactions", "Transactions", CircleDollarSign], ["closeAccount", "Close Account", Ban], ["profile", "Profile", UserRound]],
  admin: [["dashboard", "Control Center", Home], ["applications", "Applications", ClipboardList], ["closures", "Closure Requests", FileX2], ["accounts", "Accounts", Landmark], ["transactions", "Transactions", CircleDollarSign], ["audit", "Audit Trail", CheckCircle2]]
};

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function statusClass(status) {
  return String(status).toLowerCase().replaceAll(" ", "-");
}

/** The customer record behind a signed-in account holder, with an application fallback. */
function findCustomerProfile(data, user, customerAccountNumber) {
  const account = customerAccountNumber ? data.accounts.find((item) => item.accountNumber === customerAccountNumber) : null;
  const customerId = account?.customerId || user.customerId;
  return (
    data.customers.find((item) => item.customerId === customerId) ||
    data.customers.find((item) => item.ownerUsername === user.username) ||
    data.applications.find((item) => item.customerId === customerId) ||
    data.applications.find((item) => item.ownerUsername === user.username) ||
    null
  );
}

function ownedAccounts(data, user, customerAccountNumber) {
  return data.accounts.filter(
    (account) =>
      (account.ownerUsername === user.username || account.customerId === user.customerId || account.accountNumber === customerAccountNumber) &&
      (!customerAccountNumber || account.accountNumber === customerAccountNumber)
  );
}

// Who is signed in, kept in sessionStorage so a refresh does not bounce you back
// to the login screen. Deliberately per-tab rather than localStorage: testers
// routinely keep a reviewer in one tab and a customer in another, and a shared
// store would make those two tabs fight over one identity.
const SESSION_KEY = "qtb-session";

function loadSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    const user = saved && users.find((item) => item.username === saved.username);
    if (!user) return null;
    // A view from a previous role would render nothing, so fall back to the dashboard.
    const allowedViews = navByRole[user.role].map(([id]) => id);
    return {
      username: user.username,
      customerAccountNumber: saved.customerAccountNumber || null,
      view: allowedViews.includes(saved.view) ? saved.view : "dashboard"
    };
  } catch {
    return null; // corrupt entry, or storage blocked
  }
}

const restoredSession = loadSession();

function App() {
  const [session, setSession] = useState(restoredSession?.username || null);
  const [customerAccountNumber, setCustomerAccountNumber] = useState(restoredSession?.customerAccountNumber || null);
  const [view, setView] = useState(restoredSession?.view || "dashboard");
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [needsAccessCode, setNeedsAccessCode] = useState(false);
  const [accessCodeError, setAccessCodeError] = useState("");
  const [checkingAccessCode, setCheckingAccessCode] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [selectedClosureId, setSelectedClosureId] = useState(null);
  const [selectedAccountNumber, setSelectedAccountNumber] = useState("8001200101");
  const [filters, setFilters] = useState({ search: "", status: "All", transactionType: "All" });
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);

  const reload = useCallback(async () => {
    try {
      const result = await api.getState();
      setData(result.state);
      setLoadError("");
      setNeedsAccessCode(false);
    } catch (error) {
      if (error.code === "unauthorized") {
        setData(null);
        setNeedsAccessCode(true);
      } else {
        setLoadError(error.message);
      }
    }
  }, []);

  async function submitAccessCode(code) {
    setCheckingAccessCode(true);
    setAccessCodeError("");
    try {
      setAccessCode(code);
      const result = await api.getState();
      setData(result.state);
      setNeedsAccessCode(false);
    } catch (error) {
      clearAccessCode();
      setAccessCodeError(error.code === "unauthorized" ? "That access code was not accepted." : error.message);
    } finally {
      setCheckingAccessCode(false);
    }
  }

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: session, customerAccountNumber, view }));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // storage blocked; the session just won't survive a refresh
    }
  }, [session, customerAccountNumber, view]);

  const user = users.find((item) => item.username === session);
  const displayName = useMemo(() => {
    if (!user || !data) return "";
    if (user.role !== "customer") return user.name;
    const profile = findCustomerProfile(data, user, customerAccountNumber);
    const name = profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : "";
    return name || user.name;
  }, [user, data, customerAccountNumber]);

  // A restored account-holder session can outlive its account. Sign out rather
  // than leave the holder staring at empty screens.
  useEffect(() => {
    if (!data || !user || user.role !== "customer" || !customerAccountNumber) return;
    if (data.accounts.some((account) => account.accountNumber === customerAccountNumber)) return;
    signOut();
    notify("That account is no longer available. Please sign in again.");
  }, [data, user, customerAccountNumber]);

  function apply(state) {
    setData(state);
  }

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function signOut() {
    setSession(null);
    setCustomerAccountNumber(null);
    setView("dashboard");
    setSelectedApplicationId(null);
    setSelectedClosureId(null);
    setModal(null);
  }

  function confirmSignOut() {
    setModal({
      title: "Sign out of QA's Trust Bank?",
      body: "You will be returned to the sign-in screen. Any details you have typed but not submitted will be lost.",
      confirmText: "Sign out",
      testId: "signout-modal",
      onConfirm: signOut
    });
  }

  if (needsAccessCode) return <AccessGate onSubmit={submitAccessCode} error={accessCodeError} busy={checkingAccessCode} />;
  if (loadError && !data) return <ConnectionError message={loadError} onRetry={reload} />;
  if (!data) return <LoadingScreen />;

  if (!user) {
    return <LoginScreen data={data} onLogin={(nextUser, context) => { setSession(nextUser.username); setCustomerAccountNumber(context?.accountNumber || null); setView("dashboard"); }} />;
  }

  const props = {
    user,
    data,
    apply,
    reload,
    view,
    customerAccountNumber,
    setView,
    filters,
    setFilters,
    selectedApplicationId,
    setSelectedApplicationId,
    selectedClosureId,
    setSelectedClosureId,
    selectedAccountNumber,
    setSelectedAccountNumber,
    notify,
    setModal,
    modal
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="top-actions">
          <span className="user-chip" data-testid="current-user"><span className="avatar">{(displayName || user.name)[0]}</span>{displayName} - {user.label}</span>
          <button className="btn secondary" data-testid="logout-button" onClick={confirmSignOut}><LogOut size={17} /> Sign out</button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <p className="role-title">{user.label}</p>
          <nav className="nav-list" aria-label="Main navigation">
            {navByRole[user.role].map(([id, label, Icon]) => (
              <button key={id} className={`nav-button ${view === id ? "active" : ""}`} data-testid={`nav-${id}`} onClick={() => { setView(id); setSelectedApplicationId(null); setSelectedClosureId(null); }}>
                <Icon size={18} /><span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <main className="main"><CurrentView {...props} /></main>
      </div>
      {toast && <div className="toast" data-testid="toast">{toast}</div>}
      {modal && <ConfirmModal modal={modal} onCancel={() => setModal(null)} />}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand" data-testid="brand">
      <span className="brand-mark">QT</span>
      <span><span className="brand-name">QA's Trust Bank</span><span className="brand-subtitle">React Demo Operations</span></span>
    </div>
  );
}

function LoadingScreen() {
  return <div className="empty" data-testid="app-loading" style={{ margin: "80px auto", maxWidth: 420 }}>Loading banking data...</div>;
}

function ConnectionError({ message, onRetry }) {
  return (
    <div className="empty" data-testid="connection-error" style={{ margin: "80px auto", maxWidth: 520 }}>
      <p>{message}</p>
      <button className="btn primary stack-top" data-testid="retry-connection" onClick={onRetry}><RefreshCw size={17} /> Try again</button>
    </div>
  );
}

// Everything in the login backdrop is vector or CSS, so it stays sharp on any
// display and needs no network round-trip. Movement is transform/opacity only,
// and the whole thing is switched off under prefers-reduced-motion.
const backdropCoins = [
  { left: 6, size: 46, delay: 0, duration: 19, glyph: "$" },
  { left: 17, size: 30, delay: 4.5, duration: 23, glyph: "€" },
  { left: 30, size: 56, delay: 9, duration: 17, glyph: "£" },
  { left: 43, size: 34, delay: 2, duration: 25, glyph: "¥" },
  { left: 57, size: 44, delay: 12, duration: 20, glyph: "$" },
  { left: 69, size: 28, delay: 6.5, duration: 27, glyph: "₹" },
  { left: 81, size: 50, delay: 15, duration: 18, glyph: "$" },
  { left: 92, size: 32, delay: 8, duration: 24, glyph: "€" }
];

const skylineBuildings = [
  { x: 18, w: 78, h: 168 },
  { x: 106, w: 54, h: 232 },
  { x: 170, w: 96, h: 130 },
  { x: 276, w: 62, h: 196 },
  { x: 348, w: 122, h: 262 },
  { x: 480, w: 70, h: 148 },
  { x: 560, w: 88, h: 214 },
  { x: 658, w: 58, h: 166 },
  { x: 726, w: 104, h: 242 },
  { x: 840, w: 66, h: 146 },
  { x: 916, w: 92, h: 202 },
  { x: 1018, w: 60, h: 176 },
  { x: 1088, w: 94, h: 138 }
];

const SKYLINE_BASE = 300;

/** A few windows per tower that light up out of step with each other. */
const litWindows = skylineBuildings.flatMap((building, index) =>
  [0, 1].map((slot) => ({
    key: `${index}-${slot}`,
    x: building.x + 9 + ((index * 2 + slot * 3) % Math.max(1, Math.floor((building.w - 18) / 20))) * 20,
    y: SKYLINE_BASE - building.h + 18 + ((index + slot * 4) % Math.max(1, Math.floor((building.h - 30) / 26))) * 26,
    delay: ((index * 5 + slot * 11) % 17) * 0.6
  }))
);

function LoginBackdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <span className="backdrop-glow glow-teal" />
      <span className="backdrop-glow glow-gold" />

      <svg className="backdrop-grid" viewBox="0 0 120 120" preserveAspectRatio="none" focusable="false">
        <defs>
          <pattern id="qtb-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0v10" fill="none" stroke="currentColor" strokeWidth="0.2" />
          </pattern>
        </defs>
        <rect width="120" height="120" fill="url(#qtb-grid)" />
      </svg>

      <svg className="backdrop-vault" viewBox="0 0 200 200" focusable="false">
        <g className="vault-ring">
          <circle cx="100" cy="100" r="94" />
          <circle cx="100" cy="100" r="72" />
          <circle cx="100" cy="100" r="30" />
          {[22.5, 112.5, 202.5, 292.5].map((angle) => (
            <circle key={angle} className="vault-bolt" cx="100" cy="18" r="5" transform={`rotate(${angle} 100 100)`} />
          ))}
        </g>
        <g className="vault-spokes">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <rect key={angle} x="97.5" y="34" width="5" height="36" rx="2.5" transform={`rotate(${angle} 100 100)`} />
          ))}
        </g>
      </svg>

      <svg className="backdrop-chart" viewBox="0 0 620 200" preserveAspectRatio="none" focusable="false">
        <path className="chart-area" d="M0 168 L70 140 L140 152 L210 104 L280 122 L350 74 L420 92 L490 48 L560 62 L620 26 L620 200 L0 200 Z" />
        <path className="chart-line" d="M0 168 L70 140 L140 152 L210 104 L280 122 L350 74 L420 92 L490 48 L560 62 L620 26" />
      </svg>

      <span className="bank-card bank-card-a"><span className="bank-card-chip" /><span className="bank-card-line" /></span>
      <span className="bank-card bank-card-b"><span className="bank-card-chip" /><span className="bank-card-line" /></span>

      <span className="coin-layer">
        {backdropCoins.map((coin) => (
          <span
            key={`${coin.left}-${coin.glyph}`}
            className="coin"
            style={{ left: `${coin.left}%`, "--coin-size": `${coin.size}px`, "--coin-delay": `${coin.delay}s`, "--coin-duration": `${coin.duration}s` }}
          >
            {coin.glyph}
          </span>
        ))}
      </span>

      <svg className="backdrop-skyline" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <pattern id="qtb-windows" width="20" height="26" patternUnits="userSpaceOnUse">
            <rect x="9" y="10" width="8" height="11" rx="1.5" />
          </pattern>
        </defs>
        {skylineBuildings.map((building) => (
          <g key={building.x}>
            <rect className="tower" x={building.x} y={SKYLINE_BASE - building.h} width={building.w} height={building.h} rx="3" />
            <rect className="tower-windows" x={building.x} y={SKYLINE_BASE - building.h} width={building.w} height={building.h} rx="3" fill="url(#qtb-windows)" />
          </g>
        ))}
        {litWindows.map((window) => (
          <rect key={window.key} className="window-lit" x={window.x} y={window.y} width="8" height="11" rx="1.5" style={{ animationDelay: `${window.delay}s` }} />
        ))}
      </svg>
    </div>
  );
}

function LoginVisual() {
  return (
    <section className="login-visual">
      <LoginBackdrop />
      <div className="login-copy">
        <span className="login-kicker"><ShieldCheck size={17} /> QA-ready banking lab</span>
        <h1>QA's Trust Bank</h1>
        <p>Customer onboarding, approvals, funding, transfers, and ledger checks in one realistic practice app.</p>
        <div className="login-stats" aria-label="Demo workflow summary">
          <span><strong>4</strong> role journeys</span>
          <span><strong>15+</strong> testable screens</span>
          <span><strong>1</strong> shared database</span>
        </div>
      </div>
    </section>
  );
}

/**
 * Shown when the API is gated by BANKING_ACCESS_CODE. One shared code for the
 * whole team - it keeps strangers out of a public deployment, it is not per-user
 * authentication.
 */
function AccessGate({ onSubmit, error, busy }) {
  const [code, setCode] = useState("");

  return (
    <div className="login-screen">
      <LoginVisual />
      <section className="login-panel">
        <Brand />
        <div className="login-heading">
          <span className="login-eyebrow">Restricted</span>
          <h1>Team access code</h1>
          <p className="muted">This demo is shared by the QA team. Enter the access code to continue.</p>
        </div>
        <form className="grid" data-testid="access-gate-form" onSubmit={(event) => { event.preventDefault(); onSubmit(code); }}>
          <Field label="Access code">
            <input type="password" data-testid="access-code-input" value={code} onChange={(event) => setCode(event.target.value)} autoFocus />
          </Field>
          <button className="btn primary login-submit" data-testid="access-code-submit" disabled={busy}>{busy ? "Checking..." : "Continue"}</button>
          <p className="error" role="alert">{error}</p>
        </form>
        <div className="demo-users">
          <span className="muted">Ask whoever set up the deployment for the code. It is stored in this browser so you only enter it once.</span>
        </div>
      </section>
    </div>
  );
}

function LoginScreen({ data, onLogin }) {
  const [error, setError] = useState("");
  const [mode, setMode] = useState("staff");
  const [form, setForm] = useState({ username: "", password: "", accountId: "", dob: "" });

  function submit(event) {
    event.preventDefault();
    if (mode === "customer") {
      const accountId = form.accountId.trim();
      if (!accountId || !form.dob) {
        setError("Account ID and date of birth are required.");
        return;
      }
      const account = data.accounts.find((item) => item.accountNumber === accountId || item.customerId === accountId);
      if (!account) {
        setError("We could not find a matching account for that account ID.");
        return;
      }
      const profile =
        data.customers.find((item) => item.customerId === account.customerId && item.dob === form.dob) ||
        data.applications.find((item) => item.customerId === account.customerId && item.dob === form.dob);
      if (!profile) {
        setError("The account ID and date of birth did not match our records.");
        return;
      }
      onLogin(users.find((user) => user.role === "customer"), { accountNumber: account.accountNumber, customerId: account.customerId });
      return;
    }

    const found = users.find((user) => user.username === form.username.trim() && user.password === form.password);
    if (!found) {
      setError("Invalid username or password.");
      return;
    }
    onLogin(found);
  }

  return (
    <div className="login-screen">
      <LoginVisual />
      <section className="login-panel">
        <Brand />
        <div className="login-heading">
          <span className="login-eyebrow">Secure access</span>
          <h1>Sign in to operations</h1>
          <p className="muted">Use a seeded role to continue the banking workflow.</p>
        </div>
        <div className="login-mode-switch" role="tablist" aria-label="Sign in mode">
          <button type="button" className={`login-mode-button ${mode === "staff" ? "active" : ""}`} onClick={() => setMode("staff")}>Staff</button>
          <button type="button" className={`login-mode-button ${mode === "customer" ? "active" : ""}`} onClick={() => setMode("customer")}>Customer</button>
        </div>
        <form className="grid" data-testid="login-form" onSubmit={submit}>
          {mode === "customer" ? (
            <>
              <Field label="Account ID"><input data-testid="account-id-input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} /></Field>
              <Field label="Date of birth"><input data-testid="customer-dob-input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
            </>
          ) : (
            <>
              <Field label="Username"><input data-testid="username-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
              <Field label="Password"><input data-testid="password-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            </>
          )}
          <button className="btn primary login-submit" data-testid="login-button">Sign in</button>
          <p className="error" role="alert">{error}</p>
        </form>
        <div className="demo-users">
          <strong>Demo users</strong>
          {users.filter((user) => user.role !== "customer").map((user) => (
            <button key={user.username} className="demo-user" data-testid={`quick-login-${user.role}`} onClick={() => onLogin(user)}>
              <span>{user.label}</span><strong>{user.username}</strong>
            </button>
          ))}
          <span className="muted">Password for staff users: demo123</span>
        </div>
      </section>
    </div>
  );
}

function CurrentView(props) {
  if (props.view === "apply") return <ApplicationForm {...props} />;
  if (props.view === "myApplications") return <Applications {...props} onlyMine />;
  if (props.view === "applications") return <Applications {...props} />;
  if (props.view === "transfer") return <TransferFunds {...props} />;
  if (props.view === "closeAccount") return <CloseAccount {...props} />;
  if (props.view === "closures") return <ClosureRequests {...props} />;
  if (props.view === "funding") return <Funding {...props} />;
  if (props.view === "accounts") return <Accounts data={props.data} setSelectedAccountNumber={props.setSelectedAccountNumber} setView={props.setView} />;
  if (props.view === "transactions") return <Transactions {...props} />;
  if (props.view === "profile") return <Profile {...props} />;
  if (props.view === "audit") return <Audit audit={props.data.audit} />;
  return <Dashboard {...props} />;
}

function PageHead({ title, subtitle, children }) {
  return <div className="page-head"><div><h1>{title}</h1><p className="muted">{subtitle}</p></div>{children}</div>;
}

function Metric({ label, value, testId }) {
  return <article className="metric" data-testid={testId}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></article>;
}

function Dashboard(props) {
  const { user, data, setView, customerAccountNumber, setSelectedApplicationId } = props;
  if (user.role === "customer") return <CustomerDashboard user={user} data={data} customerAccountNumber={customerAccountNumber} />;
  if (user.role === "applicant") {
    const mine = data.applications.filter((app) => app.ownerUsername === user.username);
    return (
      <>
        <PageHead title="Applicant dashboard" subtitle="Submit a banking application and track its decision status.">
          <button className="btn primary" data-testid="start-application" onClick={() => setView("apply")}><Plus size={17} /> New application</button>
        </PageHead>
        <section className="grid three">
          <Metric label="My applications" value={mine.length} testId="my-app-count" />
          <Metric label="Submitted" value={mine.filter((app) => app.status === "Submitted").length} testId="my-submitted-count" />
          <Metric label="Approved" value={mine.filter((app) => app.status === "Approved").length} testId="my-approved-count" />
        </section>
        <section className="panel stack-top"><h2>My recent applications</h2><ApplicationsTable applications={mine} onOpen={setSelectedApplicationId} /></section>
        <ApplicationDetailDialog {...props} />
      </>
    );
  }
  const pending = data.applications.filter((app) => ["Submitted", "Under Review"].includes(app.status)).length;
  const pendingClosures = data.closureRequests.filter((request) => ["Submitted", "Under Review", "Needs More Info"].includes(request.status)).length;
  return (
    <>
      <PageHead title={user.role === "reviewer" ? "Review queue" : user.role === "teller" ? "Teller operations" : "Control center"} subtitle="Operational snapshot for today's demo banking work." />
      <section className="grid three">
        <Metric label="Pending review" value={pending} testId="pending-review-count" />
        <Metric label="Approved applications" value={data.applications.filter((app) => app.status === "Approved").length} testId="approved-count" />
        <Metric label="Total balances" value={money(data.accounts.reduce((sum, account) => sum + account.currentBalance, 0))} testId="balance-count" />
      </section>
      {user.role !== "teller" && (
        <section className="grid three stack-top">
          <Metric label="Open closure requests" value={pendingClosures} testId="pending-closure-count" />
          <Metric label="Closed accounts" value={data.accounts.filter((account) => account.status === "Closed").length} testId="closed-account-count" />
          <Metric label="Registered customers" value={data.customers.length} testId="customer-count" />
        </section>
      )}
      <section className="panel stack-top">
        <h2>Recent activity</h2>
        <AuditList audit={data.audit.slice(-5).reverse()} />
      </section>
    </>
  );
}

function CustomerDashboard({ user, data, customerAccountNumber }) {
  const accounts = ownedAccounts(data, user, customerAccountNumber);
  const accountNumbers = accounts.map((account) => account.accountNumber);
  return (
    <>
      <PageHead title="Account dashboard" subtitle="Balances and recent transaction activity for the account holder." />
      <section className="grid two">{accounts.map((account) => <AccountCard key={account.accountNumber} account={account} />)}</section>
      <section className="panel stack-top"><h2>Recent transactions</h2><TransactionsTable transactions={data.transactions.filter((txn) => accountNumbers.includes(txn.accountNumber)).slice(-6).reverse()} /></section>
    </>
  );
}

function AccountCard({ account }) {
  return (
    <article className="account-card" data-testid={`account-card-${account.accountNumber}`}>
      <div className="account-number">{account.accountType} - **** {account.accountNumber.slice(-4)}</div>
      <div className="balance" data-testid={`balance-${account.accountNumber}`}>{money(account.currentBalance)}</div>
      <div className="muted">Available {money(account.availableBalance)} - {account.branch} branch</div>
      <div className="stack-small"><Status value={account.status} /></div>
    </article>
  );
}

function ApplicationForm({ user, data, apply, setView, setSelectedApplicationId, notify, setModal }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    const validation = validateApplication(form, data.applications);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      const result = await api.createApplication(form, { username: user.username, name: user.name });
      apply(result.state);
      setError("");
      setSelectedApplicationId(result.id);
      setView("myApplications");
      setModal({
        title: "Application submitted",
        body: `Your application ${result.id} has been received and is now under review.`,
        confirmText: "Continue",
        testId: "application-submitted-modal",
        onConfirm: () => setModal(null)
      });
      notify(`Application ${result.id} submitted.`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="New customer application" subtitle="Capture identity, profile, account request, and opening deposit details." />
      <form className="panel" data-testid="application-form" onSubmit={submit}>
        <div className="form-hint">Required fields are marked with <span className="required-marker">*</span>.</div>
        <h2>Customer details</h2>
        <div className="form-grid">
          <FormInput label="First name" required testId="first-name-input" value={form.firstName} onChange={(v) => set("firstName", v)} />
          <FormInput label="Last name" required testId="last-name-input" value={form.lastName} onChange={(v) => set("lastName", v)} />
          <FormInput label="Date of birth" required type="date" testId="dob-input" value={form.dob} onChange={(v) => set("dob", v)} />
          <FormSelect label="Gender" required options={["Female", "Male", "Non-binary", "Prefer not to say"]} testId="gender-select" value={form.gender} onChange={(v) => set("gender", v)} />
          <FormInput label="Email" required testId="email-input" value={form.email} onChange={(v) => set("email", v)} />
          <FormInput label="Mobile number" required testId="mobile-input" value={form.mobile} onChange={(v) => set("mobile", v)} />
          <FormInput className="span-2" label="Address" required testId="address-input" value={form.address} onChange={(v) => set("address", v)} />
          <FormInput label="City" required testId="city-input" value={form.city} onChange={(v) => set("city", v)} />
          <FormInput label="State" required testId="state-input" value={form.state} onChange={(v) => set("state", v)} />
          <FormInput label="ZIP" required testId="zip-input" value={form.zip} onChange={(v) => set("zip", v)} />
        </div>
        <h2 className="stack-top">Identity and employment</h2>
        <div className="form-grid">
          <FormInput label="National ID / SSN" required testId="national-id-input" value={form.nationalId} onChange={(v) => set("nationalId", v)} />
          <FormSelect label="ID document type" required options={["Driver License", "Passport", "State ID"]} testId="id-type-select" value={form.idType} onChange={(v) => set("idType", v)} />
          <FormInput label="ID number" required testId="id-number-input" value={form.idNumber} onChange={(v) => set("idNumber", v)} />
          <FormInput label="Occupation" required testId="occupation-input" value={form.occupation} onChange={(v) => set("occupation", v)} />
          <FormInput label="Employer" required testId="employer-input" value={form.employer} onChange={(v) => set("employer", v)} />
          <FormInput label="Annual income" required type="number" testId="income-input" value={form.income} onChange={(v) => set("income", v)} />
        </div>
        <h2 className="stack-top">Account request</h2>
        <div className="form-grid">
          <FormSelect label="Account type" required options={accountTypes} testId="account-type-select" value={form.accountType} onChange={(v) => set("accountType", v)} />
          <FormInput label="Initial deposit" required type="number" testId="initial-deposit-input" value={form.initialDeposit} onChange={(v) => set("initialDeposit", v)} />
          <FormSelect label="Branch" required options={branches} testId="branch-select" value={form.branch} onChange={(v) => set("branch", v)} />
          <FormInput className="span-2" label="Document upload" testId="document-upload-input" value={form.documents} onChange={(v) => set("documents", v)} />
          <label className="checkbox-row span-3"><input type="checkbox" data-testid="terms-checkbox" checked={Boolean(form.terms)} onChange={(e) => set("terms", e.target.checked)} /> I confirm the customer details are accurate. <span className="required-marker">*</span></label>
        </div>
        <p className="error" role="alert">{error}</p>
        <div className="actions"><button type="button" className="btn secondary" data-testid="clear-application" onClick={() => setForm({})}>Clear</button><button className="btn primary" data-testid="submit-application" disabled={busy}>{busy ? "Submitting..." : "Submit application"}</button></div>
      </form>
    </>
  );
}

function Applications(props) {
  const { user, data, filters, setFilters, onlyMine, selectedApplicationId, setSelectedApplicationId } = props;
  const visible = useMemo(() => {
    const term = filters.search.toLowerCase();
    return data.applications
      .filter((app) => !onlyMine || app.ownerUsername === user.username)
      .filter((app) => filters.status === "All" || app.status === filters.status)
      .filter((app) => !term || `${app.id} ${app.firstName} ${app.lastName} ${app.email} ${app.mobile} ${app.accountNumber}`.toLowerCase().includes(term))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }, [data.applications, filters, onlyMine, user.username]);

  return (
    <>
      <PageHead title={onlyMine ? "My applications" : "Applications"} subtitle="Search, filter, review, approve, reject, or request more information." />
      <section className="panel">
        <ListFilters filters={filters} setFilters={setFilters} statuses={["All", "Submitted", "Under Review", "Approved", "Rejected", "Needs More Info"]} />
        <ApplicationsTable applications={visible} onOpen={setSelectedApplicationId} />
      </section>
      <ApplicationDetailDialog {...props} />
    </>
  );
}

function ListFilters({ filters, setFilters, statuses, testId = "status-filter" }) {
  return (
    <div className="toolbar">
      <div className="filters">
        <Field label="Search"><input data-testid="search-input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></Field>
        <Field label="Status"><select data-testid={testId} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
      </div>
      <button className="btn secondary" data-testid="clear-filters" onClick={() => setFilters({ ...filters, search: "", status: "All" })}>Clear filters</button>
    </div>
  );
}

function ApplicationsTable({ applications, onOpen }) {
  if (!applications.length) return <div className="empty" data-testid="empty-applications">No applications match the current view.</div>;
  return (
    <div className="table-wrap">
      <table data-testid="applications-table">
        <thead><tr><th>Application</th><th>Customer</th><th>Account type</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{applications.map((app) => (
          <tr key={app.id} data-testid={`application-row-${app.id}`}>
            <td><strong>{app.id}</strong><br /><span className="muted">{app.email}</span></td>
            <td>{app.firstName} {app.lastName}<br /><span className="muted">{app.mobile}</span></td>
            <td>{app.accountType}<br /><span className="muted">{money(app.initialDeposit)} requested</span></td>
            <td>{dateTime(app.submittedAt)}</td>
            <td><Status value={app.status} /></td>
            <td><button className="btn secondary" data-testid={`view-application-${app.id}`} onClick={() => onOpen(app.id)}>Open</button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function ApplicationDetail({ user, apply, application, setModal, setSelectedApplicationId, notify }) {
  const [comments, setComments] = useState(application.reviewerComments || "");
  const [error, setError] = useState("");
  const canReview = ["reviewer", "admin"].includes(user.role) && !["Approved", "Rejected"].includes(application.status);

  function decide(decision) {
    if (["Rejected", "Needs More Info"].includes(decision) && !comments.trim()) {
      setError("Comments are required for this decision.");
      return;
    }
    setModal({
      title: `${decision} application`,
      body: `Confirm ${decision.toLowerCase()} for application ${application.id}.`,
      confirmText: decision,
      onConfirm: async () => {
        try {
          const result = await api.decideApplication(application.id, decision, comments, user.name);
          apply(result.state);
          setError("");
          setSelectedApplicationId(application.id);
          setModal(null);
          notify(`Application ${application.id} ${decision.toLowerCase()}.`);
        } catch (decisionError) {
          setModal(null);
          setError(decisionError.message);
        }
      }
    });
  }

  return (
    <div data-testid="application-detail">
      <div className="detail-list">
        <Detail label="Status" value={application.status} />
        <Detail label="Email" value={application.email} />
        <Detail label="Mobile" value={application.mobile} />
        <Detail label="DOB" value={application.dob} />
        <Detail label="Address" value={`${application.address}, ${application.city}, ${application.state} ${application.zip}`} />
        <Detail label="ID" value={`${application.idType} - ${application.idNumber}`} />
        <Detail label="National ID" value={application.nationalId} />
        <Detail label="Employment" value={`${application.occupation} at ${application.employer}`} />
        <Detail label="Income" value={money(application.income)} />
        <Detail label="Account request" value={`${application.accountType} - ${application.branch}`} />
        <Detail label="Initial deposit" value={money(application.initialDeposit)} />
        <Detail label="Documents" value={application.documents} />
        <Detail label="Account number" value={application.accountNumber || "Not created"} />
      </div>
      {canReview ? (
        <div className="grid stack-top" data-testid="review-form">
          <Field label="Reviewer comments"><textarea data-testid="review-comments" value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
          <p className="error">{error}</p>
          <div className="actions">
            <button className="btn secondary" data-testid="needs-info-button" onClick={() => decide("Needs More Info")}>Request info</button>
            <button className="btn danger" data-testid="reject-button" onClick={() => decide("Rejected")}><XCircle size={17} /> Reject</button>
            <button className="btn success" data-testid="approve-button" onClick={() => decide("Approved")}><CheckCircle2 size={17} /> Approve</button>
          </div>
        </div>
      ) : <p className="muted stack-top">Reviewer comments: {application.reviewerComments || "None"}</p>}
    </div>
  );
}

const emptyTransfer = { transferType: "Same bank", toAccountNumber: "", beneficiaryName: "", bankName: "", routingNumber: "", amount: "", description: "", confirm: false };

function TransferFunds({ user, data, apply, customerAccountNumber, notify, setModal }) {
  const accounts = ownedAccounts(data, user, customerAccountNumber);
  const usable = accounts.filter((account) => account.status !== "Closed");
  const [fromAccountNumber, setFromAccountNumber] = useState(usable[0]?.accountNumber || "");
  const [form, setForm] = useState(emptyTransfer);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const selectedNumber = usable.some((item) => item.accountNumber === fromAccountNumber) ? fromAccountNumber : usable[0]?.accountNumber || "";
  const account = data.accounts.find((item) => item.accountNumber === selectedNumber);
  const sameBank = form.transferType === "Same bank";

  const accountNumbers = accounts.map((item) => item.accountNumber);
  const myTransfers = data.transfers
    .filter((transfer) => accountNumbers.includes(transfer.fromAccountNumber) || accountNumbers.includes(transfer.toAccountNumber))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function submit(event) {
    event.preventDefault();
    const payload = { ...form, fromAccountNumber: selectedNumber, amount: Number(form.amount) };
    const validation = validateTransfer(payload, account, data.accounts);
    if (validation) {
      setError(validation);
      return;
    }
    setModal({
      title: "Confirm transfer",
      body: `Send ${money(payload.amount)} from account ${selectedNumber} to ${sameBank ? `account ${payload.toAccountNumber} at this bank` : `${payload.beneficiaryName} (${payload.bankName}, account ${payload.toAccountNumber})`}. This cannot be undone.`,
      confirmText: "Send transfer",
      testId: "transfer-confirm-modal",
      onConfirm: async () => {
        setBusy(true);
        try {
          const result = await api.createTransfer(payload, { username: user.username, name: user.name });
          apply(result.state);
          setError("");
          setForm(emptyTransfer);
          setModal({
            title: "Transfer sent",
            body: `Transfer ${result.id} of ${money(payload.amount)} completed.${sameBank ? "" : " Funds sent to another bank can take up to two working days to arrive."}`,
            confirmText: "Done",
            testId: "transfer-sent-modal",
            onConfirm: () => setModal(null)
          });
          notify(`Transfer ${result.id} completed.`);
        } catch (transferError) {
          setModal(null);
          setError(transferError.message);
        } finally {
          setBusy(false);
        }
      }
    });
  }

  return (
    <>
      <PageHead title="Transfer funds" subtitle="Move money to another account at this bank, or out to an account at a different bank." />
      {usable.length ? (
        <form className="panel" data-testid="transfer-form" onSubmit={submit}>
          <div className="form-hint">Required fields are marked with <span className="required-marker">*</span>.</div>
          <h2>From</h2>
          <div className="form-grid">
            <FormSelect label="Account" required options={usable.map((item) => item.accountNumber)} testId="transfer-from-select" value={selectedNumber} onChange={setFromAccountNumber} />
            <Detail label="Available balance" value={account ? money(account.availableBalance) : "-"} />
            <Detail label="Account status" value={account ? account.status : "-"} />
          </div>
          <h2 className="stack-top">To</h2>
          <div className="form-grid">
            <FormSelect label="Destination" required options={transferTypes} testId="transfer-type-select" value={form.transferType} onChange={(v) => set("transferType", v)} />
            <FormInput label={sameBank ? "Account number at this bank" : "Account number"} required testId="transfer-to-input" value={form.toAccountNumber} onChange={(v) => set("toAccountNumber", v)} />
            {sameBank ? null : (
              <>
                <FormInput label="Beneficiary name" required testId="transfer-beneficiary-input" value={form.beneficiaryName} onChange={(v) => set("beneficiaryName", v)} />
                <FormInput label="Bank name" required testId="transfer-bank-input" value={form.bankName} onChange={(v) => set("bankName", v)} />
                <FormInput label="Routing / IFSC code" required testId="transfer-routing-input" value={form.routingNumber} onChange={(v) => set("routingNumber", v)} />
              </>
            )}
          </div>
          <h2 className="stack-top">Amount</h2>
          <div className="form-grid">
            <FormInput label="Amount" required type="number" testId="transfer-amount-input" value={form.amount} onChange={(v) => set("amount", v)} />
            <FormInput className="span-2" label="Reference for the recipient" testId="transfer-description-input" value={form.description} onChange={(v) => set("description", v)} />
            <label className="checkbox-row span-3"><input type="checkbox" data-testid="transfer-confirm-checkbox" checked={Boolean(form.confirm)} onChange={(e) => set("confirm", e.target.checked)} /> I have checked the destination details are correct. <span className="required-marker">*</span></label>
          </div>
          <p className="error" role="alert">{error}</p>
          <div className="actions">
            <button type="button" className="btn secondary" data-testid="clear-transfer" onClick={() => { setForm(emptyTransfer); setError(""); }}>Clear</button>
            <button className="btn primary" data-testid="submit-transfer" disabled={busy}><ArrowLeftRight size={17} /> {busy ? "Sending..." : "Send transfer"}</button>
          </div>
        </form>
      ) : (
        <section className="panel"><div className="empty" data-testid="no-transfer-accounts">You have no open accounts available to transfer from.</div></section>
      )}
      <section className="panel stack-top">
        <h2>Recent transfers</h2>
        <TransfersTable transfers={myTransfers} />
      </section>
    </>
  );
}

function TransfersTable({ transfers }) {
  if (!transfers.length) return <div className="empty" data-testid="empty-transfers">No transfers yet.</div>;
  return (
    <div className="table-wrap">
      <table data-testid="transfers-table">
        <thead><tr><th>Reference</th><th>From</th><th>To</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>{transfers.map((transfer) => (
          <tr key={transfer.id} data-testid={`transfer-row-${transfer.id}`}>
            <td><strong>{transfer.id}</strong><br /><span className="muted">{transfer.transferType}</span></td>
            <td>{transfer.fromAccountNumber}</td>
            <td>{transfer.toAccountNumber}<br /><span className="muted">{transfer.beneficiaryName ? `${transfer.beneficiaryName} - ${transfer.bankName}` : transfer.bankName}</span></td>
            <td>{money(transfer.amount)}</td>
            <td><Status value={transfer.status} /></td>
            <td>{dateTime(transfer.createdAt)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function CloseAccount({ user, data, apply, customerAccountNumber, notify, setModal }) {
  const accounts = ownedAccounts(data, user, customerAccountNumber);
  const closable = accounts.filter((account) => account.status !== "Closed");
  const [form, setForm] = useState({ accountNumber: closable[0]?.accountNumber || "", reason: "", details: "", payoutMethod: "", payoutReference: "", confirm: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const accountNumbers = accounts.map((account) => account.accountNumber);
  const myRequests = data.closureRequests.filter((request) => accountNumbers.includes(request.accountNumber)).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  // Once a request is approved the selected account disappears from `closable`,
  // so fall back to the first one still open rather than holding a stale number.
  const selectedNumber = closable.some((item) => item.accountNumber === form.accountNumber) ? form.accountNumber : closable[0]?.accountNumber || "";
  const account = data.accounts.find((item) => item.accountNumber === selectedNumber);

  function submit(event) {
    event.preventDefault();
    const payload = { ...form, accountNumber: selectedNumber };
    const validation = validateClosureRequest(payload, account, data.closureRequests);
    if (validation) {
      setError(validation);
      return;
    }
    setModal({
      title: "Submit account closure request?",
      body: `Account ${account.accountNumber} holds ${money(account.currentBalance)}. Once a reviewer approves this request the balance is paid out via ${form.payoutMethod.toLowerCase()} and the account is permanently closed.`,
      confirmText: "Submit request",
      testId: "closure-confirm-modal",
      onConfirm: async () => {
        setBusy(true);
        try {
          const result = await api.createClosureRequest(payload, { username: user.username, name: user.name });
          apply(result.state);
          setError("");
          setForm({ accountNumber: selectedNumber, reason: "", details: "", payoutMethod: "", payoutReference: "", confirm: false });
          setModal({
            title: "Closure request submitted",
            body: `Request ${result.id} has been sent for review. Your account stays open and usable until a reviewer approves it.`,
            confirmText: "Continue",
            testId: "closure-submitted-modal",
            onConfirm: () => setModal(null)
          });
          notify(`Closure request ${result.id} submitted.`);
        } catch (submitError) {
          setModal(null);
          setError(submitError.message);
        } finally {
          setBusy(false);
        }
      }
    });
  }

  return (
    <>
      <PageHead title="Close an account" subtitle="Raise a closure request for review. Approved requests pay out the balance and close the account." />
      {closable.length ? (
        <form className="panel" data-testid="closure-form" onSubmit={submit}>
          <div className="form-hint">Required fields are marked with <span className="required-marker">*</span>.</div>
          <h2>Account to close</h2>
          <div className="form-grid">
            <FormSelect label="Account" required options={closable.map((item) => item.accountNumber)} testId="closure-account-select" value={selectedNumber} onChange={(v) => set("accountNumber", v)} />
            <Detail label="Current balance" value={account ? money(account.currentBalance) : "-"} />
            <Detail label="Account status" value={account ? account.status : "-"} />
          </div>
          <h2 className="stack-top">Reason for closing</h2>
          <div className="form-grid">
            <FormSelect label="Reason" required options={closureReasons} testId="closure-reason-select" value={form.reason} onChange={(v) => set("reason", v)} />
            <div className="field span-2">
              <label>Additional details{form.reason === "Other" ? <span className="required-marker">*</span> : null}</label>
              <textarea data-testid="closure-details" value={form.details} onChange={(e) => set("details", e.target.value)} />
            </div>
          </div>
          <h2 className="stack-top">Remaining balance payout</h2>
          <div className="form-grid">
            <FormSelect label="Payout method" required options={payoutMethods} testId="closure-payout-select" value={form.payoutMethod} onChange={(v) => set("payoutMethod", v)} />
            <FormInput label="Destination account number" required={form.payoutMethod === "Transfer to another bank account"} testId="closure-payout-reference" value={form.payoutReference} onChange={(v) => set("payoutReference", v)} />
            <label className="checkbox-row span-3"><input type="checkbox" data-testid="closure-confirm-checkbox" checked={Boolean(form.confirm)} onChange={(e) => set("confirm", e.target.checked)} /> I understand this closes the account permanently once approved. <span className="required-marker">*</span></label>
          </div>
          <p className="error" role="alert">{error}</p>
          <div className="actions">
            <button type="button" className="btn secondary" data-testid="clear-closure" onClick={() => setForm({ accountNumber: selectedNumber, reason: "", details: "", payoutMethod: "", payoutReference: "", confirm: false })}>Clear</button>
            <button className="btn danger" data-testid="submit-closure" disabled={busy}><Ban size={17} /> {busy ? "Submitting..." : "Request account closure"}</button>
          </div>
        </form>
      ) : (
        <section className="panel"><div className="empty" data-testid="no-closable-accounts">You have no open accounts available to close.</div></section>
      )}
      <section className="panel stack-top">
        <h2>My closure requests</h2>
        <ClosureRequestsTable requests={myRequests} />
      </section>
    </>
  );
}

function ClosureRequests(props) {
  const { data, filters, setFilters, selectedClosureId, setSelectedClosureId } = props;
  const visible = useMemo(() => {
    const term = filters.search.toLowerCase();
    return data.closureRequests
      .filter((request) => filters.status === "All" || request.status === filters.status)
      .filter((request) => !term || `${request.id} ${request.accountNumber} ${request.customerId} ${request.accountHolder} ${request.reason}`.toLowerCase().includes(term))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }, [data.closureRequests, filters]);

  return (
    <>
      <PageHead title="Account closure requests" subtitle="Review customer requests to close an account, then approve, reject, or ask for more information." />
      <section className="panel">
        <ListFilters filters={filters} setFilters={setFilters} statuses={["All", "Submitted", "Under Review", "Approved", "Rejected", "Needs More Info"]} testId="closure-status-filter" />
        <ClosureRequestsTable requests={visible} onOpen={setSelectedClosureId} />
      </section>
      <ClosureRequestDetailDialog {...props} />
    </>
  );
}

function ClosureRequestsTable({ requests, onOpen }) {
  if (!requests.length) return <div className="empty" data-testid="empty-closures">No closure requests match the current view.</div>;
  return (
    <div className="table-wrap">
      <table data-testid="closures-table">
        <thead><tr><th>Request</th><th>Account</th><th>Reason</th><th>Submitted</th><th>Status</th>{onOpen ? <th>Action</th> : null}</tr></thead>
        <tbody>{requests.map((request) => (
          <tr key={request.id} data-testid={`closure-row-${request.id}`}>
            <td><strong>{request.id}</strong><br /><span className="muted">{request.accountHolder || request.customerId}</span></td>
            <td>{request.accountNumber}<br /><span className="muted">{money(request.closingBalance)} at request</span></td>
            <td>{request.reason}<br /><span className="muted">{request.payoutMethod}</span></td>
            <td>{dateTime(request.submittedAt)}</td>
            <td><Status value={request.status} /></td>
            {onOpen ? <td><button className="btn secondary" data-testid={`view-closure-${request.id}`} onClick={() => onOpen(request.id)}>Open</button></td> : null}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function ClosureRequestDetail({ user, data, apply, request, setModal, setSelectedClosureId, notify }) {
  const [comments, setComments] = useState(request.reviewerComments || "");
  const [error, setError] = useState("");
  const account = data.accounts.find((item) => item.accountNumber === request.accountNumber);
  const canReview = ["reviewer", "admin"].includes(user.role) && ["Submitted", "Under Review", "Needs More Info"].includes(request.status);

  function decide(decision) {
    if (["Rejected", "Needs More Info"].includes(decision) && !comments.trim()) {
      setError("Comments are required for this decision.");
      return;
    }
    setModal({
      title: `${decision} closure request`,
      body: decision === "Approved"
        ? `Approving closes account ${request.accountNumber} permanently and pays out ${money(account?.currentBalance || 0)} via ${request.payoutMethod.toLowerCase()}.`
        : `Confirm ${decision.toLowerCase()} for closure request ${request.id}.`,
      confirmText: decision,
      testId: "closure-decision-modal",
      onConfirm: async () => {
        try {
          const result = await api.decideClosureRequest(request.id, decision, comments, user.name);
          apply(result.state);
          setError("");
          setSelectedClosureId(request.id);
          setModal(null);
          notify(`Closure request ${request.id} ${decision.toLowerCase()}.`);
        } catch (decisionError) {
          setModal(null);
          setError(decisionError.message);
        }
      }
    });
  }

  return (
    <div data-testid="closure-detail">
      <div className="detail-list">
        <Detail label="Account holder" value={request.accountHolder || "-"} />
        <Detail label="Customer ID" value={request.customerId || "-"} />
        <Detail label="Account type" value={account ? `${account.accountType} - ${account.branch}` : "-"} />
        <Detail label="Account status" value={account ? account.status : "-"} />
        <Detail label="Current balance" value={money(account?.currentBalance || 0)} />
        <Detail label="Balance at request" value={money(request.closingBalance)} />
        <Detail label="Reason" value={request.reason} />
        <Detail label="Additional details" value={request.details || "None"} />
        <Detail label="Payout method" value={request.payoutMethod} />
        <Detail label="Payout reference" value={request.payoutReference || "-"} />
        <Detail label="Submitted" value={dateTime(request.submittedAt)} />
        <Detail label="Decision" value={request.decisionAt ? `${request.status} - ${dateTime(request.decisionAt)}` : "Pending"} />
        <Detail label="Payout transaction" value={request.payoutTransactionId || "-"} />
        <Detail label="Reviewer" value={request.reviewer || "-"} />
      </div>
      {canReview ? (
        <div className="grid stack-top" data-testid="closure-review-form">
          <Field label="Reviewer comments"><textarea data-testid="closure-review-comments" value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
          <p className="error">{error}</p>
          <div className="actions">
            <button className="btn secondary" data-testid="closure-needs-info-button" onClick={() => decide("Needs More Info")}>Request info</button>
            <button className="btn danger" data-testid="closure-reject-button" onClick={() => decide("Rejected")}><XCircle size={17} /> Reject</button>
            <button className="btn success" data-testid="closure-approve-button" onClick={() => decide("Approved")}><CheckCircle2 size={17} /> Approve and close</button>
          </div>
        </div>
      ) : <p className="muted stack-top">Reviewer comments: {request.reviewerComments || "None"}</p>}
    </div>
  );
}

function Funding({ data, apply, selectedAccountNumber, setSelectedAccountNumber, notify, filters, setFilters }) {
  const [form, setForm] = useState({ type: "", amount: "", description: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const term = filters.search.toLowerCase();
  const accounts = data.accounts.filter((account) => {
    const customer = data.customers.find((item) => item.customerId === account.customerId);
    return !term || `${account.accountNumber} ${account.customerId} ${customer?.firstName || ""} ${customer?.lastName || ""}`.toLowerCase().includes(term);
  });
  const account = data.accounts.find((item) => item.accountNumber === selectedAccountNumber) || data.accounts[0];

  async function submit(event) {
    event.preventDefault();
    if (!account) return setError("Select a valid account.");
    setBusy(true);
    try {
      const result = await api.postTransaction({
        accountNumber: account.accountNumber,
        type: form.type,
        amount: form.amount,
        description: form.description,
        createdBy: "Teller"
      });
      apply(result.state);
      setError("");
      setSelectedAccountNumber(account.accountNumber);
      setForm({ type: "", amount: "", description: "" });
      notify(`Transaction ${result.transaction.id} posted.`);
    } catch (postError) {
      setError(postError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Fund account" subtitle="Search an approved account and post teller transactions." />
      <section className="grid two">
        <div className="panel">
          <h2>Find account</h2>
          <Field label="Account number or customer"><input data-testid="account-search-input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="8001200101 or Priya" /></Field>
          <div className="stack-top"><AccountsTable data={data} accounts={accounts} onSelect={setSelectedAccountNumber} /></div>
        </div>
        <div className="panel">
          <h2>Post transaction</h2>
          {account ? (
            <>
              <AccountCard account={account} />
              <form className="grid stack-top" data-testid="fund-form" onSubmit={submit}>
                <FormSelect label="Transaction type" options={tellerTransactionTypes} testId="transaction-type-select" value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
                <FormInput label="Amount" type="number" testId="amount-input" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
                <Field label="Description"><textarea data-testid="transaction-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                <p className="error">{error}</p>
                <button className="btn primary" data-testid="post-transaction" disabled={busy}><Banknote size={17} /> {busy ? "Posting..." : "Post transaction"}</button>
              </form>
            </>
          ) : <div className="empty">Select an account to continue.</div>}
        </div>
      </section>
    </>
  );
}

function Accounts({ data, setSelectedAccountNumber, setView }) {
  return <><PageHead title="Accounts" subtitle="Active customer accounts created from approved applications." /><section className="panel"><AccountsTable data={data} accounts={data.accounts} onSelect={(accountNumber) => { setSelectedAccountNumber(accountNumber); setView("funding"); }} /></section></>;
}

function AccountsTable({ data, accounts, onSelect }) {
  if (!accounts.length) return <div className="empty">No accounts found.</div>;
  return (
    <div className="table-wrap">
      <table data-testid="accounts-table">
        <thead><tr><th>Account</th><th>Customer</th><th>Status</th><th>Balance</th><th>Action</th></tr></thead>
        <tbody>{accounts.map((account) => {
          const customer = data.customers.find((item) => item.customerId === account.customerId);
          return (
            <tr key={account.accountNumber} data-testid={`account-row-${account.accountNumber}`}>
              <td><strong>{account.accountNumber}</strong><br /><span className="muted">{account.accountType} - {account.branch}</span></td>
              <td>{customer ? `${customer.firstName} ${customer.lastName}` : account.customerId}<br /><span className="muted">{account.customerId}</span></td>
              <td><Status value={account.status} /></td>
              <td>{money(account.currentBalance)}</td>
              <td><button className="btn secondary" data-testid={`select-account-${account.accountNumber}`} onClick={() => onSelect(account.accountNumber)}>Select</button></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function Transactions({ user, data, filters, setFilters, customerAccountNumber }) {
  const accountNumbers = user.role === "customer" ? ownedAccounts(data, user, customerAccountNumber).map((account) => account.accountNumber) : null;
  const visible = data.transactions
    .filter((txn) => !accountNumbers || accountNumbers.includes(txn.accountNumber))
    .filter((txn) => filters.transactionType === "All" || txn.type === filters.transactionType)
    .filter((txn) => !filters.search || `${txn.id} ${txn.accountNumber} ${txn.type} ${txn.description}`.toLowerCase().includes(filters.search.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <>
      <PageHead title="Transactions" subtitle="Search and verify ledger activity by account, type, amount, or reference." />
      <section className="panel">
        <div className="toolbar">
          <div className="filters">
            <Field label="Search"><input data-testid="transaction-search-input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></Field>
            <Field label="Type"><select data-testid="transaction-type-filter" value={filters.transactionType} onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}>{["All", ...transactionTypes].map((type) => <option key={type}>{type}</option>)}</select></Field>
          </div>
          <button className="btn secondary" data-testid="clear-transaction-filters" onClick={() => setFilters({ ...filters, search: "", transactionType: "All" })}>Clear filters</button>
        </div>
        <TransactionsTable transactions={visible} />
      </section>
    </>
  );
}

function TransactionsTable({ transactions }) {
  if (!transactions.length) return <div className="empty" data-testid="empty-transactions">No transactions found.</div>;
  return (
    <div className="table-wrap">
      <table data-testid="transactions-table">
        <thead><tr><th>Reference</th><th>Account</th><th>Type</th><th>Amount</th><th>Balance after</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>{transactions.map((txn) => (
          <tr key={txn.id} data-testid={`transaction-row-${txn.id}`}>
            <td><strong>{txn.id}</strong><br /><span className="muted">{txn.description}</span></td>
            <td>{txn.accountNumber}</td>
            <td>{txn.direction} - {txn.type}</td>
            <td>{money(txn.amount)}</td>
            <td>{money(txn.balanceAfter)}</td>
            <td><Status value={txn.status} /></td>
            <td>{dateTime(txn.createdAt)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Profile({ user, data, customerAccountNumber }) {
  const profile = findCustomerProfile(data, user, customerAccountNumber);
  const fullName = profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : user.name || "Customer";

  return (
    <>
      <PageHead title="Profile" subtitle="Customer information captured during onboarding." />
      <section className="panel">{profile ? <div className="detail-list">
        <Detail label="Name" value={fullName} />
        <Detail label="Email" value={profile.email} />
        <Detail label="Mobile" value={profile.mobile} />
        <Detail label="Address" value={`${profile.address}, ${profile.city}, ${profile.state} ${profile.zip}`} />
        <Detail label="Customer ID" value={profile.customerId || "-"} />
        <Detail label="Identity" value={`${profile.idType} - ${profile.idNumber}`} />
      </div> : <div className="empty">No profile found.</div>}</section>
    </>
  );
}

function Audit({ audit }) {
  return <><PageHead title="Audit trail" subtitle="Chronological record of submissions, decisions, account creation, and transactions." /><section className="panel"><AuditList audit={[...audit].reverse()} /></section></>;
}

function AuditList({ audit }) {
  if (!audit.length) return <div className="empty">No audit events found.</div>;
  return <div className="audit" data-testid="audit-list">{audit.map((item, index) => <div className="audit-entry" key={`${item.at}-${index}`}><strong>{item.action}</strong><span className="muted">{item.actor} - {dateTime(item.at)}</span></div>)}</div>;
}

function Status({ value }) {
  return <span className={`status ${statusClass(value)}`}>{value}</span>;
}

function Detail({ label, value }) {
  return <div className="detail-item"><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>;
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function FormInput({ label, type = "text", value = "", onChange, testId, className = "", required = false }) {
  return <div className={`field ${className}`}><label>{label}{required ? <span className="required-marker">*</span> : null}</label><input type={type} value={value || ""} data-testid={testId} onChange={(e) => onChange(e.target.value)} required={required} /></div>;
}

function FormSelect({ label, options, value = "", onChange, testId, className = "", required = false }) {
  return <div className={`field ${className}`}><label>{label}{required ? <span className="required-marker">*</span> : null}</label><select value={value || ""} data-testid={testId} onChange={(e) => onChange(e.target.value)} required={required}><option value="">Select</option>{options.map((option) => <option key={option}>{option}</option>)}</select></div>;
}

/**
 * Popup shell for record details. `blocked` is set while a confirmation dialog
 * sits on top, so Escape closes that one first rather than yanking this away
 * from underneath it.
 */
function DetailDialog({ title, subtitle, status, onClose, blocked, testId, children }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !blocked) onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, blocked]);

  return (
    <div
      className="modal-backdrop detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid={testId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !blocked) onClose();
      }}
    >
      <div className="modal modal-wide">
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <div className="modal-head-actions">
            {status}
            <button type="button" className="icon-button" data-testid="close-detail" aria-label="Close details" onClick={onClose}><X size={18} /></button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function ApplicationDetailDialog(props) {
  const application = props.data.applications.find((item) => item.id === props.selectedApplicationId);
  if (!application) return null;
  return (
    <DetailDialog
      testId="application-detail-dialog"
      title={`${application.id} - ${application.firstName} ${application.lastName}`}
      subtitle={`${application.accountType} account request - ${application.branch} branch`}
      status={<Status value={application.status} />}
      blocked={Boolean(props.modal)}
      onClose={() => props.setSelectedApplicationId(null)}
    >
      <ApplicationDetail {...props} application={application} />
    </DetailDialog>
  );
}

function ClosureRequestDetailDialog(props) {
  const request = props.data.closureRequests.find((item) => item.id === props.selectedClosureId);
  if (!request) return null;
  return (
    <DetailDialog
      testId="closure-detail-dialog"
      title={`${request.id} - account ${request.accountNumber}`}
      subtitle={`Closure requested by ${request.accountHolder || request.customerId || "account holder"}`}
      status={<Status value={request.status} />}
      blocked={Boolean(props.modal)}
      onClose={() => props.setSelectedClosureId(null)}
    >
      <ClosureRequestDetail {...props} request={request} />
    </DetailDialog>
  );
}

function ConfirmModal({ modal, onCancel }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="confirmation-modal" data-modal={modal.testId || "confirmation"}>
      <div className="modal">
        <h2>{modal.title}</h2>
        <p>{modal.body}</p>
        <div className="actions">
          <button className="btn secondary" data-testid="modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn primary" data-testid="modal-confirm" onClick={modal.onConfirm}>{modal.confirmText}</button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
