import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Phone, Activity, Dumbbell, Brain, Shield } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Jacob Hanif AI Coach</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="#pricing">
              <Button variant="ghost">Pricing</Button>
            </Link>
            <Link href="/auth/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Train Like a <span className="text-primary">National Champion</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Get personalized calisthenics and strength coaching from an AI trained on 
            Jacob Hanif&apos;s methods. UK National Calisthenics Champion. World-record holder. 
            180kg bench at 67kg bodyweight.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="text-lg px-8">
                Start Training Now
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary">180kg</div>
              <div className="text-muted-foreground">Bench Press at 67kg BW</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">40s</div>
              <div className="text-muted-foreground">Full Planche Hold</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">23s</div>
              <div className="text-muted-foreground">One-Arm Planche</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">UK #1</div>
              <div className="text-muted-foreground">National Champion</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Everything You Need to Progress</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Get the same coaching methodology that created a national champion, 
          powered by AI and personalized to your level.
        </p>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Chat Coaching</CardTitle>
              <CardDescription>
                Ask any question about training, nutrition, or recovery. 
                Get instant, personalized advice based on proven methods.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Brain className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Form Analysis</CardTitle>
              <CardDescription>
                Upload photos of your form and get detailed feedback 
                on technique, positioning, and areas for improvement.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Activity className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Oura Integration</CardTitle>
              <CardDescription>
                Connect your Oura Ring for recovery-aware coaching. 
                Training advice adapts to your sleep and readiness scores.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground text-center mb-12">
            Cancel anytime. No hidden fees.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="relative">
              <CardHeader>
                <CardTitle>Monthly</CardTitle>
                <CardDescription>Perfect for trying it out</CardDescription>
                <div className="text-4xl font-bold mt-4">
                  £17.99<span className="text-lg font-normal text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Unlimited chat coaching
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Form analysis (photos)
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Oura Ring integration
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Access to all training content
                  </li>
                </ul>
                <Link href="/auth/signup" className="block mt-6">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>
            
            <Card className="relative border-primary">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded-full">
                  Best Value
                </span>
              </div>
              <CardHeader>
                <CardTitle>Yearly</CardTitle>
                <CardDescription>Save over £115 per year</CardDescription>
                <div className="text-4xl font-bold mt-4">
                  £99.99<span className="text-lg font-normal text-muted-foreground">/year</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Everything in Monthly
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    2 months free
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Priority support
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Early access to new features
                  </li>
                </ul>
                <Link href="/auth/signup" className="block mt-6">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Training?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Join hundreds of athletes getting personalized coaching from the 
          AI trained on a national champion&apos;s methods.
        </p>
        <Link href="/auth/signup">
          <Button size="lg" className="text-lg px-8">
            Start Your Journey
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2026 Jacob Hanif AI Coach. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
