import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps { redirectAfterAuth?: string; }
type Stage = "login" | "otp" | "password";
type OtpPurpose = "setup" | "reset";

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  return returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : fallback;
}

const safeError = (error: unknown, fallback: string) => error instanceof ApiError || error instanceof Error ? error.message : fallback;

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, user, requestOtp, verifyOtp, login, setPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);
  const [email, setEmail] = useState("");
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<Stage>("login");
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("setup");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated && stage === "login") {
      if (user?.hasPassword !== false) navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect, stage, user?.hasPassword]);

  const visibleStage: Stage = stage === "login" && isAuthenticated && user?.hasPassword === false ? "password" : stage;

  const run = async (operation: () => Promise<void>, fallback: string) => {
    setIsBusy(true); setError(null);
    try { await operation(); } catch (requestError) { setError(safeError(requestError, fallback)); } finally { setIsBusy(false); }
  };

  const submitLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    void run(async () => { await login(email.trim(), password); navigate(redirect); }, "Invalid email or password");
  };

  const requestCode = (purpose: OtpPurpose) => {
    if (!email.trim()) { setError("Email is required"); return; }
    setOtpPurpose(purpose);
    void run(async () => { const response = await requestOtp(email.trim()); setOtp(""); setNotice(response.message); setStage("otp"); }, "Unable to send verification email");
  };

  const submitCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.length !== 6) return;
    void run(async () => { const result = await verifyOtp(email.trim(), otp, otpPurpose); setOtp(""); if (otpPurpose === "reset" || !result.user.hasPassword) setStage("password"); else navigate(redirect); }, "Unable to verify code");
  };

  const submitPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    void run(async () => { await setPassword(password); navigate(redirect); }, "Unable to set password");
  };

  const resetToLogin = () => {
    if (isBusy) return;
    setStage("login"); setOtp(""); setError(null); setNotice(null); setPasswordValue(""); setConfirmPassword("");
  };

  return <div className="min-h-screen flex flex-col"><div className="flex-1 flex items-center justify-center"><Card className="min-w-[350px] pb-0 border shadow-md">
    <CardHeader className="text-center"><div className="flex justify-center"><img src={logo} alt="Le Feast" width={64} height={64} className="rounded-lg mb-4 mt-4 cursor-pointer" onClick={() => navigate("/")} /></div><CardTitle className="text-xl">{visibleStage === "login" ? "Sign in to Your Daily Checks" : visibleStage === "otp" ? "Verify your email" : "Set your password"}</CardTitle><CardDescription>{visibleStage === "login" ? "Use your Le Feast email and password." : visibleStage === "otp" ? `We've sent a code to ${email}` : "Choose a password for future sign-ins."}</CardDescription></CardHeader>
    {visibleStage === "login" && <form onSubmit={submitLogin}><CardContent className="space-y-4"><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input name="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" type="email" className="pl-9" disabled={isBusy} required /></div><Input name="password" value={password} onChange={event => setPasswordValue(event.target.value)} placeholder="Password" type="password" minLength={10} disabled={isBusy} required />{error && <p className="text-sm text-red-500">{error}</p>}</CardContent><CardFooter className="flex-col gap-2"><Button type="submit" className="w-full" disabled={isBusy}>{isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>}</Button><Button type="button" variant="link" className="w-full" disabled={isBusy} onClick={() => requestCode("reset")}>Forgot password?</Button><Button type="button" variant="ghost" className="w-full" disabled={isBusy} onClick={() => requestCode("setup")}>Set up a password</Button></CardFooter></form>}
    {visibleStage === "otp" && <form onSubmit={submitCode}><CardContent className="pb-4">{notice && <p className="mb-4 text-sm text-center text-muted-foreground">{notice}</p>}<div className="flex justify-center"><InputOTP value={otp} onChange={setOtp} maxLength={6} disabled={isBusy}><InputOTPGroup>{Array.from({ length: 6 }).map((_, index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup></InputOTP></div>{error && <p className="mt-2 text-sm text-red-500 text-center">{error}</p>}<p className="text-sm text-muted-foreground text-center mt-4">Code required only for setup or password reset.</p></CardContent><CardFooter className="flex-col gap-2"><Button type="submit" className="w-full" disabled={isBusy || otp.length !== 6}>{isBusy ? "Verifying…" : "Verify code"}</Button><Button type="button" variant="link" disabled={isBusy} onClick={() => requestCode(otpPurpose)}>Send again</Button><Button type="button" variant="ghost" className="w-full" onClick={resetToLogin} disabled={isBusy}>Back to sign in</Button></CardFooter></form>}
    {visibleStage === "password" && <form onSubmit={submitPassword}><CardContent className="space-y-4"><Input name="new-password" value={password} onChange={event => setPasswordValue(event.target.value)} placeholder="New password" type="password" minLength={10} disabled={isBusy} required /><Input name="confirm-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Confirm password" type="password" minLength={10} disabled={isBusy} required /><p className="text-xs text-muted-foreground">Use at least 10 characters. Previous OTP sessions are replaced after setup.</p>{error && <p className="text-sm text-red-500">{error}</p>}</CardContent><CardFooter className="flex-col gap-2"><Button type="submit" className="w-full" disabled={isBusy || password.length < 10 || !confirmPassword}>{isBusy ? "Saving…" : "Save password"}</Button></CardFooter></form>}
    <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">Internal Le Feast workspace · Europe/London</div>
  </Card></div></div>;
}

export default function AuthPage(props: AuthProps) { return <Suspense><Auth {...props} /></Suspense>; }
