import { Api, TelegramClient } from 'telegram';
import { computeCheck } from 'telegram/Password';
import { FloodWaitError } from 'telegram/errors';
import { Raw } from 'telegram/events';
import { API_HASH, API_ID } from './config';

export interface QrLoginOptions {
  onQr: (url: string, expires: number) => void;
  onPasswordNeeded: (hint?: string, error?: unknown) => Promise<string>;
  signal?: AbortSignal;
}

async function ensureConnected(client: TelegramClient): Promise<void> {
  if (!client.connected) {
    await client.connect();
  }
}

function errorMessageOf(error: unknown): string {
  const value = error as { errorMessage?: string; message?: string };
  return value?.errorMessage || value?.message || '';
}

function isPasswordNeeded(error: unknown): boolean {
  return errorMessageOf(error) === 'SESSION_PASSWORD_NEEDED';
}

function isPasswordInvalid(error: unknown): boolean {
  const message = errorMessageOf(error);
  return (
    message === 'PASSWORD_HASH_INVALID' || message === 'PASSWORD_EMPTY'
  );
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export async function sendCode(
  client: TelegramClient,
  phone: string
): Promise<{ phoneCodeHash: string; isCodeViaApp: boolean }> {
  await ensureConnected(client);
  const result = await client.sendCode(
    { apiId: API_ID, apiHash: API_HASH },
    phone
  );
  return {
    phoneCodeHash: result.phoneCodeHash,
    isCodeViaApp: result.isCodeViaApp,
  };
}

export async function signInWithCode(
  client: TelegramClient,
  phone: string,
  phoneCodeHash: string,
  code: string
): Promise<'ok' | 'password_needed'> {
  await ensureConnected(client);

  try {
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: code,
      })
    );

    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new Error('This phone number has no Telegram account');
    }

    return 'ok';
  } catch (error) {
    if (isPasswordNeeded(error)) {
      return 'password_needed';
    }
    throw error;
  }
}

export async function signInWithPassword(
  client: TelegramClient,
  password: string
): Promise<Api.TypeUser> {
  await ensureConnected(client);

  const passwordConfig = await client.invoke(new Api.account.GetPassword());
  const check = await computeCheck(passwordConfig, password);
  // Re-wrap the SRP proof with this bundle's Buffer so the TL serializer
  // always accepts it, whatever Buffer copy the hashing code returned.
  const srp =
    check instanceof Api.InputCheckPasswordSRP
      ? new Api.InputCheckPasswordSRP({
          srpId: check.srpId,
          A: Buffer.from(check.A),
          M1: Buffer.from(check.M1),
        })
      : check;
  const result = await client.invoke(
    new Api.auth.CheckPassword({ password: srp })
  );

  if (result instanceof Api.auth.Authorization) {
    return result.user;
  }

  throw new Error('This phone number has no Telegram account');
}

export async function getPasswordHint(
  client: TelegramClient
): Promise<string | undefined> {
  await ensureConnected(client);
  const passwordConfig = await client.invoke(new Api.account.GetPassword());
  return passwordConfig.hint;
}

