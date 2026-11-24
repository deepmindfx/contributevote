import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const browserVariables = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_USE_SUPABASE",
  "VITE_FLUTTERWAVE_PUBLIC_KEY",
  "VITE_FLW_PUBLIC_KEY_PROD",
  "VITE_FLW_PUBLIC_KEY_TEST",
  "VITE_WEB_PUSH_PUBLIC_KEY",
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const publicEnv = loadEnv(mode, process.cwd(), browserVariables);
  const definitions = Object.fromEntries(
    browserVariables.map(name => [`import.meta.env.${name}`, JSON.stringify(publicEnv[name] ?? "")]),
  );

  return {
    envPrefix: [],
    define: definitions,
    server: {
      host: "127.0.0.1",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
            ui: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-slot']
          }
        }
      }
    },
  };
});
