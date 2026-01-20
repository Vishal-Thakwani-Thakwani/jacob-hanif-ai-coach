'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface OuraButtonProps {
  isConnected: boolean
}

export function OuraButton({ isConnected }: OuraButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    // TODO: Implement Oura OAuth flow
    // For now, redirect to Oura OAuth
    const clientId = process.env.NEXT_PUBLIC_OURA_CLIENT_ID
    const redirectUri = `${window.location.origin}/api/oura/callback`
    const scope = 'daily personal'
    
    if (clientId) {
      window.location.href = `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`
    } else {
      alert('Oura OAuth not configured yet')
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await fetch('/api/oura/disconnect', { method: 'POST' })
      window.location.reload()
    } catch (error) {
      console.error('Disconnect error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      variant={isConnected ? 'outline' : 'default'} 
      onClick={isConnected ? handleDisconnect : handleConnect}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : isConnected ? (
        'Disconnect'
      ) : (
        'Connect Oura'
      )}
    </Button>
  )
}
