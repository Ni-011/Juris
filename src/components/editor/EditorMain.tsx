"use client"

import * as React from "react"
import { 
    useEditor, 
    EditorContent,
    mergeAttributes 
} from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import { 
    Heading1, Heading2, Heading3, Bold, Italic, Underline as UnderlineIcon, 
    Strikethrough, List, ListOrdered, 
    SeparatorHorizontal, AlignLeft, AlignCenter, AlignRight, 
    Link, Image, Sparkles, Send, Type, Wand2, Zap,
    Undo, Redo, Quote, Code, MoreHorizontal, Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { Node } from '@tiptap/core'

const VariableNode = Node.create({
    name: 'variable',
    group: 'inline',
    content: 'text*',
    inline: true,
    selectable: true,
    atom: false,

    addAttributes() {
        return {
            key: {
                default: null,
                parseHTML: element => element.getAttribute('data-variable-key'),
                renderHTML: attributes => ({
                    'data-variable-key': attributes.key,
                }),
            },
            url: {
                default: null,
                parseHTML: element => element.getAttribute('data-url'),
                renderHTML: attributes => ({
                    'data-url': attributes.url,
                }),
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-variable-key]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 
            class: 'bg-slate-100/80 text-slate-900 px-1.5 rounded-sm border-b border-slate-200/60 font-bold mx-0.5 inline-flex items-center hover:bg-slate-200/50 transition-all cursor-pointer citation-link',
        }), 0]
    },

    addCommands() {
        return {
            insertVariable: (attrs: any) => ({ chain }: any) => {
                return chain()
                    .insertContent({
                        type: this.name,
                        attrs,
                        content: [
                            {
                                type: 'text',
                                text: attrs.label || `[${attrs.key}]`,
                            },
                        ],
                    })
                    .run()
            },
        } as any
    },
})

interface Tool {
    icon: any;
    label: string;
    command: (editor: any) => void;
    active?: string | object;
    level?: number;
}

const initialContent = `
    <h1 style="text-align: center">IN THE COURT OF SESSIONS AT GURUGRAM, HARYANA</h1>
    <p style="text-align: center"><strong>BAIL APPLICATION NO. ________ OF 2024</strong></p>
    <br/>
    <p><strong>IN THE MATTER OF:</strong></p>
    <p><span data-variable-key="applicant"><strong>Rajesh Kumar</strong></span> ...Applicant/Accused</p>
    <p style="text-align: center"><strong>VERSUS</strong></p>
    <p><strong>State of Haryana</strong> ...Respondent</p>
    <br/>
    <h2 style="text-align: center">APPLICATION UNDER SECTION 482 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 FOR GRANT OF REGULAR BAIL</h2>
    <br/>
    <p><strong>MOST RESPECTFULLY SHOWETH:</strong></p>
    
    <h2>I. BACKGROUND AND ARREST DETAILS</h2>
    <p>1. That the Applicant/Accused is a law-abiding citizen of India, presently residing at <span data-variable-key="address">[Address Missing]</span>. The Applicant has been falsely implicated in FIR No. <span data-variable-key="fir">402/2024</span> dated 15.03.2024, registered at Police Station Sector 18, Gurugram.</p>
    <p>2. That the offences alleged against the Applicant are under Sections 420, 467, and 468 of the Indian Penal Code, 1860. It is pertinent to note that the investigation is ongoing and the Applicant was arrested on <span data-variable-key="arrest_date">20.03.2024</span>.</p>

    <h2>II. COMPLIANCE WITH THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023</h2>
    <p>3. That the present application is being preferred under the provisions of the <strong>Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)</strong>, which has come into force on 1st July, 2024, specifically focusing on the safeguards provided to the accused during the trial stage.</p>
    <p>4. That in terms of <strong>Section 480 of the BNSS</strong>, the Applicant submits that the continued incarceration is no longer required for the purpose of investigation, as the entire case is based on documentary evidence that is already under the custody of the Investigating Officer.</p>

    <h2>III. GROUNDS FOR GRANT OF BAIL</h2>
    <p>5. <strong>Non-Flight Risk</strong>: The Applicant has deep roots in society and has a family to support. There is no possibility of the Applicant absconding or fleeing from the hands of justice.</p>
    <p>6. <strong>No Evidence Tampering</strong>: All materials relevant to the FIR are documentary in nature. There is no apprehension that the Applicant will tamper with the evidence or influence the witnesses.</p>
    <p>7. <strong>Cooperation with Investigation</strong>: The Applicant has consistently cooperated with the investigating agency and is willing to abide by any conditions imposed by this Hon'ble Court.</p>

    <h2>IV. PRAYER</h2>
    <p>In the light of the abovementioned facts and circumstances, it is most respectfully prayed that this Hon'ble Court may be pleased to:</p>
    <p>(a) Grant regular bail to the Applicant/Accused in FIR No. <span data-variable-key="fir">402/2024</span> registered at Police Station Sector 18, Gurugram.</p>
    <p>(b) Pass any other order which this Hon'ble Court may deem fit and proper in the interest of justice.</p>
    <br/>
    <p style="text-align: right"><strong>APPLICANT</strong></p>
    <p style="text-align: right">Through: Counsel</p>
`

