import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Sparkles, MessageSquare, Clock, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Fetch session by share token
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.shareToken, token))
    .limit(1);

  if (!session || !session.isPublic) {
    notFound();
  }

  // Fetch messages
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, session.id))
    .orderBy(asc(chatMessages.createdAt));

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-slate-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-200">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Juris Shared</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Legal Research Intelligence</p>
            </div>
          </div>
          <a
            href="/login"
            className="text-[12px] font-bold px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-all"
          >
            Try Juris
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Session Info */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-tight">Shared Conversation</span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(session.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <h2 className="text-3xl font-serif font-bold text-slate-900 leading-tight">
            {session.title || "Untitled Conversation"}
          </h2>
          <div className="mt-6 flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-slate-800">Verified Juris Output</p>
              <p className="text-[11px] text-slate-400 font-medium">This research was generated using Juris AI & Verified Databases.</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-8">
          {messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[90%] rounded-2xl p-6 text-[15px] leading-relaxed shadow-sm border ${
                msg.role === "user" 
                  ? "bg-slate-100 text-slate-700 border-slate-200/50" 
                  : "bg-white text-slate-800 border-slate-100"
              }`}>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-50">
                    <div className="h-6 w-6 bg-slate-900 rounded-md flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Juris Intelligence</span>
                  </div>
                )}
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    p: (props) => <p className="mb-4 last:mb-0" {...props} />,
                    h1: (props) => <h1 className="text-xl font-bold mt-6 mb-3 text-slate-900" {...props} />,
                    h2: (props) => <h2 className="text-lg font-bold mt-5 mb-2 text-slate-900" {...props} />,
                    h3: (props) => <h3 className="text-base font-bold mt-4 mb-2 text-slate-900" {...props} />,
                    ul: (props) => <ul className="list-disc pl-5 mb-4 space-y-2" {...props} />,
                    ol: (props) => <ol className="list-decimal pl-5 mb-4 space-y-2" {...props} />,
                    li: (props) => <li className="pl-1" {...props} />,
                    strong: (props) => <strong className="font-bold text-slate-950" {...props} />,
                    blockquote: (props) => <blockquote className="border-l-4 border-slate-200 pl-4 italic text-slate-600 my-4" {...props} />,
                  }}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-20 p-10 bg-slate-900 rounded-[32px] text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent)]" />
          <Sparkles className="h-10 w-10 text-white/20 mx-auto mb-6" />
          <h3 className="text-2xl font-serif font-bold mb-3 italic">Supercharge your legal research</h3>
          <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto font-medium">Build your own document vaults and get instant AI-powered answers with Juris.</p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-slate-900 font-bold rounded-xl hover:scale-105 transition-all shadow-lg"
          >
            Get Started for Free
          </a>
        </div>
      </main>
    </div>
  );
}
