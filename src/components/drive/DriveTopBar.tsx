import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Github,
  Grid2X2,
  List,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Brand } from '@/components/brand';
import { ThemeModeToggle } from '@/components/theme-mode-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TelegramMe } from '@/context/TelegramContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ViewMode } from './types';

interface DriveTopBarProps {
  me: TelegramMe | null;
  search: string;
  onSearchChange: (value: string) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  sidebarVisible: boolean;
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
  sidebarVisible,
  onToggleSidebar,
  onOpenMobileSidebar,
  onLogout,
  loggingOut,
}: DriveTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const displayName = me?.firstName || 'Telegram user';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground md:hidden"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 shrink-0 text-muted-foreground md:inline-flex"
          onClick={onToggleSidebar}
          aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarVisible ? (
            <PanelLeftClose className="h-[18px] w-[18px]" />
          ) : (
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          )}
        </Button>

        <Brand
          className="flex shrink-0"
          markClassName="h-8 w-8"
          textClassName="hidden text-[0.95rem] lg:block"
        />

        <div className="relative ml-auto min-w-0 flex-1 sm:mx-2 sm:max-w-xl md:ml-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onSearchChange('');
                event.currentTarget.blur();
              }
            }}
            placeholder={isMobile ? 'Search' : 'Search files and folders'}
            className="h-10 rounded-xl border-transparent bg-muted/60 pl-9 pr-9 shadow-none hover:bg-muted/80 focus-visible:border-ring focus-visible:bg-background sm:pr-16 [&::-webkit-search-cancel-button]:appearance-none"
            aria-label="Search files and folders"
            type="search"
          />
          {search ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border bg-background/70 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground/80 sm:flex">
              <span className="text-xs leading-none">/</span>
            </kbd>
          )}
        </div>

        <div
          className="hidden shrink-0 items-center rounded-lg border bg-muted/40 p-0.5 sm:flex"
          role="group"
          aria-label="View mode"
        >
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'h-8 w-8 rounded-md',
              view === 'grid' && 'bg-card shadow-sm'
            )}
            onClick={() => onViewChange('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            <Grid2X2 className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'h-8 w-8 rounded-md',
              view === 'list' && 'bg-card shadow-sm'
            )}
            onClick={() => onViewChange('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground sm:hidden"
          onClick={() => onViewChange(view === 'grid' ? 'list' : 'grid')}
          aria-label={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
        >
          {view === 'grid' ? (
            <List className="h-4 w-4" />
          ) : (
            <Grid2X2 className="h-4 w-4" />
          )}
        </Button>

        <ThemeModeToggle className="hidden h-9 w-9 shrink-0 sm:inline-flex" />

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 shrink-0 gap-2 px-1.5 sm:px-2"
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8 ring-1 ring-border">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[8rem] truncate text-sm font-medium md:inline">
                {displayName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="normal-case tracking-normal">
              <div className="flex items-center gap-3 py-1">
                <Avatar className="h-9 w-9 ring-1 ring-border">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {me?.username ? `@${me.username}` : 'Telegram Saved Messages'}
                  </p>
                </div>
                {me?.premium ? (
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Premium
                  </span>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a
                href="https://github.com/sbgoud/freecloudsolution"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="mr-2 h-4 w-4" />
                About TG Drive
              </a>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette className="mr-2 h-4 w-4" />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => setTheme(option.value)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {option.label}
                      {(theme ?? 'system') === option.value ? (
                        <Check className="ml-auto h-4 w-4" />
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
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
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
