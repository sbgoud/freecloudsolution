import { FormEvent, useEffect, useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
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

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void> | void;
}

function validate(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Please enter a folder name.';
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'Folder names cannot contain slashes.';
  }
  if (trimmed === '.' || trimmed === '..') {
    return 'Please choose a different name.';
  }
  return null;
}

export function NewFolderDialog({
  open,
  onOpenChange,
  onCreate,
}: NewFolderDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const message = validate(name);
    if (message) {
      setError(message);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim());
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Could not create folder.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary sm:mx-0">
              <FolderPlus className="h-5 w-5" />
            </div>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Create a folder in the current location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="new-folder-name">Folder name</Label>
            <Input
              id="new-folder-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Project archive"
              autoFocus
              disabled={submitting}
            />
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
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
