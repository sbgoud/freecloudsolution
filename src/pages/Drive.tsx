import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, LogOut, Send } from 'lucide-react';
import { useTelegram } from '@/context/TelegramContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const Drive = () => {
  const navigate = useNavigate();
  const { status, me, logout } = useTelegram();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'loggedOut') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
              <Send className="h-4 w-4" />
            </div>
            <span className="font-semibold">TG Drive</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <h1 className="text-2xl font-semibold">
              {me?.firstName || 'Telegram user'}
            </h1>
            {me?.username ? (
              <p className="text-sm text-muted-foreground">@{me.username}</p>
            ) : null}
            <p className="mt-6 text-sm text-muted-foreground">
              Your files will show up here. The drive experience is coming in
              the next step.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Drive;
