import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/context/TelegramContext';
import {
  friendlyError,
  sendCode,
  signInWithCode,
  signInWithPassword,
} from '@/lib/telegram/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const countryCodes = [
  { code: '+91', name: 'India' },
  { code: '+1', name: 'USA' },
  { code: '+44', name: 'UK' },
  { code: '+61', name: 'Australia' },
  { code: '+33', name: 'France' },
  { code: '+49', name: 'Germany' },
  { code: '+81', name: 'Japan' },
  { code: '+7', name: 'Russia' },
  { code: '+86', name: 'China' },
  { code: '+971', name: 'UAE' },
];

const Login = () => {
  const navigate = useNavigate();
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTwoFactorRequired, setIsTwoFactorRequired] = useState(false);
  const [error, setError] = useState('');
  const { client, status, completeLogin } = useTelegram();

  useEffect(() => {
    if (status === 'loggedIn') {
      navigate('/home');
    }
  }, [status, navigate]);

  const handleSendCode = async () => {
    if (!client) return;
    const fullPhone = `${countryCode}${phoneNumber}`;
    if (!fullPhone) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await sendCode(client, fullPhone);
      setPhone(fullPhone);
      setPhoneCodeHash(result.phoneCodeHash);
      setIsCodeSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!client || !code || !phone || !phoneCodeHash) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await signInWithCode(client, phone, phoneCodeHash, code);
      if (result === 'password_needed') {
        setIsTwoFactorRequired(true);
      } else {
        await completeLogin();
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPassword = async () => {
    if (!client || !password) return;
    setIsLoading(true);
    setError('');
    try {
      await signInWithPassword(client, password);
      await completeLogin();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800">Telegram Login</h1>
          <p className="text-gray-500 mt-2">
            {isTwoFactorRequired 
              ? 'Enter your 2FA password' 
              : isCodeSent 
                ? 'Enter verification code' 
                : 'Enter your phone number'}
          </p>
        </div>
        
        {isTwoFactorRequired ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="password" className="block mb-2 font-medium text-gray-700">
                2FA Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={handleSendPassword}
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Verify Password'}
            </Button>
          </div>
        ) : !isCodeSent ? (
          <div className="space-y-4">
            <div>
              <Label className="block mb-2 font-medium text-gray-700">
                Phone Number
              </Label>
              <div className="flex gap-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryCodes.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name} ({country.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="tel"
                  placeholder="1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <Button
              onClick={handleSendCode}
              disabled={isLoading || !phoneNumber}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send Code'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="code" className="block mb-2 font-medium text-gray-700">
                Verification Code
              </Label>
              <Input
                id="code"
                type="text"
                placeholder="Enter code sent to your phone"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={handleVerifyCode}
              disabled={isLoading || !code}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
        )}
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>By signing in, you agree to our Terms and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
