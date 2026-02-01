'use client';

import { useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  MessageSquare,
  DollarSign,
  Repeat,
  Calendar,
  ClipboardList,
  FolderOpen,
  FileText,
  MailQuestion,
  ChevronDown,
  User,
  Bell,
  Settings,
  MessageCircleQuestionMark,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import gsap from 'gsap';
import { createClient } from '@/lib/supabase/client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

// Updated URLs - all under /dashboard
const mainItems: NavItem[] = [
  { title: 'Explore', url: '/dashboard', icon: Compass },
  { title: 'Messages', url: '/dashboard/messages', icon: MessageSquare },
  { title: 'Calendar', url: '/dashboard/calendar', icon: Calendar },
  { title: 'Finances', url: '/dashboard/finances', icon: DollarSign },
  { title: 'Lifecycle', url: '/dashboard/lifecycle', icon: Repeat },
];

const documentItems: NavItem[] = [
  { title: 'Questionnaire', url: '/dashboard/questionnaire', icon: ClipboardList },
  { title: 'Files', url: '/dashboard/files', icon: FolderOpen },
  { title: 'Reports', url: '/dashboard/reports', icon: FileText },
  { title: 'Requests', url: '/dashboard/requests', icon: MailQuestion },
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!indicatorRef.current) return;
    
    if (isActive) {
      gsap.to(indicatorRef.current, {
        scaleY: 1,
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
      });
    } else {
      gsap.to(indicatorRef.current, {
        scaleY: 0,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
      });
    }
  }, [isActive]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className="relative group hover:bg-transparent">
        <a 
          ref={linkRef}
          href={item.url} 
          className={`relative flex items-center gap-3 px-2.5 py-2.5 transition-all duration-300 group-data-[collapsible=icon]:justify-center ${
            isActive ? 'text-white' : 'text-sbi-muted hover:text-white'
          }`}
        >
          {/* Active indicator line */}
          <div 
            ref={indicatorRef}
            className="absolute left-1 group-data-[collapsible=icon]:left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-sbi-green origin-center scale-y-0 opacity-0"
          />
          
          {/* Icon with glow effect on active */}
          <div className={`relative transition-all duration-300 ${isActive ? 'text-sbi-green' : ''}`}>
            <item.icon className="size-4" strokeWidth={1.25} />
            {isActive && (
              <div className="absolute inset-0 blur-sm bg-sbi-green/30 rounded-full" />
            )}
          </div>
          
          {/* Label */}
          <span className={`font-extralight tracking-wide text-sm group-data-[collapsible=icon]:hidden ${
            isActive ? 'text-white' : ''
          }`}>
            {item.title}
          </span>
          
          {/* Hover background */}
          <div className="absolute inset-0 bg-sbi-dark-card/0 group-hover:bg-sbi-dark-card/50 transition-colors duration-300 -z-10" />
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  
  const isActive = (url: string) => {
    if (url === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(url);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sbi-dark-border/50 bg-sbi-dark overflow-hidden">
      {/* Header */}
      <SidebarHeader className="h-16 border-b border-sbi-dark-border/50 bg-sbi-dark justify-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-transparent group px-2
                group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon))]
                group-data-[collapsible=icon]:h-12
                group-data-[collapsible=icon]:px-0
                group-data-[collapsible=icon]:gap-0
                group-data-[collapsible=icon]:justify-center"
            >
              <a
                href="/dashboard"
                className="flex items-center gap-3
                  group-data-[collapsible=icon]:gap-0
                  group-data-[collapsible=icon]:justify-center
                  group-data-[collapsible=icon]:w-full"
              >
                {/* Logo mark */}
                <div
                  className="relative flex aspect-square size-7 items-center justify-center shrink-0
                    group-data-[collapsible=icon]:mx-auto
                    group-data-[collapsible=icon]:size-8"
                >
                  {/* Outer ring */}
                  <div
                    className="absolute inset-0 border border-sbi-dark-border group-hover:border-sbi-green/30 transition-colors duration-500 rotate-45"
                    style={{
                      transform: state === 'collapsed' ? 'scale(0.7)' : 'scale(0.9)',
                      transition: 'transform 220ms ease, border-color 500ms ease',
                    }}
                  />
                  {/* Inner content */}
                  <div className="relative flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4 text-sbi-green"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2v20" />
                      <path d="m4.93 4.93 14.14 14.14" />
                    </svg>
                  </div>
                </div>
                {/* Brand name */}
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-extralight tracking-[0.2em] text-white uppercase">SBI</span>
                  <span className="text-[9px] tracking-wider text-sbi-muted-dark uppercase">Client Portal</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="bg-sbi-dark px-2 group-data-[collapsible=icon]:px-0 py-4 overflow-x-hidden">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainItems.map((item) => (
                <NavLink key={item.title} item={item} isActive={isActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Documents Section */}
        <SidebarGroup className="mt-0.5">
          <SidebarGroupLabel className="px-3 text-[9px] tracking-[0.25em] uppercase text-sbi-muted-dark font-extralight mb-2">
            Documents
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {documentItems.map((item) => (
                <NavLink key={item.title} item={item} isActive={isActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer - User Profile */}
      <SidebarFooter className="border-t border-sbi-dark-border/50 bg-sbi-dark p-3 px-3 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className="group hover:bg-sbi-dark-card/50 transition-colors duration-300 w-full px-2
                    group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon))]
                    group-data-[collapsible=icon]:h-12
                    group-data-[collapsible=icon]:px-0
                    group-data-[collapsible=icon]:gap-0
                    group-data-[collapsible=icon]:justify-center
                    data-[state=open]:bg-sbi-dark-card/50"
                >
                  {/* Avatar */}
                  <div
                    className="relative flex size-9 items-center justify-center shrink-0
                      group-data-[collapsible=icon]:size-8"
                  >
                    <div className="absolute inset-0 scale-90 border border-sbi-dark-border group-hover:border-sbi-green/30 transition-colors duration-300" />
                    <span className="text-xs font-extralight text-sbi-green tracking-wider">JD</span>
                  </div>
                  
                  {/* User info */}
                  <div className="flex-1 text-left min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-extralight text-white truncate">John Doe</p>
                    <p className="text-[11px] text-sbi-muted-dark truncate tracking-wide">john@utsbi.com</p>
                  </div>
                  
                  {/* Dropdown indicator */}
                  <ChevronDown
                    className="size-4 text-sbi-muted group-hover:text-sbi-green transition-colors duration-300
                      group-data-[collapsible=icon]:hidden"
                    strokeWidth={1.5}
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-none bg-sbi-dark border border-sbi-dark-border p-0 shadow-xl"
                sideOffset={13}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                    <div className="relative flex size-8 items-center justify-center shrink-0">
                      <div className="absolute inset-0 scale-90 border border-sbi-dark-border" />
                      <span className="text-xs font-extralight text-sbi-green tracking-wider">JD</span>
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-extralight text-white">John Doe</span>
                      <span className="truncate text-xs text-sbi-muted-dark">john@utsbi.com</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-sbi-dark-border/50 my-0" />
                <DropdownMenuItem className="rounded-none focus:bg-sbi-dark-card/50 focus:text-white text-sbi-muted font-extralight cursor-pointer group py-2.5">
                  <User className="mr-2 size-4 group-hover:text-sbi-green transition-colors" strokeWidth={1.5} />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-none focus:bg-sbi-dark-card/50 focus:text-white text-sbi-muted font-extralight cursor-pointer group py-2.5">
                  <Bell className="mr-2 size-4 group-hover:text-sbi-green transition-colors" strokeWidth={1.5} />
                  Notifications
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-none focus:bg-sbi-dark-card/50 focus:text-white text-sbi-muted font-extralight cursor-pointer group py-2.5">
                  <Settings className="mr-2 size-4 group-hover:text-sbi-green transition-colors" strokeWidth={1.5} />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-none focus:bg-sbi-dark-card/50 focus:text-white text-sbi-muted font-extralight cursor-pointer group py-2.5">
                  <MessageCircleQuestionMark className="mr-2 size-4 group-hover:text-sbi-green transition-colors" strokeWidth={1.5} />
                  Help
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-sbi-dark-border/50 my-0" />
                <DropdownMenuItem 
                  className="rounded-none focus:bg-sbi-dark-card/50 focus:text-white text-sbi-muted font-extralight cursor-pointer group py-2.5"
                  onSelect={handleLogout}
                >
                  <LogOut className="mr-2 size-4 group-hover:text-sbi-green transition-colors" strokeWidth={1.5} />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}