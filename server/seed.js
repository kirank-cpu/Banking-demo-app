// Baseline demo data. Loaded when the database is empty and re-loaded by
// POST /api/reset so every teammate can get back to a known state.

export const seedData = {
  customers: [
    {
      customerId: "C1001",
      ownerUsername: "customer",
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
      createdAt: "2026-06-11T09:30:00.000Z"
    }
  ],
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
      closedAt: "",
      currentBalance: 1725,
      availableBalance: 1725
    }
  ],
  transactions: [
    { id: "TXN-900001", accountNumber: "8001200101", type: "Initial Funding", direction: "Credit", amount: 500, balanceAfter: 500, description: "Opening deposit", status: "Completed", createdBy: "Jon Mercer", createdAt: "2026-06-11T10:00:00.000Z" },
    { id: "TXN-900002", accountNumber: "8001200101", type: "Cash Deposit", direction: "Credit", amount: 1250, balanceAfter: 1750, description: "Counter cash deposit", status: "Completed", createdBy: "Jon Mercer", createdAt: "2026-06-15T12:40:00.000Z" },
    { id: "TXN-900003", accountNumber: "8001200101", type: "Service Fee", direction: "Debit", amount: 25, balanceAfter: 1725, description: "Monthly account fee", status: "Completed", createdBy: "System", createdAt: "2026-06-18T03:00:00.000Z" }
  ],
  closureRequests: [],
  transfers: [],
  audit: [
    { at: "2026-06-10T10:12:00.000Z", actor: "Priya Nair", action: "Application APP-24001 submitted" },
    { at: "2026-06-11T09:30:00.000Z", actor: "Mina Patel", action: "Application APP-24001 approved and account 8001200101 created" },
    { at: "2026-06-11T10:00:00.000Z", actor: "Jon Mercer", action: "Initial funding completed for account 8001200101" },
    { at: "2026-06-19T14:55:00.000Z", actor: "Noah Bennett", action: "Application APP-24002 submitted" }
  ]
};
