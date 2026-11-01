import { Folder } from 'lucide-react';
import type { TelegramClient } from 'telegram';
import { Checkbox } from '@/components/ui/checkbox';
import { humanSize, type DriveFile } from '@/lib/telegram/files';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { DriveThumbnail } from './DriveThumbnail';
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {folders.map((folder) => (
        <div
          key={`folder:${folder.path}`}
          role="button"
          tabIndex={0}
          className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpenFolder(folder)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenFolder(folder);
            }
          }}
        >
          <div className="relative flex aspect-[4/3] items-center justify-center bg-muted/40">
            <Folder className="h-12 w-12 fill-sky-500/15 text-sky-500" />
            <div className="absolute right-1.5 top-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              <ItemMenu
                target={{ type: 'folder', folder }}
                onOpen={() => onOpenFolder(folder)}
                onRename={() => onRename({ type: 'folder', folder })}
                onMove={() => onMove({ type: 'folder', folder })}
                onDelete={() => onDelete({ type: 'folder', folder })}
              />
            </div>
          </div>
          <div className="min-w-0 p-2.5">
            <p className="truncate text-sm font-medium" title={folder.name}>
              {folder.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {showPath ? folder.parent || '/' : 'Folder'}
            </p>
          </div>
        </div>
      ))}

      {files.map((file) => {
        const selected = selectedIds.has(file.id);
        return (
          <div
            key={`file:${file.id}`}
            role="button"
            tabIndex={0}
            className={cn(
              'group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected && 'border-primary ring-2 ring-primary/30'
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
          >
            <div className="relative aspect-[4/3]">
              <DriveThumbnail client={client} file={file} />
              <div
                className={cn(
                  'absolute left-2 top-2 transition-opacity',
                  selected
                    ? 'opacity-100'
                    : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'
                )}
                onClick={(event) => event.stopPropagation()}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(file)}
                  aria-label={`Select ${file.name}`}
                  className="border-white/80 bg-background/80 shadow-sm"
                />
              </div>
              <div
                className="absolute right-1.5 top-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                <ItemMenu
                  target={{ type: 'file', file }}
                  onDownload={() => onDownloadFile(file)}
                  onRename={() => onRename({ type: 'file', file })}
                  onMove={() => onMove({ type: 'file', file })}
                  onDelete={() => onDelete({ type: 'file', file })}
                />
              </div>
            </div>
            <div className="min-w-0 p-2.5">
              <p className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {showPath ? file.folder || '/' : humanSize(file.size)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
