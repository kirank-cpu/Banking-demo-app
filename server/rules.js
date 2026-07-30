// Shared between the Express API and the React client so the browser and the
// database never disagree about what a valid request looks like.

export const accountTypes = ["Savings", "Checking", "Current"];
export const branches = ["Downtown", "North Park", "West End", "Digital"];
export const transactionTypes = ["Initial Funding", "Cash Deposit", "Withdrawal", "Internal Transfer", "Service Fee", "Interest Credit", "Refund", "Closure Payout"];
export const debitTypes = ["Withdrawal", "Service Fee", "Closure Payout"];

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
