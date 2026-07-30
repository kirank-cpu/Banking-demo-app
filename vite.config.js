import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser always calls same-origin /api; this proxy decides where that goes.
// Point it at whoever is hosting the shared database:
//   BANKING_API_URL=http://192.168.1.20:4000 npm run dev
const apiTarget = process.env.BANKING_API_URL || "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true }
    }
  }
});
