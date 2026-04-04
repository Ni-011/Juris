"use client";

import React from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import {
  Plus,
  Zap,
  LayoutGrid,
  Search,
  MessageSquare,
  Clock,
  Briefcase,
  PanelLeft,
  FileText,
  ArrowUp,
  ChevronDown,
  Sparkles,
  ExternalLink,
  BookOpen,
  Scale
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

// Premium Sequential Loader representing the legal research process
const SequentialLoader = () => {
  const [step, setStep] = React.useState(0);
  const steps = [
    { text: "Analyzing case context...", icon: <Search className="h-4 w-4" /> },
    { text: "Identifying legal issues...", icon: <Scale className="h-4 w-4" /> },
    { text: "Hunting for precedents...", icon: <Zap className="h-4 w-4" /> },
    { text: "Generating argument strategy...", icon: <Sparkles className="h-4 w-4" /> },
    { text: "Finalizing legal partner briefing...", icon: <Briefcase className="h-4 w-4" /> }
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="flex flex-col gap-4 py-4 w-full max-w-sm">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                transition={{ duration: 0.4, ease: "backOut" }}
              >
                {steps[step].icon}
              </motion.div>
            </AnimatePresence>
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-xl border-2 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent opacity-40"
          />
        </div>
        <div className="flex flex-col">
          <AnimatePresence mode="wait">
            <motion.span
              key={step}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-sm font-semibold text-slate-700 tracking-tight"
            >
              {steps[step].text}
            </motion.span>
          </AnimatePresence>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">
            Advanced Research Engine
          </span>
        </div>
      </div>

      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-indigo-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.8, ease: "circOut" }}
        />
      </div>
    </div>
  );
};

// Helper to process citations in the format [[n]] into links for ReactMarkdown
const processCitations = (content: string) => {
  return content.replace(/\[\[\s*(\d+)\s*\]\]/g, (match, n) => {
    return ` [${n}](#cite-${n})`;
  });
};

