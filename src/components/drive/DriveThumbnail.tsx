import { useEffect, useRef, useState } from 'react';
import type { TelegramClient } from 'telegram';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { getThumbnail, type DriveFile } from '@/lib/telegram/files';
import { cn } from '@/lib/utils';
import { FileIcon } from './FileIcon';

interface DriveThumbnailProps {
  client: TelegramClient | null;
  file: DriveFile;
  className?: string;
}

export function DriveThumbnail({ client, file, className }: DriveThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUrl(null);
    setVisible(false);
  }, [file.id]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [file.id]);

  useEffect(() => {
    if (!visible || !client || !file.hasThumb) return;
    if (file.kind !== 'image' && file.kind !== 'video') return;

    let cancelled = false;
    setLoading(true);

    getThumbnail(client, file)
      .then((result) => {
        if (!cancelled) setUrl(result);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, file, visible]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full items-center justify-center overflow-hidden bg-muted/50',
        className
      )}
    >
      {url ? (
        <img
          src={url}
          alt={file.name}
          loading="lazy"
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : file.kind === 'image' ? (
        <ImageIcon className="h-10 w-10 text-muted-foreground/70" />
      ) : (
        <FileIcon kind={file.kind} className="h-10 w-10" />
      )}
    </div>
  );
}
