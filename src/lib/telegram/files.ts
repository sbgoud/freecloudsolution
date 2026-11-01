import { Api, TelegramClient } from 'telegram';
import {
  basename,
  buildFileCaption,
  buildFolderCaption,
  dirname,
  joinPath,
  normalizePath,
  parseCaption,
} from './meta';

export type DriveKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'archive'
  | 'doc'
  | 'other';

export interface DriveFile {
  id: number;
  name: string;
  path: string;
  folder: string;
  size: number;
  mimeType: string;
  date: number;
  kind: DriveKind;
  tagged: boolean;
  hasThumb: boolean;
  message: Api.Message;
}

export interface DriveFolderMarker {
  id: number;
  path: string;
  date: number;
}

export interface UploadItem {
  file: File;
  path: string;
}

export interface UploadOptions {
  onFileProgress?: (index: number, fraction: number) => void;
  signal?: AbortSignal;
}

const UNSORTED_FOLDER = '/Unsorted';
const BYTES_PER_MB = 1024 * 1024;
const GB = 1024 * BYTES_PER_MB;

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'heic',
  'heif',
  'avif',
  'tif',
  'tiff',
]);
const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'm4v',
  'mov',
  'mkv',
  'avi',
  'webm',
  '3gp',
  'wmv',
  'flv',
]);
const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'wav',
  'flac',
  'opus',
  'wma',
]);
const ARCHIVE_EXTENSIONS = new Set([
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'tgz',
  'bz2',
  'xz',
  'zst',
]);
const DOC_EXTENSIONS = new Set([
  'txt',
  'md',
  'csv',
  'rtf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'json',
  'xml',
  'yaml',
  'yml',
]);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/flac': 'flac',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
  'application/x-tar': 'tar',
  'application/gzip': 'gz',
  'application/json': 'json',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
};

function extensionOf(name: string): string {
  const clean = name.split('?')[0].split('#')[0];
  const index = clean.lastIndexOf('.');
  if (index < 0 || index === clean.length - 1) return '';
  return clean.slice(index + 1).toLowerCase();
}

function extensionFromMime(mimeType: string): string {
  const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
  return MIME_EXTENSIONS[mime] || '';
}

export function detectKind(mimeType: string, name = ''): DriveKind {
  const mime = (mimeType || '').toLowerCase();
  const extension = extensionOf(name) || extensionFromMime(mimeType);

  if (mime === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (
    mime === 'application/zip' ||
    mime === 'application/x-rar-compressed' ||
    mime === 'application/x-7z-compressed' ||
    mime === 'application/x-tar' ||
    mime === 'application/gzip' ||
    ARCHIVE_EXTENSIONS.has(extension)
  ) {
    return 'archive';
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('powerpoint') ||
    mime.includes('presentation') ||
    DOC_EXTENSIONS.has(extension)
  ) {
    return 'doc';
  }
  return 'other';
}

export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  const formatted =
    exponent === 0 ? String(Math.round(value)) : value.toFixed(2).replace(/\.0+$/, '');
  return `${formatted} ${units[exponent]}`;
}

function getDocument(message: Api.Message): Api.Document | undefined {
  const media = message.media;
  if (
    media instanceof Api.MessageMediaDocument &&
    media.document instanceof Api.Document
  ) {
    return media.document;
  }
  return undefined;
}

function getPhoto(message: Api.Message): Api.Photo | undefined {
  const media = message.media;
  if (media instanceof Api.MessageMediaPhoto && media.photo instanceof Api.Photo) {
    return media.photo;
  }
  return undefined;
}

function documentFileName(document: Api.Document): string | undefined {
  for (const attribute of document.attributes || []) {
    if (attribute instanceof Api.DocumentAttributeFilename) {
      return attribute.fileName;
    }
  }
  return undefined;
}

function photoSizeBytes(photo: Api.Photo): number {
  let largest = 0;
  for (const size of photo.sizes || []) {
    const value = size as unknown as {
      size?: number;
      bytes?: { length?: number };
      sizes?: number[];
    };
    if (typeof value.size === 'number') {
      largest = Math.max(largest, value.size);
    }
    if (typeof value.bytes?.length === 'number') {
      largest = Math.max(largest, value.bytes.length);
    }
    if (Array.isArray(value.sizes) && value.sizes.length > 0) {
      const last = value.sizes[value.sizes.length - 1];
      if (typeof last === 'number') largest = Math.max(largest, last);
    }
  }
  return largest;
}

