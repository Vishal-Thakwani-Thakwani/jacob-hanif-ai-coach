import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let displayName = 'there'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()
    
    if (profile?.name) {
      // Get first name only
      displayName = profile.name.split(' ')[0]
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Hero greeting */}
        <div className="flex items-center gap-4 mb-8">
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
            <h1 className="text-3xl font-bold">Hey {displayName}! 👋</h1>
            <p className="text-muted-foreground">
              Ready to train? Let&apos;s crush it today.
            </p>
          </div>
        </div>
        
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
                <CardTitle>💬 Text Jacob</CardTitle>
                <CardDescription>
                  Get instant coaching advice, form feedback, and personalized 
                  training guidance. Upload photos for technique analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                  Start Chatting
                </Button>
              </CardContent>
            </Card>
          </Link>
          
          <Card className="opacity-60 h-full border-dashed">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle className="flex items-center gap-2">
                📞 Call Jacob
                <span className="text-xs bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded font-normal">
                  Coming Soon
                </span>
              </CardTitle>
              <CardDescription>
                Voice coaching powered by AI. Have a real-time 
                conversation for hands-free coaching while you train.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
