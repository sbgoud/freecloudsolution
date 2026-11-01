import {
  ChevronDown,
  ExternalLink,
  FolderPlus,
  Github,
  Plus,
  ShieldCheck,
  Upload,
} from 'lucide-react';
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
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 w-full justify-start gap-2 rounded-xl shadow-sm">
              <Plus className="h-4 w-4" />
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
      </div>

      <div className="flex items-center justify-between px-4 pb-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Folders
        </p>
        <button
          type="button"
          onClick={onNewFolder}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Create a new folder"
          title="New folder"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        aria-label="Folder navigation"
      >
        <FolderTree
          tree={tree}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-xl border border-sidebar-border bg-card/70 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <p className="text-xs font-semibold text-foreground">
              Stored in Telegram
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Your files stay privately in your own Saved Messages. TG Drive keeps
            no copy on any server.
          </p>
          <a
            href="https://github.com/sbgoud/freecloudsolution"
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <Github className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              TG Drive is a pure open-source project by sbgoud
            </span>
            <ExternalLink className="ml-auto mt-0.5 h-3 w-3 shrink-0 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
}
