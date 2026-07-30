// The schema lives in JS rather than a .sql file so it is always bundled into
// the Vercel serverless function, which has no reliable filesystem to read from.
//
// Column names are camelCase on purpose: the REST API hands rows straight to the
// React client, so the SQL shape and the UI shape stay identical.

export const schema = `
CREATE TABLE IF NOT EXISTS customers (
  customerId    TEXT PRIMARY KEY,
  ownerUsername TEXT,
  firstName     TEXT NOT NULL,
  lastName      TEXT NOT NULL,
  dob           TEXT NOT NULL,
  gender        TEXT,
  email         TEXT NOT NULL,
  mobile        TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  nationalId    TEXT,
  idType        TEXT,
  idNumber      TEXT,
  occupation    TEXT,
  employer      TEXT,
  income        REAL,
  createdAt     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id               TEXT PRIMARY KEY,
  ownerUsername    TEXT NOT NULL,
  customerId       TEXT REFERENCES customers(customerId),
  status           TEXT NOT NULL,
  firstName        TEXT,
  lastName         TEXT,
  dob              TEXT,
  gender           TEXT,
  email            TEXT,
  mobile           TEXT,
  address          TEXT,
  city             TEXT,
  state            TEXT,
  zip              TEXT,
  nationalId       TEXT,
  idType           TEXT,
  idNumber         TEXT,
  occupation       TEXT,
  employer         TEXT,
  income           REAL,
  accountType      TEXT,
  initialDeposit   REAL,
  branch           TEXT,
  submittedAt      TEXT,
  reviewer         TEXT DEFAULT '',
  reviewerComments TEXT DEFAULT '',
  decisionAt       TEXT DEFAULT '',
  accountNumber    TEXT DEFAULT '',
  documents        TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  accountNumber    TEXT PRIMARY KEY,
  customerId       TEXT NOT NULL REFERENCES customers(customerId),
  ownerUsername    TEXT,
  accountType      TEXT,
  status           TEXT NOT NULL,
  branch           TEXT,
  openedAt         TEXT,
  closedAt         TEXT DEFAULT '',
  currentBalance   REAL NOT NULL DEFAULT 0,
  availableBalance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  accountNumber TEXT NOT NULL REFERENCES accounts(accountNumber),
  type          TEXT NOT NULL,
  direction     TEXT NOT NULL,
  amount        REAL NOT NULL,
  balanceAfter  REAL NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL,
  createdBy     TEXT,
  createdAt     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS closureRequests (
  id                  TEXT PRIMARY KEY,
  accountNumber       TEXT NOT NULL REFERENCES accounts(accountNumber),
  customerId          TEXT,
  ownerUsername       TEXT,
  accountHolder       TEXT,
  reason              TEXT NOT NULL,
  details             TEXT,
  payoutMethod        TEXT NOT NULL,
  payoutReference     TEXT,
  status              TEXT NOT NULL,
  submittedAt         TEXT NOT NULL,
  reviewer            TEXT DEFAULT '',
  reviewerComments    TEXT DEFAULT '',
  decisionAt          TEXT DEFAULT '',
  closingBalance      REAL DEFAULT 0,
  payoutTransactionId TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     TEXT NOT NULL,
  actor  TEXT,
  action TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxTransactionsAccount ON transactions(accountNumber);
CREATE INDEX IF NOT EXISTS idxAccountsCustomer    ON accounts(customerId);
CREATE INDEX IF NOT EXISTS idxClosureAccount      ON closureRequests(accountNumber);
`;
