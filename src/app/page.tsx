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
  Scale,
  Copy,
  Check,
  ChevronRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';

// Premium Sequential Loader representing the legal research process
const SequentialLoader = () => {
  const [step, setStep] = React.useState(0);
  const steps = [
    { text: "Analyzing case context..." },
    { text: "Identifying legal issues..." },
    { text: "Searching statutes & precedents..." },
    { text: "Synthesizing legal logic..." },
    { text: "Finalizing Juris briefing..." }
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="flex flex-col gap-2 py-3 w-full animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-5 h-5">
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.4, 1, 0.4] 
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="h-1.5 w-1.5 rounded-full bg-slate-400"
          />
        </div>
        <div className="flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <span className="text-[13px] font-medium text-slate-500 tracking-tight italic">
                {steps[step].text}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
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
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = React.useState<{ id: string, role: 'user' | 'assistant', content: string, metadata?: any }[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [isResearchEnabled, setIsResearchEnabled] = React.useState(true);
  const [activeCitationData, setActiveCitationData] = React.useState<any>(null);
  const [isCitationVisible, setIsCitationVisible] = React.useState(false);
  const [copyingId, setCopyingId] = React.useState<string | null>(null);
  const [isCopied, setIsCopied] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  const [isInputFocused, setIsInputFocused] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  React.useEffect(() => {
    const handleClickOutside = () => {
      setCopyingId(null);
      setIsCopied(false);
      setIsCitationVisible(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Robust mobile keyboard dismissal detection
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleVisualViewportResize = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const threshold = 0.95; 
      const isKeyboardClosed = viewport.height >= window.innerHeight * threshold;

      if (isKeyboardClosed && isInputFocused) {
        setIsInputFocused(false);
        if (textareaRef.current) {
          textareaRef.current.blur();
        }
      }
    };

    const viewport = window.visualViewport;
    viewport.addEventListener('resize', handleVisualViewportResize);
    return () => viewport.removeEventListener('resize', handleVisualViewportResize);
  }, [isInputFocused]);

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
        if ('metadata' in m && (m as any).metadata?.groundingChunks) {
          const unifiedContext = (m as any).metadata.groundingChunks.map((c: any, i: number) => {
            const ctx = c.retrievedContext;
            return `[[${i + 1}]] PRECEDENT: ${ctx.title} (${ctx.citation || 'Judgment'})\nExcerpt: ${ctx.text}`;
          }).join('\n\n---\n\n');
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(f => f.filter((_, idx) => idx !== i));
                    }}
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
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsInputFocused(false), 200);
          }}
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
              ? "bg-slate-900 text-white hover:bg-black"
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
    <>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} transition-all duration-200`}
        >
          <div
            onClick={(e) => {
              if (msg.role === 'user') {
                e.stopPropagation();
                setCopyingId(copyingId === msg.id ? null : msg.id);
                setIsCopied(false);
              }
            }}
            className={`px-4 py-3 rounded-2xl max-w-[95%] sm:max-w-[85%] text-[15px] leading-relaxed transition-all cursor-pointer select-none ${msg.role === 'user'
              ? 'bg-slate-100 text-slate-900 rounded-br-sm hover:bg-slate-200/80 active:scale-[0.98]'
              : 'bg-transparent text-slate-800'
              }`}
          >
            {msg.role === 'assistant' && <div className="font-bold text-slate-900 mb-2 flex items-center gap-2"><div className="h-5 w-5 bg-slate-900 rounded flex items-center justify-center text-white font-serif text-[10px]">J</div> Juris</div>}
            <div className="markdown-prose text-inherit">
              {msg.role === 'assistant' ? (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node, href, children, ...props }) => {
                        if (href && href.startsWith('#cite-')) {
                          const chunkPart = href.replace('#cite-', '');
                          const chunkIdx = parseInt(chunkPart, 10) - 1;

                          const chunk = msg.metadata?.groundingChunks?.[chunkIdx];
                          if (!chunk) return <a href={href} {...props}>{children}</a>;

                          return (
                            <span
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveCitationData(chunk);
                                setIsCitationVisible(true);
                              }}
                              className="inline-flex items-center justify-center min-w-[22px] h-[18px] bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:border-slate-300 rounded-md text-slate-700 text-[10px] font-bold mx-1 align-baseline cursor-pointer shadow-sm transition-all hover:scale-105 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                            >
                              {children}
                            </span>
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
          <AnimatePresence mode="wait">
            {copyingId === msg.id && msg.role === 'user' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-1 mr-1"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(msg.content);
                    } else {
                      console.warn("Clipboard API not available");
                    }
                    setIsCopied(true);
                    setTimeout(() => {
                      setIsCopied(false);
                      setCopyingId(null);
                    }, 1500);
                  }}
                  className="h-7 px-2.5 text-[11px] font-bold text-slate-500 hover:text-slate-900 gap-1.5 bg-white border border-slate-200/60 rounded-xl shadow-sm transition-all hover:scale-105 active:scale-[0.98]"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {isCopied ? "Copied" : "Copy text"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </>
  ), [messages, isLoading, copyingId, isCopied, isMobile]);

  if (!isMounted) {
    return <div className="flex h-screen w-full bg-white overflow-hidden" />;
  }

  return (
    <div className="flex h-dvh w-full bg-white font-sans text-slate-900 overflow-hidden relative">
      <AppSidebar />
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <main className="flex-1 w-full relative overflow-hidden flex flex-col h-dvh">
        <div className="flex-1 flex flex-col relative overflow-hidden h-full">
          {/* Top Header */}
          <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-white/80 backdrop-blur-md z-30">
            <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
              <SidebarTrigger className="h-9 w-9 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0" />
              <div className="h-4 w-[1px] bg-slate-200 shrink-0 hidden sm:block" />
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-[13px] font-bold text-slate-400 tracking-wider uppercase shrink-0">Drafts</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                <span className="text-[13px] font-bold text-slate-900 truncate">Legal Research Assistant</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="ghost" 
                size="sm"
                onClick={() => setMessages([])}
                className="h-9 w-9 p-0 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-[11px] font-bold text-white font-serif shadow-sm">J</div>
            </div>
          </div>

          <div
            className="flex-1 flex flex-col relative w-full overflow-hidden bg-white"
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

            <motion.div 
              layout
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className={`w-full flex flex-col overflow-y-auto scroll-smooth flex-1 transition-all duration-300 ${
                messages.length === 0 
                  ? (isMobile && isInputFocused ? 'justify-start pt-12 pb-32' : 'justify-center') 
                  : 'pt-4'
              }`}
            >
              <AnimatePresence mode="wait">
                {messages.length === 0 ? (
                  <motion.div
                    key="landing-header"
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    className="w-full max-w-[1100px] mx-auto flex flex-col items-center text-center px-6"
                  >
                    <motion.div
                      layout
                      className={`transition-all duration-500 ${isMobile && isInputFocused ? 'opacity-0 h-0 overflow-hidden mb-0 scale-95' : 'opacity-100 mb-0'}`}
                    >
                      <h1 className="text-5xl md:text-7xl font-serif font-medium mb-4 tracking-tight text-slate-900">
                        Juris
                      </h1>
                      <p className="text-lg md:text-xl text-slate-500 font-medium mb-10">How can I help you today?</p>
                    </motion.div>

                    <motion.div
                      layout
                      layoutId="chat-input-container"
                      className={`w-full max-w-[850px] transition-all duration-500 ${isMobile && isInputFocused ? 'mt-4' : 'mb-10'}`}
                    >
                      {renderChatInput('landing')}
                    </motion.div>

                    <motion.div
                      layout
                      className={`w-full flex flex-wrap justify-center gap-3 transition-all duration-500 ${isMobile && isInputFocused ? 'opacity-0 h-0 overflow-hidden pointer-events-none mt-0' : 'opacity-100 mt-0'}`}
                    >
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
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat-history"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    className="w-full max-w-[1100px] mx-auto flex flex-col gap-8 px-4 sm:px-6 pb-8"
                  >
                    {renderedMessages}
                    <div ref={messagesEndRef} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {messages.length > 0 && (
              <motion.div
                layout
                layoutId="chat-input-container"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 40 }}
                className="w-full shrink-0 z-20 flex justify-center px-4 sm:px-6 bg-transparent py-4"
              >
                <div className="w-full max-w-[1100px]">
                  {renderChatInput('chat')}
                </div>
              </motion.div>
            )}
          </div>

          <AnimatePresence>
            {isCitationVisible && activeCitationData && (() => {
              const chunk = activeCitationData;
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
                    onClick={() => setIsCitationVisible(false)}
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
                          <span className={`text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${isPrecedent
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-amber-50 text-amber-800 border-amber-100'
                            }`}>
                            {isPrecedent ? 'Judgment' : 'Statute'}
                          </span>
                        </div>
                        <Button
                          variant="ghost" 
                          size="icon"
                          onClick={() => setIsCitationVisible(false)}
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
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(`${displayTitle}\n\n${text}`);
                          } else {
                            console.warn("Clipboard API not available");
                          }
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
                        className="h-9 px-5 gap-2 text-[11px] font-bold text-white bg-slate-900 hover:bg-black shadow-sm transition-all rounded-xl w-full sm:w-auto"
                      >
                        {ctx.pdfUrl ? 'View Judgment' : 'Full Document'}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                </div>
              );
            })()}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
