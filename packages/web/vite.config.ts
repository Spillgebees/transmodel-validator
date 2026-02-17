/**
 * Vite configuration for the web UI.
 *
 * Uses TanStack Start for SSR, Nitro for production server deployment,
 * Tailwind CSS v4 for styling, and vite-tsconfig-paths for the `~/` alias.
 */

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [tsConfigPaths(), tanstackStart(), nitro(), react(), tailwindcss()],
});
