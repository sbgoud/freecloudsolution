import { useEffect, useState } from 'react';
import type { TelegramClient } from 'telegram';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  downloadFile,
  triggerBrowserDownload,
  type DriveFile,
} from '@/lib/telegram/files';

interface ImagePreviewDialogProps {
  client: TelegramClient | null;
  file: DriveFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImagePreviewDialog({
  client,
  file,
  open,
  onOpenChange,
}: ImagePreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !file || !client) {
      setUrl(null);
      setBlob(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setUrl(null);
    setBlob(null);

    downloadFile(client, file)
      .then((result) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(result);
        setBlob(result);
        setUrl(objectUrl);
      })
      .catch((downloadError) => {
        if (cancelled) return;
        setError(
          downloadError instanceof Error
            ? downloadError.message
            : 'Could not load this image.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, file, client, attempt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-4 sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{file?.name ?? 'Preview'}</DialogTitle>
          <DialogDescription>
            {file ? `${file.folder || '/'}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex min-h-[16rem] items-center justify-center overflow-hidden rounded-xl border bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%,hsl(var(--muted))),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%,hsl(var(--muted)))] bg-[length:20px_20px] bg-[position:0_0,10px_10px]">
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading image…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAttempt((value) => value + 1)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : url ? (
            <img
              src={url}
              alt={file?.name ?? 'Image preview'}
              className="max-h-[65vh] w-auto max-w-full object-contain"
            />
          ) : null}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() => {
              if (blob && file) triggerBrowserDownload(blob, file.name);
            }}
            disabled={!blob}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
