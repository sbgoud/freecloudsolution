import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-9 w-9 shrink-0', className)}
      role="img"
      aria-label="TG Drive"
    >
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <path
        d="M14 23.5C14 20.4624 16.4624 18 19.5 18H28.1L32 21.5H44.5C47.5376 21.5 50 23.9624 50 27V41.5C50 44.5376 47.5376 47 44.5 47H19.5C16.4624 47 14 44.5376 14 41.5V23.5Z"
        className="fill-primary-foreground"
        fillOpacity="0.18"
      />
      <path
        d="M14 23.5C14 20.4624 16.4624 18 19.5 18H28.1L32 21.5H44.5C47.5376 21.5 50 23.9624 50 27V41.5C50 44.5376 47.5376 47 44.5 47H19.5C16.4624 47 14 44.5376 14 41.5V23.5Z"
        className="stroke-primary-foreground"
        strokeWidth="3"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M22.5 35.4L45 26.2L37.8 35.4L45 44.6L22.5 35.4Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}

interface BrandProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  subtitle?: string;
}

export function Brand({
  className,
  markClassName,
  textClassName,
  subtitle,
}: BrandProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={markClassName} />
      <div className="min-w-0">
        <p
          className={cn(
            'text-[0.95rem] font-semibold leading-none tracking-tight',
            textClassName
          )}
        >
          TG Drive
        </p>
        {subtitle ? (
          <p className="mt-1 text-[11px] leading-none text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
