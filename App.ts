import { lazy, Suspense } from "react";


export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          vendor: ["axios", "lodash"]
        }
      }
    }
  }
};