import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

export const ALLOWED_DOMAINS = ['wearefieldtrip.com', 'hellofieldtrip.com']

const isAllowedEmail = (email?: string) =>
  !!email && ALLOWED_DOMAINS.includes(email.split('@')[1]?.toLowerCase())

type AuthState = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  // Defense in depth: the database already rejects other domains on sign-up.
  const user = isAllowedEmail(session?.user.email) ? session!.user : null

  useEffect(() => {
    if (session && !user) void supabase.auth.signOut()
  }, [session, user])

  const value: AuthState = {
    user,
    loading,
    signInWithGoogle: async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          // Hint only; the real enforcement is the database trigger.
          queryParams: { prompt: 'select_account' },
        },
      })
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
