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
import { formatDateShort } from './format';
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
  const allSelected =
    files.length > 0 && files.every((file) => selectedIds.has(file.id));
  const someSelected = files.some((file) => selectedIds.has(file.id));

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
                aria-label="Select all files"
              />
            </TableHead>
            <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Name
            </TableHead>
            <TableHead className="hidden w-28 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">
              Size
            </TableHead>
            <TableHead className="hidden w-36 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
              Modified
            </TableHead>
            <TableHead className="w-12 pr-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder) => (
            <TableRow
              key={`folder:${folder.path}`}
              className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
              onClick={() => onOpenFolder(folder)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onOpenFolder(folder);
              }}
              tabIndex={0}
            >
              <TableCell className="pl-4" />
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Folder
                      className="h-[18px] w-[18px] fill-primary/15"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium" title={folder.name}>
                      {folder.name}
                    </p>
                    {showPath ? (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {folder.parent || '/'}
                      </p>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                —
              </TableCell>
              <TableCell className="hidden text-xs tabular-nums text-muted-foreground md:table-cell">
                {formatDateShort(folder.date)}
              </TableCell>
              <TableCell className="pr-4" onClick={(event) => event.stopPropagation()}>
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
                tabIndex={0}
                className={cn(
                  'group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40',
                  selected && 'bg-primary/[0.06] hover:bg-primary/[0.08]'
                )}
                onClick={() => {
                  if (isMobile) onOpenFile(file);
                }}
                onDoubleClick={() => onOpenFile(file)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onOpenFile(file);
                }}
              >
                <TableCell className="pl-4" onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(file)}
                    aria-label={`Select ${file.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                      <FileIcon kind={file.kind} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium" title={file.name}>
                        {file.name}
                      </p>
                      {showPath ? (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {file.folder || '/'}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-xs tabular-nums text-muted-foreground sm:table-cell">
                  {humanSize(file.size)}
                </TableCell>
                <TableCell className="hidden text-xs tabular-nums text-muted-foreground md:table-cell">
                  {formatDateShort(file.date)}
                </TableCell>
                <TableCell className="pr-4" onClick={(event) => event.stopPropagation()}>
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
