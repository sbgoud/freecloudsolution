import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MadeWithDyad } from '@/components/made-with-dyad';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in (simple check for session)
    const session = localStorage.getItem('session');
    if (session) {
      navigate('/home');
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Telegram Web</h1>
        <p className="text-xl text-gray-600">
          Redirecting to login...
        </p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;