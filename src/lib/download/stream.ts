export interface DownloadWriter {
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: (reason?: unknown) => Promise<void> | void;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}

interface WritableFileStream {
  write: (data: BufferSource) => Promise<void>;
  close: () => Promise<void>;
  abort?: (reason?: unknown) => Promise<void>;
}

interface SaveFileHandle {
  createWritable: () => Promise<WritableFileStream>;
}

type ShowSaveFilePicker = (
  options?: SaveFilePickerOptions
) => Promise<SaveFileHandle>;

const SW_URL = '/download-sw.js';
const STREAM_URL_PREFIX = '/__tgdrive_dl/';
const HANDSHAKE_TIMEOUT = 15_000;
const IFRAME_LIFETIME = 60_000;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function getSaveFilePicker(): ShowSaveFilePicker | null {
  if (typeof window === 'undefined') return null;
  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker })
    .showSaveFilePicker;
  return typeof picker === 'function' ? picker : null;
}

export function canUseFileSystemAccess(): boolean {
  return getSaveFilePicker() !== null;
}

export function canUseServiceWorkerStream(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof MessageChannel !== 'undefined'
  );
}

export function registerDownloadServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorkerStream()) return Promise.resolve(null);
  if (registrationPromise) return registrationPromise;

  registrationPromise = navigator.serviceWorker
    .register(SW_URL, { scope: '/' })
    .then(async (registration) => {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => window.setTimeout(resolve, HANDSHAKE_TIMEOUT)),
      ]);
      if (!registration.active) {
        registrationPromise = null;
        return null;
      }
      return registration;
    })
    .catch(() => {
      registrationPromise = null;
      return null;
    });

  return registrationPromise;
}

function waitForController(timeout = HANDSHAKE_TIMEOUT): Promise<boolean> {
  if (navigator.serviceWorker.controller) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(value);
    };
    const onChange = () => finish(Boolean(navigator.serviceWorker.controller));
    const timer = window.setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), timeout);
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });
}

export async function createFileSystemWriter(
  filename: string
): Promise<DownloadWriter | null> {
  const picker = getSaveFilePicker();
  if (!picker) return null;

  const handle = await picker({ suggestedName: filename || 'download' });
  const writable = await handle.createWritable();
  let closed = false;

  return {
    async write(chunk) {
      if (closed) throw new Error('Download stream is already closed');
      await writable.write(chunk);
    },
    async close() {
      if (closed) return;
      closed = true;
      await writable.close();
    },
    async abort(reason) {
      if (closed) return;
      closed = true;
      try {
        await writable.abort?.(reason);
      } catch {
        // The stream may already be closed by the browser.
      }
    },
  };
}

function randomId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface StreamMessage {
  type?: string;
  message?: string;
}

export async function createServiceWorkerWriter(
  filename: string,
  size: number,
  signal?: AbortSignal
): Promise<DownloadWriter | null> {
  if (!canUseServiceWorkerStream()) return null;

  const registration = await registerDownloadServiceWorker();
  if (!registration) return null;
  if (!(await waitForController())) return null;

  const worker = navigator.serviceWorker.controller;
  if (!worker) return null;

  const id = randomId();
  const channel = new MessageChannel();
  const port = channel.port1;

  let resolveRegistered: (() => void) | null = null;
  let rejectRegistered: ((error: Error) => void) | null = null;
  let resolveReady: (() => void) | null = null;
  let rejectReady: ((error: Error) => void) | null = null;
  let pendingAck: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;
  let failure: Error | null = null;
  let finished = false;

  const registered = new Promise<void>((resolve, reject) => {
    resolveRegistered = resolve;
    rejectRegistered = reject;
  });
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Avoid an unhandled rejection when one of the handshakes never resolves.
  void registered.catch(() => undefined);
  void ready.catch(() => undefined);

  const fail = (error: Error) => {
    if (failure) return;
    failure = error;
    pendingAck?.reject(error);
    pendingAck = null;
    rejectRegistered?.(error);
    rejectReady?.(error);
  };

  port.onmessage = (event: MessageEvent<StreamMessage>) => {
    const data = event.data || {};
    switch (data.type) {
      case 'registered':
        resolveRegistered?.();
        break;
      case 'ready':
        resolveReady?.();
        break;
      case 'ack':
        pendingAck?.resolve();
        pendingAck = null;
        break;
      case 'error':
        fail(new Error(data.message || 'Streaming download failed'));
        break;
      default:
        break;
    }
  };
  port.start();

  const onAbort = () => {
    if (finished) return;
    try {
      port.postMessage({ type: 'abort', message: 'Download cancelled' });
    } catch {
      // Ignore.
    }
    fail(new Error('Download cancelled'));
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const withTimeout = <T,>(promise: Promise<T>, label: string): Promise<T> => {
    let timer = 0;
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(
        () => reject(new Error(`Timed out waiting for ${label}`)),
        HANDSHAKE_TIMEOUT
      );
    });
    return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
  };

  let iframe: HTMLIFrameElement | null = null;

  const cleanup = () => {
    signal?.removeEventListener('abort', onAbort);
    // Give the close/abort message a chance to reach the service worker.
    window.setTimeout(() => {
      try {
        port.close();
      } catch {
        // Ignore.
      }
    }, 1000);
    if (iframe) {
      const current = iframe;
      window.setTimeout(() => current.remove(), IFRAME_LIFETIME);
      iframe = null;
    }
  };

  try {
    worker.postMessage(
      { type: 'tgdrive-download-init', id, filename: filename || 'download', size },
      [channel.port2]
    );
    await withTimeout(registered, 'service worker registration');

    if (!document.body) throw new Error('Document is not ready for downloads');
    iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.src = `${STREAM_URL_PREFIX}${id}`;
    document.body.appendChild(iframe);

    await withTimeout(ready, 'stream start');

    if (failure) throw failure;
    if (signal?.aborted) throw new Error('Download cancelled');

    return {
      async write(chunk) {
        if (failure) throw failure;
        if (finished) throw new Error('Download stream is already closed');
        if (signal?.aborted) throw new Error('Download cancelled');

        await new Promise<void>((resolve, reject) => {
          pendingAck = { resolve, reject };
          const copy = new Uint8Array(chunk);
          try {
            port.postMessage({ type: 'chunk', chunk: copy }, [copy.buffer]);
          } catch (error) {
            pendingAck = null;
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      },
      async close() {
        if (finished) return;
        finished = true;
        try {
          port.postMessage({ type: 'close' });
        } catch {
          // Ignore.
        }
        cleanup();
      },
      async abort(reason) {
        if (finished) return;
        finished = true;
        try {
          port.postMessage({
            type: 'abort',
            message: reason instanceof Error ? reason.message : String(reason || 'Download cancelled'),
          });
        } catch {
          // Ignore.
        }
        cleanup();
      },
    };
  } catch (error) {
    try {
      port.postMessage({ type: 'abort', message: 'Download cancelled' });
    } catch {
      // Ignore.
    }
    cleanup();
    throw error;
  }
}
