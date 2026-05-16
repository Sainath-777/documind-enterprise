"use client";

import * as React from "react";
import {
  FileText,
  UploadCloud,
  MoreHorizontal,
  Trash2,
  Download,
  Search,
  RefreshCw,
  AlertCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listDocuments, uploadDocument, deleteDocument } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import type { DocumentListItem } from "@/types/api";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DocumentsPage() {
  const { isAuthenticated } = useAuthStore();
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchDocuments = React.useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await listDocuments();
      setDocuments(data.documents);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to fetch documents");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    fetchDocuments();
    // Poll every 10s so processing→indexed status updates automatically
    const interval = setInterval(fetchDocuments, 10000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      await fetchDocuments(); // Refresh immediately
    } catch (err: unknown) {
      setError((err as Error).message ?? "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDropZoneClick = () => {
    if (!isAuthenticated) return;
    fileInputRef.current?.click();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      await fetchDocuments();
    } catch (err: unknown) {
      setError((err as Error).message ?? "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document? This will remove it from the AI's knowledge base.")) return;
    
    // Optimistic UI update
    setDocuments((prev) => prev.filter(doc => doc.id !== id));
    
    try {
      await deleteDocument(id);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to delete document");
      fetchDocuments(); // revert on failure
    }
  };

  const filtered = documents.filter((d) =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-8 p-8 pt-10 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
          <p className="text-muted-foreground mt-1">
            Upload and manage your workspace knowledge base.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchDocuments} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleDropZoneClick} disabled={isUploading || !isAuthenticated}>
            {isUploading ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
            ) : (
              <><UploadCloud className="mr-2 h-4 w-4" /> Upload Files</>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={handleDropZoneClick}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer group ${
          isAuthenticated
            ? "border-border/60 bg-muted/10 hover:bg-muted/30 hover:border-primary/40"
            : "border-border/30 bg-muted/5 opacity-50 cursor-not-allowed"
        }`}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <UploadCloud className={`h-6 w-6 text-primary ${isUploading ? "animate-bounce" : ""}`} />
        </div>
        <h3 className="text-lg font-medium">
          {isUploading ? "Uploading…" : isAuthenticated ? "Click to upload or drag and drop" : "Sign in to upload documents"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
          PDF files only · Maximum 50MB · Files are encrypted at rest
        </p>
      </div>

      {/* Table */}
      <div className="space-y-4">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents…"
            className="pl-9 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[40%]">Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && documents.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : filtered.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        {isAuthenticated ? "No documents yet. Upload a PDF to get started." : "Sign in to see your documents."}
                      </TableCell>
                    </TableRow>
                  )
                : filtered.map((doc) => (
                    <TableRow key={doc.id} className="group">
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <FileText className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[280px]" title={doc.filename}>{doc.filename}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.processing_status === "indexed" && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-normal">Indexed</Badge>
                        )}
                        {doc.processing_status === "processing" && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-normal animate-pulse">Processing</Badge>
                        )}
                        {doc.processing_status === "pending" && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-normal">Pending</Badge>
                        )}
                        {doc.processing_status === "failed" && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-normal">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{doc.chunk_count ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatBytes(doc.file_size_bytes)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(doc.upload_date)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>} />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />Download
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(doc.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
