// Local / self-hosted entry point: serves the API and, when a production build
// exists, the UI too - so one process can host the whole demo for a team.
// On Vercel the same Express app is served by api/index.js instead.

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, attachErrorHandler } from "./app.js";
import { describeDatabase, ensureReady, isRemote } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(here, "..", "dist");
const port = Number(process.env.PORT || 4000);

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (request, response) => response.sendFile(path.join(distDir, "index.html")));
}

attachErrorHandler(app);

try {
  await ensureReady();
} catch (error) {
  console.error("Could not open the database:", error.message);
  process.exit(1);
}

app.listen(port, () => {
  console.log(`QA's Trust Bank API listening on http://localhost:${port}`);
  console.log(`Database: ${describeDatabase()}${isRemote ? " (Turso)" : ""}`);
  if (!fs.existsSync(distDir)) console.log("No production build found - run `npm run dev` for the UI, or `npm start` to serve it from here.");
});
