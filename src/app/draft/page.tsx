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
    Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const docTypes = [
    { id: 'legal-notice', title: "Legal Notice", icon: Mail },
    { id: 'bail-app', title: "Bail Application", icon: Shield },
    { id: 'plaint', title: "Plaint (Civil Suit)", icon: FileText },
    { id: 'writ', title: "Writ Petition", icon: Scale },
    { id: 'affidavit', title: "Affidavit", icon: FileCheck, active: true },
    { id: 'written-stmt', title: "Written Statement", icon: File },
    { id: 'interim-app', title: "Interim Application", icon: Clock },
    { id: 'appeal-memo', title: "Appeal Memo", icon: ArrowUpCircle },
    { id: 'criminal-complaint', title: "Criminal Complaint", icon: AlertTriangle },
    { id: 'reply-notice', title: "Reply to Legal Notice", icon: Reply },
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

    const handleGenerate = async () => {
        if (!draftInstructions.trim() && !selectedDocId) return;
        
        setIsGenerating(true);
        setGenerationStatus("Starting pipeline...");
        setGenerationReasoning("");
        
        try {
            const finalInstruction = draftInstructions.trim() || `Draft a standard ${docTypes.find(d => d.id === selectedDocId)?.title || selectedDocId} using common boilerplate.`;
            
            const res = await fetch('/api/draft/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docType: docTypes.find(d => d.id === selectedDocId)?.title || selectedDocId,
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
            alert("Draft generation failed.");
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex h-dvh w-full bg-white font-sans text-slate-900 overflow-hidden relative">
            {isGenerating && (
                 <div className="absolute inset-0 z-[100] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center shadow-2xl transition-all animate-in fade-in">
                     <div className="max-w-md w-full bg-white ring-1 ring-slate-100 shadow-[0_0_80px_-20px_rgba(0,0,0,0.1)] rounded-[2rem] p-8 md:p-10 flex flex-col items-center">
                         <div className="h-16 w-16 bg-slate-900 shadow-xl rounded-2xl flex items-center justify-center mb-6">
                             <Loader2 className="h-8 w-8 text-white animate-spin" />
                         </div>
                         <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Juris is drafting</h3>
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
                            {docTypes.map((doc) => (
                                <Card 
                                    key={doc.id}
                                    onClick={() => setSelectedDocId(doc.id)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-4 cursor-pointer transition-all duration-200 h-28 md:h-32 border-slate-100 bg-white hover:bg-slate-50/50 relative text-center",
                                        selectedDocId === doc.id ? "bg-slate-50 border-slate-900 ring-1 ring-slate-900" : ""
                                    )}
                                >
                                    <div className={cn(
                                        "mb-3 transition-colors",
                                        selectedDocId === doc.id ? "text-slate-900" : "text-slate-400"
                                    )}>
                                        <doc.icon className="h-6 w-6" />
                                    </div>
                                    <span className={cn(
                                        "text-[12px] md:text-[13px] font-semibold tracking-tight",
                                        selectedDocId === doc.id ? "text-slate-900" : "text-slate-500"
                                    )}>
                                        {doc.title}
                                    </span>
                                </Card>
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
