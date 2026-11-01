import { format } from 'date-fns';

export function formatDateShort(value: number): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

export function formatDateLong(value: number): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'MMM d, yyyy, h:mm a');
  } catch {
    return '—';
  }
}
