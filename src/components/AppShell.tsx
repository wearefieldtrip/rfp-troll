import { ClipboardListIcon, FileTextIcon, LogOutIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const NAV = [
  { to: '/', label: 'RFPs', icon: FileTextIcon, end: true },
  { to: '/rubric', label: 'Rubric', icon: ClipboardListIcon, end: false },
]

export function AppShell() {
  const { user, signOut } = useAuth()
  const name = (user?.user_metadata.full_name as string | undefined) ?? user?.email ?? ''
  const avatar = user?.user_metadata.avatar_url as string | undefined

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 py-3 text-base font-semibold">RFP Buddy</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <SidebarMenuItem key={to}>
                  <NavLink to={to} end={end}>
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive} render={<span />}>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="gap-2">
          <div className="flex items-center gap-2 p-2">
            <Avatar className="size-8">
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{name}</p>
              {user?.email && user.email !== name && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => void signOut()}>
            <LogOutIcon />
            Sign out
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
