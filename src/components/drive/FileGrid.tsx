import { AlertTriangle, Folder } from 'lucide-react';
import type { TelegramClient } from 'telegram';
import { Checkbox } from '@/components/ui/checkbox';
import { humanSize, type DriveFile } from '@/lib/telegram/files';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { DriveThumbnail } from './DriveThumbnail';
import { formatDateShort } from './format';
import { ItemMenu } from './ItemMenu';
import type { FolderEntry, ItemTarget } from './types';

interface FileGridProps {
  client: TelegramClient | null;
  files: DriveFile[];
  folders: FolderEntry[];
  selectedIds: Set<number>;
  showPath?: boolean;
  onToggleSelect: (file: DriveFile) => void;
  onOpenFolder: (folder: FolderEntry) => void;
  onOpenFile: (file: DriveFile) => void;
  onDownloadFile: (file: DriveFile) => void;
  onRename: (target: ItemTarget) => void;
  onMove: (target: ItemTarget) => void;
  onDelete: (target: ItemTarget) => void;
}

export function FileGrid({
  client,
  files,
  folders,
  selectedIds,
  showPath,
  onToggleSelect,
  onOpenFolder,
  onOpenFile,
  onDownloadFile,
  onRename,
  onMove,
  onDelete,
}: FileGridProps) {
  const isMobile = useIsMobile();

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 2xl:grid-cols-5">
      {folders.map((folder) => (
        <div
          key={`folder:${folder.path}`}
          role="button"
          tabIndex={0}
          className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-smooth hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0"
          onClick={() => onOpenFolder(folder)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenFolder(folder);
            }
          }}
          aria-label={`Open folder ${folder.name}`}
        >
          <div className="relative flex aspect-[4/3] items-center justify-center bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.10),transparent_68%)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/10 bg-card/80 text-primary shadow-sm backdrop-blur-sm transition-transform duration-200 ease-smooth group-hover:scale-105">
              <Folder
                className="h-7 w-7 fill-primary/15"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <div
              className="absolute right-1.5 top-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
              onClick={(event) => event.stopPropagation()}
            >
              <ItemMenu
                target={{ type: 'folder', folder }}
                onOpen={() => onOpenFolder(folder)}
                onRename={() => onRename({ type: 'folder', folder })}
                onMove={() => onMove({ type: 'folder', folder })}
                onDelete={() => onDelete({ type: 'folder', folder })}
              />
            </div>
          </div>
          <div className="min-w-0 border-t bg-card px-3 py-2.5">
            <p className="truncate text-[13px] font-medium" title={folder.name}>
              {folder.name}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {showPath ? folder.parent || '/' : formatDateShort(folder.date)}
            </p>
          </div>
        </div>
      ))}

      {files.map((file) => {
        const selected = selectedIds.has(file.id);
        const incomplete = Boolean(file.parts && file.complete === false);
        return (
          <div
            key={`file:${file.id}`}
            role="button"
            tabIndex={0}
            className={cn(
              'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-smooth hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0',
              selected &&
                'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]'
            )}
            onClick={() => {
              if (isMobile) onOpenFile(file);
            }}
            onDoubleClick={() => onOpenFile(file)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onOpenFile(file);
              }
            }}
            aria-label={`${file.name}${selected ? ', selected' : ''}`}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <DriveThumbnail client={client} file={file} />
              <div
                className={cn(
                  'absolute left-2 top-2 z-10 transition-opacity duration-150',
                  selected
                    ? 'opacity-100'
                    : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
                )}
                onClick={(event) => event.stopPropagation()}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-background/90 shadow-sm backdrop-blur">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(file)}
                    aria-label={`Select ${file.name}`}
                  />
                </span>
              </div>
              <div
                className="absolute right-1.5 top-1.5 z-10 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                <ItemMenu
                  target={{ type: 'file', file }}
                  onDownload={() => onDownloadFile(file)}
                  downloadDisabled={incomplete}
                  onRename={() => onRename({ type: 'file', file })}
                  onMove={() => onMove({ type: 'file', file })}
                  onDelete={() => onDelete({ type: 'file', file })}
                />
              </div>
              {incomplete ? (
                <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 backdrop-blur dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Incomplete — {file.parts?.length ?? 0}/{file.partCount ?? '?'} parts
                </span>
              ) : null}
            </div>
            <div className="min-w-0 border-t bg-card px-3 py-2.5">
              <p className="truncate text-[13px] font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] tabular-nums text-muted-foreground">
                {showPath
                  ? file.folder || '/'
                  : `${humanSize(file.size)} · ${formatDateShort(file.date)}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
