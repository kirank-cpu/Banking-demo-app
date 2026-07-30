// Vercel serverless entry point.
//
// Deliberately a plain filename. An earlier version used a `[...path].js`
// catch-all, which Vercel routed as a single dynamic segment: /api/state worked
// but /api/applications/:id/decision returned a platform 404 and never reached
// Express. Routing is now driven by the explicit rewrite in vercel.json instead.
//
// The router is mounted at both /api and the root, so it matches whether the
// original URL or a prefix-stripped one arrives.

import { attachErrorHandler, createApiApp } from "../server/app.js";

const app = createApiApp({ mountAtRoot: true });
attachErrorHandler(app);

export default app;
