import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // strictPort: fail loudly if 5173 is taken instead of silently moving to 5174
  server: { port: 5173, strictPort: true },
});