const toolbarGroups = [
    {
        name: 'headings',
        tools: [
            { icon: Heading1, label: 'H1', command: (e: any) => e.chain().focus().toggleHeading({ level: 1 }).run(), active: 'heading', level: 1 },
            { icon: Heading2, label: 'H2', command: (e: any) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: 'heading', level: 2 },
            { icon: Heading3, label: 'H3', command: (e: any) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: 'heading', level: 3 },
        ]
    },
    {
        name: 'basic',
        tools: [
            { icon: Bold, label: 'Bold', command: (e: any) => e.chain().focus().toggleBold().run(), active: 'bold' },
            { icon: Italic, label: 'Italic', command: (e: any) => e.chain().focus().toggleItalic().run(), active: 'italic' },
            { icon: Underline, label: 'Underline', command: (e: any) => e.chain().focus().toggleUnderline().run(), active: 'underline' },
            { icon: Strikethrough, label: 'Strikethrough', command: (e: any) => e.chain().focus().toggleStrike().run(), active: 'strike' },
        ]
    },
    {
        name: 'lists',
        tools: [
            { icon: List, label: 'Bullet List', command: (e: any) => e.chain().focus().toggleBulletList().run(), active: 'bulletList' },
            { icon: ListOrdered, label: 'Ordered List', command: (e: any) => e.chain().focus().toggleOrderedList().run(), active: 'orderedList' },
            { icon: SeparatorHorizontal, label: 'Divider', command: (e: any) => e.chain().focus().setHorizontalRule().run() },
        ]
    },
    {
        name: 'align',
        tools: [
            { icon: AlignLeft, label: 'Left', command: (e: any) => e.chain().focus().setTextAlign('left').run(), active: { textAlign: 'left' } },
            { icon: AlignCenter, label: 'Center', command: (e: any) => e.chain().focus().setTextAlign('center').run(), active: { textAlign: 'center' } },
            { icon: AlignRight, label: 'Right', command: (e: any) => e.chain().focus().setTextAlign('right').run(), active: { textAlign: 'right' } },
        ]
    }
]

