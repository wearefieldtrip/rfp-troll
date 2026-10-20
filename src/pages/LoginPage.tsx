import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  if (!loading && user) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>RFP Buddy</CardTitle>
          <CardDescription>Sign in with your Fieldtrip Google account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => void signInWithGoogle()}>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
