import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTelegram } from '@/context/TelegramContext';

const Index = () => {
  const { status } = useTelegram();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Navigate to={status === 'loggedIn' ? '/drive' : '/login'} replace />;
};

export default Index;
