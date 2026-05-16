"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Database, Mail, Lock, ShieldCheck, ArrowRight, Building, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { registerUser } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await registerUser({
        email,
        password,
        company_name: workspaceName,
      });
      // After registration, redirect to login
      router.push("/login?registered=true");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_#3B82F615_0%,_transparent_60%)]" />
      
      <div className="z-10 w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Create Workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">Start your enterprise AI journey with DocuMind</p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Register Organization</CardTitle>
            <CardDescription>
              Set up your private workspace and administrative account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Name</label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Acme Corp" 
                    className="pl-9 bg-background/50 border-border/50"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="email"
                    placeholder="admin@acmecorp.com" 
                    className="pl-9 bg-background/50 border-border/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="password"
                    placeholder="Min. 8 characters" 
                    className="pl-9 bg-background/50 border-border/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Workspace"}
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <div className="flex items-center justify-center text-[11px] text-muted-foreground gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
                <span>Dedicated Tenant Isolation Enabled</span>
              </div>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have a workspace?{" "}
          <a href="/login" className="text-primary hover:underline underline-offset-4">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
