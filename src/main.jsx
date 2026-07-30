import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  Home,
  Landmark,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserRound,
  XCircle
} from "lucide-react";
import "../styles.css";
import "./react.css";

const STORAGE_KEY = "metrobank-react-demo-state-v1";

const users = [
  { username: "applicant", password: "demo123", name: "Avery Stone", role: "applicant", label: "Customer Applicant" },
  { username: "reviewer", password: "demo123", name: "Mina Patel", role: "reviewer", label: "Bank Reviewer" },
  { username: "teller", password: "demo123", name: "Jon Mercer", role: "teller", label: "Teller Operations" },
  { username: "customer", password: "demo123", name: "Girish Uppar", role: "customer", label: "Account Holder", customerId: "C1001" },
  { username: "admin", password: "demo123", name: "Sam Rivera", role: "admin", label: "Admin" }
];

const navByRole = {
  applicant: [["dashboard", "Overview", Home], ["apply", "New Application", Plus], ["myApplications", "My Applications", ClipboardList]],
  reviewer: [["dashboard", "Review Queue", FileCheck2], ["applications", "Applications", ClipboardList], ["audit", "Audit Trail", CheckCircle2]],
  teller: [["dashboard", "Operations", Home], ["funding", "Fund Account", BadgeDollarSign], ["transactions", "Transactions", CircleDollarSign]],
  customer: [["dashboard", "Accounts", Landmark], ["transactions", "Transactions", CircleDollarSign], ["profile", "Profile", UserRound]],
  admin: [["dashboard", "Control Center", Home], ["applications", "Applications", ClipboardList], ["accounts", "Accounts", Landmark], ["transactions", "Transactions", CircleDollarSign], ["audit", "Audit Trail", CheckCircle2]]
};

const accountTypes = ["Savings", "Checking", "Current"];
const branches = ["Downtown", "North Park", "West End", "Digital"];
const transactionTypes = ["Initial Funding", "Cash Deposit", "Withdrawal", "Internal Transfer", "Service Fee", "Interest Credit", "Refund"];

const seedData = {
  applications: [
    {
      id: "APP-24001",
      ownerUsername: "customer",
      customerId: "C1001",
      status: "Approved",
      firstName: "Priya",
      lastName: "Nair",
      dob: "1992-04-16",
      gender: "Female",
      email: "priya.nair@example.com",
      mobile: "5552149001",
      address: "24 Market Street",
      city: "Austin",
      state: "TX",
      zip: "73301",
      nationalId: "TX-4432-7812",
      idType: "Driver License",
      idNumber: "D7821192",
      occupation: "Product Analyst",
      employer: "Northstar Retail",
      income: 82000,
      accountType: "Savings",
      initialDeposit: 500,
      branch: "Downtown",
      submittedAt: "2026-06-10T10:12:00.000Z",
      reviewer: "Mina Patel",
      reviewerComments: "KYC checks complete.",
      decisionAt: "2026-06-11T09:30:00.000Z",
      accountNumber: "8001200101",
      documents: "drivers-license.pdf"
    },
    {
      id: "APP-24002",
      ownerUsername: "applicant",
      customerId: null,
      status: "Submitted",
      firstName: "Noah",
      lastName: "Bennett",
      dob: "1988-09-03",
      gender: "Male",
      email: "noah.bennett@example.com",
      mobile: "5557781203",
      address: "85 Lake View Road",
      city: "Columbus",
      state: "OH",
      zip: "43004",
      nationalId: "OH-9931-2277",
      idType: "Passport",
      idNumber: "P8821002",
      occupation: "Consultant",
      employer: "Freelance",
      income: 69000,
      accountType: "Checking",
      initialDeposit: 250,
      branch: "Digital",
      submittedAt: "2026-06-19T14:55:00.000Z",
      reviewer: "",
      reviewerComments: "",
      decisionAt: "",
      accountNumber: "",
      documents: "passport.pdf"
    }
  ],
  accounts: [
    {
      customerId: "C1001",
      ownerUsername: "customer",
      accountNumber: "8001200101",
      accountType: "Savings",
      status: "Active",
      branch: "Downtown",
      openedAt: "2026-06-11T09:30:00.000Z",
      currentBalance: 1725,
      availableBalance: 1725
    }
  ],
  transactions: [
    { id: "TXN-900001", accountNumber: "8001200101", type: "Initial Funding", direction: "Credit", amount: 500, balanceAfter: 500, description: "Opening deposit", status: "Completed", createdBy: "Jon Mercer", createdAt: "2026-06-11T10:00:00.000Z" },
    { id: "TXN-900002", accountNumber: "8001200101", type: "Cash Deposit", direction: "Credit", amount: 1250, balanceAfter: 1750, description: "Counter cash deposit", status: "Completed", createdBy: "Jon Mercer", createdAt: "2026-06-15T12:40:00.000Z" },
    { id: "TXN-900003", accountNumber: "8001200101", type: "Service Fee", direction: "Debit", amount: 25, balanceAfter: 1725, description: "Monthly account fee", status: "Completed", createdBy: "System", createdAt: "2026-06-18T03:00:00.000Z" }
  ],
  audit: [
    { at: "2026-06-10T10:12:00.000Z", actor: "Priya Nair", action: "Application APP-24001 submitted" },
    { at: "2026-06-11T09:30:00.000Z", actor: "Mina Patel", action: "Application APP-24001 approved and account 8001200101 created" },
    { at: "2026-06-11T10:00:00.000Z", actor: "Jon Mercer", action: "Initial funding completed for account 8001200101" },
    { at: "2026-06-19T14:55:00.000Z", actor: "Noah Bennett", action: "Application APP-24002 submitted" }
  ]
};

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(seedData);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function statusClass(status) {
  return String(status).toLowerCase().replaceAll(" ", "-");
}

