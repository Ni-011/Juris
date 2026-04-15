"use client"

// Diagnostic: Force re-compilation to clear stale html-to-docx traces.
import * as React from "react"
import { Save, Share, Download, ChevronDown, Rocket, Menu, Maximize2, Minimize2, Check, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface EditorHeaderProps {
    onToggleFocus: () => void
    isFocusMode: boolean
    editor: any
}

export function EditorHeader({ onToggleFocus, isFocusMode, editor }: EditorHeaderProps) {
    const [isSaving, setIsSaving] = React.useState(false)
    const [saveSuccess, setSaveSuccess] = React.useState(false)

    const handleSave = () => {
        if (!editor) return
        setIsSaving(true)
        setSaveSuccess(false)
        
        // Manual save logic
        const content = editor.getHTML()
        localStorage.setItem('juris_draft_content', content)
        
        setTimeout(() => {
            setIsSaving(false)
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 2000)
        }, 800)
    }

    const handleExportPDF = () => {
        window.print()
    }

    const handleExportWord = async () => {
        if (!editor || isSaving) return
        try {
            setIsSaving(true)
            const content = editor.getHTML()
            
            const response = await fetch('/api/draft/export/docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: content })
            })

            if (!response.ok) throw new Error('Export failed')
            
            const docBlob = await response.blob()
            const url = URL.createObjectURL(docBlob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'Legal_Draft_Juris.docx'
            link.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error("Word Export Error:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <header className="h-14 border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-white z-[60]">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {!isFocusMode && (
                    <>
                        <SidebarTrigger className="h-9 w-9 text-slate-400 hover:text-slate-900 transition-colors shrink-0 cursor-pointer" />
                        <div className="h-4 w-[1px] bg-slate-100 shrink-0" />
                    </>
                )}
                <div className="flex flex-col min-w-0">
                    <h2 className="text-[14px] font-bold text-slate-900 truncate flex items-center gap-2">
                        Bail Application
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Drafting</span>
                    </h2>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.15em] truncate">
                        Regular Bail Application u/s 437/439 of CrPC.
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSave}
                    disabled={isSaving}
                    className={cn(
                        "h-10 px-4 gap-2 rounded-xl transition-all duration-300 font-bold text-[12px] uppercase tracking-wider",
                        saveSuccess 
                            ? "bg-slate-900 text-white border-transparent" 
                            : "text-slate-600 hover:bg-slate-50 active:scale-95"
                    )}
                >
                    {saveSuccess ? <Check className="h-4 w-4" /> : <Save className={cn("h-4 w-4", isSaving && "animate-spin")} />}
                    <span>{saveSuccess ? 'Saved' : (isSaving ? 'Saving' : 'Save')}</span>
                </Button>
                
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-10 px-4 gap-2 text-slate-600 hover:bg-slate-50 transition-all rounded-xl font-bold text-[12px] uppercase tracking-wider active:scale-95"
                >
                    <Share className="h-4 w-4" />
                    <span>Share</span>
                </Button>

                <div className="h-4 w-[1px] bg-slate-100 mx-2" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            className="h-10 px-5 gap-2.5 bg-slate-950 hover:bg-black text-white rounded-xl shadow-lg shadow-slate-200 transition-all active:scale-95 font-bold text-[11px] uppercase tracking-widest border-none"
                        >
                            <Rocket className="h-3.5 w-3.5" />
                            <span>Export</span>
                            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl border-slate-100 shadow-2xl bg-white/95 backdrop-blur-md">
                        <DropdownMenuItem onClick={handleExportPDF} className="gap-3 px-3 py-3 cursor-pointer rounded-xl text-slate-600 focus:text-slate-950 focus:bg-slate-50 transition-all border border-transparent focus:border-slate-100 group">
                            <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center group-focus:scale-110 transition-transform">
                                <Download className="h-4 w-4 text-slate-900" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[13px] font-bold">Download PDF</span>
                                <span className="text-[10px] text-slate-400 font-medium">Best for formal filing</span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportWord} className="gap-3 px-3 py-3 cursor-pointer rounded-xl text-slate-600 focus:text-slate-950 focus:bg-slate-50 transition-all border border-transparent focus:border-slate-100 group">
                            <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center group-focus:scale-110 transition-transform">
                                <FileText className="h-4 w-4 text-slate-900" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[13px] font-bold">Download Word</span>
                                <span className="text-[10px] text-slate-400 font-medium">Best for further editing</span>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-[1px] bg-slate-100 mx-2" />

                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onToggleFocus}
                    className={cn(
                        "h-10 w-10 p-0 flex items-center justify-center rounded-xl transition-all duration-300 active:scale-90",
                        isFocusMode 
                            ? "bg-slate-950 text-white shadow-xl shadow-slate-200" 
                            : "text-slate-400 hover:text-slate-900 bg-slate-50/50 hover:bg-slate-100"
                    )}
                    title={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
                >
                    {isFocusMode ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
                </Button>
            </div>
        </header>
    )
}