function toMillis(value: unknown): number {
  const numeric = Number(value) || 0;
  if (numeric <= 0) return 0;
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}

function thumbCount(message: Api.Message): number {
  const document = getDocument(message);
  if (document) return document.thumbs?.length || 0;
  const photo = getPhoto(message);
  return photo?.sizes?.length || 0;
}

function makeFileName(message: Api.Message): { name: string; mimeType: string; size: number } {
  const document = getDocument(message);
  if (document) {
    const mimeType = document.mimeType || 'application/octet-stream';
    const filename = documentFileName(document);
    if (filename) {
      return {
        name: filename,
        mimeType,
        size: Number(document.size) || 0,
      };
    }
    const extension = extensionFromMime(mimeType);
    return {
      name: `file_${message.id}${extension ? `.${extension}` : ''}`,
      mimeType,
      size: Number(document.size) || 0,
    };
  }

  const photo = getPhoto(message);
  if (photo) {
    return {
      name: `photo_${message.id}.jpg`,
      mimeType: 'image/jpeg',
      size: photoSizeBytes(photo),
    };
  }

  return {
    name: `file_${message.id}`,
    mimeType: 'application/octet-stream',
    size: 0,
  };
}

export async function listAll(
  client: TelegramClient,
  onProgress?: (loaded: number) => void
): Promise<{ files: DriveFile[]; folders: DriveFolderMarker[] }> {
  if (!client.connected) await client.connect();

  const files: DriveFile[] = [];
  const folders: DriveFolderMarker[] = [];
  let loaded = 0;

  for await (const message of client.iterMessages('me', { limit: undefined })) {
    loaded += 1;

    const meta = parseCaption(message.message);
    if (meta?.type === 'folder') {
      folders.push({
        id: message.id,
        path: meta.path,
        date: toMillis(message.date),
      });
    } else {
      const document = getDocument(message);
      const photo = getPhoto(message);

      if (document || photo) {
        const details = makeFileName(message);
        const tagged = meta?.type === 'file';
        const path = tagged ? meta.path : joinPath(UNSORTED_FOLDER, details.name);
        const name = basename(path) || details.name;

        files.push({
          id: message.id,
          name,
          path,
          folder: dirname(path),
          size: details.size,
          mimeType: details.mimeType,
          date: toMillis(message.date),
          kind: detectKind(details.mimeType, name),
          tagged,
          hasThumb: thumbCount(message) > 0,
          message,
        });
      }
    }

    if (loaded % 100 === 0) onProgress?.(loaded);
  }

  onProgress?.(loaded);
  return { files, folders };
}

export function messageToDriveFile(
  message: Api.Message,
  path: string
): DriveFile | null {
  const document = getDocument(message);
  const photo = getPhoto(message);
  if (!document && !photo) return null;

  const details = makeFileName(message);
  const normalizedPath = normalizePath(path);
  const name = basename(normalizedPath) || details.name;

  return {
    id: message.id,
    name,
    path: normalizedPath,
    folder: dirname(normalizedPath),
    size: details.size,
    mimeType: details.mimeType,
    date: toMillis(message.date),
    kind: detectKind(details.mimeType, name),
    tagged: true,
    hasThumb: thumbCount(message) > 0,
    message,
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Upload cancelled');
  }
}

export async function uploadFiles(
  client: TelegramClient,
  items: UploadItem[],
  opts: UploadOptions = {}
): Promise<Api.Message[]> {
  if (!client.connected) await client.connect();

  const me = await client.getMe();
  const maxSize = me.premium ? 4 * GB : 2 * GB;

  for (const item of items) {
    if (item.file.size > maxSize) {
      throw new Error(
        `"${item.file.name}" is ${humanSize(item.file.size)}, but Telegram allows at most ${humanSize(maxSize)}${me.premium ? ' (Premium)' : ' on a free account'}.`
      );
    }
  }

  const messages: Api.Message[] = [];

  for (let index = 0; index < items.length; index += 1) {
    throwIfAborted(opts.signal);

    const item = items[index];
    const workers = item.file.size > 100 * BYTES_PER_MB ? 8 : 4;

    const progressCallback = (fraction: number) => {
      throwIfAborted(opts.signal);
      opts.onFileProgress?.(index, fraction);
    };

    const message = await client.sendFile('me', {
      file: item.file,
      caption: buildFileCaption(item.path),
      forceDocument: true,
      workers,
      progressCallback,
      parseMode: false,
    });

    messages.push(message);
  }

  return messages;
}

