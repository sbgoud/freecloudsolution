import { Api, TelegramClient } from 'telegram';
import { sendBlobAsDocument } from './upload';
import {
  basename,
  buildFileCaption,
  buildFolderCaption,
  createSplitId,
  dirname,
  joinPath,
  normalizePath,
  parseCaption,
  type SplitMeta,
} from './meta';
import {
  canUseFileSystemAccess,
  canUseServiceWorkerStream,
  createFileSystemWriter,
  createServiceWorkerWriter,
  type DownloadWriter,
} from '@/lib/download/stream';

export type DriveKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'archive'
  | 'doc'
  | 'other';

export interface DrivePart {
  index: number;
  messageId: number;
  size: number;
  message: Api.Message;
}

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
  parts?: DrivePart[];
  splitId?: string;
  partCount?: number;
  complete?: boolean;
}

export interface DriveFolderMarker {
  id: number;
  path: string;
  date: number;
}

export interface UploadedPart {
  index: number;
  message: Api.Message;
}

export interface UploadItem {
  file: File;
  path: string;
  splitId?: string;
  uploadedParts?: UploadedPart[];
}

export interface UploadPartProgress {
  index: number;
  count: number;
}

export interface UploadOptions {
  onFileProgress?: (
    index: number,
    fraction: number,
    part?: UploadPartProgress
  ) => void;
  onPartUploaded?: (
    index: number,
    message: Api.Message,
    splitId: string
  ) => void;
  signal?: AbortSignal;
}

export interface UploadResult {
  file: DriveFile;
  splitId?: string;
  parts: UploadedPart[];
}

const UNSORTED_FOLDER = '/Unsorted';
const BYTES_PER_MB = 1024 * 1024;
const GB = 1024 * BYTES_PER_MB;
export const PART_SIZE = 1.5 * GB;
const STREAM_DOWNLOAD_THRESHOLD = 200 * BYTES_PER_MB;
const BLOB_FALLBACK_LIMIT = 500 * BYTES_PER_MB;
const DOWNLOAD_REQUEST_SIZE = 512 * 1024;

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

interface SplitGroup {
  split: SplitMeta;
  path: string;
  date: number;
  parts: DrivePart[];
}

function buildSplitDriveFile(group: SplitGroup): DriveFile {
  const parts = [...group.parts].sort((a, b) => a.index - b.index);
  const representative = parts[0];
  const count = group.split.n;
  const present = new Set(parts.map((part) => part.index));
  const complete =
    parts.length === count &&
    present.size === count &&
    parts.every((part) => part.index >= 0 && part.index < count);
  const name = basename(group.path) || group.split.name || `file_${representative.messageId}`;
  const mimeType = group.split.mime || 'application/octet-stream';

  return {
    id: representative.messageId,
    name,
    path: group.path,
    folder: dirname(group.path),
    size: group.split.size || parts.reduce((sum, part) => sum + part.size, 0),
    mimeType,
    date: group.date,
    kind: detectKind(mimeType, name),
    tagged: true,
    hasThumb: false,
    message: representative.message,
    parts,
    splitId: group.split.id,
    partCount: count,
    complete,
  };
}

export async function listAll(
  client: TelegramClient,
  onProgress?: (loaded: number) => void
): Promise<{ files: DriveFile[]; folders: DriveFolderMarker[] }> {
  if (!client.connected) await client.connect();

  const files: DriveFile[] = [];
  const folders: DriveFolderMarker[] = [];
  const splitGroups = new Map<string, SplitGroup>();
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

        if (meta?.split && document) {
          const existing = splitGroups.get(meta.split.id);
          const group = existing ?? {
            split: meta.split,
            path: meta.path,
            date: 0,
            parts: [],
          };
          if (meta.split.i === 0) group.path = meta.path;
          group.date = Math.max(group.date, toMillis(message.date));
          group.parts.push({
            index: meta.split.i,
            messageId: message.id,
            size: Number(document.size) || details.size,
            message,
          });
          splitGroups.set(meta.split.id, group);
        } else {
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
    }

    if (loaded % 100 === 0) onProgress?.(loaded);
  }

  for (const group of splitGroups.values()) {
    files.push(buildSplitDriveFile(group));
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

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function uploadPartWithRetry(
  client: TelegramClient,
  partFile: File,
  caption: string,
  workers: number,
  progressCallback: (fraction: number) => void,
  signal?: AbortSignal
): Promise<Api.Message> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await sendBlobAsDocument(client, partFile, partFile.name, caption, {
        workers,
        signal,
        onProgress: progressCallback,
      });
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw new Error('Upload cancelled');
      if (attempt >= 3) break;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Upload failed');
}

