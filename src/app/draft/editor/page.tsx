"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { EditorHeader } from "@/components/editor/EditorHeader"
import { EditorLeftSidebar } from "@/components/editor/EditorLeftSidebar"
import { EditorRightSidebar } from "@/components/editor/EditorRightSidebar"
import { EditorMain } from "@/components/editor/EditorMain"

import { cn } from "@/lib/utils"
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function EditorPage() {
    const [isFocusMode, setIsFocusMode] = React.useState(false)
    const [editor, setEditor] = React.useState<any>(null)
    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
    const [newFieldLabel, setNewFieldLabel] = React.useState("")
    const [error, setError] = React.useState("")

    const [variables, setVariables] = React.useState([
        { label: "Applicant Name", value: "Rajesh Kumar", key: "applicant" },
        { label: "Father's Name", value: "", key: "father", placeholder: "[Father's Name Missing]" },
        { label: "Address", value: "", key: "address", placeholder: "[Address Missing]" },
        { label: "Respondent", value: "State of Haryana", key: "respondent" },
        { label: "FIR Number", value: "402/2024", key: "fir" },
    ])

    const handleAddField = () => {
        setIsAddModalOpen(true)
        setError("")
        setNewFieldLabel("")
    }

    const handleConfirmAddField = (e: React.FormEvent) => {
        e.preventDefault()
        const label = newFieldLabel.trim()
        if (!label) return

        const key = label.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        if (variables.some(v => v.key === key)) {
            setError("A field with a similar name already exists.")
            return
        }

        setVariables(prev => [...prev, { 
            label, 
            value: '', 
            key, 
            placeholder: `Enter ${label}...` 
        }])
        setIsAddModalOpen(false)
        setNewFieldLabel("")
    }

    const handleInsertVariable = (key: string, label: string) => {
        if (!editor) return
        editor.commands.insertVariable({ key, label })
    }

    return (
        <div className="flex h-screen w-full bg-white overflow-hidden relative font-sans">
            <AppSidebar />
            
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <EditorHeader 
                    onToggleFocus={() => setIsFocusMode(!isFocusMode)} 
                    isFocusMode={isFocusMode} 
                    editor={editor}
                />
                
                <div id="editor-container" className="flex-1 flex overflow-hidden relative">
                    {!isFocusMode && <EditorLeftSidebar editor={editor} />}
                    <EditorMain 
                        onEditorReady={setEditor} 
                        variables={variables}
                    />
                    {!isFocusMode && (
                        <EditorRightSidebar 
                            variables={variables} 
                            setVariables={setVariables}
                            editor={editor}
                            onAddField={handleAddField}
                            onInsertVariable={handleInsertVariable}
                        />
                    )}
                </div>
            </main>

            {/* Premium Add Field Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleConfirmAddField}>
                        <DialogHeader>
                            <DialogTitle className="text-xl font-serif tracking-tight">Add Document Field</DialogTitle>
                            <DialogDescription className="text-slate-500 font-sans tracking-tight pt-1">
                                Create a new dynamic field that will sync across your entire legal draft.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                                    Field Label
                                </label>
                                <Input 
                                    autoFocus
                                    placeholder="e.g. Judge Name, Case Number..."
                                    value={newFieldLabel}
                                    onChange={(e) => {
                                        setNewFieldLabel(e.target.value)
                                        setError("")
                                    }}
                                    className="h-12 bg-slate-50 border-slate-100 rounded-xl px-4 text-[14px] font-medium transition-all focus:bg-white focus:border-slate-200 focus:ring-0 placeholder:text-slate-300"
                                />
                                {error && (
                                    <p className="text-[11px] font-bold text-rose-500 pl-1 uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                                        {error}
                                    </p>
                                )}
                            </div>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => setIsAddModalOpen(false)}
                                className="font-bold text-[11px] uppercase tracking-widest text-slate-400 hover:text-slate-900 h-11 px-6 rounded-xl cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit"
                                disabled={!newFieldLabel.trim()}
                                className="bg-slate-900 border-none text-white font-bold text-[11px] uppercase tracking-widest h-11 px-8 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                Create Field
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
