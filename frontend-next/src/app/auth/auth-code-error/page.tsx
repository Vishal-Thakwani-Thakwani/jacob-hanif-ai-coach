'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const errorMessage = searchParams.get('error')
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Authentication Error</CardTitle>
          <CardDescription>
            Something went wrong during sign in. This usually happens if the session expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          {errorMessage && (
            <div className="mb-4 p-2 bg-destructive/10 rounded text-destructive text-xs font-mono">
              Error: {errorMessage}
            </div>
          )}
          <p>Please try signing in again. If the problem persists, try:</p>
          <ul className="mt-2 text-left list-disc list-inside">
            <li>Clearing your browser cookies</li>
            <li>Using a different browser</li>
            <li>Disabling browser extensions</li>
          </ul>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Link href="/auth/signin">
            <Button>Try Again</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function AuthCodeError() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ErrorContent />
    </Suspense>
  )
}
