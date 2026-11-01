import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import type { Plugin } from "vite";

/**
 * GramJS's `telegram/CryptoFile` does `require("crypto")`. In the browser that
 * would resolve to crypto-browserify (via vite-plugin-node-polyfills), whose
 * hashes come back as a *different* Buffer class than the global Buffer shim.
 * GramJS's TL serializer checks `data instanceof Buffer`, so the 2FA SRP check
 * (auth.CheckPassword) failed with "Bytes or str expected, not b".
 * Point that import at GramJS's own browser crypto (WebCrypto based), which is
 * what GramJS's browser bundle uses and which returns the global Buffer.
 */
function gramjsBrowserCrypto(): Plugin {
  return {
    name: "gramjs-browser-crypto",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]telegram[\\/]CryptoFile\.js$/.test(id)) return null;
      const patched = code.replace(
        /require\(["']crypto["']\)/,
        'require("./crypto/crypto")',
      );
      if (patched === code) {
        throw new Error("gramjs-browser-crypto: could not patch telegram/CryptoFile.js");
      }
      return { code: patched, map: null };
    },
  };
}

// Same patch for the dev server's esbuild dependency pre-bundling.
const gramjsBrowserCryptoEsbuild = {
  name: "gramjs-browser-crypto-esbuild",
  setup(build: {
    onLoad: (
      options: { filter: RegExp },
      callback: (args: { path: string }) => Promise<{ contents: string; loader: "js" }>,
    ) => void;
  }) {
    build.onLoad({ filter: /[\\/]telegram[\\/]CryptoFile\.js$/ }, async (args) => {
      const code = await fs.promises.readFile(args.path, "utf8");
      return {
        contents: code.replace(/require\(["']crypto["']\)/, 'require("./crypto/crypto")'),
        loader: "js",
      };
    });
  },
};

export default defineConfig(() => ({
  optimizeDeps: {
    esbuildOptions: {
      plugins: [gramjsBrowserCryptoEsbuild],
    },
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    gramjsBrowserCrypto(),
    dyadComponentTagger(),
    react(),
    nodePolyfills({
      // To exclude specific polyfills, add them to this list.
      exclude: [
        'fs', // Excludes the polyfill for the `fs` module.
      ],
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));