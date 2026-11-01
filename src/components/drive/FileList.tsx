import { format } from 'date-fns';
import { Folder } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { humanSize, type DriveFile } from '@/lib/telegram/files';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { FileIcon } from './FileIcon';
import { ItemMenu } from './ItemMenu';
import type { FolderEntry, ItemTarget } from './types';

interface FileListProps {
  files: DriveFile[];
  folders: FolderEntry[];
  selectedIds: Set<number>;
  showPath?: boolean;
  onToggleSelect: (file: DriveFile) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpenFolder: (folder: FolderEntry) => void;
  onOpenFile: (file: DriveFile) => void;
  onDownloadFile: (file: DriveFile) => void;
  onRename: (target: ItemTarget) => void;
  onMove: (target: ItemTarget) => void;
  onDelete: (target: ItemTarget) => void;
}

function formatDate(value: number): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

export function FileList({
  files,
  folders,
  selectedIds,
  showPath,
  onToggleSelect,
  onToggleSelectAll,
  onOpenFolder,
  onOpenFile,
  onDownloadFile,
  onRename,
  onMove,
  onDelete,
}: FileListProps) {
  const isMobile = useIsMobile();
  const allSelected = files.length > 0 && files.every((file) => selectedIds.has(file.id));
  const someSelected = files.some((file) => selectedIds.has(file.id));

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
                aria-label="Select all files"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden w-28 sm:table-cell">Size</TableHead>
            <TableHead className="hidden w-36 md:table-cell">Modified</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder) => (
            <TableRow
              key={`folder:${folder.path}`}
              className="cursor-pointer"
              onClick={() => onOpenFolder(folder)}
            >
              <TableCell />
              <TableCell>
                <div className="flex min-w-0 items-center gap-2">
                  <Folder className="h-5 w-5 shrink-0 fill-sky-500/15 text-sky-500" />
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={folder.name}>
                      {folder.name}
                    </p>
                    {showPath ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {folder.parent || '/'}
                      </p>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                —
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {formatDate(folder.date)}
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <ItemMenu
                  target={{ type: 'folder', folder }}
                  onOpen={() => onOpenFolder(folder)}
                  onRename={() => onRename({ type: 'folder', folder })}
                  onMove={() => onMove({ type: 'folder', folder })}
                  onDelete={() => onDelete({ type: 'folder', folder })}
                />
              </TableCell>
            </TableRow>
          ))}

          {files.map((file) => {
            const selected = selectedIds.has(file.id);
            return (
              <TableRow
                key={`file:${file.id}`}
                data-state={selected ? 'selected' : undefined}
                className={cn('cursor-pointer', selected && 'bg-primary/5')}
                onClick={() => {
                  if (isMobile) onOpenFile(file);
                }}
                onDoubleClick={() => onOpenFile(file)}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(file)}
                    aria-label={`Select ${file.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon kind={file.kind} className="h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={file.name}>
                        {file.name}
                      </p>
                      {showPath ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {file.folder || '/'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {humanSize(file.size)}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {formatDate(file.date)}
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <ItemMenu
                    target={{ type: 'file', file }}
                    onDownload={() => onDownloadFile(file)}
                    onRename={() => onRename({ type: 'file', file })}
                    onMove={() => onMove({ type: 'file', file })}
                    onDelete={() => onDelete({ type: 'file', file })}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
