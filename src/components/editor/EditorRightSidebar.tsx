"use client"

import * as React from "react"
import { History, LayoutList, FileText, Plus, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const tabs = [
    { id: 'variables', label: 'Variables' },
    { id: 'context', label: 'Context' },
]

export function EditorRightSidebar({ 
    variables, 
    setVariables,
    editor,
    onAddField,
    onInsertVariable
}: { 
    variables: any[], 
    setVariables: (vars: any[]) => void,
    editor: any,
    onAddField: () => void,
    onInsertVariable: (key: string, label: string) => void
}) {
    const [activeTab, setActiveTab] = React.useState('variables')

    const handleVariableChange = (key: string, newValue: string) => {
        if (!editor) return

        const nextVars = variables.map(v => 
            v.key === key ? { ...v, value: newValue } : v
        )
        setVariables(nextVars)

        const { state, view } = editor
        const tr = state.tr
        const positions: { from: number, to: number }[] = []

        state.doc.descendants((node: any, pos: number) => {
            if (node.type.name === 'variable') {
                if (node.attrs.key === key) {
                    positions.push({ 
                        from: pos + 1, 
                        to: pos + node.nodeSize - 1 
                    })
                }
            }
        })

        // Replace from end to start to maintain index validity
        for (let i = positions.length - 1; i >= 0; i--) {
            const { from, to } = positions[i]
            // We use a zero-width space or a placeholder if empty to keep the node selectable/visible
            // But if the user wants it truly empty, we can use ""
            tr.insertText(newValue, from, to)
        }

        if (tr.docChanged) {
            view.dispatch(tr)
        }
    }

    return (
        <aside className="w-[300px] border-l border-slate-100 bg-white flex flex-col shrink-0 overflow-hidden hidden xl:flex">
            {/* Minimal Tab Bar */}
            <div className="flex px-6 pt-6 gap-6 border-b border-slate-50 shrink-0">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "pb-3 border-b-2 transition-all cursor-pointer font-bold text-[11px] tracking-widest uppercase",
                            activeTab === tab.id
                                ? "border-slate-900 text-slate-900" 
                                : "border-transparent text-slate-400 hover:text-slate-500"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="px-6 py-8">
                    {activeTab === 'variables' ? (
                        <div className="space-y-8">
                            <div className="space-y-6">
                                {variables.map((variable, i) => (
                                    <div key={i} className="group/var space-y-1">
                                        <div className="flex items-center justify-between px-0.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em]">{variable.label}</label>
                                            <button 
                                                onClick={() => onInsertVariable(variable.key, variable.label)}
                                                className="text-slate-300 hover:text-slate-950 transition-colors cursor-pointer"
                                                title="Insert"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <input 
                                            type="text"
                                            className="w-full bg-transparent border-b border-slate-100 px-0.5 py-3.5 text-[13px] text-slate-900 font-medium outline-none transition-all placeholder:text-slate-200 focus:border-slate-950 ring-0"
                                            value={variable.value}
                                            onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                                            placeholder={variable.placeholder || `Enter ${variable.label}...`}
                                        />
                                    </div>
                                ))}
                                
                                <div className="flex flex-col gap-2 pt-2">
                                    <button 
                                        onClick={() => {
                                            if (editor && (window as any).syncJurisVariables) {
                                                const html = editor.getHTML()
                                                const parser = new DOMParser()
                                                const doc = parser.parseFromString(html, 'text/html')
                                                const spans = doc.querySelectorAll('span[data-variable-key]')
                                                const currentVars: Record<string, string> = {}
                                                spans.forEach((span: any) => {
                                                    const key = span.getAttribute('data-variable-key')
                                                    if (key) currentVars[key] = span.textContent || ""
                                                })
                                                
                                                // Also scan for [Brackets]
                                                const text = editor.getText()
                                                const bracketMatches = [...text.matchAll(/\[([^\]]+)\]/g)]
                                                bracketMatches.forEach(match => {
                                                    const raw = match[1]
                                                    const key = raw.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                                                    if (key && !currentVars[key]) {
                                                        currentVars[key] = match[0]
                                                    }
                                                })

                                                if (Object.keys(currentVars).length > 0) {
                                                    (window as any).syncJurisVariables(currentVars)
                                                }
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-2 text-sky-600 hover:text-sky-700 h-10 rounded-lg transition-all cursor-pointer font-bold text-[9px] uppercase tracking-[0.25em] border border-sky-100 hover:bg-sky-50"
                                    >
                                        <LayoutList className="h-3.5 w-3.5" />
                                        <span>Scan Document</span>
                                    </button>

                                    <button 
                                        onClick={onAddField}
                                        className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-950 h-10 rounded-lg transition-all cursor-pointer font-bold text-[9px] uppercase tracking-[0.25em] border border-dashed border-slate-200 hover:border-slate-300"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Add Variable</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-400">
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 px-0.5">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em]">Case Objective</label>
                                        <Info className="h-3 w-3 text-slate-200" />
                                    </div>
                                    <textarea 
                                        className="w-full min-h-[160px] bg-slate-50/20 border border-slate-100 rounded-lg px-3 py-4 text-[13px] text-slate-900 font-medium outline-none transition-all placeholder:text-slate-200 focus:border-slate-950 focus:bg-white resize-none"
                                        placeholder="Outline the core objective..."
                                    />
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.25em] px-0.5">Counter-party</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-transparent border-b border-slate-100 px-0.5 py-3.5 text-[13px] text-slate-900 font-medium outline-none transition-all placeholder:text-slate-200 focus:border-slate-950 ring-0"
                                        placeholder="e.g. State of Delhi"
                                    />
                                </div>
                                
                                <div className="p-4 rounded-xl border border-dashed border-slate-200 hover:border-slate-950 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all hover:bg-white group">
                                    <FileText className="h-4 w-4 text-slate-300 group-hover:text-slate-950 transition-colors" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter group-hover:text-slate-950">Add Precedents</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status */}
            <div className="px-6 py-4 border-t border-slate-50 bg-white">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Connected to Juris-AI</span>
                </div>
            </div>
        </aside>
    )
}
