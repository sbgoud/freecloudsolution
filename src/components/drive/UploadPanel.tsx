import {
  CheckCircle2,
  CloudUpload,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { detectKind } from '@/lib/telegram/files';
import { cn } from '@/lib/utils';
import { FileIcon } from './FileIcon';
import type { UploadTask } from './types';

interface UploadPanelProps {
  tasks: UploadTask[];
  onCancel: () => void;
  onClose: () => void;
  onRetry: (id: number) => void;
}

function statusLabel(task: UploadTask): string {
  switch (task.status) {
    case 'queued':
      return 'Queued';
    case 'uploading':
      return `${Math.round(task.progress * 100)}%`;
    case 'done':
      return 'Done';
    case 'error':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}

export function UploadPanel({
  tasks,
  onCancel,
  onClose,
  onRetry,
}: UploadPanelProps) {
  if (tasks.length === 0) return null;

  const total = tasks.length;
  const done = tasks.filter((task) => task.status === 'done').length;
  const failed = tasks.filter((task) => task.status === 'error').length;
  const cancelled = tasks.filter((task) => task.status === 'cancelled').length;
  const settled = done + failed + cancelled;
  const active = tasks.some(
    (task) => task.status === 'uploading' || task.status === 'queued'
  );
  const overall = total
    ? Math.round(
        (tasks.reduce((sum, task) => {
          if (task.status === 'done') return sum + 1;
          if (task.status === 'uploading') return sum + task.progress;
          return sum;
        }, 0) /
          total) *
          100
      )
    : 0;

  return (
    <div className="fixed inset-x-3 bottom-safe z-50 overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-pop sm:inset-x-auto sm:right-6 sm:w-[380px]">
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CloudUpload className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {active
              ? `Uploading ${Math.min(settled + 1, total)} of ${total}`
              : `Uploaded ${done} of ${total} items`}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {active
              ? `Saving to your Telegram Saved Messages · ${overall}%`
              : failed > 0
                ? `${failed} failed${cancelled ? `, ${cancelled} cancelled` : ''}`
                : cancelled > 0
                  ? `${cancelled} cancelled`
                  : 'All uploads finished'}
          </p>
        </div>
        {active ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-xs"
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label="Close upload panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-4 pt-3">
        <Progress value={overall} className="h-1.5" />
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto p-2 pb-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
              <FileIcon
                kind={detectKind(task.file.type, task.file.name)}
                className="h-3.5 w-3.5"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p
                  className="min-w-0 flex-1 truncate text-xs font-medium"
                  title={task.path}
                >
                  {task.file.name}
                </p>
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 text-[11px] tabular-nums',
                    task.status === 'error' && 'text-destructive',
                    task.status === 'done' &&
                      'text-emerald-600 dark:text-emerald-400',
                    task.status === 'cancelled' && 'text-muted-foreground',
                    (task.status === 'queued' || task.status === 'uploading') &&
                      'text-muted-foreground'
                  )}
                >
                  {task.status === 'uploading' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : task.status === 'done' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : task.status === 'error' ? (
                    <XCircle className="h-3 w-3" />
                  ) : null}
                  {statusLabel(task)}
                </span>
              </div>
              {task.status === 'uploading' ? (
                <Progress value={task.progress * 100} className="mt-1.5 h-1" />
              ) : null}
              {task.status === 'uploading' &&
              task.partCount &&
              task.partCount > 1 ? (
                <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                  Part {(task.partIndex ?? 0) + 1} of {task.partCount}
                </p>
              ) : null}
              {task.status === 'error' && task.error ? (
                <div className="mt-1 flex items-start gap-2">
                  <p className="line-clamp-2 flex-1 text-[11px] leading-relaxed text-destructive">
                    {task.error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 shrink-0 px-2 text-[11px]"
                    onClick={() => onRetry(task.id)}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
