import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get Stripe customer ID from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()
    
    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 400 })
    }
    
    // Create portal session - Stripe handles cancel/upgrade UI
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
    })
    
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
