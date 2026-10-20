import { Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AppShell() {
  const { user, signOut } = useAuth()
  const name = (user?.user_metadata.full_name as string | undefined) ?? user?.email ?? ''
  const avatar = user?.user_metadata.avatar_url as string | undefined

  return (
    <div className="min-h-svh">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <span className="font-semibold">RFP Buddy</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none">
            <Avatar>
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
