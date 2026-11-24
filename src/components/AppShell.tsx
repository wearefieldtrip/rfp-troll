import { LogOutIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { RubricDialog } from '@/components/RubricDialog'
import { Button } from '@/components/ui/button'

export function AppShell() {
  const { user, signOut } = useAuth()
  const name = (user?.user_metadata.full_name as string | undefined) ?? user?.email ?? ''
  const [rubricOpen, setRubricOpen] = useState(false)
  const avatar = user?.user_metadata.avatar_url as string | undefined

  return (
    <div className="min-h-svh">
      <header className="flex h-14 items-center gap-3 border-b px-8">
        <Link to="/" className="text-base font-semibold">
          RFP Troll
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setRubricOpen(true)}>
            Rubric
          </Button>
          <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">{name}</span>
          <Avatar className="size-7">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signOut()}>
            <LogOutIcon />
          </Button>
        </div>
      </header>
      <RubricDialog open={rubricOpen} onOpenChange={setRubricOpen} />
      <main className="px-8 py-10">
        <Outlet />
      </main>
    </div>
  )
}
