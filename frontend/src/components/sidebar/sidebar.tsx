"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  MessageSquare, 
  FileText, 
  Activity, 
  Users, 
  Shield, 
  Settings, 
  Database,
  Search,
  LogIn,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth-store";

const navItems = [
  { name: "Ask AI", href: "/chat", icon: MessageSquare },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Usage", href: "/usage", icon: Activity },
  { name: "Team", href: "/team", icon: Users },
  { name: "Audit Logs", href: "/audit", icon: Shield },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-full min-h-screen w-[240px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground sticky top-0">
      {/* Logo */}
      <div className="flex h-14 items-center px-6 font-semibold tracking-tight">
        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Database className="h-4 w-4" />
        </div>
        DocuMind
      </div>

      {/* Search Trigger */}
      <div className="px-4 py-3">
        <button 
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          className="flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <span className="flex items-center">
            <Search className="mr-2 h-4 w-4" />
            Search anything...
          </span>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-4 w-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Auth-Aware User Section */}
      <div className="mt-auto border-t border-border p-4">
        {isAuthenticated ? (
          <>
            {/* Quota bar */}
            <div className="mb-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Monthly Usage</span>
                <span className="font-medium text-foreground">78%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[78%] bg-primary transition-all duration-500" />
              </div>
              <span className="text-[10px] text-muted-foreground">78k of 100k tokens</span>
            </div>
            {/* User + Logout */}
            <div className="flex items-center gap-3 rounded-md px-2 py-2 group hover:bg-sidebar-accent transition-colors cursor-pointer" onClick={handleLogout} title="Click to sign out">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">U</AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium leading-none truncate">Workspace</span>
                <span className="text-xs text-muted-foreground mt-1">Signed in</span>
              </div>
              <LogOut className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </>
        ) : (
          /* Not authenticated — show Sign In CTA */
          <Link
            href="/login"
            className="flex items-center gap-3 w-full rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-3 text-sm font-medium text-primary transition-colors"
          >
            <LogIn className="h-4 w-4 shrink-0" />
            <span>Sign In to your Workspace</span>
          </Link>
        )}
      </div>
    </div>
  );
}
