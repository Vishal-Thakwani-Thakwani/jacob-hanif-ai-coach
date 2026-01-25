import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Phone, Crown, Lock, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let displayName = 'there'
  let subscriptionStatus = 'free'
  let isPro = false
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, subscription_status')
      .eq('id', user.id)
      .single()
    
    if (profile?.name) {
      displayName = profile.name.split(' ')[0]
    }
    if (profile?.subscription_status) {
      subscriptionStatus = profile.subscription_status
      isPro = subscriptionStatus === 'active' || subscriptionStatus === 'past_due'
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Hero greeting */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-orange-500">
              <Image
                src="/jacob.jpg"
                alt="Jacob Hanif"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">Hey {displayName}!</h1>
                {isPro ? (
                  <Badge className="bg-gradient-to-r from-orange-500 to-red-600">
                    <Crown className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                ) : (
                  <Badge variant="outline">Free</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Ready to train? Let&apos;s crush it today.
              </p>
            </div>
          </div>
          
          {!isPro && (
            <Link href="/pricing">
              <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            </Link>
          )}
        </div>
        
        {/* Free tier notice */}
        {!isPro && (
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-600/10 border border-orange-500/20">
            <div className="flex items-start gap-3">
              <Crown className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium">You&apos;re on the Free plan</p>
                <p className="text-sm text-muted-foreground">
                  5 messages/day. Upgrade to Pro for unlimited messages, image analysis, Oura integration, and more!
                </p>
              </div>
            </div>
          </div>
        )}
        
        <p className="text-muted-foreground mb-6">
          How would you like to connect with Jacob today?
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/dashboard/chat">
            <Card className="hover:border-orange-500 hover:shadow-lg transition-all cursor-pointer h-full group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-6 w-6 text-orange-500" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  Text Jacob
                  {!isPro && (
                    <span className="text-xs text-muted-foreground font-normal">
                      (5 msgs/day)
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Get instant coaching advice and personalized training guidance.
                  {isPro ? ' Upload photos for technique analysis.' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                  Start Chatting
                </Button>
              </CardContent>
            </Card>
          </Link>
          
          {isPro ? (
            <Link href="/dashboard/call" className="block h-full">
              <Card className="h-full hover:border-green-500/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                    <Phone className="h-6 w-6 text-green-500" />
                  </div>
                  <CardTitle className="flex items-center gap-2">
                    Call Jacob
                    <Badge className="bg-green-500">
                      Live
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Voice coaching powered by AI. Have a real-time 
                    conversation for hands-free coaching while you train.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Start Call
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Card className="h-full border-dashed relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-600/5" />
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4 relative">
                  <Phone className="h-6 w-6 text-muted-foreground" />
                  <Lock className="h-4 w-4 text-orange-500 absolute -bottom-1 -right-1" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  Call Jacob
                  <Badge variant="outline" className="text-orange-500 border-orange-500">
                    <Crown className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Voice coaching powered by AI. Have a real-time 
                  conversation for hands-free coaching while you train.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/pricing">
                  <Button className="w-full" variant="outline">
                    <Lock className="h-4 w-4 mr-2" />
                    Upgrade to Unlock
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Pro Features Grid */}
        {!isPro && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Unlock with Pro</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: '💬', title: 'Unlimited Chat', desc: 'No daily limits' },
                { icon: '📸', title: 'Form Analysis', desc: 'Upload photos' },
                { icon: '⌚', title: 'Oura Ring', desc: 'Health sync' },
                { icon: '📞', title: 'Voice Calls', desc: 'Coming soon' },
              ].map((feature) => (
                <div key={feature.title} className="p-4 rounded-lg border bg-card">
                  <span className="text-2xl">{feature.icon}</span>
                  <p className="font-medium text-sm mt-2">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
