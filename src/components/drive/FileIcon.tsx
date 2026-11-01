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
  image: 'text-emerald-500',
  video: 'text-rose-500',
  audio: 'text-violet-500',
  pdf: 'text-red-500',
  archive: 'text-amber-500',
  doc: 'text-sky-500',
  other: 'text-slate-500',
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
  return <Icon className={cn('h-8 w-8', KIND_STYLES[kind], className)} />;
}
