import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function CallPage() {
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <Phone className="h-10 w-10 text-muted-foreground" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Voice Coaching Coming Soon</h1>
        <p className="text-muted-foreground mb-8">
          We&apos;re building real-time voice coaching powered by ElevenLabs. 
          Have natural conversations with your AI coach while training.
        </p>
        
        <Card className="text-left">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Get Notified
            </CardTitle>
            <CardDescription>
              Be the first to know when voice coaching launches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-1"
              />
              <Button>Notify Me</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
