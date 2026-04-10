"use client"

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Copy, Check, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface LegalContextData {
    sourceType: 'precedent' | 'statute'
    retrievedContext: {
        title: string
        text: string
        citation?: string
        court?: string
        year?: number | string
        pdfUrl?: string
    }
}

interface LegalContextDialogProps {
    isOpen: boolean
    onClose: () => void
    data: LegalContextData | null
    isMobile?: boolean
}

const copyToClipboard = async (text: string) => {
    if (typeof window === 'undefined') return false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn("Modern Clipboard API failed:", err);
        }
    }
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        return false;
    }
};

export function LegalContextDialog({ isOpen, onClose, data, isMobile = false }: LegalContextDialogProps) {
    const [isCopied, setIsCopied] = React.useState(false)

    if (!isOpen || !data) return null

    const chunk = data;
    const isPrecedent = chunk.sourceType === 'precedent';
    const ctx = chunk.retrievedContext || {};
    const displayTitle = isPrecedent
        ? (ctx.title || 'Case Precedent')
        : (ctx.title?.replace('.pdf', '') || 'Statute');

    const fullText = chunk.retrievedContext?.text?.trim() || "";
    let smartSnippet = fullText;
    if (smartSnippet.toLowerCase().startsWith(displayTitle.toLowerCase())) {
        smartSnippet = smartSnippet.substring(displayTitle.length).trim();
        smartSnippet = smartSnippet.replace(/^[:\-\s—]+/, '');
    }
    const courtYearLine = isPrecedent ? `${ctx.court || 'Court'} ${ctx.year ? `(${ctx.year})` : ''}` : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 pointer-events-none">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm pointer-events-auto"
            />

            <motion.div
                initial={isMobile ? { y: '100%' } : { opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={isMobile ? { y: '100%' } : { opacity: 0, y: 20, scale: 0.98 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full sm:max-w-[540px] bg-white border-t sm:border border-slate-100 shadow-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh] sm:max-h-[650px]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-white px-8 pt-8 pb-5 flex flex-col gap-4 sticky top-0 z-10 border-b border-slate-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                                {isPrecedent ? 'Case Precedent' : 'Statute Reference'}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            <Plus className="h-4 w-4 rotate-45" />
                        </Button>
                    </div>

                    <h3 className="text-[18px] sm:text-[20px] font-serif font-bold text-slate-900 leading-[1.3] tracking-tight break-words">
                        {displayTitle}
                    </h3>

                    {(courtYearLine || ctx.citation) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                            {courtYearLine && <span>{courtYearLine}</span>}
                            {courtYearLine && ctx.citation && <div className="h-0.5 w-0.5 rounded-full bg-slate-300" />}
                            {ctx.citation && <span className="italic normal-case font-serif">{ctx.citation}</span>}
                        </div>
                    )}
                </div>

                <div className="px-8 pb-6 overflow-y-auto custom-scrollbar bg-white w-full max-w-full overflow-x-hidden pt-6">
                    <div className="markdown-prose text-slate-700 text-[14px] leading-[1.8] font-serif tracking-normal w-full max-w-full break-words overflow-x-hidden border-l-2 border-slate-50 pl-6">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p: ({ children }) => <p className="mb-4 last:mb-0 break-words max-w-full whitespace-pre-wrap">{children}</p>,
                                blockquote: ({ children }) => <blockquote className="border-l-4 border-slate-200 pl-4 py-1 my-4 italic text-slate-500 break-words max-w-full">{children}</blockquote>,
                                code: ({ children }) => <code className="bg-slate-100 px-1 rounded text-[13px] break-all whitespace-pre-wrap">{children}</code>,
                                pre: ({ children }) => <pre className="bg-slate-50 p-3 rounded-lg my-3 overflow-x-auto whitespace-pre-wrap break-words max-w-full border border-slate-200/40 text-[13px]">{children}</pre>,
                                ul: ({ children }) => <ul className="list-disc ml-4 mb-4 space-y-2 break-words max-w-full">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal ml-4 mb-4 space-y-2 break-words max-w-full">{children}</ol>,
                                li: ({ children }) => <li className="break-words max-w-full">{children}</li>
                            }}
                        >
                            {smartSnippet
                                .replace(/\\n/g, '\n')
                                .replace(/\\"/g, '"')
                                .replace(/(Case|Court|Citation|Summary|Statute|Section|Analysis):/gi, '**$1:**')
                            }
                        </ReactMarkdown>
                    </div>
                </div>

                <div className="bg-slate-50/50 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto border-t border-slate-100 mb-safe">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const text = ctx.text || "";
                            copyToClipboard(`${displayTitle}\n\n${text}`);
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="h-9 px-4 gap-2 text-[11px] font-bold text-slate-500 hover:text-slate-900 hover:bg-white transition-all rounded-xl w-full sm:w-auto"
                    >
                        {isCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {isCopied ? "Copied" : "Copy text"}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (ctx.pdfUrl) {
                                window.open(ctx.pdfUrl, '_blank');
                                return;
                            }
                            const title = ctx.title || "";
                            const text = ctx.text || "";
                            let searchUrl = "";
                            if (!isPrecedent) {
                                const sectionMatch = text.match(/Section\s*(\d+)/i) || title.match(/Section\s*(\d+)/i);
                                const actMatch = text.match(/(BNS|BNSS|BSA|Constitution|IPC|CrPC)/i) || title.match(/(BNS|BNSS|BSA|Constitution|IPC|CrPC)/i);
                                const query = `${sectionMatch ? sectionMatch[0] : ""} ${actMatch ? actMatch[0] : "BNS"}`.trim();
                                searchUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(query || title || text.substring(0, 30))}`;
                            } else {
                                searchUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(title)}`;
                            }
                            window.open(searchUrl, '_blank');
                        }}
                        className="h-9 px-5 gap-2 text-[11px] font-bold text-white bg-slate-900 hover:bg-black shadow-sm transition-all rounded-xl w-full sm:w-auto"
                    >
                        {ctx.pdfUrl ? 'View Judgment' : 'Full Document'}
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </motion.div>
        </div>
    )
}
