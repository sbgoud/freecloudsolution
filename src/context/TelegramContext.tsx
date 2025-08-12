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
  uploadFile: (file: File) => Promise<void>;
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
      try {
        const sessionString = localStorage.getItem('session') || '';
        const session = new StringSession(sessionString);
        const newClient = new TelegramClient(
          session,
          API_ID,
          API_HASH,
          { connectionRetries: 5 }
        );
        
        setClient(newClient);
        
        // Only try to restore session if we have a valid session string
        if (sessionString && sessionString.length > 0) {
          try {
            await newClient.connect();
            // Verify the session is still valid by trying to get account info
            await newClient.invoke(new Api.users.GetFullUser({
              id: new Api.InputUserSelf()
            }));
            setIsLoggedIn(true);
          } catch (e) {
            console.error('Session restore failed, clearing invalid session:', e.message || e);
            localStorage.removeItem('session');
            setIsLoggedIn(false);
            if (newClient.connected) {
              await newClient.disconnect();
            }
          }
        } else {
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('Failed to initialize client:', error);
        setIsLoggedIn(false);
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
      
      // Get password configuration
      const passwordConfig = await client.invoke(
        new Api.account.GetPassword()
      );
      
      // Try a different approach - check if we can access the method differently
      let checkPassword;
      
      // First try the direct method
      try {
        checkPassword = await (client as any).computeCheckPassword(passwordConfig, password);
      } catch (e) {
        // If that fails, try importing it
        try {
          const { computeCheckPassword } = await import('telegram/Password');
          checkPassword = await computeCheckPassword(passwordConfig, password);
        } catch (importError) {
          console.error('Failed to import computeCheckPassword:', importError);
          // If both fail, throw an error
          throw new Error('Unable to compute password check - SRP implementation not available');
        }
      }
      
      // Use the computed parameters to check the password
      await client.invoke(
        new Api.auth.CheckPassword({
          password: checkPassword
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

  const uploadFile = async (file: File) => {
    if (!client) {
      throw new Error('Telegram client is not initialized. Please try logging in again.');
    }
    
    if (!isLoggedIn) {
      throw new Error('You must be logged in to upload files.');
    }

    try {
      // Ensure client is connected before uploading
      if (!client.connected) {
        await client.connect();
      }

      // Verify we're still authenticated
      try {
        await client.invoke(new Api.users.GetFullUser({
          id: new Api.InputUserSelf()
        }));
      } catch (authError) {
        console.error('Authentication verification failed:', authError);
        setIsLoggedIn(false);
        localStorage.removeItem('session');
        throw new Error('Your session has expired. Please log in again.');
      }

      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024; // 50MB in bytes
      if (file.size > maxSize) {
        throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 50MB limit.`);
      }

      // Convert File to Buffer for Telegram API
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Upload the file to Telegram servers
      const uploadedFile = await client.uploadFile({
        file: buffer,
        workers: 1,
      });

      // Send the file to saved messages
      await client.invoke(
        new Api.messages.SendMedia({
          peer: 'self', // Send to saved messages
          media: new Api.InputMediaUploadedDocument({
            file: uploadedFile,
            mimeType: file.type || 'application/octet-stream',
            attributes: [
              new Api.DocumentAttributeFilename({
                fileName: file.name,
              }),
            ],
          }),
          message: `Uploaded file: ${file.name}`,
          randomId: Math.floor(Math.random() * 0xffffffff),
        })
      );
    } catch (error: any) {
      // Provide user-friendly error messages
      let errorMessage = 'Failed to upload file. Please try again.';
      
      if (error.message) {
        // If we already have a user-friendly message, use it
        if (error.message.includes('session has expired') || 
            error.message.includes('must be logged in') ||
            error.message.includes('File size') ||
            error.message.includes('client is not initialized')) {
          errorMessage = error.message;
        } else if (error.message.includes('FLOOD_WAIT')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment before uploading again.';
        } else if (error.message.includes('FILE_PARTS_INVALID')) {
          errorMessage = 'File upload failed due to corruption. Please try again.';
        } else if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
          errorMessage = 'Your session has expired. Please log in again.';
          setIsLoggedIn(false);
          localStorage.removeItem('session');
        } else if (error.message.includes('CONNECTION_NOT_INITED')) {
          errorMessage = 'Connection lost. Please try again.';
        }
      }

      console.error('File upload error:', {
        message: error.message,
        code: error.code,
        type: error.constructor.name
      });

      const uploadError = new Error(errorMessage);
      uploadError.cause = error;
      throw uploadError;
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
    uploadFile,
    isTwoFactorRequired
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
};