"use client";

import * as React from "react";
import {
  Send,
  Paperclip,
  Bot,
  User,
  Maximize2,
  X,
  ChevronDown,
  FileText,
  Search,
  Zap,
  Clock,
  RefreshCw
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamQuery } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";
import type { ChatMessage, Citation, SSEDone, SSEMetadata } from "@/types/api";

// -------------------------------------------------------
// Individual Message Bubble
// -------------------------------------------------------
function MessageBubble({
  message,
  onCitationClick,
}: {
  message: ChatMessage;
  onCitationClick: (citation: Citation) => void;
}) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex gap-4 w-full ${isAssistant ? "" : "flex-row-reverse"}`}>
      <Avatar className="h-8 w-8 mt-0.5 border border-border shrink-0">
        <AvatarFallback className={isAssistant ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground text-xs"}>
          {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col gap-2 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${message.role === "user" ? "bg-primary/10 border border-primary/20 px-4 py-3 rounded-2xl rounded-tr-sm" : "bg-muted/30 border border-border/50 px-4 py-3 rounded-2xl rounded-tl-sm"}`}>
          {message.content}
          {message.isStreaming && (
            <span className="ml-1 inline-block h-4 w-0.5 bg-primary animate-pulse" />
          )}
        </div>

        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.citations.map((cit) => (
              <Button
                key={cit.id}
                variant="outline"
                size="sm"
                className="h-6 text-[10px] bg-background hover:bg-primary/5 border-border rounded-full px-2"
                onClick={() => onCitationClick(cit)}
              >
                <FileText className="mr-1 h-3 w-3" />
                Page {cit.page}
              </Button>
            ))}
          </div>
        )}

        {isAssistant && message.metadata && !message.isStreaming && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {message.metadata.retrieval_latency_ms}ms</span>
            {message.metadata.cache_hit && <span className="text-emerald-500 font-medium">Cache Hit</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main Chat Workspace
// -------------------------------------------------------
export default function ChatWorkspace() {
  const { isAuthenticated } = useAuthStore();
  const { messages, setMessages, clearChat } = useChatStore();
  const [inputValue, setInputValue] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [activeCitation, setActiveCitation] = React.useState<Citation | null>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return;

    setIsUploading(true);
    try {
      const { uploadDocument } = await import("@/lib/api-client");
      await uploadDocument(file);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: `✅ Successfully uploaded **${file.name}**. Processing...`
      }]);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInputValue("");
    setIsStreaming(true);

    let metadata: SSEMetadata | undefined;

    if (isAuthenticated) {
      streamQuery(
        { query: userMessage.content, top_k: 5 },
        {
          onMetadata: (m) => { metadata = m; },
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: msg.content + token } : msg
              )
            );
          },
          onSources: (chunks) => {
            const citations: Citation[] = chunks.map((c, i) => ({
              id: `${assistantId}-cit-${i}`,
              doc_id: c.doc_id,
              page: c.page,
              score: c.score,
              text_preview: c.text_preview,
            }));
            setMessages((prev) =>
              prev.map((msg) => msg.id === assistantId ? { ...msg, citations } : msg)
            );
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, isStreaming: false, metadata } : msg
              )
            );
            setIsStreaming(false);
          },
          onError: (message) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: `⚠️ ${message}`, isStreaming: false } : msg
              )
            );
            setIsStreaming(false);
          },
        }
      );
    }
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto min-h-screen bg-background">
      
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">DocuMind AI</h1>
            <p className="text-[10px] text-muted-foreground">Vercel/Linear Styled RAG</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 text-xs text-muted-foreground hover:text-destructive">
              Clear chat
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.dispatchEvent(new Event("open-command-palette"))}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area - Natural Scrolling */}
      <div className="flex-1 px-6 py-10 space-y-12">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Enterprise Knowledge Base</h2>
            <p className="text-muted-foreground max-w-lg mb-10 text-lg">
              Ask complex questions across your PDFs. Our AI uses Reranking and Hybrid Search for 99.9% accuracy.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
              {[
                "Summarize our data security policies",
                "What are the PII handling rules?",
                "List all compliance requirements",
                "Check the vendor agreement terms"
              ].map(q => (
                <button key={q} onClick={() => setInputValue(q)} className="text-left p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all text-sm">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-10">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onCitationClick={setActiveCitation} />
          ))}
        </div>
      </div>

      {/* Input Area - Sticks to bottom but part of normal flow */}
      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-10 pb-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative group rounded-2xl border border-border bg-card shadow-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <Textarea
              placeholder="Ask your documents anything..."
              className="min-h-[60px] max-h-[200px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 px-5 py-5 text-base"
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between px-4 pb-4">
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
              </div>
              <Button size="icon" className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90" onClick={handleSend} disabled={!inputValue.trim() || isStreaming}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Citation Overlay */}
      {activeCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <header className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Document Source (Page {activeCitation.page})</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveCitation(null)}>
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="p-8 overflow-y-auto text-sm leading-relaxed">
              <div className="bg-muted/50 p-6 rounded-xl border border-border mb-4 italic">
                &quot;{activeCitation.text_preview}&quot;
              </div>
              <p className="text-xs text-muted-foreground">Source Match Score: {(activeCitation.score * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
