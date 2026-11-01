import { useState } from 'react';
import {
  Grid2X2,
  List,
  Loader2,
  LogOut,
  Menu,
  Search,
  Send,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import type { TelegramMe } from '@/context/TelegramContext';
import { cn } from '@/lib/utils';
import type { ViewMode } from './types';

interface DriveTopBarProps {
  me: TelegramMe | null;
  search: string;
  onSearchChange: (value: string) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TG';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function DriveTopBar({
  me,
  search,
  onSearchChange,
  view,
  onViewChange,
  onToggleSidebar,
  onOpenMobileSidebar,
  onLogout,
  loggingOut,
}: DriveTopBarProps) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = me?.firstName || 'Telegram user';

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={isMobile ? onOpenMobileSidebar : onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
            <Send className="h-4 w-4" />
          </div>
          <span className="hidden font-semibold sm:inline">TG Drive</span>
        </div>

        <div className="relative ml-1 min-w-0 flex-1 sm:ml-4 sm:max-w-xl">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search files and folders"
            className="h-9 bg-muted/40 pl-8 pr-8"
            aria-label="Search files and folders"
          />
          {search ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center rounded-md border bg-muted/30 p-0.5">
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn('h-8 w-8', view === 'grid' && 'shadow-sm')}
            onClick={() => onViewChange('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            <Grid2X2 className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn('h-8 w-8', view === 'list' && 'shadow-sm')}
            onClick={() => onViewChange('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 gap-2 px-1.5 sm:px-2"
              aria-label="Account menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-semibold text-white">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[8rem] truncate text-sm font-medium md:inline">
                {displayName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{displayName}</p>
              {me?.username ? (
                <p className="truncate text-xs text-muted-foreground">
                  @{me.username}
                </p>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onLogout();
              }}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
