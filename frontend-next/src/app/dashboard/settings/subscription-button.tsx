'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface SubscriptionButtonProps {
  hasSubscription: boolean
}

export function SubscriptionButton({ hasSubscription }: SubscriptionButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    if (hasSubscription) {
      // Open Stripe Customer Portal
      setLoading(true)
      try {
        const response = await fetch('/api/stripe/portal', {
          method: 'POST',
        })
        const data = await response.json()
        if (data.url) {
          window.location.href = data.url
        }
      } catch (error) {
        console.error('Portal error:', error)
      } finally {
        setLoading(false)
      }
    } else {
      // Go to pricing page
      router.push('/pricing')
    }
  }

  return (
    <Button 
      variant={hasSubscription ? 'outline' : 'default'} 
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : hasSubscription ? (
        'Manage Subscription'
      ) : (
        'Upgrade Now'
      )}
    </Button>
  )
}
