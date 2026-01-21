import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, CreditCard, User, Crown, Lock, Check } from 'lucide-react'
import { SubscriptionButton } from './subscription-button'
import { OuraButton } from './oura-button'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const subscriptionStatus = profile?.subscription_status || 'free'
  const isPro = subscriptionStatus === 'active' || subscriptionStatus === 'past_due'

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account, subscription, and integrations.
            </p>
          </div>
          {isPro ? (
            <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-lg px-4 py-1">
              <Crown className="h-4 w-4 mr-2" />
              Pro
            </Badge>
          ) : (
            <Badge variant="outline" className="text-lg px-4 py-1">
              Free
            </Badge>
          )}
        </div>
        
        <div className="space-y-6">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <p className="font-medium">{profile?.name || 'Not set'}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <p className="font-medium">{user.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Section */}
          <Card className={isPro ? 'border-orange-500/50' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription
                {isPro && (
                  <Badge className="bg-gradient-to-r from-orange-500 to-red-600">
                    Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Manage your subscription plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isPro ? 'Pro Plan' : 'Free Plan'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isPro 
                      ? `${profile?.subscription_plan === 'yearly' ? 'Annual' : 'Monthly'} subscription`
                      : '5 messages/day, no image upload'}
                  </p>
                </div>
                <SubscriptionButton 
                  hasSubscription={isPro} 
                />
              </div>
              
              {/* Feature comparison for free users */}
              {!isPro && (
                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm font-medium mb-3">Upgrade to Pro to unlock:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      'Unlimited messages',
                      'Image form analysis',
                      'Oura Ring sync',
                      'Voice calls (soon)',
                      'Priority support',
                      'No daily limits',
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-muted-foreground">
                        <Check className="h-4 w-4 text-orange-500" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <Link href="/pricing" className="block mt-4">
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600">
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Pro - £17.99/mo
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Oura Integration */}
          <Card className={!isPro ? 'opacity-75' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Oura Ring
                {!isPro && (
                  <Badge variant="outline" className="text-orange-500 border-orange-500">
                    <Crown className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Connect your Oura Ring for recovery-aware coaching
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPro ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {profile?.oura_connected_at ? 'Connected' : 'Not Connected'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {profile?.oura_connected_at 
                        ? `Connected on ${new Date(profile.oura_connected_at).toLocaleDateString()}`
                        : 'Sync your sleep and readiness data'}
                    </p>
                  </div>
                  <OuraButton isConnected={!!profile?.oura_connected_at} />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      Pro Feature
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Upgrade to Pro to sync your Oura data for personalized recovery advice
                    </p>
                  </div>
                  <Link href="/pricing">
                    <Button variant="outline" size="sm">
                      <Lock className="h-4 w-4 mr-2" />
                      Unlock
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
