import {
  File,
  FileArchive,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
} from 'lucide-react';
import type { DriveKind } from '@/lib/telegram/files';
import { cn } from '@/lib/utils';

const KIND_STYLES: Record<DriveKind, string> = {
  image: 'text-emerald-600 dark:text-emerald-400',
  video: 'text-rose-600 dark:text-rose-400',
  audio: 'text-violet-600 dark:text-violet-400',
  pdf: 'text-red-600 dark:text-red-400',
  archive: 'text-amber-600 dark:text-amber-400',
  doc: 'text-sky-600 dark:text-sky-400',
  other: 'text-slate-500 dark:text-slate-400',
};

const KIND_ICONS = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  archive: FileArchive,
  doc: FileText,
  other: File,
};

interface FileIconProps {
  kind: DriveKind;
  className?: string;
}

export function FileIcon({ kind, className }: FileIconProps) {
  const Icon = KIND_ICONS[kind] ?? File;
  return (
    <Icon
      className={cn('h-8 w-8', KIND_STYLES[kind], className)}
      strokeWidth={1.75}
      aria-hidden="true"
    />
  );
}
