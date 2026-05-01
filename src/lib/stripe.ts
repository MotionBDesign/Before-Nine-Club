import Stripe from 'stripe'

let stripeClient: Stripe | null = null

function getStripe(): Stripe {
  if (stripeClient) return stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }

  stripeClient = new Stripe(secretKey)
  return stripeClient
}

export const stripe = { get instance() { return getStripe() } }

export async function createCustomer(email: string, name: string) {
  return getStripe().customers.create({
    email,
    name,
    metadata: { source: 'before-nine-club' },
  })
}

export async function createSubscription(customerId: string, priceId: string) {
  return getStripe().subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  })
}

export async function pauseSubscription(subscriptionId: string) {
  return getStripe().subscriptions.update(subscriptionId, {
    pause_collection: { behavior: 'void' },
  })
}

export async function resumeSubscription(subscriptionId: string) {
  return getStripe().subscriptions.update(subscriptionId, {
    pause_collection: null,
  })
}

export async function cancelSubscription(subscriptionId: string) {
  return getStripe().subscriptions.cancel(subscriptionId)
}

export async function getSubscription(subscriptionId: string) {
  return getStripe().subscriptions.retrieve(subscriptionId)
}

export async function createBillingPortalSession(customerId: string, returnUrl: string) {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}