export function EditorMain({ 
    onEditorReady, 
    variables 
}: { 
    onEditorReady: (editor: any) => void,
    variables: any[]
}) {
    const [aiInput, setAiInput] = React.useState("")
    const [isTyping, setIsTyping] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)

    const toolbarGroups = [
        {
            tools: [
                { icon: Undo, label: "Undo", command: (editor: any) => editor.chain().focus().undo().run() },
                { icon: Redo, label: "Redo", command: (editor: any) => editor.chain().focus().redo().run() },
            ]
        },
        {
            tools: [
                { icon: Heading1, label: "Title", active: 'heading', level: 1, command: (editor: any) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
                { icon: Heading2, label: "Heading", active: 'heading', level: 2, command: (editor: any) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
            ]
        },
        {
            tools: [
                { icon: Bold, label: "Bold", active: 'bold', command: (editor: any) => editor.chain().focus().toggleBold().run() },
                { icon: Italic, label: "Italic", active: 'italic', command: (editor: any) => editor.chain().focus().toggleItalic().run() },
                { icon: UnderlineIcon, label: "Underline", active: 'underline', command: (editor: any) => editor.chain().focus().toggleUnderline().run() },
            ]
        },
        {
            tools: [
                { icon: List, label: "Bullet List", active: 'bulletList', command: (editor: any) => editor.chain().focus().toggleBulletList().run() },
                { icon: ListOrdered, label: "Ordered List", active: 'orderedList', command: (editor: any) => editor.chain().focus().toggleOrderedList().run() },
            ]
        },
        {
            tools: [
                { icon: AlignLeft, label: "Align Left", active: { textAlign: 'left' }, command: (editor: any) => editor.chain().focus().setTextAlign('left').run() },
                { icon: AlignCenter, label: "Align Center", active: { textAlign: 'center' }, command: (editor: any) => editor.chain().focus().setTextAlign('center').run() },
                { icon: AlignRight, label: "Align Right", active: { textAlign: 'right' }, command: (editor: any) => editor.chain().focus().setTextAlign('right').run() },
            ]
        }
    ]

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {
                    HTMLAttributes: {
                        class: 'scroll-mt-20',
                    },
                },
            }),
            VariableNode,
            CharacterCount,
            BubbleMenuExtension,
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: initialContent,
        editorProps: {
            attributes: {
                class: 'outline-none min-h-full prose-premium whitespace-pre-wrap break-words',
            },
            handleClick(view, pos, event) {
                const target = event.target as HTMLElement
                const variableSpan = target.closest('span[data-variable-key]')
                
                if (variableSpan) {
                    const url = variableSpan.getAttribute('data-url')
                    const key = variableSpan.getAttribute('data-variable-key')
                    if (url) {
                        window.open(url, '_blank')
                    } else {
                        // Fallback to Indian Kanoon search for the cited text
                        const query = variableSpan.textContent || key
                        window.open(`https://indiankanoon.org/search/?formInput=${encodeURIComponent(query || "Indian Law")}`, '_blank')
                    }
                    return true
                }
                return false
            }
        },
        onUpdate: ({ editor }) => {
            localStorage.setItem('juris_draft_content', editor.getHTML())
        }
    })

    React.useEffect(() => {
        if (editor) {
            onEditorReady(editor)
        }
    }, [editor, onEditorReady])

    const handleAIAction = async (prompt: string, selectionOnly = false) => {
        if (!editor || isTyping) return
        
        setIsTyping(true)
        const selection = editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            ' '
        )
        const fullDocument = editor.getHTML()

        try {
            const response = await fetch('/api/draft/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    selection: selectionOnly ? selection : (selection || "the selected section"),
                    fullDocument
                })
            })

            const data = await response.json()
            if (data.result) {
                if (selection) {
                    editor.chain().focus().insertContent(data.result).run()
                } else {
                    // If no selection, just append or alert
                    console.log("AI Result:", data.result)
                    editor.chain().focus().insertContent(`<p>${data.result}</p>`).run()
                }
            }
        } catch (error) {
            console.error("AI Error:", error)
        } finally {
            setIsTyping(false)
            setAiInput("")
        }
    }

    if (!editor) return null

    return (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative font-sans">
            {/* Toolbar Strip */}
            <div className="h-11 border-b border-slate-100 flex items-center px-3 gap-1 bg-white shrink-0 z-10">
                <div className="flex items-center gap-0.5">
                    {toolbarGroups.map((group, i) => (
                        <React.Fragment key={i}>
                            <div className="flex items-center gap-0">
                                {group.tools.map((tool: any, j: number) => {
                                    const isActive = tool.active ? editor.isActive(tool.active, tool.level ? { level: tool.level } : {}) : false
                                    return (
                                        <button 
                                            key={j}
                                            onClick={() => tool.command(editor)}
                                            title={tool.label}
                                            className={cn(
                                                "h-7 w-7 flex items-center justify-center rounded-md transition-colors cursor-pointer border-none",
                                                isActive 
                                                    ? "bg-slate-900 text-white" 
                                                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                                            )}
                                        >
                                            <tool.icon className="h-3.5 w-3.5" />
                                        </button>
                                    )
                                })}
                            </div>
                            {i < toolbarGroups.length - 1 && (
                                <div className="h-4 w-px bg-slate-100 mx-1.5" />
                            )}
                        </React.Fragment>
                    ))}
                </div>
                <div className="ml-auto text-[10px] text-slate-400 tabular-nums pr-1">
                    {editor.storage.characterCount?.characters() || 0} chars
                </div>
            </div>

            {/* Document Canvas */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-12 sm:py-16 custom-scrollbar bg-slate-50/80">
                <div className="w-full max-w-[816px] min-h-[1056px] mx-auto px-[72px] py-[96px] md:px-[96px] md:py-[96px] relative canvas-paper box-border">
                    
                    <BubbleMenu editor={editor} updateDelay={100} className="flex items-center gap-0.5 bg-slate-900/95 text-white p-1 rounded-xl shadow-2xl border border-white/10 backdrop-blur-md">
                        <button 
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={cn("h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 border-none cursor-pointer", editor.isActive('bold') ? "text-sky-400" : "text-white")}
                        >
                            <Bold className="h-3.5 w-3.5" />
                        </button>
                        <button 
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={cn("h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 border-none cursor-pointer", editor.isActive('italic') ? "text-sky-400" : "text-white")}
                        >
                            <Italic className="h-3.5 w-3.5" />
                        </button>
                        <button 
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            className={cn("h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 border-none cursor-pointer", editor.isActive('underline') ? "text-sky-400" : "text-white")}
                        >
                            <UnderlineIcon className="h-3.5 w-3.5" />
                        </button>
                        
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        
                        <button 
                            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                            className={cn("h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 border-none cursor-pointer", editor.isActive('heading', { level: 1 }) ? "text-sky-400" : "text-white")}
                        >
                            <Heading1 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                            className={cn("h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 border-none cursor-pointer", editor.isActive('heading', { level: 2 }) ? "text-sky-400" : "text-white")}
                        >
                            <Heading2 className="h-3.5 w-3.5" />
                        </button>
 
                        <div className="w-px h-4 bg-white/10 mx-1" />
 
                        <button 
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            className={cn("h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 border-none cursor-pointer", editor.isActive('bulletList') ? "text-sky-400" : "text-white")}
                        >
                            <List className="h-3.5 w-3.5" />
                        </button>
                        <button 
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            className={cn("h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 border-none cursor-pointer", editor.isActive('orderedList') ? "text-sky-400" : "text-white")}
                        >
                            <ListOrdered className="h-3.5 w-3.5" />
                        </button>
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        <button 
                            onClick={() => editor.chain().focus().toggleBlockquote().run()}
                            className={cn("h-8 w-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 border-none cursor-pointer", editor.isActive('blockquote') ? "text-sky-400" : "text-white")}
                        >
                            <Quote className="h-3.5 w-3.5" />
                        </button>
                    </BubbleMenu>
 
                    <EditorContent 
                        editor={editor} 
                        className="text-slate-900 font-serif text-[14.5px] leading-[1.85] max-w-full selection:bg-sky-100/60" 
                    />
                </div>
            </div>

            {/* AI Command Bar */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-[560px] px-6 z-40">
                <div className={cn(
                    "bg-white border rounded-xl shadow-xl transition-all duration-300 overflow-hidden",
                    isFocused ? "border-slate-950 shadow-slate-200" : "border-slate-200"
                )}>
                    <form 
                        onSubmit={(e) => {
                            e.preventDefault()
                            handleAIAction(aiInput)
                        }}
                        className="flex items-center gap-3 px-4 py-1"
                    >
                        <input 
                            type="text" 
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            disabled={isTyping}
                            className="flex-1 bg-transparent border-none outline-none text-[13px] text-slate-800 py-3 placeholder:text-slate-400 disabled:cursor-not-allowed font-medium"
                            placeholder={isTyping ? "Juris is thinking..." : "Ask Juris to edit, add a clause, or rewrite..."}
                        />
                        <button 
                            type="submit"
                            disabled={isTyping || !aiInput.trim()}
                            className="h-8 w-8 bg-slate-950 hover:bg-black text-white rounded-lg shrink-0 transition-all disabled:opacity-30 cursor-pointer flex items-center justify-center shadow-lg active:scale-95"
                        >
                            <Send className="h-3.5 w-3.5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
