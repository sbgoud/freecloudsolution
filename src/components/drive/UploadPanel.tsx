import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
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

export function UploadPanel({ tasks, onCancel, onClose }: UploadPanelProps) {
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
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border bg-background shadow-2xl">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {active
              ? `Uploading ${Math.min(settled + 1, total)} of ${total}`
              : `Uploaded ${done} of ${total} items`}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {active
              ? 'Uploads to your Saved Messages'
              : failed > 0
                ? `${failed} failed${cancelled ? `, ${cancelled} cancelled` : ''}`
                : cancelled > 0
                  ? `${cancelled} cancelled`
                  : 'All uploads finished'}
          </p>
        </div>
        {active ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
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

      <div className="max-h-64 space-y-2 overflow-y-auto px-4 py-3">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-2">
            <FileIcon
              kind={detectKind(task.file.type, task.file.name)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
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
                    'flex shrink-0 items-center gap-1 text-[11px]',
                    task.status === 'error' && 'text-destructive',
                    task.status === 'done' && 'text-emerald-600',
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
                <Progress value={task.progress * 100} className="mt-1 h-1" />
              ) : null}
              {task.status === 'error' && task.error ? (
                <p className="mt-0.5 truncate text-[11px] text-destructive">
                  {task.error}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
