"use client";

import * as React from "react";
import {
    MessageSquare,
    Folder,
    Workflow,
    History,
    Library,
    BookOpen,
    HelpCircle,
    Plus,
    Search,
    Layout,
    ChevronDown,
    PanelLeft
} from "lucide-react";
import Link from 'next/link';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
    { title: "Assistant", icon: MessageSquare, active: true },
    {
        title: "Vault",
        icon: Folder,
        items: [
            "Statements (A&W)",
            "Delta Supply",
            "Supply Agreements"
        ]
    },
    { title: "Workflows", icon: Workflow },
    { title: "History", icon: History },
    { title: "Library", icon: Library },
    { title: "Guidance", icon: BookOpen },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" className="border-r border-slate-100 bg-white shadow-sm">
            <SidebarHeader className="px-4 py-4 space-y-4 group-data-[collapsible=icon]:px-2">
                <a href="/" className="flex items-center gap-3 justify-start group-data-[collapsible=icon]:justify-center hover:opacity-80 transition-opacity px-1">
                    <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center text-white font-serif font-bold text-sm uppercase tracking-tighter shrink-0">
                        J
                    </div>
                    <span className="text-xl font-serif font-medium tracking-tight text-slate-900 group-data-[collapsible=icon]:hidden">
                        Juris
                    </span>
                </a>

                <div className="flex items-center justify-between hover:bg-slate-50 px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group group-data-[collapsible=icon]:hidden">
                    <span className="text-[13px] font-semibold text-slate-700">Juris</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>

                <Button
                    className="w-full justify-center gap-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm h-9 px-4 transition-all rounded-lg hover:scale-105 active:scale-95 cursor-pointer"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-[13px] font-medium group-data-[collapsible=icon]:hidden">Create</span>
                </Button>
            </SidebarHeader>

            <SidebarContent className="px-2 mt-2">
                <SidebarMenu className="gap-0.5">
                    {navItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                isActive={item.active}
                                className={`gap-3 py-2 px-3 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${item.active
                                    ? "bg-slate-100 text-slate-900 font-semibold"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <item.icon className={`h-4 w-4 ${item.active ? "text-slate-900" : "text-slate-500"}`} />
                                <span className="text-[13px]">{item.title}</span>
                            </SidebarMenuButton>

                            {item.items && (
                                <div className="ml-9 mt-1 space-y-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                                    {item.items.map((subItem) => (
                                        <div
                                            key={subItem}
                                            className="text-[13px] text-slate-400 hover:text-slate-900 py-1 cursor-pointer transition-all hover:translate-x-1"
                                        >
                                            {subItem}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>

            <SidebarFooter className="p-4 mt-auto">
                <div className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all rounded-lg cursor-pointer hover:scale-[1.02] active:scale-[0.98]">
                    <HelpCircle className="h-4 w-4 text-slate-500" />
                    <span className="text-[13px] font-medium group-data-[collapsible=icon]:hidden">Help</span>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
