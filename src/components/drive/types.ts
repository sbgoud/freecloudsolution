import type { Api } from 'telegram';
import type { DriveFile } from '@/lib/telegram/files';

export interface FolderEntry {
  path: string;
  name: string;
  parent: string;
  date: number;
}

export interface FolderTreeNode {
  path: string;
  name: string;
  children: FolderTreeNode[];
}

export type ViewMode = 'grid' | 'list';

export type ItemTarget =
  | { type: 'file'; file: DriveFile }
  | { type: 'folder'; folder: FolderEntry };

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'done'
  | 'error'
  | 'cancelled';

export interface UploadTask {
  id: number;
  file: File;
  path: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  splitId?: string;
  uploadedParts?: { index: number; message: Api.Message }[];
  partIndex?: number;
  partCount?: number;
}
