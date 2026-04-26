"use client"

import * as React from "react"
import {
    Mail,
    Shield,
    FileText,
    Scale,
    FileCheck,
    File,
    Clock,
    ArrowUpCircle,
    AlertTriangle,
    Reply,
    Plus,
    Mic,
    Paperclip,
    Globe,
    ChevronDown,
    LayoutGrid,
    Sparkles,
    FileSignature,
    Loader2,
    SendHorizontal,
    ShieldCheck,
    ScrollText,
    Fingerprint,
    PenTool,
    Timer,
    ArrowUpRight,
    ShieldAlert,
    MessageSquareReply,
    Handshake,
    Lock,
    Home,
    Briefcase,
    Users,
    StickyNote
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { LoadingScreen } from "@/components/ui/loading-screen"

const LITIGATION_TYPES = [
    { id: 'legal-notice', title: "Legal Notice", icon: SendHorizontal },
    { id: 'bail-app', title: "Bail Application", icon: ShieldCheck },
    { id: 'plaint', title: "Plaint (Civil Suit)", icon: ScrollText },
    { id: 'writ', title: "Writ Petition", icon: Scale },
    { id: 'affidavit', title: "Affidavit", icon: Fingerprint },
    { id: 'written-stmt', title: "Written Statement", icon: PenTool },
    { id: 'interim-app', title: "Interim Application", icon: Timer },
    { id: 'appeal-memo', title: "Appeal Memo", icon: ArrowUpRight },
    { id: 'criminal-complaint', title: "Criminal Complaint", icon: ShieldAlert },
    { id: 'reply-notice', title: "Reply to Legal Notice", icon: MessageSquareReply },
]

const CONTRACT_TYPES = [
    { id: 'service-agreement', title: "Service Agreement", icon: Handshake },
    { id: 'nda', title: "Non-Disclosure", icon: Lock },
    { id: 'lease-deed', title: "Lease Deed", icon: Home },
    { id: 'employment-contract', title: "Employment", icon: Briefcase },
    { id: 'partnership-deed', title: "Partnership", icon: Users },
    { id: 'power-of-attorney', title: "Power of Attorney", icon: FileSignature },
    { id: 'mou', title: "Memorandum (MoU)", icon: StickyNote },
]

const templates = [
    {
        title: "Affidavit in Support of Application",
        description: "Affidavit in support of [Bail Application / Interim Application / Stay Application / Review Petition] in [Case Title and Number] before [Court Name], [City]...."
    },
    {
        title: "Affidavit for Name/Address/DOB Change",
        description: "Affidavit for [name change / address correction / date of birth correction] on [Aadhaar / PAN / Passport / School Records / Property Documents]...."
    },
    {
        title: "Affidavit of Income / Assets",
        description: "Affidavit of income and assets in [Family Court Case No. / Maintenance Petition / Bail Application] before [Court Name]. Deponent: [Name], aged..."
    }
]

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

export default function DraftPage() {
    const router = useRouter();
    const [selectedDocId, setSelectedDocId] = React.useState('affidavit');
    const [activeCategory, setActiveCategory] = React.useState('litigation');
    const [draftInstructions, setDraftInstructions] = React.useState('');
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [generationStatus, setGenerationStatus] = React.useState('Initializing...');
    const [generationReasoning, setGenerationReasoning] = React.useState('');
    const reasoningRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (reasoningRef.current) {
            reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
        }
    }, [generationReasoning]);

    React.useEffect(() => {
        const firstDoc = activeCategory === 'litigation' ? LITIGATION_TYPES[0] : CONTRACT_TYPES[0];
        if (firstDoc) setSelectedDocId(firstDoc.id);
    }, [activeCategory]);

    const currentDocTypes = activeCategory === 'litigation' ? LITIGATION_TYPES : CONTRACT_TYPES;

    const handleGenerate = async () => {
        if (!draftInstructions.trim() && !selectedDocId) return;

        setIsGenerating(true);
        setGenerationStatus("Starting pipeline...");
        setGenerationReasoning("");

        try {
            const selectedDoc = currentDocTypes.find(d => d.id === selectedDocId);
            const finalInstruction = draftInstructions.trim() || `Draft a standard ${selectedDoc?.title || selectedDocId} using common boilerplate.`;

            const res = await fetch('/api/draft/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docType: selectedDoc?.title || selectedDocId,
                    instructions: finalInstruction
                })
            });

            if (!res.body) throw new Error("No response body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let fullDraftHtml = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                let boundary = buffer.indexOf('\n');

                while (boundary !== -1) {
                    const line = buffer.slice(0, boundary).trim();
                    buffer = buffer.slice(boundary + 1);
                    boundary = buffer.indexOf('\n');

                    if (!line) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.s) setGenerationStatus(data.s);
                        if (data.r) setGenerationReasoning(prev => prev + data.r);
                        if (data.t) fullDraftHtml += data.t;
                        if (data.m && data.m.research) {
                            localStorage.setItem('juris_draft_research', JSON.stringify(data.m.research));
                        }
                        if (data.error) throw new Error(data.error);
                    } catch (e) {
                        // silently ignore
                    }
                }
            }

            const finalHtml = fullDraftHtml.replace('---END---', '');
            localStorage.setItem('juris_generated_draft', finalHtml);
            router.push('/draft/editor');

        } catch (e: any) {
            console.error("Failed to generate draft:", e);
            const isTimeout = e.message?.includes('timeout') || e.message?.includes('Failed to fetch') || e.message?.includes('network');
            alert(isTimeout 
                ? "Draft generation timed out due to server load. Please try again in a moment."
                : "Draft generation failed. Please try again.");
            setIsGenerating(false);
            setGenerationStatus("Failed");
        }
    };

    return (
        <div className="flex h-dvh w-full bg-white font-sans text-slate-900 overflow-hidden relative">
            {isGenerating && (
                <div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center transition-all animate-in fade-in">
                    <LoadingScreen />
                    <div className="mt-48 max-w-md w-full bg-white ring-1 ring-slate-100 shadow-[0_0_80px_-20px_rgba(0,0,0,0.1)] rounded-[2rem] p-8 md:p-10 flex flex-col items-center z-10 relative">
                        <div className="bg-slate-50 px-4 py-2 rounded-full mb-6">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{generationStatus}</span>
                        </div>
                        <div ref={reasoningRef} className="w-full bg-transparent h-40 overflow-y-auto text-left text-[11px] leading-relaxed text-slate-400 font-mono scroll-smooth overflow-x-hidden pt-2 border-t border-slate-100">
                            {generationReasoning || "Initializing reasoning engine..."}
                        </div>
                    </div>
                </div>
            )}
            <AppSidebar />

            <main className="flex-1 w-full relative overflow-hidden flex flex-col h-dvh">
                {/* Top Header */}
                <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-white/80 backdrop-blur-md z-30">
                    <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                        <SidebarTrigger className="h-9 w-9 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0" />
                        <div className="h-4 w-[1px] bg-slate-200 shrink-0 hidden sm:block" />
                        <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-[13px] font-bold text-slate-400 tracking-wider uppercase shrink-0">Drafts</span>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                            <span className="text-[13px] font-bold text-slate-900 truncate">New Draft</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-[11px] font-bold text-white font-serif shadow-sm">J</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white">
                    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12">
                        {/* Header Content */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 md:mb-14 gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="h-6 w-6 bg-slate-900 rounded-md flex items-center justify-center text-white font-serif font-bold text-[10px] uppercase tracking-tighter shrink-0">
                                        J
                                    </div>
                                    <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Drafting Assistant</span>
                                </div>
                                <h1 className="text-4xl md:text-6xl font-serif font-medium text-slate-900 tracking-tight leading-[1.1]">New Draft</h1>
                                <p className="text-slate-500 mt-4 text-sm md:text-[17px] leading-relaxed max-w-lg">
                                    Select a category and document type below to generate a professional legal draft in seconds.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" className="flex gap-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl h-11 px-5 transition-all border border-slate-100 md:border-none">
                                    <LayoutGrid className="h-4 w-4" />
                                    <span className="text-[13px] font-bold uppercase tracking-wider">My Drafts</span>
                                </Button>
                            </div>
                        </div>

                        {/* Top Controls — Simplified & Focused */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between mb-8 pb-4 border-b border-slate-100 gap-8">
                            <div className="flex flex-col gap-4 flex-1">
                                <div className="flex items-center gap-2 ml-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Select Category</span>
                                    <div className="h-px bg-slate-50 flex-1" />
                                </div>
                                <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-200/50 w-full md:w-fit">
                                    <button
                                        onClick={() => setActiveCategory('contracts')}
                                        className={cn(
                                            "flex-1 md:px-8 py-2.5 rounded-lg text-[12px] md:text-[13px] font-semibold transition-all uppercase tracking-wider",
                                            activeCategory === 'contracts' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-500"
                                        )}
                                    >
                                        Contracts
                                    </button>
                                    <button
                                        onClick={() => setActiveCategory('litigation')}
                                        className={cn(
                                            "flex-1 md:px-8 py-2.5 rounded-lg text-[12px] md:text-[13px] font-semibold transition-all uppercase tracking-wider",
                                            activeCategory === 'litigation' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-500"
                                        )}
                                    >
                                        Litigation
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Doc Type Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 mb-12 md:mb-16">
                            {currentDocTypes.map((doc) => (
                                <motion.div
                                    key={doc.id}
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="h-full"
                                >
                                    <button
                                        onClick={() => setSelectedDocId(doc.id)}
                                        className={cn(
                                            "w-full flex flex-col items-center justify-center p-4 cursor-pointer transition-all duration-300 h-32 md:h-36 border text-center rounded-2xl relative group overflow-hidden",
                                            selectedDocId === doc.id 
                                                ? "bg-white border-slate-900 ring-2 ring-slate-900/5 text-slate-900 shadow-xl z-10 scale-[1.05]" 
                                                : "bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:bg-white text-slate-600"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-10 w-10 md:h-11 md:w-11 rounded-xl flex items-center justify-center mb-3 transition-all duration-300",
                                            selectedDocId === doc.id ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "bg-white text-slate-400 border border-slate-50 shadow-sm"
                                        )}>
                                            <doc.icon className="h-5 w-5 md:h-5.5 md:w-5.5 stroke-[1.5px]" />
                                        </div>
                                        <span className={cn(
                                            "text-[12px] md:text-[13px] font-bold tracking-tight px-1 transition-colors duration-300",
                                            selectedDocId === doc.id ? "text-slate-900" : "text-slate-500 group-hover:text-slate-900"
                                        )}>
                                            {doc.title}
                                        </span>
                                        {selectedDocId === doc.id && (
                                            <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-slate-900 shadow-[0_0_10px_rgba(0,0,0,0.1)]" />
                                        )}
                                    </button>
                                </motion.div>
                            ))}
                        </div>

                        {/* Custom Draft Form (Matches Chat Input Style) */}
                        <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
                            <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">
                                <FileSignature className="h-4 w-4 text-slate-300" />
                                <span>Draft Specification</span>
                            </div>

                            <Card className="p-0 border-slate-100 overflow-hidden shadow-sm rounded-2xl border bg-white focus-within:border-slate-300 transition-all duration-300">
                                <textarea
                                    className="w-full h-40 md:h-48 p-6 md:p-8 text-slate-800 bg-transparent focus:outline-none resize-none placeholder:text-slate-300 font-sans text-base md:text-lg leading-relaxed"
                                    placeholder={selectedDocId ? `Describe your ${selectedDocId}...` : "Describe your legal requirement..."}
                                    value={draftInstructions}
                                    onChange={(e) => setDraftInstructions(e.target.value)}
                                />
                                <div className="px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-50 bg-slate-50/[0.2] gap-4">
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all">
                                            <Mic className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all">
                                            <Paperclip className="h-4 w-4" />
                                        </Button>
                                        <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                                        <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-slate-900 h-9 px-3 rounded-lg hover:bg-slate-100 transition-all">
                                            <Globe className="h-3.5 w-3.5" />
                                            <span className="text-[11px] font-bold uppercase tracking-wider">English</span>
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </div>

                                    <Button
                                        onClick={handleGenerate}
                                        className="bg-slate-900 hover:bg-black text-white font-semibold rounded-xl h-10 px-8 text-[13px] shadow-sm transition-all active:scale-95 w-full sm:w-auto"
                                    >
                                        Generate Draft
                                    </Button>
                                </div>
                            </Card>
                        </div>

                        {/* Templates Section */}
                        <div className="mt-24 md:mt-32 max-w-5xl mx-auto">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4 border-b border-slate-100 pb-6">
                                <div className="space-y-1">
                                    <h3 className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                                        Curated Templates
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">Select a structure to pre-fill the generator</p>
                                </div>
                                <span className="bg-slate-50 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100">8+ Templates available</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {templates.map((template, i) => (
                                    <motion.div
                                        key={i}
                                        whileHover={{ y: -8 }}
                                        className="cursor-pointer h-full"
                                        onClick={handleGenerate}
                                    >
                                        <Card className="p-7 md:p-8 border-slate-200/60 bg-white hover:border-slate-900 hover:shadow-professional transition-all h-full flex flex-col group rounded-3xl relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-slate-900 opacity-0 group-hover:opacity-100 transition-all" />
                                            <h4 className="text-[16px] md:text-[17px] font-bold text-slate-900 mb-4 group-hover:text-slate-900 transition-colors tracking-tight leading-snug">{template.title}</h4>
                                            <p className="text-[13px] text-slate-500 leading-relaxed font-sans line-clamp-4 mb-6">
                                                {template.description}
                                            </p>
                                            <div className="mt-auto pt-4 flex items-center text-[11px] font-bold text-slate-400 group-hover:text-slate-900 transition-colors uppercase tracking-[0.15em]">
                                                Use Structure →
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
