import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Phone } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
        <p className="text-muted-foreground mb-8">
          Choose how you want to interact with your AI coach today.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/dashboard/chat">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Chat</CardTitle>
                <CardDescription>
                  Text-based coaching for training advice, form feedback, 
                  and personalized guidance. Upload photos for form analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Start Chatting</Button>
              </CardContent>
            </Card>
          </Link>
          
          <Card className="opacity-60 h-full">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle className="flex items-center gap-2">
                Call
                <span className="text-xs bg-muted px-2 py-0.5 rounded font-normal">
                  Coming Soon
                </span>
              </CardTitle>
              <CardDescription>
                Voice coaching powered by ElevenLabs. Have a real-time 
                conversation with your AI coach for hands-free guidance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
