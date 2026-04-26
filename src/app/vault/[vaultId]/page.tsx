"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { FileIcon } from "@/components/file-icon";
import {
  Plus,
  Upload,
  Trash2,
  RefreshCw,
  ArrowLeft,
  ArrowUp,
  MessageSquare,
  FileText,
  HardDrive,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  History,
  Share2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LoadingScreen } from "@/components/ui/loading-screen";

// ─── Types ──────────────────────────────────────────────

interface DocumentData {
  id: string;
  fileName: string;
  docType: string;
  fileSize: number | null;
  pageCount: number | null;
  status: string;
  errorMessage: string | null;
  uploadTime: string;
  language: string | null;
}

interface VaultData {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

interface VaultStats {
  totalDocuments: number;
  byStatus: {
    pending: number;
    processing: number;
    ready: number;
    failed: number;
  };
  totalSize: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Helpers ────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Page ───────────────────────────────────────────────

import { Suspense } from "react";

function VaultDetailContent() {
  const params = useParams();
  const router = useRouter();
  const vaultId = params.vaultId as string;
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session');

  // State
  const [vault, setVault] = useState<VaultData | null>(null);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [showDeleteVault, setShowDeleteVault] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sessions & History
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Data fetching ──────────────────────────────────

  const fetchVault = useCallback(async () => {
    try {
      const res = await fetch(`/api/vaults/${vaultId}`);
      const data = await res.json();
      if (data.vault) setVault(data.vault);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      console.error("Failed to fetch vault:", e);
    }
  }, [vaultId]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/vaults/${vaultId}/documents`);
      const data = await res.json();
      if (data.documents) setDocuments(data.documents);
    } catch (e) {
      console.error("Failed to fetch documents:", e);
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/sessions?vaultId=${vaultId}`);
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    }
  }, [vaultId]);

  useEffect(() => {
    fetchVault();
    fetchDocuments();
    fetchSessions();
    
    if (sessionParam) {
      loadSession(sessionParam);
    }
  }, [fetchVault, fetchDocuments, fetchSessions, vaultId, sessionParam]);

  // Poll every 5s while any doc is processing
  useEffect(() => {
    const hasProcessing = documents.some((d) =>
      ["pending", "processing"].includes(d.status)
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
      fetchVault();
    }, 5000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments, fetchVault]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Handlers ───────────────────────────────────────

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch(`/api/vaults/${vaultId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      fetchDocuments();
      fetchVault();
    } catch (e) {
      console.error("Upload error:", e);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    setDeleting(docId);
    try {
      await fetch(`/api/vaults/${vaultId}/documents/${docId}`, {
        method: "DELETE",
      });
      fetchDocuments();
      fetchVault();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(null);
    }
  };

  const handleReprocess = async (docId: string) => {
    setReprocessing(docId);
    try {
      await fetch(`/api/vaults/${vaultId}/documents/${docId}`, {
        method: "POST",
      });
      fetchDocuments();
    } catch (e) {
      console.error("Reprocess failed:", e);
    } finally {
      setReprocessing(null);
    }
  };

  const handleDeleteVault = async () => {
    try {
      await fetch(`/api/vaults/${vaultId}`, { method: "DELETE" });
      router.push("/vault");
    } catch (e) {
      console.error("Delete vault failed:", e);
    }
  };

  // ─── Chat ───────────────────────────────────────────

  const handleSendChat = async () => {
    if (!chatInput.trim() || isSubmitting) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsSubmitting(true);

    try {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "",
        },
      ]);

      const response = await fetch(`/api/vaults/${vaultId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          messages: [
            ...chatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userMsg.content }
          ]
        }),
      });

      if (!response.ok) throw new Error("Failed to search vault");

      // Get session ID from header if it was newly created
      const newSessionId = response.headers.get("X-Session-Id");
      if (newSessionId && !sessionId) {
        setSessionId(newSessionId);
        fetchSessions();
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let assistantResponse = "";

      while (reader && !done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value, { stream: true });
          const lines = chunkValue.split("\n");

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.t) {
                assistantResponse += parsed.t;
                setChatMessages(prev => {
                  const newMsgs = [...prev];
                  const last = newMsgs[newMsgs.length - 1];
                  last.content = assistantResponse;
                  return newMsgs;
                });
              }
            } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (e) {
      console.error("Chat error:", e);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error searching your vault.",
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadSession = async (sId: string) => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/chat/sessions/${sId}`);
      const data = await res.json();
      if (data.session) {
        setSessionId(data.session.id);
        setChatMessages(data.messages || []);
        setIsPublic(data.session.isPublic);
        setShareToken(data.session.shareToken);
        setShowHistory(false);
      }
    } catch (e) {
      console.error("Failed to load session:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewChat = () => {
    setSessionId(null);
    setChatMessages([]);
    setIsPublic(false);
    setShareToken(null);
  };

  const toggleShare = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      const data = await res.json();
      if (data.session) {
        setIsPublic(data.session.isPublic);
        setShareToken(data.session.shareToken);
      }
    } catch (e) {
      console.error("Failed to toggle share:", e);
    }
  };

  const deleteSession = async (sId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      const res = await fetch(`/api/chat/sessions/${sId}`, { method: "DELETE" });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sId));
        if (sessionId === sId) handleNewChat();
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  const copyShareLink = () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (loading || !vault) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <AppSidebar />
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileUpload(e.target.files)}
        multiple
        className="hidden"
      />

      <main className="flex-1 flex flex-col relative overflow-hidden max-h-screen">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8 text-slate-400 hover:text-slate-900 transition-all cursor-pointer" />
            <button
              onClick={() => router.push("/vault")}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-900 transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-[13px] font-medium hidden sm:inline">
                Vaults
              </span>
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <h1 className="text-lg font-serif font-semibold tracking-tight text-slate-900">
              {vault.name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2 bg-slate-900 hover:bg-black text-white font-semibold rounded-lg h-8 px-4 text-[12px] transition-all cursor-pointer"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteVault(true)}
              className="h-8 px-3 text-[12px] font-medium text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 60/40 split */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANEL: Documents */}
          <div className="flex-[3] flex flex-col overflow-hidden min-w-0 border-r border-slate-100 bg-white/50">
            {/* Upload zone */}
            <div
              className={`m-4 border-2 border-dashed rounded-xl transition-all ${
                isDragging ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Upload className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">Drag & drop documents here</p>
                <p className="text-[12px] text-slate-400 mt-1">PDF, DOCX, TXT, HTML, CSV, Images</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 h-8 text-[12px] font-medium cursor-pointer"
                >
                  Browse files
                </Button>
              </div>
            </div>

            {/* Stats */}
            {stats && stats.totalDocuments > 0 && (
              <div className="px-4 mb-3 flex items-center gap-4 text-[12px] text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <FileText className="h-3.5 w-3.5" />
                  {stats.totalDocuments} docs
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <HardDrive className="h-3.5 w-3.5" />
                  {formatBytes(stats.totalSize)}
                </span>
              </div>
            )}

            {/* Document list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
              <AnimatePresence>
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400">
                    <FileText className="h-10 w-10 opacity-20 mb-3" />
                    <p className="text-sm">No documents uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {documents.map((doc, i) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 group transition-all"
                      >
                        <FileIcon docType={doc.docType} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-slate-800 truncate">{doc.fileName}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{doc.docType.toUpperCase()}</span>
                            <span>•</span>
                            <span>{formatBytes(doc.fileSize || 0)}</span>
                          </div>
                        </div>
                        <StatusBadge status={doc.status} />
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                          {doc.status === "failed" && (
                            <button onClick={() => handleReprocess(doc.id)} className="h-7 w-7 rounded-md hover:bg-slate-50 text-slate-400 hover:text-slate-900 flex items-center justify-center cursor-pointer">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteDoc(doc.id)} className="h-7 w-7 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT PANEL: Chat */}
          <div className="flex-[2] flex flex-col overflow-hidden bg-white">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg shadow-slate-200">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-900 tracking-tight">Vault Assistant</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Smart document search</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowHistory(!showHistory)} className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${showHistory ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50"}`}>
                    {showHistory ? <X className="h-4 w-4" /> : <History className="h-4 w-4" />}
                  </button>
                  <button onClick={handleNewChat} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all cursor-pointer">
                    <Plus className="h-4 w-4" />
                  </button>
                  {sessionId && (
                    <button onClick={toggleShare} className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${isPublic ? "bg-amber-50 text-amber-600" : "text-slate-400 hover:bg-slate-50"}`}>
                      <Share2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Share link */}
              <AnimatePresence>
                {isPublic && shareToken && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 overflow-hidden">
                    <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ExternalLink className="h-3 w-3 text-amber-600 shrink-0" />
                        <span className="text-[11px] font-medium text-amber-800 truncate">Public sharing enabled</span>
                      </div>
                      <button onClick={copyShareLink} className="h-6 px-2 rounded bg-white border border-amber-200 text-[10px] font-bold text-amber-700 hover:bg-amber-50 transition-all cursor-pointer flex items-center gap-1 shrink-0">
                        {isCopied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                        {isCopied ? "Copied" : "Copy Link"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 relative flex flex-col overflow-hidden">
              {/* History Overlay */}
              <AnimatePresence>
                {showHistory && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-white flex flex-col shadow-2xl">
                    <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                      <h4 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-slate-400" />
                        Chat History
                      </h4>
                      <button onClick={() => setShowHistory(false)} className="h-7 w-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
                      {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                          <MessageSquare className="h-8 w-8 opacity-10 mb-2" />
                          <p className="text-[11px]">No history found</p>
                        </div>
                      ) : (
                      sessions.map((s) => (
                        <div key={s.id} className="relative group">
                          <button
                            onClick={() => loadSession(s.id)}
                            className={`w-full text-left p-2.5 rounded-lg transition-all cursor-pointer group ${
                              sessionId === s.id ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <p className="text-[12px] font-semibold truncate leading-tight pr-6">{s.title || "New Chat"}</p>
                            <div className="flex items-center gap-2 mt-1 opacity-60">
                              <Clock className="h-2.5 w-2.5" />
                              <span className="text-[10px]">{new Date(s.updatedAt).toLocaleDateString()}</span>
                              {s.isPublic && <Share2 className="h-2.5 w-2.5 text-amber-500" />}
                            </div>
                          </button>
                          <button
                            onClick={(e) => deleteSession(s.id, e)}
                            className={`absolute top-2.5 right-2 h-6 w-6 rounded-md items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 flex ${
                              sessionId === s.id ? "text-white/40 hover:bg-white/10 hover:text-white" : "text-slate-400"
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                      <Sparkles className="h-6 w-6 text-slate-300" />
                    </div>
                    <h4 className="text-[15px] font-bold text-slate-900 mb-1">Knowledge Assistant</h4>
                    <p className="text-[13px] text-slate-400 max-w-[240px]">Search your vault for specific legal precedents or statutory rules.</p>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <motion.div key={msg.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`max-w-[90%] rounded-2xl p-4 text-[14px] leading-relaxed shadow-sm border ${msg.role === "user" ? "bg-slate-900 text-white border-slate-800" : "bg-white text-slate-800 border-slate-100"}`}>
                        {msg.role === "assistant" && msg.content === "" ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                            <span className="text-slate-400 italic">Thinking...</span>
                          </div>
                        ) : (
                          <div className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                              p: (props) => <p className="mb-3 last:mb-0" {...props} />,
                              h1: (props) => <h1 className="text-lg font-bold mt-4 mb-2" {...props} />,
                              h2: (props) => <h2 className="text-base font-bold mt-3 mb-2" {...props} />,
                              ul: (props) => <ul className="list-disc pl-4 mb-3 space-y-1" {...props} />,
                              li: (props) => <li className="pl-1" {...props} />,
                              strong: (props) => <strong className="font-bold text-slate-950" {...props} />,
                            }}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus-within:bg-white focus-within:border-slate-200 focus-within:ring-4 focus-within:ring-slate-900/5 transition-all">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                    placeholder="Search vault..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none resize-none min-h-[24px] max-h-32"
                    rows={1}
                  />
                  <button onClick={handleSendChat} disabled={!chatInput.trim() || isSubmitting} className="h-8 w-8 bg-slate-900 hover:bg-black text-white rounded-xl flex items-center justify-center disabled:opacity-20 transition-all cursor-pointer shadow-lg shadow-slate-200">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteVault && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteVault(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl p-8 max-w-sm w-full relative z-10 shadow-2xl border border-slate-100">
              <div className="h-14 w-14 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Vault?</h3>
              <p className="text-slate-500 text-[14px] leading-relaxed mb-8">This will permanently remove all documents and embeddings in <strong>{vault.name}</strong>. This action is irreversible.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setShowDeleteVault(false)} className="rounded-xl h-12 font-bold cursor-pointer">Cancel</Button>
                <Button onClick={handleDeleteVault} className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 font-bold cursor-pointer">Delete</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VaultDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <VaultDetailContent />
    </Suspense>
  );
}
