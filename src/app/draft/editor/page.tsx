"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { EditorHeader } from "@/components/editor/EditorHeader"
import { EditorLeftSidebar } from "@/components/editor/EditorLeftSidebar"
import { EditorRightSidebar } from "@/components/editor/EditorRightSidebar"
import { EditorMain } from "@/components/editor/EditorMain"
import { LegalContextDialog, LegalContextData } from "@/components/legal/LegalContextDialog"

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
    const [isDialogOpen, setIsDialogOpen] = React.useState(false)
    const [activeReference, setActiveReference] = React.useState<LegalContextData | null>(null)

    const [variables, setVariables] = React.useState<any[]>([])

    // Sync variables from document on mount or when a new draft is generated
    React.useEffect(() => {
        const generated = localStorage.getItem('juris_generated_draft');
        const content = generated || localStorage.getItem('juris_draft_content');

        if (content) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            const spans = doc.querySelectorAll('span[data-variable-key]');
            
            const detectedVars: any[] = [];
            const seenKeys = new Set();

            spans.forEach(span => {
                const key = span.getAttribute('data-variable-key');
                if (key && !seenKeys.has(key)) {
                    seenKeys.add(key);
                    const label = key
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                    
                    detectedVars.push({
                        label,
                        key,
                        value: span.textContent || "",
                        placeholder: `Enter ${label}...`
                    });
                }
            });

            if (detectedVars.length > 0) {
                setVariables(detectedVars);
            } else if (variables.length === 0) {
                // Fallback to defaults if no markup found and empty state
                setVariables([
                    { label: "Applicant Name", value: "Rajesh Kumar", key: "applicant" },
                    { label: "Respondent", value: "State of Haryana", key: "respondent" },
                    { label: "FIR Number", value: "402/2024", key: "fir" },
                ]);
            }

            // Cleanup so we don't re-extract on every refresh if not needed
            if (generated) {
                localStorage.removeItem('juris_generated_draft');
            }
        }
    }, []);

    // Global sync function for the editor to call when content changes
    React.useEffect(() => {
        (window as any).syncJurisVariables = (currentVars: Record<string, string>) => {
            setVariables(prev => {
                const seenKeys = new Set(prev.map(v => v.key));
                let changed = false;
                
                // Update existing
                const next = prev.map(v => {
                    if (currentVars[v.key] !== undefined && currentVars[v.key] !== v.value) {
                        changed = true;
                        return { ...v, value: currentVars[v.key] };
                    }
                    return v;
                });

                // Add new ones discovered in document
                const toAdd: any[] = [];
                Object.entries(currentVars).forEach(([key, value]) => {
                    if (!seenKeys.has(key)) {
                        changed = true;
                        const label = key
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                        
                        toAdd.push({
                            label,
                            key,
                            value,
                            placeholder: `Enter ${label}...`
                        });
                    }
                });

                return changed ? [...next, ...toAdd] : prev;
            });
        };
        return () => {
            delete (window as any).syncJurisVariables;
        };
    }, []);

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

    const handleReferenceClick = (type: 'statute' | 'precedent', name: string) => {
        const researchRaw = localStorage.getItem('juris_draft_research');
        const research = researchRaw ? JSON.parse(researchRaw) : {};
        let found: any = null;
        
        if (type === 'precedent') {
            found = (research.precedents || []).find((p: any) => 
                (p.caseName || p.title || "").toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes((p.caseName || p.title || "").toLowerCase())
            );
        } else {
            found = (research.statutes || []).find((s: any) => 
                (s.retrievedContext?.title || "").toLowerCase().includes(name.toLowerCase()) ||
                (s.retrievedContext?.text || "").toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes((s.retrievedContext?.title || "").toLowerCase())
            );
        }

        if (found) {
            setActiveReference({
                sourceType: type,
                retrievedContext: type === 'precedent' ? {
                    title: found.caseName || found.title,
                    text: found.summary || found.snippet || "",
                    citation: found.citation,
                    court: found.court,
                    year: found.year,
                    pdfUrl: found.pdfUrl
                } : found.retrievedContext
            });
        } else {
            // Fallback for manually added or unrecognized items
            setActiveReference({
                sourceType: type,
                retrievedContext: {
                    title: name,
                    text: `Official details for ${name}. Click below to see the full legal source.`,
                }
            });
        }
        setIsDialogOpen(true);
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
                    {!isFocusMode && (
                        <EditorLeftSidebar 
                            editor={editor} 
                            variables={variables} 
                            onReferenceClick={handleReferenceClick}
                        />
                    )}
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

            <LegalContextDialog 
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                data={activeReference}
                isMobile={false}
            />
        </div>
    )
}
