import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

// Lazy init Supabase to avoid build errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')
  
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }
  
  let event
  const stripe = getStripe()
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  const supabase = getSupabase()
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan
        
        if (userId) {
          await supabase.from('profiles').update({
            subscription_status: 'active',
            subscription_plan: plan,
            stripe_customer_id: session.customer as string,
          }).eq('id', userId)
          
          console.log(`Subscription activated for user ${userId}`)
        }
        break
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer as string
        
        // Map Stripe status to our status
        let status = 'active'
        if (subscription.status === 'canceled') status = 'canceled'
        if (subscription.status === 'past_due') status = 'past_due'
        if (subscription.status === 'unpaid') status = 'past_due'
        
        await supabase.from('profiles').update({
          subscription_status: status,
        }).eq('stripe_customer_id', customerId)
        
        console.log(`Subscription updated for customer ${customerId}: ${status}`)
        break
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer as string
        
        await supabase.from('profiles').update({
          subscription_status: 'canceled',
        }).eq('stripe_customer_id', customerId)
        
        console.log(`Subscription canceled for customer ${customerId}`)
        break
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer as string
        
        await supabase.from('profiles').update({
          subscription_status: 'past_due',
        }).eq('stripe_customer_id', customerId)
        
        console.log(`Payment failed for customer ${customerId}`)
        break
      }
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
