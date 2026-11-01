import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import {
  API_HASH,
  API_ID,
  clearStoredSession,
  loadStoredSession,
  SESSION_KEY,
} from '@/lib/telegram/config';

export type TelegramStatus = 'loading' | 'loggedOut' | 'loggedIn';

export interface TelegramMe {
  id: number;
  firstName: string;
  username?: string;
  premium: boolean;
}

interface TelegramContextType {
  client: TelegramClient | null;
  status: TelegramStatus;
  me: TelegramMe | null;
  saveSession: () => void;
  completeLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

const TelegramContext = createContext<TelegramContextType | null>(null);

export const useTelegram = () => {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }
  return context;
};

function createClient(sessionString = ''): TelegramClient {
  return new TelegramClient(
    new StringSession(sessionString),
    API_ID,
    API_HASH,
    {
      connectionRetries: 5,
      useWSS: true,
    }
  );
}

function toMe(user: Api.User): TelegramMe {
  return {
    id: Number(user.id),
    firstName: user.firstName || '',
    username: user.username,
    premium: Boolean(user.premium),
  };
}

function persistSession(client: TelegramClient): void {
  const session = client.session.save() as unknown;
  if (typeof session === 'string' && session.length > 0) {
    localStorage.setItem(SESSION_KEY, session);
  }
}

function isExpiredSessionError(error: unknown): boolean {
  const value = error as { errorMessage?: string; message?: string };
  const message = value?.errorMessage || value?.message || '';
  return (
    message.includes('AUTH_KEY_UNREGISTERED') ||
    message.includes('AUTH_TOKEN_EXPIRED') ||
    message.includes('SESSION_REVOKED') ||
    message.includes('USER_DEACTIVATED')
  );
}

export const TelegramProvider = ({ children }: { children: ReactNode }) => {
  const clientRef = useRef<TelegramClient | null>(null);
  const [client, setClient] = useState<TelegramClient | null>(null);
  const [status, setStatus] = useState<TelegramStatus>('loading');
  const [me, setMe] = useState<TelegramMe | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const sessionString = loadStoredSession();
      const current = createClient(sessionString);
      clientRef.current = current;

      if (!cancelled) setClient(current);

      if (!sessionString) {
        if (!cancelled) setStatus('loggedOut');
        return;
      }

      try {
        await current.connect();
        const user = await current.getMe();

        if (!cancelled) {
          setMe(toMe(user));
          setStatus('loggedIn');
        }
      } catch (error) {
        if (isExpiredSessionError(error)) {
          clearStoredSession();
          try {
            if (current.connected) await current.disconnect();
          } catch {
            // ignore
          }

          const fresh = createClient('');
          clientRef.current = fresh;
          if (!cancelled) setClient(fresh);
        }

        if (!cancelled) {
          setMe(null);
          setStatus('loggedOut');
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSession = useCallback(() => {
    const current = clientRef.current;
    if (!current) return;
    persistSession(current);
  }, []);

  const completeLogin = useCallback(async () => {
    const current = clientRef.current;
    if (!current) {
      throw new Error('Telegram client is not ready');
    }

    if (!current.connected) {
      await current.connect();
    }

    persistSession(current);
    const user = await current.getMe();
    setMe(toMe(user));
    setStatus('loggedIn');
  }, []);

  const logout = useCallback(async () => {
    const current = clientRef.current;

    if (current) {
      try {
        if (!current.connected) await current.connect();
        await current.invoke(new Api.auth.LogOut());
      } catch {
        // Clearing local state is still required if the server logout fails.
      }

      try {
        if (current.connected) await current.disconnect();
      } catch {
        // ignore
      }
    }

    clearStoredSession();

    const fresh = createClient('');
    clientRef.current = fresh;
    setClient(fresh);
    setMe(null);
    setStatus('loggedOut');
  }, []);

  return (
    <TelegramContext.Provider
      value={{ client, status, me, saveSession, completeLogin, logout }}
    >
      {children}
    </TelegramContext.Provider>
  );
};
