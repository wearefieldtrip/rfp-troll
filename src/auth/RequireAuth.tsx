import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { clearReturnTo, peekReturnTo, saveReturnTo } from '@/lib/return-to'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const here = location.pathname + location.search + location.hash
  const saved = user ? peekReturnTo() : null

  // Arriving at the page that was asked for ends the trip.
  useEffect(() => {
    if (user && saved === here) clearReturnTo()
  }, [user, saved, here])

  if (loading) return null
  if (!user) {
    // Remember where they were going; the sign-in leaves the app and comes back to the home address.
    saveReturnTo(here)
    return <Navigate to="/login" replace />
  }
  // Just signed in: continue to the page they asked for.
  if (saved && saved !== here) return <Navigate to={saved} replace />
  return <Outlet />
}
