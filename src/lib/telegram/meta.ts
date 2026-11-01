export type CaptionType = 'file' | 'folder';

export interface SplitMeta {
  id: string;
  i: number;
  n: number;
  size: number;
  name: string;
  mime: string;
}

export interface CaptionMeta {
  type: CaptionType;
  path: string;
  split?: SplitMeta;
}

const CAPTION_HEADER = '#tgdrive';
const MAX_CAPTION_LENGTH = 1024;
const SPLIT_ID_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function createSplitId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  let id = '';
  for (const byte of bytes) {
    id += SPLIT_ID_ALPHABET[byte % SPLIT_ID_ALPHABET.length];
  }
  return id;
}

export function normalizePath(input: string): string {
  if (!input) return '/';
  const raw = String(input).replace(/\\/g, '/');
  const stack: string[] = [];

  for (const segment of raw.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }

  return `/${stack.join('/')}`;
}

export function dirname(input: string): string {
  const path = normalizePath(input);
  if (path === '/') return '/';
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}

export function basename(input: string): string {
  const path = normalizePath(input);
  if (path === '/') return '';
  return path.slice(path.lastIndexOf('/') + 1);
}

export function joinPath(...parts: string[]): string {
  const value = parts
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => String(part))
    .join('/');
  return normalizePath(value);
}

function ensureCaptionLength(caption: string, path: string): string {
  if (caption.length > MAX_CAPTION_LENGTH) {
    throw new Error(
      `Caption metadata is too long (${caption.length} characters, maximum is ${MAX_CAPTION_LENGTH}) for path "${path}"`
    );
  }
  return caption;
}

export function buildFileCaption(path: string, split?: SplitMeta): string {
  const normalized = normalizePath(path);
  const sanitizedSplit = split
    ? {
        id: split.id,
        i: split.i,
        n: split.n,
        size: split.size,
        name: split.name,
        mime: (split.mime || 'application/octet-stream').slice(0, 128),
      }
    : undefined;

  const makeCaption = (name: string): string =>
    `${CAPTION_HEADER}\n${JSON.stringify(
      sanitizedSplit
        ? { v: 1, path: normalized, split: { ...sanitizedSplit, name } }
        : { v: 1, path: normalized }
    )}`;

  if (!sanitizedSplit) {
    return ensureCaptionLength(makeCaption(''), normalized);
  }

  let name = sanitizedSplit.name || basename(normalized);
  let caption = makeCaption(name);

  while (caption.length > MAX_CAPTION_LENGTH && name.length > 0) {
    const excess = caption.length - MAX_CAPTION_LENGTH;
    name = name.slice(0, Math.max(0, name.length - excess - 1));
    caption = makeCaption(name);
  }

  return ensureCaptionLength(caption, normalized);
}

export function buildFolderCaption(path: string): string {
  const normalized = normalizePath(path);
  const caption = `${CAPTION_HEADER}\n${JSON.stringify({
    v: 1,
    type: 'folder',
    path: normalized,
  })}`;
  return ensureCaptionLength(caption, normalized);
}

function parseSplitMeta(value: unknown): SplitMeta | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id) return undefined;
  if (!Number.isInteger(record.i) || Number(record.i) < 0) return undefined;
  if (!Number.isInteger(record.n) || Number(record.n) < 1) return undefined;
  if (!Number.isFinite(Number(record.size)) || Number(record.size) < 0) {
    return undefined;
  }

  const index = Number(record.i);
  const count = Number(record.n);
  if (index >= count) return undefined;

  return {
    id: record.id,
    i: index,
    n: count,
    size: Number(record.size),
    name: typeof record.name === 'string' ? record.name : '',
    mime:
      typeof record.mime === 'string'
        ? record.mime
        : 'application/octet-stream',
  };
}

function parseJsonLine(line: string): CaptionMeta | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (typeof record.path !== 'string') return null;
  if (
    record.type !== undefined &&
    record.type !== 'file' &&
    record.type !== 'folder'
  ) {
    return null;
  }

  const split = parseSplitMeta(record.split);
  return {
    type: record.type === 'folder' ? 'folder' : 'file',
    path: normalizePath(record.path),
    ...(split ? { split } : {}),
  };
}

export function parseCaption(text: string | null | undefined): CaptionMeta | null {
  if (!text) return null;

  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim());

  const firstLine = lines[0];
  if (!firstLine) return null;

  if (firstLine === CAPTION_HEADER) {
    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) continue;

      const parsed = parseJsonLine(line);
      if (parsed) return parsed;

      const legacyPath = /^path=(.+)$/i.exec(line);
      if (legacyPath) {
        return { type: 'file', path: normalizePath(legacyPath[1].trim()) };
      }
    }
    return null;
  }

  const legacy = /^#tgdrive\s+path=(.+)$/i.exec(firstLine);
  if (legacy) {
    return { type: 'file', path: normalizePath(legacy[1].trim()) };
  }

  return null;
}
