'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dumbbell, Shield, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function PricingPage() {
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const canceled = searchParams.get('canceled')
  
  const handleCheckout = async (plan: 'monthly' | 'yearly') => {
    setLoading(plan)
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      // Redirect to signup if not logged in
      router.push('/auth/signup')
      return
    }
    
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      
      const data = await response.json()
      
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('No checkout URL returned')
        setLoading(null)
      }
    } catch (error) {
      console.error('Checkout error:', error)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Jacob Hanif AI Coach</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/auth/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground text-lg">
            Get unlimited access to AI coaching from a national champion.
            Cancel anytime.
          </p>
          
          {canceled && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg inline-block">
              <p className="text-yellow-600">Checkout was canceled. Feel free to try again when ready.</p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly</CardTitle>
              <CardDescription>Perfect for trying it out</CardDescription>
              <div className="text-4xl font-bold mt-4">
                £17.99<span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Unlimited chat coaching
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Form analysis (photo upload)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Oura Ring integration
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Access to all training content
                </li>
              </ul>
              <Button 
                className="w-full" 
                onClick={() => handleCheckout('monthly')}
                disabled={loading !== null}
              >
                {loading === 'monthly' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Subscribe Monthly'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Yearly Plan */}
          <Card className="border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded-full">
                Best Value - Save £115
              </span>
            </div>
            <CardHeader>
              <CardTitle>Yearly</CardTitle>
              <CardDescription>2 months free</CardDescription>
              <div className="text-4xl font-bold mt-4">
                £99.99<span className="text-lg font-normal text-muted-foreground">/year</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Everything in Monthly
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  2 months free (£115 savings)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Early access to new features
                </li>
              </ul>
              <Button 
                className="w-full" 
                onClick={() => handleCheckout('yearly')}
                disabled={loading !== null}
              >
                {loading === 'yearly' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Subscribe Yearly'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ or Trust Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Trusted by Athletes</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our AI is trained on the exact methods used by UK National Calisthenics Champion 
            Jacob Hanif. Get the same coaching methodology that produced world-record level skills.
          </p>
        </div>
      </div>
    </div>
  )
}
