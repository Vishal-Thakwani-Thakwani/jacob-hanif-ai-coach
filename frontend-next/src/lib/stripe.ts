import Stripe from 'stripe'

// Lazy initialization to avoid build-time errors
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  }
  return _stripe
}

// Price IDs from environment
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || '',
  yearly: process.env.STRIPE_PRICE_YEARLY || '',
}