function nextNumeric(prefix, items, field = "id") {
  const max = items.reduce((highest, item) => Math.max(highest, Number(String(item[field] || "").replace(/\D/g, "")) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(5, "0")}`;
}

function App() {
  const [session, setSession] = useState(null);
  const [customerAccountNumber, setCustomerAccountNumber] = useState(null);
  const [view, setView] = useState("dashboard");
  const [data, setData] = useState(loadData);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [selectedAccountNumber, setSelectedAccountNumber] = useState("8001200101");
  const [filters, setFilters] = useState({ search: "", status: "All", transactionType: "All" });
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);

  const user = users.find((item) => item.username === session);
  const displayName = useMemo(() => {
    if (!user) return "";
    if (user.role === "customer") {
      const account = customerAccountNumber ? data.accounts.find((a) => a.accountNumber === customerAccountNumber) : null;
      const customerId = account?.customerId || user.customerId;
      const app = data.applications.find((a) => a.customerId === customerId) || data.applications.find((a) => a.ownerUsername === user.username);
      const name = app ? `${app.firstName || ""} ${app.lastName || ""}`.trim() : user.name;
      return name || user.name;
    }
    return user.name;
  }, [user, data, customerAccountNumber]);

  function save(nextData) {
    setData(nextData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
  }

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function resetDemo() {
    localStorage.removeItem(STORAGE_KEY);
    save(structuredClone(seedData));
    setSelectedApplicationId(null);
    notify("Demo data reset.");
  }

  if (!user) {
    return <LoginScreen data={data} onLogin={(nextUser, context) => { setSession(nextUser.username); setCustomerAccountNumber(context?.accountNumber || null); setView("dashboard"); }} />;
  }

  const props = {
    user,
    data,
    save,
    view,
    customerAccountNumber,
    setView,
    filters,
    setFilters,
    selectedApplicationId,
    setSelectedApplicationId,
    selectedAccountNumber,
    setSelectedAccountNumber,
    notify,
    setModal,
    resetDemo
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="top-actions">
          <span className="user-chip" data-testid="current-user"><span className="avatar">{(displayName || user.name)[0]}</span>{displayName} - {user.label}</span>
          <button className="btn secondary" data-testid="logout-button" onClick={() => { setSession(null); setCustomerAccountNumber(null); }}><LogOut size={17} /> Sign out</button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <p className="role-title">{user.label}</p>
          <nav className="nav-list" aria-label="Main navigation">
            {navByRole[user.role].map(([id, label, Icon]) => (
              <button key={id} className={`nav-button ${view === id ? "active" : ""}`} data-testid={`nav-${id}`} onClick={() => { setView(id); setSelectedApplicationId(null); }}>
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
      const profile = data.applications.find((item) => item.customerId === account.customerId && item.dob === form.dob);
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
      <section className="login-visual">
        <div className="login-copy">
          <span className="login-kicker"><ShieldCheck size={17} /> QA-ready banking lab</span>
          <h1>QA's Trust Bank</h1>
          <p>Customer onboarding, approvals, funding, and ledger checks in one realistic practice app.</p>
          <div className="login-stats" aria-label="Demo workflow summary">
            <span><strong>4</strong> role journeys</span>
            <span><strong>12+</strong> testable screens</span>
            <span><strong>100%</strong> local demo data</span>
          </div>
        </div>
      </section>
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

function Dashboard({ user, data, setView, resetDemo, customerAccountNumber }) {
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
        <section className="panel stack-top"><h2>My recent applications</h2><ApplicationsTable applications={mine} onOpen={() => setView("myApplications")} /></section>
      </>
    );
  }
  const pending = data.applications.filter((app) => ["Submitted", "Under Review"].includes(app.status)).length;
  return (
    <>
      <PageHead title={user.role === "reviewer" ? "Review queue" : user.role === "teller" ? "Teller operations" : "Control center"} subtitle="Operational snapshot for today's demo banking work." />
      <section className="grid three">
        <Metric label="Pending review" value={pending} testId="pending-review-count" />
        <Metric label="Approved applications" value={data.applications.filter((app) => app.status === "Approved").length} testId="approved-count" />
        <Metric label="Total balances" value={money(data.accounts.reduce((sum, account) => sum + account.currentBalance, 0))} testId="balance-count" />
      </section>
      <section className="panel stack-top">
        <div className="toolbar"><h2>Recent activity</h2><button className="btn secondary" data-testid="reset-demo" onClick={resetDemo}><RotateCcw size={17} /> Reset demo data</button></div>
        <AuditList audit={data.audit.slice(-5).reverse()} />
      </section>
    </>
  );
}

function CustomerDashboard({ user, data, customerAccountNumber }) {
  const accounts = data.accounts.filter((account) => (account.ownerUsername === user.username || account.customerId === user.customerId) && (!customerAccountNumber || account.accountNumber === customerAccountNumber));
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

function ApplicationForm({ user, data, save, setView, setSelectedApplicationId, notify, setModal }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  function submit(event) {
    event.preventDefault();
    const validation = validateApplication(form, data.applications);
    if (validation) {
      setError(validation);
      return;
    }
    const now = new Date().toISOString();
    const id = nextNumeric("APP", data.applications);
    const application = {
      id,
      ownerUsername: user.username,
      customerId: null,
      status: "Submitted",
      ...form,
      income: Number(form.income),
      initialDeposit: Number(form.initialDeposit),
      submittedAt: now,
      reviewer: "",
      reviewerComments: "",
      decisionAt: "",
      accountNumber: "",
      documents: form.documents || "mock-document.pdf"
    };
    save({ ...data, applications: [...data.applications, application], audit: [...data.audit, { at: now, actor: user.name, action: `Application ${id} submitted` }] });
    setSelectedApplicationId(id);
    setView("myApplications");
    setModal({
      title: "Application submitted",
      body: `Your application ${id} has been received and is now under review.`,
      confirmText: "Continue",
      onConfirm: () => setModal(null)
    });
    notify(`Application ${id} submitted.`);
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
        <div className="actions"><button type="button" className="btn secondary" data-testid="clear-application" onClick={() => setForm({})}>Clear</button><button className="btn primary" data-testid="submit-application">Submit application</button></div>
      </form>
    </>
  );
}

function validateApplication(form, applications) {
  const required = ["firstName", "lastName", "dob", "gender", "email", "mobile", "address", "city", "state", "zip", "nationalId", "idType", "idNumber", "occupation", "employer", "income", "accountType", "initialDeposit", "branch"];
  if (required.some((field) => !String(form[field] || "").trim())) return "Please complete all required fields.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address.";
  if (!/^\d{10}$/.test(form.mobile)) return "Mobile number must be 10 digits.";
  if (ageFromDob(form.dob) < 18) return "Applicant must be at least 18 years old.";
  if (Number(form.initialDeposit) < 100) return "Initial deposit must be at least $100.";
  if (Number(form.income) <= 0) return "Annual income must be greater than zero.";
  if (!form.terms) return "Confirm the customer details before submitting.";
  if (applications.some((app) => app.email.toLowerCase() === form.email.toLowerCase() || app.nationalId === form.nationalId)) return "An application already exists for this email or national ID.";
  return "";
}

function ageFromDob(dob) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
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
  const selected = data.applications.find((app) => app.id === selectedApplicationId);

  return (
    <>
      <PageHead title={onlyMine ? "My applications" : "Applications"} subtitle="Search, filter, review, approve, reject, or request more information." />
      <section className="panel">
        <ListFilters filters={filters} setFilters={setFilters} statuses={["All", "Submitted", "Under Review", "Approved", "Rejected", "Needs More Info"]} />
        <ApplicationsTable applications={visible} onOpen={setSelectedApplicationId} />
      </section>
      {selected && <ApplicationDetail {...props} application={selected} />}
    </>
  );
}

function ListFilters({ filters, setFilters, statuses }) {
  return (
    <div className="toolbar">
      <div className="filters">
        <Field label="Search"><input data-testid="search-input" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></Field>
        <Field label="Status"><select data-testid="status-filter" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
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

function ApplicationDetail({ user, data, save, application, setModal, setSelectedApplicationId, notify }) {
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
      onConfirm: () => {
        const now = new Date().toISOString();
        const next = structuredClone(data);
        const app = next.applications.find((item) => item.id === application.id);
        app.status = decision;
        app.reviewer = user.name;
        app.reviewerComments = comments || "Approved after review.";
        app.decisionAt = now;
        if (decision === "Approved") {
          const accountNumber = String(Math.max(...next.accounts.map((account) => Number(account.accountNumber)), 8001200101) + 1);
          const customerId = `C${Math.max(...next.applications.map((item) => Number(String(item.customerId || "").replace(/\D/g, "")) || 1000)) + 1}`;
          app.accountNumber = accountNumber;
          app.customerId = customerId;
          next.accounts.push({ customerId, ownerUsername: app.ownerUsername === "applicant" ? "customer" : app.ownerUsername, accountNumber, accountType: app.accountType, status: "Pending Funding", branch: app.branch, openedAt: now, currentBalance: 0, availableBalance: 0 });
          next.audit.push({ at: now, actor: user.name, action: `Application ${app.id} approved and account ${accountNumber} created` });
        } else {
          next.audit.push({ at: now, actor: user.name, action: `Application ${app.id} marked ${decision}` });
        }
        save(next);
        setSelectedApplicationId(application.id);
        setModal(null);
        notify(`Application ${application.id} ${decision.toLowerCase()}.`);
      }
    });
  }

  return (
    <section className="panel stack-top" data-testid="application-detail">
      <div className="toolbar"><h2>{application.id} - {application.firstName} {application.lastName}</h2><Status value={application.status} /></div>
      <div className="detail-list">
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
    </section>
  );
}

function Funding({ data, save, selectedAccountNumber, setSelectedAccountNumber, notify, filters, setFilters }) {
  const [form, setForm] = useState({ type: "", amount: "", description: "" });
  const [error, setError] = useState("");
  const term = filters.search.toLowerCase();
  const accounts = data.accounts.filter((account) => {
    const app = data.applications.find((item) => item.accountNumber === account.accountNumber);
    return !term || `${account.accountNumber} ${account.customerId} ${app?.firstName || ""} ${app?.lastName || ""}`.toLowerCase().includes(term);
  });
  const account = data.accounts.find((item) => item.accountNumber === selectedAccountNumber) || data.accounts[0];

  function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!account) return setError("Select a valid account.");
    if (!form.type) return setError("Select a transaction type.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Amount must be greater than zero.");
    const direction = ["Withdrawal", "Service Fee"].includes(form.type) ? "Debit" : "Credit";
    if (direction === "Debit" && account.currentBalance < amount) return setError("Insufficient balance for debit transaction.");

    const now = new Date().toISOString();
    const next = structuredClone(data);
    const nextAccount = next.accounts.find((item) => item.accountNumber === account.accountNumber);
    const nextBalance = direction === "Debit" ? nextAccount.currentBalance - amount : nextAccount.currentBalance + amount;
    nextAccount.currentBalance = nextBalance;
    nextAccount.availableBalance = nextBalance;
    if (nextAccount.status === "Pending Funding" && nextBalance > 0) nextAccount.status = "Active";
    const txn = { id: nextNumeric("TXN", next.transactions), accountNumber: nextAccount.accountNumber, type: form.type, direction, amount, balanceAfter: nextBalance, description: form.description || form.type, status: "Completed", createdBy: "Teller", createdAt: now };
    next.transactions.push(txn);
    next.audit.push({ at: now, actor: "Teller", action: `${form.type} ${txn.id} posted to account ${nextAccount.accountNumber}` });
    save(next);
    setSelectedAccountNumber(nextAccount.accountNumber);
    setForm({ type: "", amount: "", description: "" });
    notify(`Transaction ${txn.id} posted.`);
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
                <FormSelect label="Transaction type" options={transactionTypes.filter((type) => type !== "Initial Funding")} testId="transaction-type-select" value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
                <FormInput label="Amount" type="number" testId="amount-input" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
                <Field label="Description"><textarea data-testid="transaction-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                <p className="error">{error}</p>
                <button className="btn primary" data-testid="post-transaction"><Banknote size={17} /> Post transaction</button>
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
          const app = data.applications.find((item) => item.accountNumber === account.accountNumber);
          return (
            <tr key={account.accountNumber} data-testid={`account-row-${account.accountNumber}`}>
              <td><strong>{account.accountNumber}</strong><br /><span className="muted">{account.accountType} - {account.branch}</span></td>
              <td>{app ? `${app.firstName} ${app.lastName}` : account.customerId}<br /><span className="muted">{account.customerId}</span></td>
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
  const accountNumbers = user.role === "customer" ? data.accounts.filter((account) => (account.ownerUsername === user.username || account.customerId === user.customerId) && (!customerAccountNumber || account.accountNumber === customerAccountNumber)).map((account) => account.accountNumber) : null;
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
  const account = customerAccountNumber ? data.accounts.find((item) => item.accountNumber === customerAccountNumber) : null;
  const matchedCustomerId = account?.customerId || user.customerId;
  const app = data.applications.find((item) => item.customerId === matchedCustomerId) || data.applications.find((item) => item.ownerUsername === user.username) || null;
  const fullName = app ? `${app.firstName || ""} ${app.lastName || ""}`.trim() : user.name || "Customer";

  return (
    <>
      <PageHead title="Profile" subtitle="Customer information captured during onboarding." />
      <section className="panel">{app ? <div className="detail-list">
        <Detail label="Name" value={fullName} />
        <Detail label="Email" value={app.email} />
        <Detail label="Mobile" value={app.mobile} />
        <Detail label="Address" value={`${app.address}, ${app.city}, ${app.state} ${app.zip}`} />
        <Detail label="Customer ID" value={app.customerId || "-"} />
        <Detail label="Identity" value={`${app.idType} - ${app.idNumber}`} />
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

function ConfirmModal({ modal, onCancel }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="confirmation-modal">
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
