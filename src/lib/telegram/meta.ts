export type CaptionType = 'file' | 'folder';

export interface CaptionMeta {
  type: CaptionType;
  path: string;
}

const CAPTION_HEADER = '#tgdrive';
const MAX_CAPTION_LENGTH = 1024;

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

export function buildFileCaption(path: string): string {
  const normalized = normalizePath(path);
  const caption = `${CAPTION_HEADER}\n${JSON.stringify({ v: 1, path: normalized })}`;
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

  return {
    type: record.type === 'folder' ? 'folder' : 'file',
    path: normalizePath(record.path),
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
