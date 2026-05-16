"use client";

import * as React from "react";
import { UserPlus, Shield, CheckCircle, Clock, Building2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getTeamMembers, type TeamMember } from "@/lib/api-client";

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      year: "numeric", month: "short", day: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function TeamPage() {
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchTeam = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTeamMembers();
        setMembers(data.members);
      } catch (err: unknown) {
        setError((err as Error).message ?? "Failed to load team members");
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  const company = members[0]?.company ?? "Your Workspace";
  const tier = members[0]?.tier ?? "free";

  return (
    <div className="flex-1 space-y-8 p-8 pt-10 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Members</h2>
          <p className="text-muted-foreground mt-1">
            Manage who has access to this workspace and their permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button disabled title="Invite coming soon">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Workspace Info Card */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Company</p>
            <p className="font-semibold">{company}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <Badge variant="outline" className="capitalize bg-primary/10 text-primary border-primary/20 font-normal mt-0.5">
              {tier}
            </Badge>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
          <UserPlus className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="font-semibold">{members.length}</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Team Table */}
      <div className="rounded-md border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Member Since</TableHead>
              <TableHead>Last Login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(2)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(5)].map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted/50 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  No team members found.
                </TableCell>
              </TableRow>
            ) : (
              members.map(member => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {member.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{member.name}</span>
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-normal">
                      <Shield className="mr-1 h-3 w-3" /> {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.is_active ? (
                      <div className="flex items-center gap-1.5 text-emerald-500 text-sm">
                        <CheckCircle className="h-4 w-4" /> Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                        <Clock className="h-4 w-4" /> Inactive
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(member.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(member.last_login)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
