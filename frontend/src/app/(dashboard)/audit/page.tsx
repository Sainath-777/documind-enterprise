"use client";

import * as React from "react";
import { Shield, Search, Download, RefreshCw, Zap, Database, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getAuditLogs, type AuditLog } from "@/lib/api-client";

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function exportCSV(logs: AuditLog[]) {
  const header = "Timestamp,Event,Query,Tokens,Cost (USD),Latency (ms),Cache Hit,Status\n";
  const rows = logs.map(l =>
    `"${formatTimestamp(l.timestamp)}","${l.event}","${l.query_text.replace(/"/g, "'")}",${l.tokens_used ?? 0},${l.cost_usd},${l.retrieval_latency_ms ?? 0},${l.cache_hit},${l.status}`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `documind-audit-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditLogs(100);
      setLogs(data.logs);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter(l =>
    l.query_text.toLowerCase().includes(search.toLowerCase()) ||
    l.event.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-8 p-8 pt-10 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground mt-1">
            Real-time query history and security records for your workspace.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Queries", value: logs.length, icon: Database },
          { label: "Cache Hits", value: logs.filter(l => l.cache_hit).length, icon: Zap },
          { label: "Total Tokens", value: logs.reduce((s, l) => s + (l.tokens_used ?? 0), 0).toLocaleString(), icon: CheckCircle },
          { label: "Total Cost", value: `$${logs.reduce((s, l) => s + l.cost_usd, 0).toFixed(4)}`, icon: Shield },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <stat.icon className="h-4 w-4" />
              {stat.label}
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search queries or events..."
              className="pl-9 bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {logs.length} records
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Query</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Cache</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    {logs.length === 0
                      ? "No queries yet. Ask a question in Chat to create your first audit log."
                      : "No results match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(log => (
                  <TableRow key={log.id} className="font-mono text-xs">
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-sans font-normal text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20">
                        {log.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate font-sans font-normal" title={log.query_text}>
                      {log.query_text}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.tokens_used?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.retrieval_latency_ms != null ? `${log.retrieval_latency_ms}ms` : "—"}
                    </TableCell>
                    <TableCell>
                      {log.cache_hit ? (
                        <Badge variant="outline" className="font-sans font-normal text-[10px] h-5 px-1.5 bg-amber-500/10 text-amber-500 border-amber-500/20">HIT</Badge>
                      ) : (
                        <Badge variant="outline" className="font-sans font-normal text-[10px] h-5 px-1.5 text-muted-foreground border-border">MISS</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-sans font-normal h-5 px-1.5 text-[10px]">
                        SUCCESS
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
