"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  FileText,
  Activity,
  Users,
  Settings,
  ShieldCheck,
  Search,
  X,
} from "lucide-react";

// We bypass the @base-ui Dialog entirely for the command palette
// because cmdk's context-based store is incompatible with @base-ui's Dialog portal.
// This uses a simple raw overlay + cmdk Command directly.

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "cmdk";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const handleOpen = () => setOpen(true);

    document.addEventListener("keydown", down);
    window.addEventListener("open-command-palette", handleOpen);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("open-command-palette", handleOpen);
    };
  }, []);

  const navigate = (path: string) => {
    setOpen(false);
    setSearch("");
    router.push(path);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[28%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
        <Command className="w-full" shouldFilter={true}>
          {/* Search input */}
          <div className="flex items-center border-b border-border px-4 py-3 gap-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search or jump to..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <CommandList className="max-h-[340px] overflow-y-auto p-2">
            <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </CommandEmpty>

            <CommandGroup
              heading="Navigation"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              <CommandItem
                value="Ask AI chat"
                onSelect={() => navigate("/chat")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50 transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>Ask AI</span>
                <span className="ml-auto text-[11px] text-muted-foreground">/chat</span>
              </CommandItem>

              <CommandItem
                value="Documents library"
                onSelect={() => navigate("/documents")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Documents</span>
                <span className="ml-auto text-[11px] text-muted-foreground">/documents</span>
              </CommandItem>

              <CommandItem
                value="Usage dashboard analytics"
                onSelect={() => navigate("/usage")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50 transition-colors"
              >
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span>Usage Dashboard</span>
                <span className="ml-auto text-[11px] text-muted-foreground">/usage</span>
              </CommandItem>

              <CommandItem
                value="Team members"
                onSelect={() => navigate("/team")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50 transition-colors"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Team Members</span>
                <span className="ml-auto text-[11px] text-muted-foreground">/team</span>
              </CommandItem>

              <CommandItem
                value="Audit logs security"
                onSelect={() => navigate("/audit")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50 transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span>Audit Logs</span>
                <span className="ml-auto text-[11px] text-muted-foreground">/audit</span>
              </CommandItem>

              <CommandItem
                value="Settings workspace configuration"
                onSelect={() => navigate("/settings")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent/50 transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Settings</span>
                <span className="ml-auto text-[11px] text-muted-foreground">/settings</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>

          {/* Footer hint */}
          <div className="border-t border-border px-4 py-2.5 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span><kbd className="font-mono bg-muted px-1 rounded">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono bg-muted px-1 rounded">↵</kbd> select</span>
            <span><kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </>
  );
}
