// Polyfill for process global
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {
      NODE_ENV: 'development'
    },
    versions: {},
    cwd: () => '/',
    nextTick: (callback: () => void) => setTimeout(callback, 0)
  };
}

// Polyfill for Buffer
if (typeof Buffer === 'undefined') {
  (window as any).Buffer = require('buffer').Buffer;
}