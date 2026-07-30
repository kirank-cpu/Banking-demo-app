import express from "express";
import cors from "cors";
import { createHash, timingSafeEqual } from "node:crypto";
import { addAudit, db, describeDatabase, ensureReady, insertRow, isRemote, nextReference, query, queryOne, readState, resetDatabase, updateRow } from "./db.js";
import { debitTypes, openClosureStatuses, transactionTypes, validateApplication, validateClosureRequest } from "./rules.js";

export const app = express();
app.use(cors());
app.use(express.json());

// Shared team gate. Set BANKING_ACCESS_CODE to require a code; leave it unset and
// the API stays open, so local development and the test suites need no setup.
//
// This keeps strangers who find the public URL out. It is not per-user auth: every
// teammate shares one code, and anyone holding it can act as any role.
// Trimmed deliberately: HTTP strips whitespace around header values, so a code
// pasted into a hosting dashboard with a stray newline would otherwise never
// match and lock the whole team out.
const accessCode = (process.env.BANKING_ACCESS_CODE || "").trim();

/** Hash both sides so the comparison is fixed-length and doesn't leak the code's length. */
function matchesAccessCode(supplied) {
  const value = String(supplied || "").trim();
  if (!value) return false;
  return timingSafeEqual(createHash("sha256").update(value).digest(), createHash("sha256").update(accessCode).digest());
}

app.use("/api", (request, response, next) => {
  if (!accessCode) return next();
  if (request.path === "/health") return next(); // public liveness probe, reveals nothing
  if (matchesAccessCode(request.get("x-access-code"))) return next();
  response.status(401).json({ error: "Enter the team access code to use this banking demo.", code: "unauthorized" });
});

/** Rejects with a 400 and a message the UI can show verbatim. */
export class RequestError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Wraps a handler so the schema exists, the reply always carries the refreshed
// state, and a thrown RequestError becomes a clean 400.
function handle(handler) {
  return async (request, response, next) => {
    try {
      await ensureReady();
      const result = (await handler(request)) || {};
      response.json({ ...result, state: await readState() });
    } catch (error) {
      next(error);
    }
  };
}

function required(value, message) {
  if (!String(value ?? "").trim()) throw new RequestError(message);
  return String(value).trim();
}

