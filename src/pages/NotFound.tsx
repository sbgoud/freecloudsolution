import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { ThemeModeToggle } from '@/components/theme-mode-toggle';

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-grid-fade opacity-35" />
        <div className="absolute left-1/2 top-0 h-80 w-[32rem] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" aria-label="TG Drive home">
          <Brand />
        </Link>
        <ThemeModeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border bg-card text-primary shadow-soft">
            <Compass className="h-7 w-7" />
          </div>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Error 404
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight">
            This page drifted off.
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            We could not find <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{location.pathname}</code>.
            It may have been moved, renamed, or never existed.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button asChild>
              <Link to="/drive">
                <ArrowLeft className="h-4 w-4" />
                Back to my drive
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 px-5 py-5 text-center text-xs text-muted-foreground">
        TG Drive is a pure open-source project by{' '}
        <a
          href="https://github.com/sbgoud/freecloudsolution"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          sbgoud
        </a>
        .
      </footer>
    </div>
  );
};

export default NotFound;
