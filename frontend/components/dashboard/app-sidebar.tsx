'use client';

import * as React from 'react';
import {
  Compass,
  MessageSquare,
  DollarSign,
  Repeat,
  Calendar,
  ClipboardList,
  FolderOpen,
  FileText,
  MailQuestionMark,
  ChevronDown,
} from 'lucide-react';

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
} from '@/components/ui/sidebar';

// Menu items
const mainItems = [
  {
    title: 'Explore',
    url: '/dashboard',
    icon: Compass,
  },
  {
    title: 'Message',
    url: '/dashboard/message',
    icon: MessageSquare,
  },
  {
    title: 'Finances',
    url: '/dashboard/finances',
    icon: DollarSign,
  },
  {
    title: 'Lifecycle',
    url: '/dashboard/lifecycle',
    icon: Repeat,
  },
  {
    title: 'Calendar',
    url: '/dashboard/calendar',
    icon: Calendar,
  },
  {
    title: 'Questionnaire',
    url: '/questionnaire',
    icon: ClipboardList,
  },
];

const documentItems = [
  {
    title: 'Files',
    url: '/dashboard/files',
    icon: FolderOpen,
  },
  {
    title: 'Reports',
    url: '/dashboard/reports',
    icon: FileText,
  },
  {
    title: 'Requests',
    url: '/dashboard/requests',
    icon: MailQuestionMark,
  },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r border-zinc-800 bg-zinc-900">
      <SidebarHeader className="border-b border-zinc-800 bg-zinc-900">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-zinc-800">
              <a href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-zinc-800 text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2v20" />
                    <path d="m4.93 4.93 14.14 14.14" />
                  </svg>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-zinc-300">UTSBI</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="bg-zinc-900">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="hover:bg-zinc-800 text-zinc-300 hover:text-white data-[active=true]:bg-zinc-800">
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Documents Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-zinc-500">Documents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {documentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="hover:bg-zinc-800 text-zinc-300 hover:text-white data-[active=true]:bg-zinc-800">
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-zinc-800 bg-zinc-900">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="hover:bg-zinc-800 data-[state=open]:bg-zinc-800">
              <div className="flex size-8 items-center justify-center rounded-full bg-zinc-800">
                <span className="text-sm font-semibold text-zinc-300">JD</span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-zinc-300">John Doe</span>
                <span className="truncate text-xs text-zinc-500">john@utsbi.com</span>
              </div>
              <ChevronDown className="ml-auto size-4 text-zinc-400" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
