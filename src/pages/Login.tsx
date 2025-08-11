import { useState } from 'react';
import { useTelegram } from '@/context/TelegramContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, sendCode, sendPassword, isTwoFactorRequired } = useTelegram();

  const handleSendCode = async () => {
    if (!phone) return;
    setIsLoading(true);
    try {
      await login(phone);
      setIsCodeSent(true);
    } catch (error) {
      console.error('Failed to send code', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code) return;
    setIsLoading(true);
    try {
      await sendCode(code);
    } catch (error) {
      console.error('Failed to verify code', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPassword = async () => {
    if (!password) return;
    setIsLoading(true);
    try {
      await sendPassword(password);
    } catch (error) {
      console.error('Failed to verify password', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Telegram Login</h1>
        
        {isTwoFactorRequired ? (
          <div>
            <div className="mb-4">
              <Label htmlFor="password">2FA Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your 2FA password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleSendPassword}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Verifying...' : 'Verify Password'}
            </Button>
          </div>
        ) : !isCodeSent ? (
          <div>
            <div className="mb-4">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleSendCode}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Sending...' : 'Send Code'}
            </Button>
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="Enter code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleVerifyCode}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;