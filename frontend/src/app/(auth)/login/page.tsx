"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Database, Mail, Lock, ShieldCheck, ArrowRight, Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "true";
  const justRegistered = searchParams.get("registered") === "true";

  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  // If already authenticated, go straight to workspace
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  React.useEffect(() => {
    if (isAuthenticated) router.replace("/chat");
  }, [isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login({ email, password });
    if (success) router.push("/chat");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_#3B82F620_0%,_transparent_60%)]" />

      <div className="z-10 w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Database className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">DocuMind Enterprise</h1>
          <p className="text-sm text-muted-foreground mt-1">Secure Knowledge Base Access</p>
        </div>

        {/* Status banners — outside the Card so they stand out */}
        {sessionExpired && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Your session has expired. Please sign in again.
          </div>
        )}
        {justRegistered && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Workspace created! Sign in with your credentials.
          </div>
        )}

        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Workspace Login</CardTitle>
            <CardDescription>
              Sign in with your credentials to access your organization&apos;s workspace.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="alex@acmecorp.com"
                    className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    className="pl-9 pr-9 bg-background/50 border-border/50 focus-visible:ring-primary/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full relative overflow-hidden group"
                disabled={isLoading || !email.trim() || !password.trim()}
              >
                <span className={`flex items-center transition-all duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                {isLoading && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  </span>
                )}
              </Button>

              <div className="flex items-center justify-center text-[11px] text-muted-foreground gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
                <span>End-to-End Encrypted via TLS 1.3</span>
              </div>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-8 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <p>Don&apos;t have an enterprise workspace yet?</p>
          <a
            href="/register"
            className="w-full flex items-center justify-center rounded-md border border-border/50 bg-background/50 hover:bg-muted/50 px-4 py-2 text-sm font-medium transition-colors"
          >
            Create a new workspace
          </a>
        </div>
      </div>
    </div>
  );
}
