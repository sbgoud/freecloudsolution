import { FormEvent, useEffect, useState } from 'react';
import { Folder, FolderInput, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { normalizePath } from '@/lib/telegram/meta';
import { cn } from '@/lib/utils';
import { isPathInside } from './folders';
import type { FolderEntry } from './types';

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemType: 'file' | 'folder';
  currentParent: string;
  folders: FolderEntry[];
  disallowPath?: string;
  onMove: (destination: string) => Promise<void> | void;
}

export function MoveDialog({
  open,
  onOpenChange,
  itemName,
  itemType,
  currentParent,
  folders,
  disallowPath,
  onMove,
}: MoveDialogProps) {
  const [destination, setDestination] = useState(currentParent);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDestination(currentParent);
      setError(null);
      setSubmitting(false);
    }
  }, [open, currentParent]);

  const visibleFolders = folders.filter((folder) => {
    if (!disallowPath) return true;
    return !isPathInside(folder.path, disallowPath);
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const target = normalizePath(destination.trim() || '/');

    if (disallowPath && isPathInside(target, disallowPath)) {
      setError('You cannot move a folder into itself or one of its subfolders.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onMove(target);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Could not move item.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const destinationOptions = [
    { path: '/', name: 'My Drive', parent: '/' },
    ...visibleFolders,
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Move {itemType}</DialogTitle>
            <DialogDescription className="truncate">
              Choose a new location for “{itemName}”.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="move-destination">Destination path</Label>
              <Input
                id="move-destination"
                value={destination}
                onChange={(event) => {
                  setDestination(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="/Folder/Subfolder"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Pick a folder</p>
              <ScrollArea className="h-56 rounded-md border">
                <div className="p-1">
                  {destinationOptions.map((option) => {
                    const selected = normalizePath(destination) === option.path;
                    return (
                      <button
                        key={option.path}
                        type="button"
                        onClick={() => {
                          setDestination(option.path);
                          if (error) setError(null);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                          selected
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        )}
                        disabled={submitting}
                      >
                        {option.path === '/' ? (
                          <FolderInput className="h-4 w-4 shrink-0 text-sky-500" />
                        ) : (
                          <Folder className="h-4 w-4 shrink-0 text-sky-500" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {option.path === '/' ? 'My Drive' : option.path}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Move here
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
