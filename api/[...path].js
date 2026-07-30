// Vercel serverless entry point. The catch-all filename means every /api/*
// request reaches this function with its original URL intact, so the Express
// routes in server/app.js match exactly as they do locally.

import { app, attachErrorHandler } from "../server/app.js";

attachErrorHandler(app);

export default app;
