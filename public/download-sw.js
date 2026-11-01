/* Service worker that turns page-fed chunks into a streaming file download. */
const STREAM_PREFIX = '/__tgdrive_dl/';
const downloads = new Map();

function safeFilename(value) {
  return String(value || 'download').replace(/["\r\n\\]/g, '_');
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'tgdrive-download-init') return;

  const port = event.ports && event.ports[0];
  if (!port) return;

  let controller;
  const stream = new ReadableStream({
    start(nextController) {
      controller = nextController;
    },
    cancel() {
      const active = downloads.get(data.id);
      if (active) {
        try {
          active.port.postMessage({ type: 'error', message: 'Download cancelled' });
        } catch (error) {
          void error;
        }
      }
      downloads.delete(data.id);
    },
  });

  downloads.set(data.id, {
    stream,
    controller,
    port,
    filename: safeFilename(data.filename),
    size: Number(data.size) || 0,
  });

  port.postMessage({ type: 'registered' });
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(STREAM_PREFIX)) return;

  const id = url.pathname.slice(STREAM_PREFIX.length);
  const entry = downloads.get(id);
  if (!entry) {
    event.respondWith(new Response('Download not found', { status: 404 }));
    return;
  }

  const { stream, controller, port, filename, size } = entry;

  port.onmessage = (messageEvent) => {
    const data = messageEvent.data;
    if (!data) return;

    if (data.type === 'chunk') {
      try {
        const chunk = data.chunk instanceof Uint8Array ? data.chunk : new Uint8Array(data.chunk);
        controller.enqueue(chunk);
        port.postMessage({ type: 'ack' });
      } catch (error) {
        port.postMessage({
          type: 'error',
          message: error && error.message ? error.message : 'Could not write chunk',
        });
      }
      return;
    }

    if (data.type === 'close') {
      try {
        controller.close();
      } catch (error) {
        void error;
      }
      downloads.delete(id);
      return;
    }

    if (data.type === 'abort') {
      try {
        controller.error(new Error(data.message || 'Download cancelled'));
      } catch (error) {
        void error;
      }
      downloads.delete(id);
    }
  };
  port.start();

  const headers = new Headers();
  headers.set('Content-Type', 'application/octet-stream');
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '_');
  let encodedFilename = '';
  try {
    encodedFilename = encodeURIComponent(filename);
  } catch (error) {
    void error;
  }
  headers.set(
    'Content-Disposition',
    encodedFilename
      ? `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
      : `attachment; filename="${asciiFilename}"`
  );
  if (size > 0) headers.set('Content-Length', String(size));

  port.postMessage({ type: 'ready' });
  event.respondWith(new Response(stream, { status: 200, headers }));
});