export default function Home() {
  const [files, setFiles] = React.useState<{ name: string, type: string }[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const [messages, setMessages] = React.useState<{ id: string, role: 'user' | 'assistant', content: string, metadata?: any }[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [isResearchEnabled, setIsResearchEnabled] = React.useState(true);
  const [activeCitation, setActiveCitation] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const scrollContainer = messagesEndRef.current.parentElement?.parentElement;
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  React.useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!input.trim() && files.length === 0) return;

    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const requestMessages = [...messages, userMessage].map((m) => {
        let finalContent = m.content;
        // If this specific message was the research response, we append the context to it unseen by the user!
        if ('metadata' in m && (m as any).metadata?.groundingChunks) {
          const unifiedContext = (m as any).metadata.groundingChunks.map((c: any, i: number) => {
            const ctx = c.retrievedContext;
            return `[[${i + 1}]] PRECEDENT: ${ctx.title} (${ctx.citation || 'Judgment'})\nExcerpt: ${ctx.text}`;
          }).join('\n\n---\n\n');
          // We structure it clearly so the LLM understands this was the context it used.
          finalContent = `[SYSTEM CONTEXT - RESEARCH FOUND]:\n${unifiedContext}\n\n[MY STRATEGY]:\n${finalContent}`;
        }
        return { role: m.role, content: finalContent };
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages,
          isResearch: isResearchEnabled
        }),
      });

      if (!response.ok) throw new Error(response.statusText);
      setIsResearchEnabled(false);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);

              if (data.t) {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantId ? { ...msg, content: msg.content + data.t } : msg
                ));
              } else if (data.m) {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantId ? { ...msg, metadata: data.m } : msg
                ));
              }
            } catch (e) {
              console.error("Failed to parse stream JSON:", e, "Line:", line);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
      setFiles([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({ name: f.name, type: f.type }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).map(f => ({ name: f.name, type: f.type }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const renderChatInput = (mode: 'landing' | 'chat') => (
    <Card
      className={`w-full max-w-[950px] p-0 shadow-professional border-slate-200 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-slate-200 transition-all duration-300 border border-slate-200 ${mode === 'landing' ? 'rounded-2xl' : 'rounded-xl'}`}
    >
      <div className={`transition-all duration-300 ${mode === 'landing' ? 'p-6 min-h-[160px]' : 'p-3 min-h-[60px]'}`}>
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-wrap gap-3 mb-4"
            >
              {files.map((file, i) => (
                <div key={i} className="relative group w-24 h-28 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col p-2 transition-all hover:scale-105 active:scale-95 overflow-hidden">
                  <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl mb-2 group-hover:bg-slate-100 transition-colors border border-slate-100/50">
                    <FileText className="h-8 w-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                  <div className="text-slate-600 text-[10px] font-bold truncate text-center px-1">
                    {file.name}
                  </div>
                  <button
                    onClick={() => setFiles(f => f.filter((_, idx) => idx !== i))}
                    className="absolute top-1.5 right-1.5 h-5 w-5 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 hover:border-red-200 z-10"
                  >
                    <Plus className="h-3.5 w-3.5 rotate-45" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Juris anything about Indian Law..."
          className={`w-full resize-none border-none focus:ring-0 bg-transparent text-slate-800 text-[16px] placeholder:text-slate-400 outline-none leading-relaxed transition-all duration-300 ${mode === 'landing' ? 'min-h-[100px]' : 'min-h-[24px] max-h-32'}`}
          rows={mode === 'landing' ? 4 : 1}
        />
      </div>

      <div className={`flex items-center justify-between transition-all duration-300 bg-transparent ${mode === 'landing' ? 'p-4 pt-2' : 'p-2 pt-0'}`}>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-slate-500 hover:text-slate-900 h-8 text-[12px] font-semibold px-2 transition-all hover:bg-slate-200/50 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            {mode === 'landing' ? <span className="hidden sm:inline">Files</span> : ''}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsResearchEnabled(!isResearchEnabled)}
            className={`gap-1.5 h-8 text-[12px] font-semibold px-2 transition-all cursor-pointer ${isResearchEnabled
              ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Research</span>
          </Button>

          {mode === 'landing' && (
            <>
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-900 h-8 text-[12px] font-semibold px-2 transition-all hover:bg-slate-200/50 cursor-pointer">
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Focus</span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-900 h-8 text-[12px] font-semibold px-2 transition-all hover:bg-slate-200/50 cursor-pointer">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Prompts</span>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'chat' && (
            <div className="text-[11px] text-slate-400 font-medium mr-2 hidden sm:block">
              Press Enter to send
            </div>
          )}
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || (!input.trim() && files.length === 0)}
            className={`bg-slate-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow-md cursor-pointer ${mode === 'landing' ? 'h-9 px-6 text-[13px]' : 'h-8 px-4 text-[12px]'}`}
          >
            <ArrowUp className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{mode === 'landing' ? 'Ask Juris' : 'Send'}</span>
          </Button>
        </div>
      </div>
    </Card>
  );

  const renderedMessages = React.useMemo(() => (
    <TooltipProvider delay={200}>
      {messages.map((msg) => (
        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
          <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-[15px] leading-relaxed ${msg.role === 'user' ? 'bg-slate-100 text-slate-900 rounded-br-sm' : 'bg-transparent text-slate-800'}`}>
            {msg.role === 'assistant' && <div className="font-bold text-slate-900 mb-2 flex items-center gap-2"><div className="h-5 w-5 bg-slate-900 rounded flex items-center justify-center text-white font-serif text-[10px]">J</div> Juris</div>}
            <div className="markdown-prose">
              {msg.role === 'assistant' ? (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Intercept citation links to render custom Tooltips
                      a: ({ node, href, children, ...props }) => {
                        if (href && href.startsWith('#cite-')) {
                          const chunkPart = href.replace('#cite-', '');
                          const chunkIdx = parseInt(chunkPart, 10) - 1;

                          const chunk = msg.metadata?.groundingChunks?.[chunkIdx];
                          if (!chunk) return <a href={href} {...props}>{children}</a>;

                          const isPrecedent = chunk.sourceType === 'precedent';
                          const ctx = chunk.retrievedContext || {};
                          const displayTitle = isPrecedent
                            ? (ctx.title || 'Case Precedent')
                            : (ctx.title?.replace('.pdf', '') || 'Statute');

                          const fullText = chunk.retrievedContext?.text?.trim() || "";
                          let smartSnippet = fullText;

                          // Deduplicate title from snippet if it repeats
                          if (smartSnippet.toLowerCase().startsWith(displayTitle.toLowerCase())) {
                            smartSnippet = smartSnippet.substring(displayTitle.length).trim();
                            smartSnippet = smartSnippet.replace(/^[:\-\s—]+/, '');
                          }

                          // Cleanup excessive spaces (likely OCR/formatting artifacts)
                          smartSnippet = smartSnippet
                            .replace(/[ \t]{2,}/g, ' ')
                            .replace(/\(\s+([^)]+)\s+\)/g, '($1)')
                            .replace(/\(\s+/g, '(')
                            .replace(/\s+\)/g, ')');

                          const courtYearLine = isPrecedent
                            ? [ctx.court, ctx.year].filter(Boolean).join(' · ')
                            : '';
                          const judgesLine = isPrecedent && ctx.judges?.length
                            ? `Bench: ${ctx.judges.join(', ')}`
                            : '';

                          const citationKey = `${msg.id}-${chunkIdx}`;
                          const isCitationOpen = activeCitation === citationKey;

                          return (
                            <Tooltip open={isCitationOpen || undefined} onOpenChange={(open) => !open && setActiveCitation(null)}>
                              <TooltipTrigger
                                render={<span />}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setActiveCitation(isCitationOpen ? null : citationKey);
                                }}
                                className="inline-flex items-center justify-center min-w-[22px] h-[18px] bg-indigo-50/80 border border-indigo-200/50 hover:bg-indigo-100 hover:border-indigo-300 rounded-md text-indigo-700 text-[10px] font-bold mx-1 align-baseline cursor-pointer shadow-sm transition-all hover:scale-105"
                              >
                                {children}
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={14}
                                className="flex flex-col gap-0 w-[calc(100vw-2rem)] sm:w-[460px] max-h-[520px] p-0 bg-white border border-slate-200 shadow-professional rounded-2xl z-[100] overflow-hidden"
                              >
                                {/* Header */}
                                <div className="bg-white px-8 py-6 border-b border-slate-50 flex flex-col gap-2 sticky top-0 z-10">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                      <span className={`text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border ${isPrecedent
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                        : 'bg-amber-50 text-amber-800 border-amber-100'
                                        }`}>
                                        {isPrecedent ? 'Judgment' : 'Statute'}
                                      </span>
                                      <div className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                      <span className="text-[10px] font-bold text-slate-400 tracking-[0.1em] uppercase">
                                        Source {chunkPart}
                                      </span>
                                    </div>
                                  </div>

                                  <h3 className="text-[17px] font-serif font-bold text-slate-900 leading-tight tracking-tight break-words">
                                    {displayTitle}
                                  </h3>

                                  {(courtYearLine || ctx.citation) && (
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-500">
                                      {courtYearLine && <span>{courtYearLine}</span>}
                                      {courtYearLine && ctx.citation && <span className="text-slate-300">|</span>}
                                      {ctx.citation && <span className="italic">{ctx.citation}</span>}
                                    </div>
                                  )}
                                </div>

                                {/* Body */}
                                <div className="px-8 py-7 overflow-y-auto custom-scrollbar bg-[#FCFCFD] w-full max-w-full overflow-x-hidden">
                                  <div className="markdown-prose text-slate-700 text-[14px] leading-[1.65] font-serif tracking-normal w-full max-w-full break-words overflow-x-hidden">
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

                                {/* Footer */}
                                <div className="bg-white px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-auto">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                      Verified Reference
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-serif italic">
                                      {isPrecedent ? 'Judicial Precedent · Vaquill' : 'Statutory Reference · Juris'}
                                    </span>
                                  </div>

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
                                      if (title === "Statute") {
                                        const sectionMatch = text.match(/Section\s*(\d+)/i);
                                        const actMatch = text.match(/(BNS|BNSS|BSA|Constitution)/i);
                                        const query = `${sectionMatch ? sectionMatch[0] : ""} ${actMatch ? actMatch[0] : "BNS"}`.trim();
                                        searchUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(query || text.substring(0, 30))}`;
                                      } else {
                                        searchUrl = `https://indiankanoon.org/search/?formInput=${encodeURIComponent(title)}`;
                                      }
                                      window.open(searchUrl, '_blank');
                                    }}
                                    className="h-8 px-4 gap-2 text-[11px] font-bold text-slate-900 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all rounded-xl"
                                  >
                                    {ctx.pdfUrl ? 'View Judgment' : 'Full Document'}
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }
                        return <a href={href} className="text-blue-600 hover:underline" {...props}>{children}</a>;
                      }
                    }}
                  >
                    {processCitations(msg.content)}
                  </ReactMarkdown>
                </>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {isLoading && msg.role === 'assistant' && msg.content === '' && (
                <SequentialLoader />
              )}
            </div>
          </div>
        </div>
      ))}
    </TooltipProvider>
  ), [messages, isLoading]);

  if (!isMounted) {
    return <div className="flex h-screen w-full bg-[#FAFAFA] overflow-hidden" />;
  }

  return (
    <div className="flex h-dvh w-full bg-[#FAFAFA] overflow-hidden">
      <AppSidebar />
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#FAFAFA] max-h-screen">
        {/* Top Header */}
        <div className="p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SidebarTrigger
              className="h-8 w-8 text-slate-400 hover:text-slate-900 transition-all hover:scale-110 active:scale-95 cursor-pointer"
            />
          </div>

          <div className="flex gap-2 sm:gap-3 items-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-[12px] font-semibold text-slate-700 bg-white border-slate-200 h-8 rounded-lg px-2 sm:px-3 transition-all hover:scale-105 hover:shadow-sm active:scale-95 cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">View shared threads</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-[12px] font-semibold text-slate-700 bg-white border-slate-200 h-8 rounded-lg px-2 sm:px-3 transition-all hover:scale-105 hover:shadow-sm active:scale-95 cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
              <span className="hidden sm:inline">Tips</span>
            </Button>
          </div>
        </div>

        <div
          className="flex-1 flex flex-col relative w-full overflow-hidden bg-[#FAFAFA]"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {/* Drag Overlay */}
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-4 z-[60] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-3xl pointer-events-none"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white border border-slate-200 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm"
                >
                  <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                    <Plus className="h-8 w-8 text-slate-900" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-serif font-medium tracking-tight text-slate-900">Add files to Juris</h3>
                    <p className="text-slate-500 text-sm px-4">Drag and drop documents to analyze them</p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className={`w-full flex flex-col overflow-y-auto scroll-smooth flex-1 ${messages.length === 0 ? 'justify-center' : 'pt-4'}`}>
            <AnimatePresence mode="wait">
              {messages.length === 0 ? (
                <motion.div
                  key="landing-header"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full max-w-[1100px] mx-auto flex flex-col items-center text-center px-6"
                >
                  <h1 className="text-5xl md:text-7xl font-serif font-medium mb-4 tracking-tight text-slate-900">
                    Juris
                  </h1>
                  <p className="text-lg md:text-xl text-slate-500 font-medium mb-10">How can I help you today?</p>

                  <motion.div
                    layoutId="chat-input-container"
                    className="w-full max-w-[850px] mb-10"
                  >
                    {renderChatInput('landing')}
                  </motion.div>

                  <div className="w-full flex flex-wrap justify-center gap-3">
                    {['Statutory Analysis', 'Procedural Guidance', 'BNS/BNSS/BSA Help', 'Case Precedents'].map((chip) => (
                      <Button
                        key={chip}
                        variant="outline"
                        size="sm"
                        onClick={() => setInput(chip)}
                        className="rounded-full px-4 h-9 text-[13px] font-medium text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
                      >
                        {chip}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="chat-history"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full max-w-[1100px] mx-auto flex flex-col gap-8 px-4 sm:px-6 pb-8"
                >
                  {renderedMessages}
                  <div ref={messagesEndRef} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {messages.length > 0 && (
            <motion.div
              layoutId="chat-input-container"
              initial={false}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full shrink-0 z-20 flex justify-center px-4 sm:px-6 bg-transparent py-4"
            >
              <div className="w-full max-w-[1100px]">
                {renderChatInput('chat')}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {/* Chips moved inside header container */}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
