import {
  Download,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ItemTarget } from './types';

interface ItemMenuProps {
  target: ItemTarget;
  onOpen?: () => void;
  onDownload?: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export function ItemMenu({
  target,
  onOpen,
  onDownload,
  onRename,
  onMove,
  onDelete,
}: ItemMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Item actions"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        {target.type === 'folder' && onOpen ? (
          <DropdownMenuItem onSelect={onOpen}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open
          </DropdownMenuItem>
        ) : null}
        {target.type === 'file' && onDownload ? (
          <DropdownMenuItem onSelect={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onRename}>
          <Pencil className="mr-2 h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onMove}>
          <FolderInput className="mr-2 h-4 w-4" />
          Move to…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
