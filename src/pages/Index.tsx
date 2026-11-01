import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTelegram } from '@/context/TelegramContext';
import { Brand } from '@/components/brand';

const Index = () => {
  const { status } = useTelegram();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background">
        <Brand />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to Telegram…
        </div>
      </div>
    );
  }

  return <Navigate to={status === 'loggedIn' ? '/drive' : '/login'} replace />;
};

export default Index;
