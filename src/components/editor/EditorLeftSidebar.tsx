"use client"

import * as React from "react"
import { ChevronRight, FileText, Scale, ExternalLink, AlertCircle, Plus, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

export function EditorLeftSidebar({ editor }: { editor: any }) {
    const [dynamicOutline, setDynamicOutline] = React.useState<{ title: string, level: number, pos: number }[]>([])
    const [dynamicCitations, setDynamicCitations] = React.useState<{ name: string, pos: number }[]>([])
    const [activeHeadingPos, setActiveHeadingPos] = React.useState<number | null>(null)

    React.useEffect(() => {
        if (!editor) return

        const updateSidebar = () => {
            const headings: { title: string, level: number, pos: number }[] = []
            const citations: { name: string, pos: number }[] = []

            editor.state.doc.descendants((node: any, pos: number) => {
                if (node.type.name === 'heading') {
                    headings.push({
                        title: node.textContent,
                        level: node.attrs.level,
                        pos: pos
                    })
                }
                
                if (node.type.name === 'variable') {
                    citations.push({
                        name: node.textContent,
                        pos: pos
                    })
                }
            })

            setDynamicOutline(headings)
            
            // Deduplicate citations
            const uniqueCitations: { name: string, pos: number }[] = []
            const seen = new Set()
            for (const c of citations) {
                if (!seen.has(c.name)) {
                    seen.add(c.name)
                    uniqueCitations.push(c)
                }
            }
            setDynamicCitations(uniqueCitations)
            updateActiveHeading(headings)
        }

        const updateActiveHeading = (headings: { title: string, level: number, pos: number }[]) => {
            const { from } = editor.state.selection
            let currentActive = null
            
            for (let i = headings.length - 1; i >= 0; i--) {
                if (headings[i].pos <= from) {
                    currentActive = headings[i].pos
                    break
                }
            }
            setActiveHeadingPos(currentActive)
        }

        updateSidebar()
        editor.on('update', updateSidebar)
        editor.on('selectionUpdate', () => {
            const headings: { title: string, level: number, pos: number }[] = []
            editor.state.doc.descendants((node: any, pos: number) => {
                if (node.type.name === 'heading') {
                    headings.push({ title: node.textContent, level: node.attrs.level, pos })
                }
            })
            updateActiveHeading(headings)
        })
        
        return () => {
            editor.off('update', updateSidebar)
        }
    }, [editor])

    const handleScrollTo = (pos: number) => {
        if (!editor) return

        // 1. Set selection at the start of the heading
        editor.chain()
            .focus()
            .setTextSelection(pos)
            .run()

        // 2. Use a slight delay for layout to settle, then ensure precise scroll
        // This handles cases where selection triggers internal layout shifts (like bubble menu)
        setTimeout(() => {
            const { view } = editor
            const domNode = view.nodeDOM(pos)
            if (domNode instanceof HTMLElement) {
                domNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
            } else {
                const element = view.domAtPos(pos).node as HTMLElement
                const scrollTarget = element instanceof Text ? element.parentElement : element
                scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }, 10)
    }

    const glossaryClauses = [
        { name: "Jurisdiction & Venue", text: "The parties hereby agree that the courts at Gurugram, Haryana shall have exclusive jurisdiction to adjudicate any disputes arising out of or in connection with this application." },
        { name: "BNSS Applicability", text: "The proceedings herein are governed by the provisions of the Bharatiya Nagarik Suraksha Sanhita, 2023, while keeping in view the procedural transition from the Code of Criminal Procedure, 1973." },
        { name: "Standard Bail Ground", text: "The Applicant has deep roots in society and there is no flight risk or apprehension of tampering with evidence, as the entire case is based on documentary records already in possession of the investigating agency." }
    ]

    const actsList = [
        { name: "The Bharatiya Nagarik Suraksha Sanhita, 2023", section: "S.480" },
        { name: "The Indian Penal Code, 1860", section: "S.420, 467" },
        { name: "Constitution of India", section: "Art. 21" },
    ]

    return (
        <aside className="w-[280px] border-r border-slate-100 bg-white flex flex-col shrink-0 overflow-hidden hidden lg:flex">
            <div className="flex-1 overflow-y-auto px-5 py-8 space-y-10 custom-scrollbar">
                
                {/* 🧭 Document Outline */}
                <div className="space-y-6">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Outline</h3>
                    <div className="flex flex-col gap-5">
                        {dynamicOutline.length > 0 ? (
                            dynamicOutline.map((item, i) => {
                                const isActive = activeHeadingPos === item.pos
                                return (
                                    <button 
                                        key={i} 
                                        onClick={() => handleScrollTo(item.pos)}
                                        className={cn(
                                            "w-full flex items-center gap-3 py-0.5 px-2 transition-all cursor-pointer text-left group relative",
                                            item.level === 1 ? "" : "ml-4"
                                        )}
                                    >
                                        {isActive && (
                                            <div className="absolute -left-1 w-1 h-1 rounded-full bg-slate-950" />
                                        )}
                                        <span className={cn(
                                            "text-[12px] truncate transition-colors",
                                            isActive 
                                                ? "text-slate-950 font-bold" 
                                                : (item.level === 1 ? 'font-bold text-slate-800 uppercase tracking-tight' : 'font-medium text-slate-400 group-hover:text-slate-600')
                                        )}>
                                            {item.title}
                                        </span>
                                    </button>
                                )
                            })
                        ) : (
                            <span className="text-[11px] text-slate-300 italic block px-2">No headings detected.</span>
                        )}
                    </div>
                </div>

                {/* 🏛️ Statutory References */}
                <div className="space-y-5">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Statutory References</h3>
                    <div className="space-y-4 px-1">
                        {actsList.map((act, i) => (
                            <div 
                                key={i} 
                                onClick={() => window.open(`https://indiankanoon.org/search/?formInput=${encodeURIComponent(act.name)}`, '_blank')}
                                className="group cursor-pointer border-l-2 border-slate-100 pl-4 hover:border-slate-900 transition-all py-0.5"
                            >
                                <span className="text-[12px] font-semibold text-slate-600 block group-hover:text-slate-900 transition-colors leading-snug mb-1">{act.name}</span>
                                <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Section {act.section}</span>
                                     <ExternalLink className="h-2.5 w-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 📜 Cited Precedents */}
                <div className="space-y-5">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Cited Precedents</h3>
                    <div className="space-y-4 px-1">
                        {dynamicCitations.length > 0 ? (
                            dynamicCitations.map((cite, i) => (
                                <div 
                                    key={i} 
                                    onClick={() => handleScrollTo(cite.pos)}
                                    className="group cursor-pointer border-l-2 border-slate-100 pl-4 hover:border-slate-900 transition-all py-0.5"
                                >
                                    <span className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-900 leading-normal block transition-colors font-serif italic">
                                        {cite.name}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1 block">Verified Precedent</span>
                                </div>
                            ))
                        ) : (
                            <span className="text-[11px] text-slate-300 italic block px-1 font-serif">No precedents cited yet.</span>
                        )}
                    </div>
                </div>

                {/* 📚 Clause Library */}
                <div className="space-y-5">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Clause Library</h3>
                    <div className="space-y-1.5">
                        {glossaryClauses.map((clause, i) => (
                            <button 
                                key={i} 
                                onClick={() => editor.chain().focus().insertContent(`<p>${clause.text}</p>`).run()}
                                className="w-full group text-left p-3 rounded-lg hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{clause.name}</span>
                                    <Plus className="h-3 w-3 text-slate-300 group-hover:text-slate-900" />
                                </div>
                                <p className="text-[11px] text-slate-400 group-hover:text-slate-500 line-clamp-2 leading-relaxed">
                                    {clause.text}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.05)]">
                 <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Draft Integrity</span>
                    <span className="text-[10px] font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">83%</span>
                 </div>
                 <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div 
                        className="bg-slate-900 h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: '83%' }}
                    />
                 </div>
            </div>
        </aside>
    )
}
