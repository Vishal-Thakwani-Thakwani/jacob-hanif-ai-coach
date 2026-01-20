import { createClient } from '@/lib/supabase/server'
import { getStripe, PRICES } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { plan } = await req.json() // 'monthly' or 'yearly'
    
    const priceId = plan === 'yearly' ? PRICES.yearly : PRICES.monthly
    
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }
    
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      
      // CRITICAL: Pass user_id so webhook can identify user
      metadata: {
        user_id: user.id,
        plan: plan,
      },
      
      // Pre-fill email for returning customers
      customer_email: user.email!,
    })
    
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