export async function createFolder(
  client: TelegramClient,
  path: string
): Promise<Api.Message> {
  if (!client.connected) await client.connect();
  return client.sendMessage('me', {
    message: buildFolderCaption(path),
    parseMode: false,
  });
}

export async function deleteItems(
  client: TelegramClient,
  messageIds: number[]
): Promise<void> {
  const ids = messageIds.filter((id) => Number.isFinite(id));
  if (ids.length === 0) return;
  if (!client.connected) await client.connect();
  await client.deleteMessages('me', ids, { revoke: true });
}

export async function renameOrMove(
  client: TelegramClient,
  file: DriveFile,
  newPath: string
): Promise<Api.Message> {
  if (!client.connected) await client.connect();
  return client.editMessage('me', {
    message: file.id,
    text: buildFileCaption(newPath),
    parseMode: false,
  });
}

function isInside(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folder);
  if (normalizedPath === normalizedFolder) return true;
  if (normalizedFolder === '/') return normalizedPath.startsWith('/');
  return normalizedPath.startsWith(`${normalizedFolder}/`);
}

function replaceFolder(path: string, oldFolder: string, newFolder: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedOld = normalizePath(oldFolder);
  const normalizedNew = normalizePath(newFolder);
  if (normalizedPath === normalizedOld) return normalizedNew;

  const suffix =
    normalizedOld === '/'
      ? normalizedPath.slice(1)
      : normalizedPath.slice(normalizedOld.length + 1);
  return joinPath(normalizedNew, suffix);
}

export async function moveFolder(
  client: TelegramClient,
  files: DriveFile[],
  markers: DriveFolderMarker[],
  oldFolder: string,
  newFolder: string
): Promise<number> {
  if (!client.connected) await client.connect();

  let changed = 0;
  const oldPath = normalizePath(oldFolder);
  const newPath = normalizePath(newFolder);

  for (const file of files) {
    if (!isInside(file.path, oldPath)) continue;
    await renameOrMove(client, file, replaceFolder(file.path, oldPath, newPath));
    changed += 1;
  }

  for (const marker of markers) {
    if (!isInside(marker.path, oldPath)) continue;
    const target = replaceFolder(marker.path, oldPath, newPath);
    await client.editMessage('me', {
      message: marker.id,
      text: buildFolderCaption(target),
      parseMode: false,
    });
    changed += 1;
  }

  return changed;
}

export async function deleteFolder(
  client: TelegramClient,
  files: DriveFile[],
  markers: DriveFolderMarker[],
  folder: string
): Promise<number> {
  const target = normalizePath(folder);
  const ids: number[] = [];

  for (const file of files) {
    if (isInside(file.path, target)) ids.push(file.id);
  }
  for (const marker of markers) {
    if (isInside(marker.path, target)) ids.push(marker.id);
  }

  await deleteItems(client, ids);
  return ids.length;
}

export async function downloadFile(
  client: TelegramClient,
  file: DriveFile,
  onProgress?: (fraction: number) => void
): Promise<Blob> {
  if (!client.connected) await client.connect();

  const data = await client.downloadMedia(file.message, {
    progressCallback: (downloaded: unknown, total: unknown) => {
      const totalNumber = Number(total);
      const downloadedNumber = Number(downloaded);
      if (totalNumber > 0) {
        onProgress?.(downloadedNumber / totalNumber);
      }
    },
  });

  if (!data) {
    throw new Error(`Could not download "${file.name}"`);
  }

  const bytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  return new Blob([bytes], {
    type: file.mimeType || 'application/octet-stream',
  });
}

export function triggerBrowserDownload(blob: Blob, name: string): void {
  if (typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name || 'download';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const thumbnailCache = new Map<number, string | null>();

export async function getThumbnail(
  client: TelegramClient,
  file: DriveFile
): Promise<string | null> {
  if (thumbnailCache.has(file.id)) {
    return thumbnailCache.get(file.id) ?? null;
  }

  const count = thumbCount(file.message);
  if (count === 0) {
    thumbnailCache.set(file.id, null);
    return null;
  }

  if (!client.connected) await client.connect();

  const preferred = count > 1 ? 1 : 0;
  const indexes = Array.from(new Set([preferred, 0]));

  for (const thumb of indexes) {
    try {
      const data = await client.downloadMedia(file.message, { thumb });
      if (!data) continue;

      const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
      if (bytes.length === 0) continue;

      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
      thumbnailCache.set(file.id, url);
      return url;
    } catch {
      continue;
    }
  }

  thumbnailCache.set(file.id, null);
  return null;
}
