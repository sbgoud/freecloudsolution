import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useTelegram } from '@/context/TelegramContext';
import {
  friendlyError,
  getPasswordHint,
  sendCode,
  signInWithCode,
  signInWithPassword,
  startQrLogin,
} from '@/lib/telegram/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type LoginTab = 'qr' | 'phone';
type PhoneStep = 'phone' | 'code';
type PasswordFlow = 'qr' | 'phone';

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

function normalizePhone(value: string): string {
  return value.replace(/[\s().-]/g, '');
}

const Login = () => {
  const navigate = useNavigate();
  const { client, status, completeLogin } = useTelegram();

  const [activeTab, setActiveTab] = useState<LoginTab>('qr');

  const [qrUrl, setQrUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [isCodeViaApp, setIsCodeViaApp] = useState(false);
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [passwordActive, setPasswordActive] = useState(false);
  const [passwordFlow, setPasswordFlow] = useState<PasswordFlow>('qr');
  const [passwordHint, setPasswordHint] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const passwordResolverRef = useRef<((value: string) => void) | null>(null);
  const qrAbortRef = useRef<AbortController | null>(null);

  const handleQrPasswordNeeded = useCallback(
    (hint?: string, error?: unknown) => {
      setPasswordFlow('qr');
      setPasswordHint(hint);
      setPassword('');
      setShowPassword(false);
      setPasswordError(error ? friendlyError(error) : '');
      setPasswordLoading(false);
      setPasswordActive(true);
      setQrLoading(false);

      return new Promise<string>((resolve) => {
        passwordResolverRef.current = resolve;
      });
    },
    []
  );

  useEffect(() => {
    if (!client || status !== 'loggedOut' || activeTab !== 'qr') {
      return;
    }

    const controller = new AbortController();
    qrAbortRef.current = controller;
    let disposed = false;

    setQrUrl('');
    setQrError('');
    setQrLoading(true);

    const run = async () => {
      try {
        await startQrLogin(client, {
          signal: controller.signal,
          onQr: (url) => {
            if (disposed) return;
            setQrUrl(url);
            setQrLoading(false);
          },
          onPasswordNeeded: handleQrPasswordNeeded,
        });

        if (disposed || controller.signal.aborted) return;

        await completeLogin();
        navigate('/drive', { replace: true });
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        if (error instanceof Error && error.message === 'Login cancelled') {
          return;
        }

        const message = friendlyError(error);
        setQrError(message);
        setQrLoading(false);
        setPasswordError(message);
        setPasswordLoading(false);
      }
    };

    void run();

    return () => {
      disposed = true;
      controller.abort();
      qrAbortRef.current = null;
      passwordResolverRef.current = null;
    };
  }, [client, status, activeTab, completeLogin, navigate, handleQrPasswordNeeded]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as LoginTab);
    setQrError('');
    setPhoneError('');
    setPasswordError('');
    setPasswordActive(false);
  };

  const handleSendCode = async () => {
    if (!client) return;

    const normalized = normalizePhone(phoneInput);

    if (!PHONE_PATTERN.test(normalized)) {
      setPhoneError(
        'Enter your number in international format, e.g. +1 555 123 4567'
      );
      return;
    }

    setPhoneLoading(true);
    setPhoneError('');

    try {
      const result = await sendCode(client, normalized);
      setPhone(normalized);
      setPhoneCodeHash(result.phoneCodeHash);
      setIsCodeViaApp(result.isCodeViaApp);
      setCode('');
      setPhoneStep('code');
    } catch (error) {
      setPhoneError(friendlyError(error));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!client || !phone || !phoneCodeHash || code.length < 5) return;

    setPhoneLoading(true);
    setPhoneError('');

    try {
      const result = await signInWithCode(
        client,
        phone,
        phoneCodeHash,
        code
      );

      if (result === 'password_needed') {
        const hint = await getPasswordHint(client).catch(() => undefined);
        setPasswordFlow('phone');
        setPasswordHint(hint);
        setPassword('');
        setShowPassword(false);
        setPasswordError('');
        setPasswordLoading(false);
        setPasswordActive(true);
      } else {
        await completeLogin();
        navigate('/drive', { replace: true });
      }
    } catch (error) {
      setPhoneError(friendlyError(error));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!client || !phone || resending) return;

    setResending(true);
    setPhoneError('');

    try {
      const result = await sendCode(client, phone);
      setPhoneCodeHash(result.phoneCodeHash);
      setIsCodeViaApp(result.isCodeViaApp);
      setCode('');
    } catch (error) {
      setPhoneError(friendlyError(error));
    } finally {
      setResending(false);
    }
  };

  const handleChangeNumber = () => {
    setPhoneStep('phone');
    setPhone('');
    setPhoneCodeHash('');
    setIsCodeViaApp(false);
    setCode('');
    setPhoneError('');
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!password || passwordLoading) return;

    setPasswordError('');

    if (passwordFlow === 'qr') {
      const resolve = passwordResolverRef.current;
      passwordResolverRef.current = null;

      if (!resolve) {
        setPasswordError('This login session expired. Please start again.');
        return;
      }

      setPasswordLoading(true);
      resolve(password);
      return;
    }

    if (!client) return;

    setPasswordLoading(true);

    try {
      await signInWithPassword(client, password);
      await completeLogin();
      navigate('/drive', { replace: true });
    } catch (error) {
      setPasswordError(friendlyError(error));
      setPasswordLoading(false);
    }
  };

  const handleCancelPassword = () => {
    if (passwordFlow === 'qr') {
      qrAbortRef.current?.abort();
      setActiveTab('phone');
    }

    passwordResolverRef.current = null;
    setPasswordActive(false);
    setPassword('');
    setPasswordHint(undefined);
    setPasswordError('');
    setPasswordLoading(false);
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'loggedIn') {
    return <Navigate to="/drive" replace />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-muted/50 via-background to-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
            <Send className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">TG Drive</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Your files, stored in your own Telegram Saved Messages. Nothing is
            stored on our servers.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6">
            {passwordActive ? (
              <div className="space-y-5">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Lock className="h-6 w-6 text-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold">
                    Two-factor authentication
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your Telegram password to finish signing in.
                  </p>
                </div>

                {passwordError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not sign in</AlertTitle>
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                ) : null}

                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  <div className="space-y-2">
                    {passwordHint ? (
                      <p className="text-xs text-muted-foreground">
                        Hint: {passwordHint}
                      </p>
                    ) : null}
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Your 2FA password"
                        autoComplete="current-password"
                        autoFocus
                        disabled={passwordLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={passwordLoading || !password}
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Continue
                      </>
                    )}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={handleCancelPassword}
                  disabled={passwordLoading}
                  className="mx-auto block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                >
                  Use a different method
                </button>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qr" className="gap-2">
                    <QrCode className="h-4 w-4" />
                    QR code
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="gap-2">
                    <Smartphone className="h-4 w-4" />
                    Phone number
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="qr" className="mt-5 space-y-4">
                  {qrError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Could not start QR login</AlertTitle>
                      <AlertDescription>{qrError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="flex flex-col items-center">
                    <div className="flex h-[232px] w-[232px] items-center justify-center rounded-xl border bg-white p-3 shadow-sm">
                      {qrUrl ? (
                        <QRCodeSVG
                          value={qrUrl}
                          size={200}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                      ) : qrError ? (
                        <QrCode className="h-10 w-10 text-muted-foreground" />
                      ) : (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                      {qrError ? (
                        'QR login stopped. Try the phone tab.'
                      ) : qrLoading || !qrUrl ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating a fresh QR code...
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Waiting for you to scan...
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-center text-sm text-muted-foreground">
                    Open Telegram on your phone &gt; Settings &gt; Devices &gt;
                    Link Desktop Device and scan.
                  </p>

                  <p className="text-center text-xs text-muted-foreground">
                    The QR code refreshes automatically.
                  </p>
                </TabsContent>

                <TabsContent value="phone" className="mt-5 space-y-4">
                  {phoneError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Could not sign in</AlertTitle>
                      <AlertDescription>{phoneError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {phoneStep === 'phone' ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleSendCode();
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="+1 555 123 4567"
                          value={phoneInput}
                          onChange={(event) =>
                            setPhoneInput(event.target.value)
                          }
                          disabled={phoneLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use international format with your country code,
                          starting with +.
                        </p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={phoneLoading || !phoneInput.trim()}
                      >
                        {phoneLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending code...
                          </>
                        ) : (
                          <>
                            Send code
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="code">Verification code</Label>
                        <p className="text-xs text-muted-foreground">
                          {isCodeViaApp
                            ? `Sent to your Telegram app on ${phone}.`
                            : `Sent by SMS to ${phone}.`}
                        </p>

                        <div className="flex justify-center py-1">
                          <InputOTP
                            id="code"
                            maxLength={5}
                            value={code}
                            onChange={(value) =>
                              setCode(value.replace(/\D/g, '').slice(0, 5))
                            }
                            pattern={REGEXP_ONLY_DIGITS}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            autoFocus
                            disabled={phoneLoading}
                          >
                            <InputOTPGroup>
                              {[0, 1, 2, 3, 4].map((index) => (
                                <InputOTPSlot key={index} index={index} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>

                      <Button
                        type="button"
                        className="w-full"
                        onClick={() => void handleVerifyCode()}
                        disabled={phoneLoading || code.length < 5}
                      >
                        {phoneLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            Verify code
                          </>
                        )}
                      </Button>

                      <div className="flex items-center justify-between text-sm">
                        <button
                          type="button"
                          onClick={() => void handleResendCode()}
                          disabled={resending || phoneLoading}
                          className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                        >
                          {resending ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            'Resend code'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleChangeNumber}
                          disabled={phoneLoading}
                          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                        >
                          Change number
                        </button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>

          <CardFooter className="justify-center border-t px-6 py-4">
            <p className="text-center text-xs text-muted-foreground">
              Uses the official Telegram API. Your session is kept only in this
              browser.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;
