import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias so lib/portal files
// (which import via "@/lib/...") resolve the same way tests run them as
// they do inside Next.js itself.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
