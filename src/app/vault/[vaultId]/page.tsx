"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  X,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Search as SearchIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

export default function VaultDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vaultId = params.vaultId as string;

  // State
  const [vault, setVault] = React.useState<VaultData | null>(null);
  const [stats, setStats] = React.useState<VaultStats | null>(null);
  const [documents, setDocuments] = React.useState<DocumentData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [reprocessing, setReprocessing] = React.useState<string | null>(null);
  const [showDeleteVault, setShowDeleteVault] = React.useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ─── Data fetching ──────────────────────────────────

  const fetchVault = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/vaults/${vaultId}`);
      const data = await res.json();
      if (data.vault) setVault(data.vault);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      console.error("Failed to fetch vault:", e);
    }
  }, [vaultId]);

  const fetchDocuments = React.useCallback(async () => {
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

  React.useEffect(() => {
    fetchVault();
    fetchDocuments();
  }, [fetchVault, fetchDocuments]);

  // Poll every 5s while any doc is processing
  React.useEffect(() => {
    const hasProcessing = documents.some((d) =>
      ["pending", "parsing", "chunking", "embedding", "analyzing"].includes(
        d.status
      )
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments();
      fetchVault();
    }, 5000);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments, fetchVault]);

  // ─── File upload ────────────────────────────────────

  const handleUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));

      const res = await fetch(`/api/vaults/${vaultId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchDocuments();
        fetchVault();
      }
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleUpload(e.dataTransfer.files);
  };

  // ─── Document actions ───────────────────────────────

  const handleDeleteDoc = async (docId: string) => {
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
          messages: [
            ...chatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userMsg.content }
          ]
        }),
      });

      if (!response.ok) throw new Error("Failed to search vault");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let assistantResponse = "";
      let citationsMetadata: any = null;

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
              if (parsed.m) {
                citationsMetadata = parsed.m;
              }
            } catch (e) {
              // Ignore incomplete lines
            }
          }
        }
      }

      if (citationsMetadata?.citations?.length > 0) {
        setChatMessages(prev => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          last.content += "\n\n**Sources:**\n" + citationsMetadata.citations.map(
            (c: any) => `- [[${c.id}]] ${c.fileName} (Page ${c.pageNumber}${c.sectionHeading ? ', ' + c.sectionHeading : ''})`
          ).join("\n");
          return newMsgs;
        });
      }

    } catch (error: any) {
      setChatMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];
        last.content = "⚠️ An error occurred while searching your vault.";
        return newMsgs;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Render ─────────────────────────────────────────

  if (loading || !vault) {
    return (
      <div className="flex h-screen w-full bg-[#FAFAFA] overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] overflow-hidden">
      <AppSidebar />

      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
        accept=".pdf,.docx,.txt,.html,.csv,.png,.jpg,.jpeg,.tiff,.bmp"
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
            {vault.description && (
              <span className="text-[13px] text-slate-400 hidden lg:inline">
                — {vault.description}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2 bg-slate-900 hover:bg-black text-white font-semibold rounded-lg h-8 px-4 text-[12px] transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Upload
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteVault(true)}
              className="h-8 px-3 text-[12px] font-medium text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* 60/40 split */}
        <div className="flex-1 flex overflow-hidden">
          {/* ═══ LEFT PANEL: Documents (60%) ═══ */}
          <div className="flex-[3] flex flex-col overflow-hidden min-w-0">
            {/* Upload zone */}
            <div
              className={`mx-4 mt-4 upload-zone ${
                isDragging ? "drag-active" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center py-6 px-4">
                <Upload className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">
                  Drag & drop documents here
                </p>
                <p className="text-[12px] text-slate-400 mt-1">
                  PDF, DOCX, TXT, HTML, CSV, Images
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 h-8 text-[12px] font-medium cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Browse files
                </Button>
              </div>
            </div>

            {/* Stats bar */}
            {stats && stats.totalDocuments > 0 && (
              <div className="mx-4 mt-3 flex items-center gap-4 text-[12px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700">
                    {stats.totalDocuments}
                  </span>{" "}
                  documents
                </span>
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                  {formatBytes(stats.totalSize)}
                </span>
              </div>
            )}

            {/* Document list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar mt-3 px-4 pb-4">
              <AnimatePresence>
                {documents.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-48 text-center"
                  >
                    <FileText className="h-10 w-10 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400">
                      No documents uploaded yet
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-1">
                    {documents.map((doc, i) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="doc-row flex items-center gap-3 px-3 py-2.5 rounded-lg group"
                      >
                        <FileIcon docType={doc.docType} size="sm" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-slate-800 truncate">
                              {doc.fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>{doc.docType.toUpperCase()}</span>
                            {doc.fileSize && (
                              <span>{formatBytes(doc.fileSize)}</span>
                            )}
                            {doc.pageCount && (
                              <span>{doc.pageCount} pages</span>
                            )}
                            <span>{formatDate(doc.uploadTime)}</span>
                          </div>
                        </div>

                        <StatusBadge status={doc.status} />

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.status === "failed" && (
                            <button
                              onClick={() => handleReprocess(doc.id)}
                              disabled={reprocessing === doc.id}
                              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                              title="Re-process"
                            >
                              {reprocessing === doc.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            disabled={deleting === doc.id}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                            title="Delete"
                          >
                            {deleting === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ═══ RIGHT PANEL: Chat (40%) ═══ */}
          <div className="flex-[2] vault-chat-panel flex flex-col overflow-hidden">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-900">
                    Vault Assistant
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Ask questions about your documents
                  </p>
                </div>
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-4">
                    <MessageSquare className="h-7 w-7 text-slate-300" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">
                    Chat with your vault
                  </h4>
                  <p className="text-[12px] text-slate-400 max-w-[240px] leading-relaxed">
                    Ask questions about the documents in this vault. Juris will
                    search across all your files to find answers.
                  </p>

                  <div className="mt-6 space-y-2 w-full max-w-[260px]">
                    {[
                      "Summarize the key clauses",
                      "Compare agreement terms",
                      "Find risk provisions",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setChatInput(suggestion);
                        }}
                        className="w-full text-left text-[12px] text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 transition-all cursor-pointer hover:border-slate-200"
                      >
                        <SearchIcon className="h-3 w-3 inline mr-2 text-slate-400" />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-slate-100 text-slate-900 rounded-br-sm"
                          : "bg-white border border-slate-100 text-slate-700 rounded-bl-sm shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="h-4 w-4 bg-slate-900 rounded flex items-center justify-center">
                            <span className="text-white text-[8px] font-bold font-serif">
                              J
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-900">
                            Juris
                          </span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="p-3 border-t border-slate-100 shrink-0">
              <div className="vault-chat-input flex items-center gap-2 px-3 py-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="Ask about your documents..."
                  className="flex-1 resize-none border-none focus:ring-0 bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 outline-none min-h-[24px] max-h-24"
                  rows={1}
                />
                <Button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  size="sm"
                  className="h-7 w-7 p-0 bg-slate-900 hover:bg-black text-white rounded-lg disabled:opacity-30 cursor-pointer shrink-0"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Vault Confirmation */}
      <AnimatePresence>
        {showDeleteVault && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowDeleteVault(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">
                    Delete Vault
                  </h3>
                  <p className="text-[12px] text-slate-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-[13px] text-slate-600 mb-6">
                All documents, embeddings, and analysis data in{" "}
                <strong>{vault.name}</strong> will be permanently deleted.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteVault(false)}
                  className="h-9 px-4 text-[13px] cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteVault}
                  className="h-9 px-4 text-[13px] bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  Delete Vault
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
