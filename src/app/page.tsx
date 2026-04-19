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
  ChevronUp,
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
import { cn } from '@/lib/utils';




// Helper to process citations and fix model markdown quirks
const processMarkdownContent = (content: string) => {
  if (!content) return '';
  let processed = content.replace(/\[\[\s*(\d+)\s*\]\]/g, (match, n) => {
    return ` [${n}](#cite-${n})`;
  });
  // Fix missing spaces in headings (e.g. ###Heading -> ### Heading)
  processed = processed.replace(/^(#{1,6})(?=[^\s#])/gm, '$1 ');
  // Unescape API-escaped asterisks and hashes
  processed = processed.replace(/\\\*/g, '*').replace(/\\#/g, '#');
  return processed;
};

// Robust copy-to-clipboard utility with fallback for non-secure contexts
const copyToClipboard = async (text: string) => {
  if (typeof window === 'undefined') return false;
  
  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Modern Clipboard API failed, attempting fallback:", err);
    }
  }

  // Fallback to legacy execCommand('copy')
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Ensure it's not visible or affecting layout
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
    console.error("Copy fallback failed:", err);
    return false;
  }
};

const ThinkingBlock = ({
  msg,
  isLoading,
  currentStatus,
  currentReasoning,
  expandedThinking,
  setExpandedThinking
}: any) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  const isCurrentlyThinking = isLoading && msg.content === '' && (currentReasoning || currentStatus);
  const savedReasoning = msg.metadata?.reasoning;
  const isStreamingWithThought = isLoading && msg.content !== '' && currentReasoning;
  
  if (!isCurrentlyThinking && !savedReasoning && !isStreamingWithThought) return null;
  
  const reasoningText = savedReasoning || currentReasoning;
  const isExpanded = expandedThinking[msg.id] ?? isCurrentlyThinking ?? isStreamingWithThought;
  const isLive = isLoading && (msg.content === '' || isStreamingWithThought);

  React.useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reasoningText, isExpanded]);

  return (
    <div className="mb-4">
      {/* Live Pipeline Status — only while waiting for text */}
      {isLive && !savedReasoning && (
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute h-3 w-3 rounded-full bg-slate-900"
            />
            <div className="h-1.5 w-1.5 rounded-full bg-slate-900 relative z-10" />
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={currentStatus || 'init'}
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.3 }}
              className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em]"
            >
              {currentStatus || "Analyzing case context..."}
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      {/* Collapsible Thinking Block */}
      {reasoningText && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-200"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedThinking((prev: any) => ({ ...prev, [msg.id]: !isExpanded }));
            }}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-medium transition-colors ${isLive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>
                {isLive ? 'Thinking' : 'Reasoning'}
              </span>
              {isLive && (
                <div className="flex gap-1 ml-1 items-center h-full">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="h-1 w-1 rounded-full bg-slate-900"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div className="px-4 pb-3 border-t border-slate-100">
                  <div 
                    ref={scrollRef}
                    className={`text-[13px] leading-relaxed text-slate-500 font-sans pt-3 break-words ${isLive ? 'max-h-[300px]' : 'max-h-[400px]'} overflow-y-auto custom-scrollbar`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({children}) => <strong className="text-slate-700 block mt-3 mb-1 text-[14px]">{children}</strong>,
                          h2: ({children}) => <strong className="text-slate-700 block mt-3 mb-1 text-[13px]">{children}</strong>,
                          h3: ({children}) => <strong className="text-slate-700 block mt-2 mb-1 text-[13px]">{children}</strong>,
                          ul: ({children}) => <ul className="list-disc ml-5 mb-2">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal ml-5 mb-2">{children}</ol>,
                          li: ({children}) => <li className="mb-0.5">{children}</li>,
                          p: ({children}) => <p className="mb-2 last:mb-0 inline">{children} </p>,
                          strong: ({children}) => <strong className="font-semibold text-slate-700">{children}</strong>,
                        }}
                      >
                        {reasoningText}
                      </ReactMarkdown>
                      {isLive && (
                        <div>
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="inline-block w-1 h-3 bg-slate-400 ml-1 align-middle"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

export default function Home() {
  const [files, setFiles] = React.useState<{ name: string, type: string }[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const isAtBottomRef = React.useRef(true);
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
  const [currentStatus, setCurrentStatus] = React.useState<string | null>(null);
  const [currentReasoning, setCurrentReasoning] = React.useState<string>("");
  const [expandedThinking, setExpandedThinking] = React.useState<Record<string, boolean>>({});

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

  // Lock all scrolling when mobile keyboard is open on landing page
  React.useEffect(() => {
    const shouldLock = isMobile && isInputFocused && messages.length === 0;
    if (!shouldLock) return;

    // Lock body/html scrolling
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Block all touch-based scrolling
    const preventScroll = (e: TouchEvent) => {
      // Allow touches inside the textarea itself
      if (textareaRef.current && textareaRef.current.contains(e.target as Node)) return;
      e.preventDefault();
    };

    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [isMobile, isInputFocused, messages.length]);

  const scrollToBottom = (force = false) => {
    if (scrollContainerRef.current && (isAtBottomRef.current || force)) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: force ? 'smooth' : 'auto'
      });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const atBottom = scrollHeight - clientHeight <= scrollTop + 300;
      isAtBottomRef.current = atBottom;
    }
  };

  React.useEffect(() => {
    const timeoutId = setTimeout(() => scrollToBottom(), 50);
    return () => clearTimeout(timeoutId);
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!input.trim() && files.length === 0) return;

    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);

    // Force scroll to bottom for user message
    setTimeout(() => scrollToBottom(true), 10);

    // Convert files to base64 for the research pipeline
    const fileAttachments = await Promise.all(
      files.map(async (f: any) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            name: f.name,
            type: f.type,
            base64: (reader.result as string).split(',')[1]
          });
          reader.readAsDataURL(f as any);
        });
      })
    );

    setInput("");
    setIsLoading(true);
    setCurrentStatus("Initializing Juris research...");
    setCurrentReasoning("");

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
          isResearch: isResearchEnabled,
          attachments: fileAttachments
        }),
      });

      if (!response.ok) throw new Error(response.statusText);
      setIsResearchEnabled(false);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let localReasoning = ""; // Track reasoning locally to avoid React batching hooks inside setState

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
                // On first text token, save accumulated reasoning onto the message
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantId && !msg.metadata?.reasoning && localReasoning
                    ? { ...msg, content: msg.content + data.t, metadata: { ...msg.metadata, reasoning: localReasoning } }
                    : msg.id === assistantId
                      ? { ...msg, content: msg.content + data.t }
                      : msg
                ));
                setCurrentStatus(null); // Clear status once we start getting text
              } else if (data.s) {
                setCurrentStatus(data.s);
              } else if (data.r) {
                localReasoning += data.r;
                setCurrentReasoning(localReasoning);
                setCurrentStatus("Juris is thinking...");
              } else if (data.m) {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantId ? { ...msg, metadata: { ...(msg.metadata || {}), ...data.m } } : msg
                ));
              }
            } catch (e) {
              console.error("Failed to parse stream JSON:", e, "Line:", line);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      // If the stream died mid-response, show an error in the assistant message
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        // If there's already an assistant message that's empty or has some content, append error
        if (lastMsg && lastMsg.role === 'assistant') {
          const errorNotice = "\n\n⚠️ Connection interrupted. This may be due to server load or network issues. Please try again.";
          return prev.map(msg =>
            msg.id === lastMsg.id
              ? { ...msg, content: (msg.content || '') + errorNotice }
              : msg
          );
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
      setCurrentReasoning("");
      setCurrentStatus(null);
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
          className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} transition-all duration-200 group/msg`}
        >
          <div
            onClick={(e) => {
              if (msg.role === 'user') {
                e.stopPropagation();
                setCopyingId(copyingId === msg.id ? null : msg.id);
                setIsCopied(false);
              }
            }}
            className={cn(
               "px-4 py-3 rounded-2xl text-[15px] leading-relaxed transition-all relative",
               msg.role === 'user' 
                ? "max-w-[90%] bg-slate-100 text-slate-900 rounded-br-sm hover:bg-slate-200/80 active:scale-[0.99] cursor-pointer shadow-sm" 
                : "max-w-[95%] bg-slate-50/50 border border-slate-100/50 text-slate-800 rounded-bl-sm"
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <div className="h-5 w-5 bg-slate-900 rounded flex items-center justify-center text-white font-serif text-[10px]">J</div>
                  Juris
                </div>
                {!isLoading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(msg.content);
                      setCopyingId(msg.id);
                      setIsCopied(true);
                      setTimeout(() => {
                        setIsCopied(false);
                        setCopyingId(null);
                      }, 2000);
                    }}
                    className="h-7 w-7 opacity-0 group-hover/msg:opacity-100 transition-all text-slate-400 hover:text-slate-900 rounded-lg hover:bg-white border border-transparent hover:border-slate-100 shadow-sm"
                  >
                    {copyingId === msg.id && isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            )}
            
            <div className="markdown-prose text-inherit">
              {msg.role === 'assistant' && (
                <ThinkingBlock
                  msg={msg}
                  isLoading={isLoading}
                  currentStatus={currentStatus}
                  currentReasoning={currentReasoning}
                  expandedThinking={expandedThinking}
                  setExpandedThinking={setExpandedThinking}
                />
              )}

              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className={cn("mb-3 last:mb-0 leading-relaxed", msg.role === 'user' && "inline")}>{children}</p>,
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
                  },
                  table: ({ children }) => (
                    <div className="w-full overflow-hidden border border-slate-200 rounded-xl my-4 shadow-sm bg-white">
                      <table className="w-full text-sm text-left table-fixed">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>,
                  th: ({ children }) => <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 break-words border-r border-slate-100 last:border-0 uppercase text-[10px] tracking-widest">{children}</th>,
                  tr: ({ children }) => <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">{children}</tr>,
                  td: ({ children }) => <td className="px-3 sm:px-4 py-3 break-words text-slate-600 align-top border-r border-slate-100 last:border-0">{children}</td>,
                  strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                }}
              >
                {processMarkdownContent(msg.content)}
              </ReactMarkdown>

              {/* Minimal loading indicator when text hasn't started yet and no reasoning */}
              {isLoading && msg.role === 'assistant' && msg.content === '' && !currentReasoning && !currentStatus && (
                <div className="flex items-center gap-2 py-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="h-1.5 w-1.5 rounded-full bg-slate-400"
                  />
                  <span className="text-[13px] text-slate-400 italic">Initializing Juris research...</span>
                </div>
              )}
            </div>
          </div>
          
          <AnimatePresence mode="wait">
            {copyingId === msg.id && msg.role === 'user' && !isCopied && (
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
                    copyToClipboard(msg.content);
                    setIsCopied(true);
                    setTimeout(() => {
                      setIsCopied(false);
                      setCopyingId(null);
                    }, 1500);
                  }}
                  className="h-7 px-2.5 text-[11px] font-bold text-slate-500 hover:text-slate-900 gap-1.5 bg-white border border-slate-200/60 rounded-xl shadow-sm transition-all hover:scale-105 active:scale-[0.98]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy text
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </>
  ), [messages, isLoading, copyingId, isCopied, isMobile, currentStatus, currentReasoning, expandedThinking]);

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
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className={`w-full flex flex-col flex-1 ${messages.length === 0
                ? (isMobile && isInputFocused ? 'overflow-hidden justify-start pt-12 pb-32' : 'overflow-y-auto justify-center')
                : 'overflow-y-auto pt-4'
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-[1100px] mx-auto flex flex-col gap-8 px-4 sm:px-6 pb-8"
                  >
                    {renderedMessages}
                    <div className="h-4 shrink-0" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
                          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                            {isPrecedent ? 'Case Precedent' : 'Statute Reference'}
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
