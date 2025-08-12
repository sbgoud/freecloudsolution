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

      // Validate file size (2GB limit)
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB in bytes
      if (file.size > maxSize) {
        throw new Error(`File size (${(file.size / (1024 * 1024 * 1024)).toFixed(2)}GB) exceeds the 2GB limit.`);
      }

      console.log(`Starting MTProto upload for file: ${file.name}, size: ${file.size} bytes`);

      // Optimize connection for media uploads
      try {
        // Try to get nearest DC for optimal routing
        const config = await client.invoke(new Api.help.GetConfig());
        console.log(`📡 Using DC: ${config.thisDc}, available DCs: ${config.dcOptions?.length || 0}`);
        
        // Log available DCs for debugging
        if (config.dcOptions) {
          const mediaDCs = config.dcOptions.filter(dc => dc.mediaOnly);
          console.log(`🎯 Media-optimized DCs available: ${mediaDCs.length}`);
          mediaDCs.forEach(dc => console.log(`   - DC ${dc.id}: ${dc.ipAddress} (${dc.mediaOnly ? 'Media Only' : 'General'})`));
        }
      } catch (dcError) {
        console.log('📡 Using default DC connection (DC optimization failed)');
      }

      // Generate unique file ID (64-bit integer) - use long type for Telegram API
      const fileId = Math.floor(Math.random() * 0x7fffffffffffffff);
      
      // Read file data
      const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
              reject(new Error('Failed to read file'));
              return;
            }
            const buffer = Buffer.from(arrayBuffer);
            resolve(buffer);
          } catch (error) {
            reject(new Error(`Buffer creation failed: ${error}`));
          }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsArrayBuffer(file);
      });

      // MTProto file upload rules - OPTIMIZED for speed
      const PART_SIZE = 4 * 1024 * 1024; // 4MB chunks (maximum allowed by Telegram)
      const totalParts = Math.ceil(fileBuffer.length / PART_SIZE);
      const isBigFile = file.size >= 10 * 1024 * 1024; // 10MB threshold
      const MAX_PARALLEL_UPLOADS = 6; // Optimal parallel connections

      console.log(`File will be uploaded in ${totalParts} parts of ${PART_SIZE} bytes each. Big file: ${isBigFile}`);
      console.log(`Using ${MAX_PARALLEL_UPLOADS} parallel connections for faster upload`);

      // Parallel upload function
      const uploadPart = async (partIndex: number): Promise<void> => {
        const start = partIndex * PART_SIZE;
        const end = Math.min(start + PART_SIZE, fileBuffer.length);
        const partBytes = fileBuffer.slice(start, end);

        try {
          if (isBigFile) {
            await client.invoke(
              new Api.upload.SaveBigFilePart({
                fileId: fileId,
                filePart: partIndex,
                fileTotalParts: totalParts,
                bytes: partBytes,
              })
            );
          } else {
            await client.invoke(
              new Api.upload.SaveFilePart({
                fileId: fileId,
                filePart: partIndex,
                bytes: partBytes,
              })
            );
          }
          console.log(`✅ Part ${partIndex + 1}/${totalParts} uploaded successfully`);
        } catch (error: any) {
          if (error.message && error.message.includes('FLOOD_WAIT')) {
            const waitTime = parseInt(error.message.match(/\d+/)?.[0] || '5');
            console.log(`⏳ Rate limited, waiting ${waitTime} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            // Retry the same part
            return uploadPart(partIndex);
          }
          throw error;
        }
      };

      // Upload all parts in parallel batches
      const uploadAllParts = async (): Promise<void> => {
        for (let batchStart = 0; batchStart < totalParts; batchStart += MAX_PARALLEL_UPLOADS) {
          const batchEnd = Math.min(batchStart + MAX_PARALLEL_UPLOADS, totalParts);
          const batchParts = Array.from(
            { length: batchEnd - batchStart }, 
            (_, i) => batchStart + i
          );

          console.log(`🚀 Starting batch: parts ${batchStart + 1}-${batchEnd} (${batchParts.length} parallel uploads)`);
          
          // Upload this batch in parallel
          const uploadPromises = batchParts.map(partIndex => uploadPart(partIndex));
          await Promise.all(uploadPromises);
          
          console.log(`✅ Batch ${Math.floor(batchStart / MAX_PARALLEL_UPLOADS) + 1} completed`);
        }
      };

      // Execute parallel upload
      console.log('🚀 Starting parallel upload process...');
      try {
        await uploadAllParts();
        console.log('✅ All upload parts completed successfully!');
      } catch (uploadError) {
        console.error('❌ Parallel upload failed:', uploadError);
        throw uploadError;
      }

      console.log('All parts uploaded successfully. Creating InputFile...');

      // Create InputFile based on upload method used
      let inputFile;
      if (isBigFile) {
        inputFile = new Api.InputFileBig({
          id: fileId,
          parts: totalParts,
          name: file.name,
        });
      } else {
        // For small files, MD5 checksum is optional, so we'll provide an empty string
        inputFile = new Api.InputFile({
          id: fileId,
          parts: totalParts,
          name: file.name,
          md5Checksum: '', // MD5 is optional for file uploads
        });
      }

      console.log('Sending file to saved messages...');

      // Send the file to saved messages
      await client.invoke(
        new Api.messages.SendMedia({
          peer: 'self', // Send to saved messages
          media: new Api.InputMediaUploadedDocument({
            file: inputFile,
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

      console.log('File uploaded successfully to saved messages!');

    } catch (error: any) {
      // Provide user-friendly error messages
      let errorMessage = 'Failed to upload file. Please try again.';
      
      if (error.message) {
        // If we already have a user-friendly message, use it
        if (error.message.includes('session has expired') || 
            error.message.includes('must be logged in') ||
            error.message.includes('File size') ||
            error.message.includes('client is not initialized') ||
            error.message.includes('Failed to read file') ||
            error.message.includes('Buffer creation failed') ||
            error.message.includes('File reading failed')) {
          errorMessage = error.message;
        } else if (error.message.includes('FLOOD_WAIT')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment before uploading again.';
        } else if (error.message.includes('FILE_PART_') && error.message.includes('_MISSING')) {
          errorMessage = 'A file part was missing during upload. Please try again.';
        } else if (error.message.includes('MD5_CHECKSUM_INVALID')) {
          errorMessage = 'File checksum validation failed. The file may be corrupted.';
        } else if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
          errorMessage = 'Your session has expired. Please log in again.';
          setIsLoggedIn(false);
          localStorage.removeItem('session');
        } else if (error.message.includes('CONNECTION_NOT_INITED')) {
          errorMessage = 'Connection lost. Please try again.';
        } else if (error.message.includes('FILE_MIGRATE_')) {
          errorMessage = 'File needs to be uploaded to a different server. Please try again.';
        }
      }

      console.error('File upload error details:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        message: error.message,
        code: error.code,
        type: error.constructor.name,
        stack: error.stack
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