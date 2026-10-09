import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      react: path.resolve("./node_modules/react"),
      "react-dom": path.resolve("./node_modules/react-dom"),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-apexcharts",
      "apexcharts",
      "react-helmet-async",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-router")) return "react-vendor";
          if (id.includes("apexcharts") || id.includes("jvectormap")) return "charts";
          if (id.includes("@fullcalendar")) return "calendar";
          if (id.includes("firebase")) return "firebase";
          if (id.includes("jszip") || id.includes("jsqr") || id.includes("qrcode")) return "document-tools";
          return undefined;
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      // clientPort: 443,  // only for production behind SSL proxy; breaks HMR locally
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ["**/mysql_temp_data/**", "**/mysql_data/**", "**/.git/**", "**/node_modules/**"],
    },
  },
});
