"use client";

import * as React from "react";
import {
  MessageSquare,
  FileSignature,
  Folder,
  History,
  HelpCircle,
  Plus,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  Settings,
  CreditCard,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface VaultItem {
  id: string;
  name: string;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [vaults, setVaults] = React.useState<VaultItem[]>([]);
  const [vaultOpen, setVaultOpen] = React.useState(true);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null);
        // Fetch actual user profile
        try {
          const res = await fetch("/api/profile");
          const data = await res.json();
          if (data.profile) {
            setUserName(data.profile.fullName);
          }
        } catch {}
      }
    });

    fetch("/api/vaults")
      .then((r) => r.json())
      .then((data) => {
        if (data.vaults) {
          setVaults(
            data.vaults.map((v: any) => ({ id: v.id, name: v.name }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };
  
  const navItems = [
    { title: "Assistant", icon: MessageSquare, href: "/" },
    { title: "Draft", icon: FileSignature, href: "/draft" },
    { title: "Vault", icon: Folder, href: "/vault" },
    { title: "History", icon: History, href: "/history" },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-slate-100 bg-white shadow-sm"
    >
      <SidebarHeader className="px-4 py-4 space-y-4 group-data-[collapsible=icon]:px-2">
        <Link
          href="/"
          className="flex items-center gap-3 justify-start group-data-[collapsible=icon]:justify-center hover:opacity-80 transition-opacity px-1"
        >
          <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center text-white font-serif font-bold text-sm uppercase tracking-tighter shrink-0">
            J
          </div>
          <span className="text-xl font-serif font-medium tracking-tight text-slate-900 group-data-[collapsible=icon]:hidden">
            Juris
          </span>
        </Link>

        <div className="flex items-center justify-between hover:bg-slate-50 px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group group-data-[collapsible=icon]:hidden">
          <span className="text-[13px] font-semibold text-slate-700">
            Juris
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </div>

        <Link href="/vault">
          <Button className="w-full justify-center gap-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm h-9 px-4 transition-all rounded-lg hover:scale-105 active:scale-95 cursor-pointer">
            <Plus className="h-3.5 w-3.5" />
            <span className="text-[13px] font-medium group-data-[collapsible=icon]:hidden">
              Create
            </span>
          </Button>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 mt-2">
        <SidebarMenu className="gap-0.5">
          {navItems.map((item) => {
            const active = item.href ? isActive(item.href) : false;
            const isVault = item.title === "Vault";

            return (
              <SidebarMenuItem key={item.title}>
                {isVault ? (
                  /* Vault item: clickable label + collapsible chevron */
                  <>
                    <div
                      className={`peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                        active
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <Link
                        href="/vault"
                        className="flex items-center gap-3 flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <item.icon
                          className={`h-4 w-4 shrink-0 ${
                            active ? "text-slate-900" : "text-slate-500"
                          }`}
                        />
                        <span className="text-[13px] truncate">
                          {item.title}
                        </span>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVaultOpen(!vaultOpen);
                        }}
                        className="shrink-0 p-0.5 rounded hover:bg-slate-200/50 transition-colors"
                      >
                        <ChevronRight
                          className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
                            vaultOpen ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                    </div>

                    {vaultOpen && vaults.length > 0 && (
                      <div className="ml-9 mt-1 space-y-0.5 overflow-hidden group-data-[collapsible=icon]:hidden">
                        {vaults.map((vault) => (
                          <Link
                            key={vault.id}
                            href={`/vault/${vault.id}`}
                            className={`block text-[13px] py-1.5 px-2 rounded-md cursor-pointer transition-all hover:translate-x-1 ${
                              pathname === `/vault/${vault.id}`
                                ? "text-slate-900 font-medium bg-slate-50"
                                : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            {vault.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* All other items: use SidebarMenuButton with render prop for <Link> */
                  <SidebarMenuButton
                    isActive={active}
                    render={<Link href={item.href || "#"} />}
                    className={`gap-3 py-2 px-3 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                      active
                        ? "bg-slate-100 text-slate-900 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${
                        active ? "text-slate-900" : "text-slate-500"
                      }`}
                    />
                    <span className="text-[13px]">{item.title}</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 mt-auto space-y-2 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all rounded-lg cursor-pointer">
          <HelpCircle className="h-4 w-4 text-slate-500" />
          <span className="text-[13px] font-medium group-data-[collapsible=icon]:hidden">
            Help & Support
          </span>
        </div>

        {userEmail && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer transition-all group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:justify-center">
                <div className="flex items-center gap-3 flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <div className="h-7 w-7 rounded-full bg-slate-900 flex items-center justify-center shrink-0 shadow-sm border border-slate-200">
                    <User className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
<span className="text-[12px] font-bold text-slate-900 truncate tracking-tight">
                  {userName || userEmail?.split('@')[0]}
                </span>
                <span className="text-[10px] text-slate-400 truncate uppercase tracking-widest font-bold">
                  Professional
                </span>
                  </div>
                </div>
                {/* Mobile/Icon mode avatar */}
                <div className="hidden group-data-[collapsible=icon]:flex h-8 w-8 rounded-full bg-slate-900 items-center justify-center shadow-sm border border-slate-200">
                  <User className="h-4 w-4 text-white" />
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-data-[collapsible=icon]:hidden" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-56 rounded-xl shadow-xl border-slate-100 p-1">
              <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Account</DropdownMenuLabel>
<DropdownMenuItem
                    onClick={() => router.push("/profile")}
                    className="gap-2 px-2 py-2 rounded-lg cursor-pointer focus:bg-slate-50 transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium">Profile</span>
                  </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 px-2 py-2 rounded-lg cursor-pointer focus:bg-slate-50 transition-colors">
                <Settings className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium">Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 px-2 py-2 rounded-lg cursor-pointer focus:bg-slate-50 transition-colors text-slate-400">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">Billing</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-50 my-1" />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="gap-2 px-2 py-2 rounded-lg cursor-pointer focus:bg-red-50 text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-bold">Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
