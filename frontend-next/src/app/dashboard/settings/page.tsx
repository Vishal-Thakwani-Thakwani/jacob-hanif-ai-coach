import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, CreditCard, User } from 'lucide-react'
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

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">
          Manage your account, subscription, and integrations.
        </p>
        
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription
              </CardTitle>
              <CardDescription>Manage your subscription plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">
                    {profile?.subscription_status || 'Free'} Plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.subscription_status === 'active' 
                      ? `${profile?.subscription_plan} subscription`
                      : 'Upgrade to access all features'}
                  </p>
                </div>
                <SubscriptionButton 
                  hasSubscription={profile?.subscription_status === 'active'} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Oura Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Oura Ring
              </CardTitle>
              <CardDescription>
                Connect your Oura Ring for recovery-aware coaching
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