export async function uploadFiles(
  client: TelegramClient,
  items: UploadItem[],
  opts: UploadOptions = {}
): Promise<UploadResult[]> {
  if (!client.connected) await client.connect();

  const results: UploadResult[] = [];

  for (let index = 0; index < items.length; index += 1) {
    throwIfAborted(opts.signal);

    const item = items[index];
    const totalSize = item.file.size;
    const mimeType = item.file.type || 'application/octet-stream';

    if (totalSize <= PART_SIZE) {
      const workers = totalSize > 100 * BYTES_PER_MB ? 8 : 4;
      const progressCallback = (fraction: number) => {
        throwIfAborted(opts.signal);
        opts.onFileProgress?.(index, fraction);
      };

      const message = await uploadPartWithRetry(
        client,
        item.file,
        buildFileCaption(item.path),
        workers,
        progressCallback,
        opts.signal
      );

      const file = messageToDriveFile(message, item.path);
      if (!file) throw new Error(`Could not upload "${item.file.name}"`);
      results.push({ file, parts: [] });
      continue;
    }

    const splitId = item.splitId || createSplitId();
    const partCount = Math.ceil(totalSize / PART_SIZE);
    const originalName = item.file.name;
    const uploaded = new Map<number, Api.Message>(
      (item.uploadedParts || []).map((part) => [part.index, part.message])
    );
    const parts: UploadedPart[] = [...(item.uploadedParts || [])];
    const workers = 8;

    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      throwIfAborted(opts.signal);

      const existing = uploaded.get(partIndex);
      if (existing) {
        const uploadedBytes = Math.min(partIndex * PART_SIZE, totalSize);
        opts.onFileProgress?.(index, uploadedBytes / totalSize, {
          index: partIndex,
          count: partCount,
        });
        continue;
      }

      const start = partIndex * PART_SIZE;
      const end = Math.min(start + PART_SIZE, totalSize);
      const partLength = end - start;
      const partName = `${originalName}.part${String(partIndex + 1).padStart(3, '0')}`;
      const partFile = new File([item.file.slice(start, end)], partName, {
        type: mimeType,
      });
      const split: SplitMeta = {
        id: splitId,
        i: partIndex,
        n: partCount,
        size: totalSize,
        name: originalName,
        mime: mimeType,
      };

      const progressCallback = (fraction: number) => {
        throwIfAborted(opts.signal);
        const overall = Math.min(1, (start + fraction * partLength) / totalSize);
        opts.onFileProgress?.(index, overall, {
          index: partIndex,
          count: partCount,
        });
      };

      const message = await uploadPartWithRetry(
        client,
        partFile,
        buildFileCaption(item.path, split),
        workers,
        progressCallback,
        opts.signal
      );

      uploaded.set(partIndex, message);
      parts.push({ index: partIndex, message });
      opts.onPartUploaded?.(partIndex, message, splitId);
    }

    parts.sort((a, b) => a.index - b.index);
    const driveParts: DrivePart[] = parts.map((part) => ({
      index: part.index,
      messageId: part.message.id,
      size: Number(getDocument(part.message)?.size) || 0,
      message: part.message,
    }));
    const name = basename(item.path) || originalName;

    results.push({
      file: {
        id: driveParts[0].messageId,
        name,
        path: normalizePath(item.path),
        folder: dirname(item.path),
        size: totalSize,
        mimeType,
        date: parts.reduce(
          (latest, part) => Math.max(latest, toMillis(part.message.date)),
          0
        ),
        kind: detectKind(mimeType, name),
        tagged: true,
        hasThumb: false,
        message: driveParts[0].message,
        parts: driveParts,
        splitId,
        partCount,
        complete: driveParts.length === partCount,
      },
      splitId,
      parts,
    });
  }

  return results;
}

