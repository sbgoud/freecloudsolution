import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/context/TelegramContext';
import { MadeWithDyad } from '@/components/made-with-dyad';

const Index = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useTelegram();

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/home');
    } else {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Telegram Web Client</h1>
        <p className="text-xl text-gray-600">
          Securely access your Telegram messages from anywhere
        </p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;