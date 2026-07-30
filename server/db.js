import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { schema } from "./schema.js";
import { seedData } from "./seed.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const remoteUrl = process.env.TURSO_DATABASE_URL;

export const isRemote = Boolean(remoteUrl);

/**
 * Turso when TURSO_DATABASE_URL is set (Vercel, and anyone sharing that database),
 * otherwise a local SQLite file. Same SQL and same code path either way, so local
 * development exercises exactly what runs in production.
 *
 * The remote case deliberately uses the `web` entry point: it talks pure HTTP and
 * pulls in no native bindings, which is what makes it safe to bundle into a
 * serverless function.
 */
const { createClient } = isRemote ? await import("@libsql/client/web") : await import("@libsql/client");

export const db = isRemote
  ? createClient({ url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: pathToFileURL(process.env.BANKING_DB ? path.resolve(process.env.BANKING_DB) : path.join(here, "banking.db")).href });

export function describeDatabase() {
  if (isRemote) return new URL(remoteUrl).host;
  return process.env.BANKING_DB ? path.resolve(process.env.BANKING_DB) : path.join(here, "banking.db");
}

export const columns = {
  customers: ["customerId", "ownerUsername", "firstName", "lastName", "dob", "gender", "email", "mobile", "address", "city", "state", "zip", "nationalId", "idType", "idNumber", "occupation", "employer", "income", "createdAt"],
  applications: ["id", "ownerUsername", "customerId", "status", "firstName", "lastName", "dob", "gender", "email", "mobile", "address", "city", "state", "zip", "nationalId", "idType", "idNumber", "occupation", "employer", "income", "accountType", "initialDeposit", "branch", "submittedAt", "reviewer", "reviewerComments", "decisionAt", "accountNumber", "documents"],
  accounts: ["accountNumber", "customerId", "ownerUsername", "accountType", "status", "branch", "openedAt", "closedAt", "currentBalance", "availableBalance"],
  transactions: ["id", "accountNumber", "type", "direction", "amount", "balanceAfter", "description", "status", "createdBy", "createdAt"],
  closureRequests: ["id", "accountNumber", "customerId", "ownerUsername", "accountHolder", "reason", "details", "payoutMethod", "payoutReference", "status", "submittedAt", "reviewer", "reviewerComments", "decisionAt", "closingBalance", "payoutTransactionId"],
  transfers: ["id", "fromAccountNumber", "transferType", "toAccountNumber", "beneficiaryName", "bankName", "routingNumber", "amount", "description", "status", "createdBy", "createdAt", "debitTransactionId", "creditTransactionId"],
  audit: ["at", "actor", "action"]
};

// libSQL only binds primitives, so normalise every value down to the four types
// SQLite understands.
function bindable(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}

/** libSQL Row objects are array-like; convert to plain objects for the API and the UI. */
function toRows(result) {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((column, index) => [column, row[index]])));
}

/**
 * Every helper takes an `executor` - either `db` or an open transaction - so the
 * same code works inside and outside a transaction.
 */
export async function query(executor, sql, args = []) {
  return toRows(await executor.execute({ sql, args }));
}

export async function queryOne(executor, sql, args = []) {
  return (await query(executor, sql, args))[0] || null;
}

export async function insertRow(executor, table, row) {
  const cols = columns[table];
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  await executor.execute({ sql, args: cols.map((col) => bindable(row[col])) });
  return row;
}

export async function updateRow(executor, table, keyColumn, keyValue, patch) {
  const entries = Object.entries(patch).filter(([col]) => columns[table].includes(col));
  if (!entries.length) return;
  const sql = `UPDATE ${table} SET ${entries.map(([col]) => `${col} = ?`).join(", ")} WHERE ${keyColumn} = ?`;
  await executor.execute({ sql, args: [...entries.map(([, value]) => bindable(value)), keyValue] });
}

export async function addAudit(executor, at, actor, action) {
  await insertRow(executor, "audit", { at, actor, action });
}

/**
 * The whole demo dataset in the exact shape the React client renders.
 * Small enough to send in one response, which keeps every teammate's browser
 * in sync after any mutation.
 */
export async function readState() {
  const results = await db.batch([
    "SELECT * FROM customers ORDER BY customerId",
    "SELECT * FROM applications ORDER BY submittedAt",
    "SELECT * FROM accounts ORDER BY accountNumber",
    "SELECT * FROM transactions ORDER BY createdAt",
    "SELECT * FROM closureRequests ORDER BY submittedAt",
    "SELECT * FROM transfers ORDER BY createdAt",
    "SELECT at, actor, action FROM audit ORDER BY id"
  ], "read");
  const [customers, applications, accounts, transactions, closureRequests, transfers, audit] = results.map(toRows);
  return { customers, applications, accounts, transactions, closureRequests, transfers, audit };
}

/** `APP-00007` style reference built from the highest digits already stored. */
export async function nextReference(executor, prefix, table, column = "id") {
  const rows = await query(executor, `SELECT ${column} AS value FROM ${table}`);
  const max = rows.reduce((highest, row) => Math.max(highest, Number(String(row.value || "").replace(/\D/g, "")) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(5, "0")}`;
}

async function seedDatabase() {
  const tx = await db.transaction("write");
  try {
    for (const table of ["audit", "transfers", "closureRequests", "transactions", "accounts", "applications", "customers"]) {
      await tx.execute(`DELETE FROM ${table}`);
    }
    await tx.execute("DELETE FROM sqlite_sequence WHERE name = 'audit'");
    for (const customer of seedData.customers) await insertRow(tx, "customers", customer);
    for (const application of seedData.applications) await insertRow(tx, "applications", application);
    for (const account of seedData.accounts) await insertRow(tx, "accounts", account);
    for (const transaction of seedData.transactions) await insertRow(tx, "transactions", transaction);
    for (const request of seedData.closureRequests) await insertRow(tx, "closureRequests", request);
    for (const transfer of seedData.transfers) await insertRow(tx, "transfers", transfer);
    for (const entry of seedData.audit) await insertRow(tx, "audit", entry);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

// Serverless functions have no startup hook, so schema creation and first-run
// seeding happen lazily on the first request and are then cached per instance.
let readyPromise;

export function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await db.executeMultiple(schema);
      const [{ count }] = await query(db, "SELECT COUNT(*) AS count FROM applications");
      if (Number(count) === 0) await seedDatabase();
    })().catch((error) => {
      readyPromise = undefined; // let the next request retry instead of caching the failure
      throw error;
    });
  }
  return readyPromise;
}
