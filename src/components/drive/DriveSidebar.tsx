import { ChevronDown, FolderPlus, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderTree } from './FolderTree';
import type { FolderTreeNode } from './types';

interface DriveSidebarProps {
  tree: FolderTreeNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onNewFolder: () => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
}

export function DriveSidebar({
  tree,
  currentPath,
  onNavigate,
  onNewFolder,
  onUploadFiles,
  onUploadFolder,
}: DriveSidebarProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-11 w-full justify-start gap-2 rounded-xl shadow-sm">
            <Plus className="h-5 w-5" />
            New
            <ChevronDown className="ml-auto h-4 w-4 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={onNewFolder}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New folder
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onUploadFiles}>
            <Upload className="mr-2 h-4 w-4" />
            Upload files
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onUploadFolder}>
            <Upload className="mr-2 h-4 w-4" />
            Upload folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Folders
        </p>
        <FolderTree
          tree={tree}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      </div>

      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Files are stored privately in your Telegram Saved Messages.
      </p>
    </div>
  );
}
