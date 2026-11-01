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
  Check,
  Cloud,
  Eye,
  EyeOff,
  Github,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  QrCode,
  Send,
  Server,
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brand } from '@/components/brand';
import { ThemeModeToggle } from '@/components/theme-mode-toggle';

type LoginTab = 'qr' | 'phone';
type PhoneStep = 'phone' | 'code';
type PasswordFlow = 'qr' | 'phone';

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;
const PROJECT_URL = 'https://github.com/sbgoud/freecloudsolution';

function normalizePhone(value: string): string {
  return value.replace(/[\s().-]/g, '');
}

const valueProps = [
  {
    icon: ShieldCheck,
    title: 'Private by design',
    description: 'Your files stay in your own Telegram Saved Messages.',
  },
  {
    icon: Server,
    title: 'No app backend',
    description: 'No database, no file storage, no server in between.',
  },
  {
    icon: HardDrive,
    title: 'Room for big files',
    description: 'Upload up to 2 GB, or 4 GB with Telegram Premium.',
  },
  {
    icon: Github,
    title: 'Fully open source',
    description: 'Inspect the code and run your own copy anytime.',
  },
];

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
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background">
        <div className="animate-pulse">
          <Brand />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to Telegram…
        </div>
      </div>
    );
  }

  if (status === 'loggedIn') {
    return <Navigate to="/drive" replace />;
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-grid-fade opacity-40" />
        <div className="absolute -top-40 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background to-transparent" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <Brand />
        <div className="flex items-center gap-1.5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden text-muted-foreground sm:inline-flex"
          >
            <a href={PROJECT_URL} target="_blank" rel="noreferrer">
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </Button>
          <ThemeModeToggle />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-16">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Private cloud storage, powered by Telegram
              </span>

              <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.04] tracking-[-0.035em] text-foreground">
                Your Telegram account,
                <br />
                <span className="text-primary">with a proper drive.</span>
              </h1>

              <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
                Browse, organize, and upload files without handing your data to
                another cloud provider. TG Drive uses the Saved Messages you
                already trust.
              </p>

              <ul className="mt-9 grid max-w-lg grid-cols-2 gap-x-6 gap-y-6">
                {valueProps.map((prop) => {
                  const Icon = prop.icon;
                  return (
                    <li key={prop.title} className="flex gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card text-primary shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{prop.title}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                          {prop.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-10 flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3 shadow-sm backdrop-blur">
                <Cloud className="h-5 w-5 shrink-0 text-primary" />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  File names and folders live in Telegram message captions, so
                  your organization follows your account.
                </p>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md" aria-labelledby="sign-in-heading">
            <div className="rounded-2xl border bg-card/95 p-5 shadow-lift backdrop-blur sm:p-7">
              <div className="mb-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2
                      id="sign-in-heading"
                      className="text-[1.35rem] font-semibold tracking-tight"
                    >
                      {passwordActive ? 'Two-step verification' : 'Sign in'}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {passwordActive
                        ? 'Your account is protected with a Telegram password.'
                        : 'Connect your account to open your drive.'}
                    </p>
                  </div>
                  {!passwordActive ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Send className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <KeyRound className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>

              {passwordActive ? (
                <div className="space-y-5">
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-sm">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          Enter your Telegram password
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          This is the password you set for two-step verification,
                          not your SMS code.
                        </p>
                      </div>
                    </div>
                  </div>

                  {passwordError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Could not sign in</AlertTitle>
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="password">Password</Label>
                        {passwordHint ? (
                          <span className="truncate text-xs text-muted-foreground">
                            Hint: {passwordHint}
                          </span>
                        ) : null}
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Your 2FA password"
                          autoComplete="current-password"
                          autoFocus
                          disabled={passwordLoading}
                          className="pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      className="h-11 w-full"
                      disabled={passwordLoading || !password}
                    >
                      {passwordLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" />
                          Open my drive
                        </>
                      )}
                    </Button>
                  </form>

                  <button
                    type="button"
                    onClick={handleCancelPassword}
                    disabled={passwordLoading}
                    className="mx-auto block text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                  >
                    Use a different sign-in method
                  </button>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList className="grid h-11 w-full grid-cols-2">
                    <TabsTrigger value="qr" className="gap-2">
                      <QrCode className="h-4 w-4" />
                      QR code
                    </TabsTrigger>
                    <TabsTrigger value="phone" className="gap-2">
                      <Smartphone className="h-4 w-4" />
                      Phone number
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="qr" className="mt-6 space-y-4">
                    {qrError ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Could not start QR login</AlertTitle>
                        <AlertDescription>{qrError}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="flex flex-col items-center">
                      <div className="relative rounded-2xl border bg-white p-4 shadow-soft">
                        <div className="flex h-[212px] w-[212px] items-center justify-center">
                          {qrUrl ? (
                            <QRCodeSVG
                              value={qrUrl}
                              size={196}
                              level="M"
                              bgColor="#ffffff"
                              fgColor="#111827"
                            />
                          ) : qrError ? (
                            <QrCode className="h-10 w-10 text-slate-400" />
                          ) : (
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                          )}
                        </div>
                      </div>

                      <div
                        className="mt-4 flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        aria-live="polite"
                      >
                        {qrError ? (
                          'QR login stopped. Try the phone tab.'
                        ) : qrLoading || !qrUrl ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Generating a fresh QR code…
                          </>
                        ) : (
                          <>
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                            </span>
                            Waiting for you to scan
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Scan with Telegram
                      </p>
                      <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
                        Open Telegram on your phone, go to Settings → Devices →
                        Link Desktop Device, then point it at this code.
                      </p>
                      <p className="text-[11px] text-muted-foreground/80">
                        The code refreshes automatically.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="phone" className="mt-6 space-y-4">
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
                            className="h-11"
                          />
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Use international format with your country code,
                            starting with +.
                          </p>
                        </div>

                        <Button
                          type="submit"
                          className="h-11 w-full"
                          disabled={phoneLoading || !phoneInput.trim()}
                        >
                          {phoneLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Sending code…
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
                          <p className="text-xs leading-relaxed text-muted-foreground">
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
                          className="h-11 w-full"
                          onClick={() => void handleVerifyCode()}
                          disabled={phoneLoading || code.length < 5}
                        >
                          {phoneLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Verifying…
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Verify code
                            </>
                          )}
                        </Button>

                        <div className="flex items-center justify-between gap-3 text-sm">
                          <button
                            type="button"
                            onClick={() => void handleResendCode()}
                            disabled={resending || phoneLoading}
                            className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                          >
                            {resending ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Sending…
                              </>
                            ) : (
                              'Resend code'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleChangeNumber}
                            disabled={phoneLoading}
                            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                          >
                            Change number
                          </button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              <div className="mt-6 flex items-start gap-2 border-t pt-4">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Uses the official Telegram API. Your session is kept only in
                  this browser and can be removed by signing out.
                </p>
              </div>
            </div>

          </section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-background/60 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <p>
            TG Drive is a pure open-source project by{' '}
            <a
              href={PROJECT_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              sbgoud
            </a>
            .
          </p>
          <p className="flex items-center gap-1.5">
            <Github className="h-3.5 w-3.5" />
            No tracking. No vendor lock-in.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Login;
