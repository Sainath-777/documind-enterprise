"use client";

import * as React from "react";
import { Activity, Database, Users, CreditCard, ArrowUpRight, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getUsageStats, type UsageStats } from "@/lib/api-client";

function clamp(val: number) {
  return Math.min(Math.max(val, 0), 100);
}

export default function UsagePage() {
  const [stats, setStats] = React.useState<UsageStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsageStats();
      setStats(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to load usage data");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchStats(); }, []);

  const tokensUsed = stats?.current_usage.tokens_this_month ?? 0;
  const docsTotal = stats?.current_usage.documents_total ?? 0;
  const queriesTotal = stats?.current_usage.queries_this_month ?? 0;
  const maxTokens = stats?.plan_limits.max_tokens_per_month ?? 100000;
  const maxDocs = stats?.plan_limits.max_documents ?? 100;
  const maxQueries = stats?.plan_limits.max_queries_per_month ?? 1000;
  const tokenPct = stats?.usage_pct.tokens ?? 0;
  const docPct = stats?.usage_pct.documents ?? 0;
  const queryPct = stats?.usage_pct.queries ?? 0;

  const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`bg-muted/50 rounded animate-pulse ${className}`} />
  );

  return (
    <div className="flex-1 space-y-8 p-8 pt-10 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Usage Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Monitor your workspace quotas, token consumption, and billing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button>
            <Zap className="mr-2 h-4 w-4" />
            Upgrade Plan
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Primary Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-muted/10 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens Used</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mb-1" /> : (
              <div className="text-2xl font-bold">{tokensUsed.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              of {maxTokens.toLocaleString()} monthly limit
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/10 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Documents</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16 mb-1" /> : (
              <div className="text-2xl font-bold">{docsTotal}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              of {maxDocs} document limit
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/10 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queries Made</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16 mb-1" /> : (
              <div className="text-2xl font-bold">{queriesTotal.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              of {maxQueries.toLocaleString()} monthly limit
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/10 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {loading ? <Skeleton className="h-8 w-20 mb-1" /> : "Free"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              Open source tier <ArrowUpRight className="ml-1 h-3 w-3" />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Limits */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-border/60 bg-background">
          <CardHeader>
            <CardTitle>Usage Limits</CardTitle>
            <CardDescription>
              Real-time consumption across your provisioned workspace quotas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Tokens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Monthly Token Quota (LLM)</span>
                <span className="text-sm text-muted-foreground">
                  {loading ? "…" : `${tokenPct.toFixed(1)}% (${tokensUsed.toLocaleString()} / ${maxTokens.toLocaleString()})`}
                </span>
              </div>
              <Progress value={loading ? 0 : clamp(tokenPct)} className="h-2" />
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Document Storage</span>
                <span className="text-sm text-muted-foreground">
                  {loading ? "…" : `${docPct.toFixed(1)}% (${docsTotal} / ${maxDocs} docs)`}
                </span>
              </div>
              <Progress value={loading ? 0 : clamp(docPct)} className="h-2" />
            </div>

            {/* Queries */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Query Rate Limit (Monthly)</span>
                <span className="text-sm text-muted-foreground">
                  {loading ? "…" : `${queryPct.toFixed(1)}% (${queriesTotal} / ${maxQueries})`}
                </span>
              </div>
              <Progress value={loading ? 0 : clamp(queryPct)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-border/60 bg-muted/5 flex flex-col items-center justify-center text-center p-6">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">Need higher limits?</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-[250px]">
            Contact your account manager to request a custom Enterprise quota increase.
          </p>
          <Button className="w-full">Contact Sales</Button>
        </Card>
      </div>
    </div>
  );
}
