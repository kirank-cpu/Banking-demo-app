// Shared between the Express API and the React client so the browser and the
// database never disagree about what a valid request looks like.

export const accountTypes = ["Savings", "Checking", "Current"];
export const branches = ["Downtown", "North Park", "West End", "Digital"];
export const transactionTypes = ["Initial Funding", "Cash Deposit", "Withdrawal", "Internal Transfer", "External Transfer", "Service Fee", "Interest Credit", "Refund", "Closure Payout"];
export const debitTypes = ["Withdrawal", "Service Fee", "Closure Payout", "External Transfer"];

// Transfers are posted by their own endpoint, which writes both sides of a
// same-bank move. Keeping them out of the teller's manual form stops anyone
// creating a one-sided transfer that leaves the ledger unbalanced.
export const transferTransactionTypes = ["Internal Transfer", "External Transfer"];
export const tellerTransactionTypes = transactionTypes.filter((type) => !["Initial Funding", "Closure Payout", ...transferTransactionTypes].includes(type));

export const transferTypes = ["Same bank", "Other bank"];

export const closureReasons = ["Moving to another bank", "Duplicate account", "High fees", "Relocating abroad", "Account no longer needed", "Other"];
export const payoutMethods = ["Transfer to another bank account", "Cashier's cheque by post", "Cash at branch"];
export const openClosureStatuses = ["Submitted", "Under Review", "Needs More Info"];

export const applicationRequiredFields = ["firstName", "lastName", "dob", "gender", "email", "mobile", "address", "city", "state", "zip", "nationalId", "idType", "idNumber", "occupation", "employer", "income", "accountType", "initialDeposit", "branch"];

export function ageFromDob(dob) {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function validateApplication(form, applications) {
  if (applicationRequiredFields.some((field) => !String(form[field] ?? "").trim())) return "Please complete all required fields.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address.";
  if (!/^\d{10}$/.test(form.mobile)) return "Mobile number must be 10 digits.";
  if (ageFromDob(form.dob) < 18) return "Applicant must be at least 18 years old.";
  if (Number(form.initialDeposit) < 100) return "Initial deposit must be at least $100.";
  if (Number(form.income) <= 0) return "Annual income must be greater than zero.";
  if (!form.terms) return "Confirm the customer details before submitting.";
  if (applications.some((app) => String(app.email || "").toLowerCase() === String(form.email).toLowerCase() || app.nationalId === form.nationalId)) return "An application already exists for this email or national ID.";
  return "";
}

/**
 * @param form     the transfer being requested
 * @param account  the source account row (undefined when not found)
 * @param accounts every account at this bank, used to resolve a same-bank destination
 */
export function validateTransfer(form, account, accounts) {
  if (!account) return "Select the account to transfer from.";
  if (account.status === "Closed") return "This account is closed and cannot send transfers.";
  if (account.status !== "Active") return "This account is not active yet, so it cannot send transfers.";
  if (!transferTypes.includes(form.transferType)) return "Choose whether the money is going to this bank or another bank.";

  const destination = String(form.toAccountNumber || "").trim();
  if (!destination) return "Enter the destination account number.";

  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be greater than zero.";
  if (amount > account.availableBalance) return "Insufficient balance for this transfer.";

  if (form.transferType === "Same bank") {
    if (destination === account.accountNumber) return "Choose a different account to transfer to.";
    const target = accounts.find((item) => item.accountNumber === destination);
    if (!target) return "No account at this bank matches that account number.";
    if (target.status === "Closed") return "The destination account is closed.";
  } else {
    if (!/^\d{6,}$/.test(destination)) return "Destination account number must be at least 6 digits.";
    if (!String(form.beneficiaryName || "").trim()) return "Enter the beneficiary name.";
    if (!String(form.bankName || "").trim()) return "Enter the destination bank name.";
    if (!/^[A-Za-z0-9]{6,15}$/.test(String(form.routingNumber || "").trim())) return "Enter a valid routing / IFSC code (6-15 letters or digits).";
  }

  if (!form.confirm) return "Confirm the transfer details before sending.";
  return "";
}

/**
 * @param form    the closure request being submitted
 * @param account the account row it targets (undefined when not found)
 * @param requests every existing closure request, used to block duplicates
 */
export function validateClosureRequest(form, account, requests) {
  if (!account) return "Select the account you want to close.";
  if (account.status === "Closed") return "This account is already closed.";
  if (!form.reason) return "Select a reason for closing the account.";
  if (!closureReasons.includes(form.reason)) return "Select a valid closure reason.";
  if (form.reason === "Other" && !String(form.details || "").trim()) return "Describe your reason when selecting 'Other'.";
  if (!form.payoutMethod) return "Select how the remaining balance should be paid out.";
  if (!payoutMethods.includes(form.payoutMethod)) return "Select a valid payout method.";
  if (form.payoutMethod === "Transfer to another bank account" && !/^\d{6,}$/.test(String(form.payoutReference || "").trim())) return "Enter the destination account number (at least 6 digits).";
  if (!form.confirm) return "Confirm that you want to close this account.";
  if (requests.some((request) => request.accountNumber === account.accountNumber && openClosureStatuses.includes(request.status))) return "A closure request for this account is already in progress.";
  return "";
}