export function fileMessageIds(file: DriveFile): number[] {
  if (file.parts && file.parts.length > 0) {
    return file.parts.map((part) => part.messageId);
  }
  return [file.id];
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

  if (!file.parts || file.parts.length === 0) {
    return client.editMessage('me', {
      message: file.id,
      text: buildFileCaption(newPath),
      parseMode: false,
    });
  }

  const targetName = basename(newPath) || file.name;
  const partCount = file.partCount || file.parts.length;
  const splitId = file.splitId || createSplitId();
  const parts = [...file.parts].sort((a, b) => a.index - b.index);
  let representative: Api.Message | null = null;

  for (const part of parts) {
    const split: SplitMeta = {
      id: splitId,
      i: part.index,
      n: partCount,
      size: file.size,
      name: targetName,
      mime: file.mimeType,
    };
    const updated = await client.editMessage('me', {
      message: part.messageId,
      text: buildFileCaption(newPath, split),
      parseMode: false,
    });
    if (!representative) representative = updated;
  }

  return representative as Api.Message;
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
  let count = 0;

  for (const file of files) {
    if (isInside(file.path, target)) {
      ids.push(...fileMessageIds(file));
      count += 1;
    }
  }
  for (const marker of markers) {
    if (isInside(marker.path, target)) {
      ids.push(marker.id);
      count += 1;
    }
  }

  await deleteItems(client, ids);
  return count;
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

export interface DownloadOptions {
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

export interface DownloadOutcome {
  method: 'filesystem' | 'stream' | 'blob';
  blob?: Blob;
}

function documentLocation(document: Api.Document): Api.InputDocumentFileLocation {
  return new Api.InputDocumentFileLocation({
    id: document.id,
    accessHash: document.accessHash,
    fileReference: document.fileReference,
    thumbSize: '',
  });
}

function uint8View(value: Uint8Array): Uint8Array {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

async function streamFileToWriter(
  client: TelegramClient,
  file: DriveFile,
  writer: DownloadWriter,
  opts: DownloadOptions
): Promise<void> {
  if (file.parts && file.complete === false) {
    throw new Error('This file is incomplete and cannot be downloaded.');
  }

  const parts: DrivePart[] =
    file.parts && file.parts.length > 0
      ? [...file.parts].sort((a, b) => a.index - b.index)
      : [
          {
            index: 0,
            messageId: file.id,
            size: file.size,
            message: file.message,
          },
        ];

  if (!client.connected) await client.connect();

  const total = file.size || parts.reduce((sum, part) => sum + part.size, 0);
  let loaded = 0;

  try {
    for (const part of parts) {
      throwIfAborted(opts.signal);
      const document = getDocument(part.message);

      if (!document) {
        throw new Error(`Could not find part ${part.index + 1} of "${file.name}"`);
      }

      for await (const chunk of client.iterDownload({
        file: documentLocation(document),
        dcId: document.dcId,
        requestSize: DOWNLOAD_REQUEST_SIZE,
      })) {
        throwIfAborted(opts.signal);
        const bytes = uint8View(chunk as Uint8Array);
        if (bytes.length === 0) continue;
        await writer.write(bytes);
        loaded += bytes.length;
        opts.onProgress?.(loaded, total);
      }
    }

    await writer.close();
  } catch (error) {
    try {
      await writer.abort?.(error);
    } catch {
      // Ignore abort failures.
    }
    throw error;
  }
}

export async function downloadDriveFile(
  client: TelegramClient,
  file: DriveFile,
  opts: DownloadOptions = {}
): Promise<DownloadOutcome> {
  if (file.parts && file.complete === false) {
    throw new Error(
      `"${file.name}" is incomplete (${file.parts.length}/${file.partCount ?? '?'} parts), so it cannot be downloaded.`
    );
  }

  const streaming =
    Boolean(file.parts && file.parts.length > 0) ||
    file.size > STREAM_DOWNLOAD_THRESHOLD;

  if (streaming) {
    if (canUseFileSystemAccess()) {
      let writer: DownloadWriter | null = null;
      try {
        writer = await createFileSystemWriter(file.name);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Download cancelled');
        }
        // The picker is unavailable here; try the service worker instead.
      }
      if (writer) {
        await streamFileToWriter(client, file, writer, opts);
        return { method: 'filesystem' };
      }
    }

    if (canUseServiceWorkerStream()) {
      const writer = await createServiceWorkerWriter(
        file.name,
        file.size,
        opts.signal
      ).catch(() => null);
      if (writer) {
        await streamFileToWriter(client, file, writer, opts);
        return { method: 'stream' };
      }
    }

    if (file.parts?.length || file.size > BLOB_FALLBACK_LIMIT) {
      throw new Error(
        'This browser does not support streaming downloads. Please try a desktop browser such as Chrome or Edge.'
      );
    }

    const blob = await downloadFile(client, file, (fraction) => {
      opts.onProgress?.(fraction * file.size, file.size);
    });
    return { method: 'blob', blob };
  }

  const blob = await downloadFile(client, file, (fraction) => {
    opts.onProgress?.(fraction * file.size, file.size);
  });
  return { method: 'blob', blob };
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
