import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two-process local dev:
//   Terminal 1:  vercel dev --listen 3000   (serves the /api functions)
//   Terminal 2:  npm run dev                (Vite on 5173, proxies /api → 3000)
// Open the Vite URL (http://localhost:5173).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