export async function startQrLogin(
  client: TelegramClient,
  options: QrLoginOptions
): Promise<Api.TypeUser> {
  await ensureConnected(client);

  const { onQr, onPasswordNeeded, signal } = options;
  let notifyScan: (() => void) | null = null;
  let rejectAbort: ((error: Error) => void) | null = null;

  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
    if (signal?.aborted) {
      reject(new Error('Login cancelled'));
    }
  });
  // Avoid an unhandled rejection when the signal fires while we are not racing.
  void abortPromise.catch(() => undefined);

  const handleAbort = () => rejectAbort?.(new Error('Login cancelled'));
  signal?.addEventListener('abort', handleAbort, { once: true });

  const handler = (update: Api.TypeUpdate) => {
    if (update instanceof Api.UpdateLoginToken) {
      notifyScan?.();
    }
  };

  client.addEventHandler(handler, new Raw({ types: [Api.UpdateLoginToken] }));

  try {
    while (true) {
      if (signal?.aborted) throw new Error('Login cancelled');

      let result = await client.invoke(
        new Api.auth.ExportLoginToken({
          apiId: API_ID,
          apiHash: API_HASH,
          exceptIds: [],
        })
      );

      if (result instanceof Api.auth.LoginTokenMigrateTo) {
        await client._switchDC(result.dcId);
        result = await client.invoke(
          new Api.auth.ImportLoginToken({ token: result.token })
        );
      }

      if (result instanceof Api.auth.LoginToken) {
        const url = `tg://login?token=${result.token.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
        onQr(url, result.expires);

        const remaining = result.expires * 1000 - Date.now();
        const waitTime = Math.min(5000, Math.max(1000, remaining));

        const scanPromise = new Promise<void>((resolve) => {
          notifyScan = resolve;
        });

        await Promise.race([scanPromise, sleep(waitTime), abortPromise]);
        notifyScan = null;
        continue;
      }

      if (result instanceof Api.auth.LoginTokenSuccess) {
        if (result.authorization instanceof Api.auth.Authorization) {
          return result.authorization.user;
        }
        throw new Error('QR login did not return a user');
      }

      throw new Error(
        `Unexpected login token response: ${(result as { className?: string }).className || 'unknown'}`
      );
    }
  } catch (error) {
    if (isPasswordNeeded(error)) {
      const hint = await getPasswordHint(client).catch(() => undefined);
      let passwordError: unknown;

      while (true) {
        if (signal?.aborted) throw new Error('Login cancelled');

        const password = await Promise.race([
          onPasswordNeeded(hint, passwordError),
          abortPromise,
        ]);

        if (signal?.aborted) throw new Error('Login cancelled');

        try {
          return await signInWithPassword(client, password);
        } catch (nextPasswordError) {
          if (!isPasswordInvalid(nextPasswordError)) {
            throw nextPasswordError;
          }
          passwordError = nextPasswordError;
        }
      }
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', handleAbort);
    client.removeEventHandler(
      handler,
      new Raw({ types: [Api.UpdateLoginToken] })
    );
  }
}

export function friendlyError(error: unknown): string {
  const value = error as {
    errorMessage?: string;
    message?: string;
    seconds?: number;
  };
  const message = value?.errorMessage || value?.message || '';

  if (error instanceof FloodWaitError) {
    const minutes = Math.max(1, Math.ceil(error.seconds / 60));
    return `Too many attempts. Try again in ${minutes} minutes`;
  }

  const floodMatch = /(?:FLOOD_WAIT_|FLOOD_PREMIUM_WAIT_)(\d+)/.exec(message);
  if (floodMatch) {
    const minutes = Math.max(1, Math.ceil(Number(floodMatch[1]) / 60));
    return `Too many attempts. Try again in ${minutes} minutes`;
  }

  switch (message) {
    case 'PHONE_CODE_INVALID':
      return 'Wrong code';
    case 'PHONE_CODE_EXPIRED':
      return 'Code expired, request a new one';
    case 'PHONE_CODE_EMPTY':
    case 'PHONE_CODE_HASH_EMPTY':
      return 'Enter the code you received';
    case 'PASSWORD_HASH_INVALID':
      return 'Wrong 2FA password';
    case 'PHONE_NUMBER_INVALID':
      return 'Invalid phone number';
    case 'PHONE_NUMBER_BANNED':
      return 'This phone number is banned';
    case 'PHONE_NUMBER_UNOCCUPIED':
      return 'This phone number has no Telegram account';
    case 'SESSION_PASSWORD_NEEDED':
      return 'Two-factor authentication is required';
    case 'AUTH_TOKEN_EXPIRED':
    case 'AUTH_KEY_UNREGISTERED':
    case 'SESSION_REVOKED':
    case 'USER_DEACTIVATED':
    case 'USER_DEACTIVATED_BAN':
      return 'Your session has expired. Please log in again';
    case 'AUTH_RESTART':
      return 'Login was restarted, please try again';
    default:
      return message || 'Something went wrong. Please try again';
  }
}
