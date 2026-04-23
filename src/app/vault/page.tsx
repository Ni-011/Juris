"use client";

import React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Folder,
  FileText,
  HardDrive,
  Clock,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface VaultData {
  id: string;
  name: string;
  description: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

interface VaultWithStats extends VaultData {
  docCount?: number;
  totalSize?: number;
  readyCount?: number;
  processingCount?: number;
  failedCount?: number;
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function timeAgo(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diff = now.getTime() - past.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return past.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function VaultPage() {
  const [vaults, setVaults] = React.useState<VaultWithStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createDesc, setCreateDesc] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const fetchVaults = React.useCallback(async () => {
    try {
      const res = await fetch("/api/vaults");
      const data = await res.json();
      if (data.vaults) {
        // Fetch stats for each vault
        const withStats = await Promise.all(
          data.vaults.map(async (v: VaultData) => {
            try {
              const statsRes = await fetch(`/api/vaults/${v.id}`);
              const statsData = await statsRes.json();
              return {
                ...v,
                docCount: statsData.stats?.totalDocuments || 0,
                totalSize: statsData.stats?.totalSize || 0,
                readyCount: statsData.stats?.byStatus?.ready || 0,
                processingCount: statsData.stats?.byStatus?.processing || 0,
                failedCount: statsData.stats?.byStatus?.failed || 0,
              };
            } catch {
              return { ...v, docCount: 0, totalSize: 0 };
            }
          })
        );
        setVaults(withStats);
      }
    } catch (e) {
      console.error("Failed to fetch vaults:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || null,
        }),
      });
      if (res.ok) {
        setCreateName("");
        setCreateDesc("");
        setShowCreate(false);
        fetchVaults();
      }
    } catch (e) {
      console.error("Failed to create vault:", e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#FAFAFA] overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col relative overflow-hidden max-h-screen">
        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8 text-slate-400 hover:text-slate-900 transition-all hover:scale-110 active:scale-95 cursor-pointer" />
            <h1 className="text-2xl font-serif font-semibold tracking-tight text-slate-900">
              Vault
            </h1>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2 bg-slate-900 hover:bg-black text-white font-semibold rounded-lg h-9 px-5 text-[13px] transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Vault
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-64"
              >
                <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
              </motion.div>
            ) : vaults.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-[60vh] text-center"
              >
                <div className="h-20 w-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-6">
                  <Folder className="h-10 w-10 text-slate-300" />
                </div>
                <h2 className="text-xl font-serif font-medium text-slate-900 mb-2">
                  No vaults yet
                </h2>
                <p className="text-slate-500 text-sm max-w-sm mb-6">
                  Create your first vault to start uploading and analyzing legal
                  documents with AI.
                </p>
                <Button
                  onClick={() => setShowCreate(true)}
                  className="gap-2 bg-slate-900 hover:bg-black text-white font-semibold rounded-lg h-10 px-6 text-[13px] transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Create your first vault
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                {vaults.map((vault, i) => (
                  <motion.div
                    key={vault.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link href={`/vault/${vault.id}`}>
                      <Card className="vault-card rounded-xl bg-white p-0 cursor-pointer overflow-hidden">
                        {/* Color accent bar */}
                        <div className="h-1.5 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />

                        <div className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                                <Folder className="h-5 w-5 text-slate-500" />
                              </div>
                              <div>
                                <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">
                                  {vault.name}
                                </h3>
                                {vault.description && (
                                  <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-1">
                                    {vault.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="flex items-center gap-4 text-[12px] text-slate-500 mt-4 pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-medium">
                                {vault.docCount || 0} files
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                              <span>
                                {formatBytes(vault.totalSize || 0)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>{timeAgo(vault.createdAt)}</span>
                            </div>
                          </div>

                          {/* Status chips */}
                          {(vault.docCount || 0) > 0 && (
                            <div className="flex items-center gap-2 mt-3">
                              {(vault.readyCount || 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                  <CheckCircle className="h-3 w-3" />
                                  {vault.readyCount} ready
                                </span>
                              )}
                              {(vault.processingCount || 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 status-pulse">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {vault.processingCount} processing
                                </span>
                              )}
                              {(vault.failedCount || 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                                  <AlertCircle className="h-3 w-3" />
                                  {vault.failedCount} failed
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Create Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-0 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                  <h2 className="text-lg font-serif font-semibold text-slate-900 tracking-tight">
                    Create Vault
                  </h2>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-6 pb-6 space-y-4">
                  <div>
                    <label className="text-[13px] font-semibold text-slate-700 mb-1.5 block">
                      Name
                    </label>
                    <Input
                      placeholder="e.g. Supply Agreements"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleCreate()
                      }
                      className="h-10 text-[14px] border-slate-200 focus:ring-slate-300"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[13px] font-semibold text-slate-700 mb-1.5 block">
                      Description
                      <span className="text-slate-400 font-normal ml-1">
                        (optional)
                      </span>
                    </label>
                    <Input
                      placeholder="Brief description of this document collection"
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      className="h-10 text-[14px] border-slate-200 focus:ring-slate-300"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreate(false)}
                      className="h-9 px-4 text-[13px] font-medium cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={!createName.trim() || creating}
                      className="h-9 px-5 text-[13px] font-semibold bg-slate-900 hover:bg-black text-white cursor-pointer disabled:opacity-50"
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
