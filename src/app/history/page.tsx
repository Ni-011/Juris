"use client";

import React, { useState, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { 
  History, 
  Search, 
  MessageSquare, 
  Folder, 
  Trash2, 
  ChevronRight, 
  Clock,
  Calendar,
  Filter,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";

interface Session {
  id: string;
  title: string;
  updatedAt: string;
  vaultId: string | null;
  isPublic: boolean;
  vaultName?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "global" | "vaults">("all");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Fetch all sessions (the API returns all by default if no vaultId is provided)
        const res = await fetch("/api/chat/sessions");
        const data = await res.json();
        
        if (data.sessions) {
          // If some sessions have vaultId, we might want to fetch vault names for them
          // For now, let's just use the raw data
          setSessions(data.sessions);
        }
      } catch (e) {
        console.error("Failed to fetch history:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === "all" ? true :
      filter === "global" ? !s.vaultId :
      !!s.vaultId;
    return matchesSearch && matchesFilter;
  });

  const openSession = (session: Session) => {
    if (session.vaultId) {
      router.push(`/vault/${session.vaultId}?session=${session.id}`);
    } else {
      router.push(`/?session=${session.id}`);
    }
  };

  // Grouping by date
  const groupedSessions: { [key: string]: Session[] } = {};
  filteredSessions.forEach(s => {
    const date = new Date(s.updatedAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let group = "";
    if (date.toDateString() === today.toDateString()) group = "Today";
    else if (date.toDateString() === yesterday.toDateString()) group = "Yesterday";
    else group = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    if (!groupedSessions[group]) groupedSessions[group] = [];
    groupedSessions[group].push(s);
  });

  if (loading) return <LoadingScreen />;

  return (
    <div className="flex h-dvh w-full bg-slate-50/50 font-sans text-slate-900 overflow-hidden relative">
      <AppSidebar />
      
      <main className="flex-1 w-full relative overflow-hidden flex flex-col h-dvh">
        {/* Header */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="h-9 w-9 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0" />
            <div className="h-4 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-400" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Activity History</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              <input 
                type="text" 
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-64 bg-slate-100 border-none rounded-xl pl-10 pr-4 text-[13px] font-medium placeholder:text-slate-500 focus:ring-2 focus:ring-slate-900/5 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-12">
            
            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFilter("all")}
                className={`rounded-full px-5 h-9 text-[13px] font-bold transition-all ${filter === "all" ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "text-slate-500 hover:bg-white hover:shadow-sm"}`}
              >
                All Activity
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFilter("global")}
                className={`rounded-full px-5 h-9 text-[13px] font-bold transition-all ${filter === "global" ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "text-slate-500 hover:bg-white hover:shadow-sm"}`}
              >
                Global Research
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFilter("vaults")}
                className={`rounded-full px-5 h-9 text-[13px] font-bold transition-all ${filter === "vaults" ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "text-slate-500 hover:bg-white hover:shadow-sm"}`}
              >
                Vault Queries
              </Button>
            </div>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="h-20 w-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 border border-slate-100">
                  <History className="h-10 w-10 text-slate-200" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No history yet</h3>
                <p className="text-slate-500 max-w-sm text-sm font-medium">Your research sessions and vault queries will appear here once you start interacting with Juris.</p>
                <Button 
                  onClick={() => router.push("/")}
                  className="mt-8 bg-slate-900 hover:bg-black text-white rounded-xl px-8 h-12 font-bold shadow-xl shadow-slate-200 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  Start Researching
                </Button>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="h-12 w-12 text-slate-200 mb-4" />
                <p className="text-slate-500 text-sm font-medium">No conversations match your search or filter.</p>
              </div>
            ) : (
              Object.entries(groupedSessions).map(([group, groupSessions]) => (
                <div key={group} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{group}</h2>
                    <div className="h-[1px] flex-1 bg-slate-100" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupSessions.map((session) => (
                      <motion.div
                        key={session.id}
                        layoutId={session.id}
                        whileHover={{ y: -4 }}
                        onClick={() => openSession(session)}
                        className="group relative bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-slate-200 transition-all cursor-pointer flex flex-col gap-4 overflow-hidden"
                      >
                        {/* Status/Type Tag */}
                        <div className="flex items-center justify-between">
                          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${session.vaultId ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'}`}>
                            {session.vaultId ? <Folder className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                            {session.vaultId ? 'Vault Query' : 'Research'}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               onClick={(e) => deleteSession(session.id, e)}
                               className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                             >
                               <Trash2 className="h-3.5 w-3.5" />
                             </button>
                          </div>
                        </div>

                        {/* Title */}
                        <div className="flex-1">
                          <h3 className="text-[15px] font-bold text-slate-900 leading-tight group-hover:text-black transition-colors line-clamp-2">
                            {session.title || "Untitled Conversation"}
                          </h3>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="h-3 w-3" />
                            <span className="text-[11px] font-medium uppercase tracking-tight">
                              {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="h-7 w-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm group-hover:shadow-md">
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>

                        {/* Public Link Badge */}
                        {session.isPublic && (
                          <div className="absolute top-0 right-10 px-2 py-1 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-b-lg flex items-center gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            Public
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))
            )}

            <div className="h-10" />
          </div>
        </div>
      </main>
    </div>
  );
}
