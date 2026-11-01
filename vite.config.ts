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
const SERIALIZE_BYTES_CHECK = /if \(!\(data instanceof Buffer\)\) \{\s*if \(typeof data == "string"\) \{\s*data = Buffer\.from\(data\);\s*\}/;
const SERIALIZE_BYTES_FIX =
  'if (!(data instanceof Buffer)) { if (typeof data == "string") { data = Buffer.from(data); } else if (data instanceof Uint8Array || (data && ArrayBuffer.isView(data))) { data = Buffer.from(data.buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : data); }';

/** Source patches for GramJS so it behaves in the browser bundle. */
function patchGramjsSource(id: string, code: string): string | null {
  if (/[\\/]telegram[\\/]CryptoFile\.js$/.test(id)) {
    const patched = code.replace(/require\(["']crypto["']\)/, 'require("./crypto/crypto")');
    if (patched === code) throw new Error("gramjs patch: could not patch telegram/CryptoFile.js");
    return patched;
  }
  if (/[\\/]telegram[\\/]tl[\\/]generationHelpers\.js$/.test(id)) {
    // Accept any Uint8Array / Buffer copy (e.g. a Buffer from another
    // polyfill instance) instead of throwing "Bytes or str expected".
    const patched = code.replace(SERIALIZE_BYTES_CHECK, SERIALIZE_BYTES_FIX);
    if (patched === code) throw new Error("gramjs patch: could not patch telegram/tl/generationHelpers.js");
    return patched;
  }
  return null;
}

function gramjsBrowserCrypto(): Plugin {
  return {
    name: "gramjs-browser-crypto",
    enforce: "pre",
    transform(code, id) {
      const patched = patchGramjsSource(id, code);
      return patched === null ? null : { code: patched, map: null };
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
    build.onLoad({ filter: /[\/]telegram[\/](CryptoFile|tl[\/]generationHelpers)\.js$/ }, async (args) => {
      const code = await fs.promises.readFile(args.path, "utf8");
      return { contents: patchGramjsSource(args.path, code) ?? code, loader: "js" };
    });
  },
};

const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);

export default defineConfig(() => ({
  define: {
    __TG_DRIVE_BUILD__: JSON.stringify(BUILD_ID),
  },
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