/** Runs `work` in a write transaction, rolling back if anything throws. */
async function inTransaction(work) {
  const tx = await db.transaction("write");
  try {
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

app.get("/api/health", async (request, response, next) => {
  // Reachable without the code, but only says whether the service is up and gated.
  if (accessCode && !matchesAccessCode(request.get("x-access-code"))) return response.json({ ok: true, protected: true });
  try {
    await ensureReady();
    response.json({ ok: true, protected: Boolean(accessCode), database: describeDatabase(), remote: isRemote });
  } catch (error) {
    next(error);
  }
});

app.get("/api/state", handle(() => ({})));

app.post("/api/reset", handle(async () => {
  await resetDatabase();
  return { message: "Demo data reset." };
}));

app.post("/api/applications", handle(async (request) => {
  const { form = {}, actor = {} } = request.body || {};
  const applications = await query(db, "SELECT email, nationalId FROM applications");
  const problem = validateApplication(form, applications);
  if (problem) throw new RequestError(problem);

  const now = new Date().toISOString();
  const ownerUsername = required(actor.username, "Missing applicant identity.");

  return inTransaction(async (tx) => {
    const id = await nextReference(tx, "APP", "applications");
    await insertRow(tx, "applications", {
      ...form,
      id,
      ownerUsername,
      customerId: null,
      status: "Submitted",
      income: Number(form.income),
      initialDeposit: Number(form.initialDeposit),
      submittedAt: now,
      reviewer: "",
      reviewerComments: "",
      decisionAt: "",
      accountNumber: "",
      documents: form.documents || "mock-document.pdf"
    });
    await addAudit(tx, now, actor.name || actor.username, `Application ${id} submitted`);
    return { id };
  });
}));

app.post("/api/applications/:id/decision", handle(async (request) => {
  const { decision, comments = "", reviewer = "" } = request.body || {};
  if (!["Approved", "Rejected", "Needs More Info", "Under Review"].includes(decision)) throw new RequestError("Unknown decision.");
  if (["Rejected", "Needs More Info"].includes(decision) && !String(comments).trim()) throw new RequestError("Comments are required for this decision.");

  const now = new Date().toISOString();
  const reviewerName = reviewer || "Reviewer";

  return inTransaction(async (tx) => {
    const application = await queryOne(tx, "SELECT * FROM applications WHERE id = ?", [request.params.id]);
    if (!application) throw new RequestError("Application not found.");
    if (["Approved", "Rejected"].includes(application.status)) throw new RequestError(`Application ${application.id} is already ${application.status.toLowerCase()}.`);

    const patch = { status: decision, reviewer: reviewerName, reviewerComments: comments || "Approved after review.", decisionAt: now };

    if (decision === "Approved") {
      const accountRows = await query(tx, "SELECT accountNumber FROM accounts");
      const accountNumber = String(Math.max(...accountRows.map((row) => Number(row.accountNumber)), 8001200101) + 1);
      const customerRows = await query(tx, "SELECT customerId FROM customers");
      const customerId = `C${Math.max(...customerRows.map((row) => Number(String(row.customerId).replace(/\D/g, "")) || 1000), 1000) + 1}`;
      const ownerUsername = application.ownerUsername === "applicant" ? "customer" : application.ownerUsername;

      await insertRow(tx, "customers", { ...application, customerId, ownerUsername, createdAt: now });
      await insertRow(tx, "accounts", {
        accountNumber,
        customerId,
        ownerUsername,
        accountType: application.accountType,
        status: "Pending Funding",
        branch: application.branch,
        openedAt: now,
        closedAt: "",
        currentBalance: 0,
        availableBalance: 0
      });
      patch.accountNumber = accountNumber;
      patch.customerId = customerId;
      await addAudit(tx, now, reviewerName, `Application ${application.id} approved and account ${accountNumber} created`);
    } else {
      await addAudit(tx, now, reviewerName, `Application ${application.id} marked ${decision}`);
    }

    await updateRow(tx, "applications", "id", application.id, patch);
    return { id: application.id, decision };
  });
}));

app.post("/api/transactions", handle(async (request) => {
  const { accountNumber, type, amount, description = "", createdBy = "Teller" } = request.body || {};
  if (!type || !transactionTypes.includes(type)) throw new RequestError("Select a transaction type.");
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new RequestError("Amount must be greater than zero.");

  const now = new Date().toISOString();

  return inTransaction(async (tx) => {
    const account = await queryOne(tx, "SELECT * FROM accounts WHERE accountNumber = ?", [String(accountNumber || "")]);
    if (!account) throw new RequestError("Select a valid account.");
    if (account.status === "Closed") throw new RequestError("This account is closed and cannot accept transactions.");

    const direction = debitTypes.includes(type) ? "Debit" : "Credit";
    if (direction === "Debit" && account.currentBalance < value) throw new RequestError("Insufficient balance for debit transaction.");

    const balanceAfter = direction === "Debit" ? account.currentBalance - value : account.currentBalance + value;
    const transaction = {
      id: await nextReference(tx, "TXN", "transactions"),
      accountNumber: account.accountNumber,
      type,
      direction,
      amount: value,
      balanceAfter,
      description: description || type,
      status: "Completed",
      createdBy,
      createdAt: now
    };

    await insertRow(tx, "transactions", transaction);
    await updateRow(tx, "accounts", "accountNumber", account.accountNumber, {
      currentBalance: balanceAfter,
      availableBalance: balanceAfter,
      status: account.status === "Pending Funding" && balanceAfter > 0 ? "Active" : account.status
    });
    await addAudit(tx, now, createdBy, `${type} ${transaction.id} posted to account ${account.accountNumber}`);
    return { transaction };
  });
}));

app.post("/api/closure-requests", handle(async (request) => {
  const { form = {}, actor = {} } = request.body || {};
  const now = new Date().toISOString();

  return inTransaction(async (tx) => {
    const account = await queryOne(tx, "SELECT * FROM accounts WHERE accountNumber = ?", [String(form.accountNumber || "")]);
    const existing = await query(tx, "SELECT accountNumber, status FROM closureRequests");
    const problem = validateClosureRequest(form, account, existing);
    if (problem) throw new RequestError(problem);

    const id = await nextReference(tx, "CLR", "closureRequests");
    await insertRow(tx, "closureRequests", {
      id,
      accountNumber: account.accountNumber,
      customerId: account.customerId,
      ownerUsername: actor.username || account.ownerUsername,
      accountHolder: actor.name || "",
      reason: form.reason,
      details: form.details || "",
      payoutMethod: form.payoutMethod,
      payoutReference: form.payoutReference || "",
      status: "Submitted",
      submittedAt: now,
      reviewer: "",
      reviewerComments: "",
      decisionAt: "",
      closingBalance: account.currentBalance,
      payoutTransactionId: ""
    });
    await addAudit(tx, now, actor.name || actor.username, `Closure request ${id} submitted for account ${account.accountNumber}`);
    return { id };
  });
}));

app.post("/api/closure-requests/:id/decision", handle(async (request) => {
  const { decision, comments = "", reviewer = "" } = request.body || {};
  if (!["Approved", "Rejected", "Needs More Info", "Under Review"].includes(decision)) throw new RequestError("Unknown decision.");
  if (["Rejected", "Needs More Info"].includes(decision) && !String(comments).trim()) throw new RequestError("Comments are required for this decision.");

  const now = new Date().toISOString();
  const reviewerName = reviewer || "Reviewer";

  return inTransaction(async (tx) => {
    const closureRequest = await queryOne(tx, "SELECT * FROM closureRequests WHERE id = ?", [request.params.id]);
    if (!closureRequest) throw new RequestError("Closure request not found.");
    if (!openClosureStatuses.includes(closureRequest.status)) throw new RequestError(`Closure request ${closureRequest.id} is already ${closureRequest.status.toLowerCase()}.`);

    const patch = { status: decision, reviewer: reviewerName, reviewerComments: comments || "Closure approved after review.", decisionAt: now };
    let payoutTransactionId = "";

    if (decision === "Approved") {
      const account = await queryOne(tx, "SELECT * FROM accounts WHERE accountNumber = ?", [closureRequest.accountNumber]);
      if (!account) throw new RequestError("The account for this request no longer exists.");
      if (account.status === "Closed") throw new RequestError("This account is already closed.");

      // Settle the remaining balance first so the ledger still adds up after closure.
      if (account.currentBalance > 0) {
        const payout = {
          id: await nextReference(tx, "TXN", "transactions"),
          accountNumber: account.accountNumber,
          type: "Closure Payout",
          direction: "Debit",
          amount: account.currentBalance,
          balanceAfter: 0,
          description: `Closing balance paid out - ${closureRequest.payoutMethod}${closureRequest.payoutReference ? ` (${closureRequest.payoutReference})` : ""}`,
          status: "Completed",
          createdBy: reviewerName,
          createdAt: now
        };
        await insertRow(tx, "transactions", payout);
        payoutTransactionId = payout.id;
      }

      await updateRow(tx, "accounts", "accountNumber", account.accountNumber, { status: "Closed", closedAt: now, currentBalance: 0, availableBalance: 0 });
      patch.closingBalance = account.currentBalance;
      patch.payoutTransactionId = payoutTransactionId;
      await addAudit(tx, now, reviewerName, `Closure request ${closureRequest.id} approved and account ${account.accountNumber} closed`);
    } else {
      await addAudit(tx, now, reviewerName, `Closure request ${closureRequest.id} marked ${decision}`);
    }

    await updateRow(tx, "closureRequests", "id", closureRequest.id, patch);
    return { id: closureRequest.id, decision, payoutTransactionId };
  });
}));

export function attachErrorHandler(target) {
  target.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    const status = error.status || 500;
    if (status === 500) console.error(error);
    response.status(status).json({ error: error.message || "Unexpected server error." });
  });
}
