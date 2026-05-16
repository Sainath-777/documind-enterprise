import { Sidebar } from "@/components/sidebar/sidebar";
import { CommandPalette } from "@/components/command-palette/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col relative min-h-screen">
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
