'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Update the profile with the name
        await supabase
          .from('profiles')
          .update({ name: name.trim() })
          .eq('id', user.id)
      }
      router.push('/dashboard')
    } catch (error) {
      console.error('Error saving name:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 ring-4 ring-orange-500">
            <Image
              src="/jacob.jpg"
              alt="Jacob Hanif"
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          </div>
          <CardTitle className="text-2xl">Welcome to Jacob AI Coach</CardTitle>
          <CardDescription>
            Let&apos;s get to know you so I can personalize your coaching experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="text-sm font-medium mb-2 block">
                What should I call you?
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                className="text-lg"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Saving...' : "Let's Go"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
