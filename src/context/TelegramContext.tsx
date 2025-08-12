import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';

// Hardcoded credentials (user will change manually later)
const API_ID = 20134869;
const API_HASH = 'b702f181f4de5e6fe4848b632d62e5b3';

interface TelegramContextType {
  client: TelegramClient | null;
  isLoggedIn: boolean;
  login: (phone: string) => Promise<void>;
  sendCode: (code: string) => Promise<void>;
  sendPassword: (password: string) => Promise<void>;
  logout: () => void;
  fetchMessages: () => Promise<any[]>;
  isTwoFactorRequired: boolean;
}

const TelegramContext = createContext<TelegramContextType | null>(null);

export const useTelegram = () => {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }
  return context;
};

export const TelegramProvider = ({ children }: { children: ReactNode }) => {
  const [client, setClient] = useState<TelegramClient | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [isTwoFactorRequired, setIsTwoFactorRequired] = useState(false);

  useEffect(() => {
    const initializeClient = async () => {
      const session = new StringSession(localStorage.getItem('session') || '');
      const newClient = new TelegramClient(
        session,
        API_ID,
        API_HASH,
        { connectionRetries: 5 }
      );
      
      setClient(newClient);
      
      if (session.save()) {
        try {
          await newClient.connect();
          setIsLoggedIn(true);
        } catch (e) {
          console.error('Session restore failed', e);
          localStorage.removeItem('session');
        }
      }
    };

    initializeClient();
  }, []);

  const login = async (phoneNumber: string) => {
    if (!client) return;
    setPhone(phoneNumber);
    
    try {
      // Ensure client is connected before sending code
      if (!client.connected) {
        await client.connect();
      }
      
      const result = await client.invoke(
        new Api.auth.SendCode({
          phoneNumber,
          apiId: API_ID,
          apiHash: API_HASH,
          settings: new Api.CodeSettings({})
        })
      );
      
      setPhoneCodeHash(result.phoneCodeHash);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const sendCode = async (code: string) => {
    if (!client || !phone || !phoneCodeHash) return;
    
    try {
      // Ensure client is connected before signing in
      if (!client.connected) {
        await client.connect();
      }
      
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash,
          phoneCode: code
        })
      );
      
      localStorage.setItem('session', client.session.save() as string);
      setIsLoggedIn(true);
      setIsTwoFactorRequired(false);
    } catch (error: any) {
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        setIsTwoFactorRequired(true);
      } else {
        console.error('Code verification error:', error);
        throw error;
      }
    }
  };

  const sendPassword = async (password: string) => {
    if (!client) return;
    
    try {
      // Ensure client is connected before sending password
      if (!client.connected) {
        await client.connect();
      }
      
      const credentials = await client.invoke(
        new Api.account.GetPassword()
      );
      
      const { srpId, A, M1 } = await client.computeSrpParams(credentials, password);
      
      await client.invoke(
        new Api.auth.CheckPassword({
          password: new Api.InputCheckPasswordSRP({
            srpId,
            A,
            M1
          })
        })
      );
      
      localStorage.setItem('session', client.session.save() as string);
      setIsLoggedIn(true);
      setIsTwoFactorRequired(false);
    } catch (error) {
      console.error('Password verification error:', error);
      throw error;
    }
  };

  const logout = () => {
    if (client) {
      client.disconnect();
    }
    localStorage.removeItem('session');
    setIsLoggedIn(false);
    setIsTwoFactorRequired(false);
    setPhone('');
    setPhoneCodeHash('');
  };

  const fetchMessages = async () => {
    if (!client) return [];
    
    try {
      // Ensure client is connected before fetching messages
      if (!client.connected) {
        await client.connect();
      }
      
      const result = await client.invoke(
        new Api.messages.GetSavedHistory({
          peer: 'self',
          limit: 5,
          offsetId: 0
        })
      );
      
      return result.messages || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  const value = {
    client,
    isLoggedIn,
    login,
    sendCode,
    sendPassword,
    logout,
    fetchMessages,
    isTwoFactorRequired
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
};