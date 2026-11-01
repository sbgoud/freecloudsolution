import { Buffer as BufferPolyfill } from 'buffer';

interface ProcessShim {
  env: { NODE_ENV: string };
  versions: Record<string, string>;
  cwd: () => string;
  nextTick: (callback: () => void) => void;
}

const globalScope = globalThis as unknown as {
  process?: ProcessShim;
  Buffer?: typeof BufferPolyfill;
};

if (typeof globalScope.process === 'undefined') {
  globalScope.process = {
    env: {
      NODE_ENV: 'development',
    },
    versions: {},
    cwd: () => '/',
    nextTick: (callback: () => void) => setTimeout(callback, 0),
  };
}

if (typeof globalScope.Buffer === 'undefined') {
  globalScope.Buffer = BufferPolyfill;
}
