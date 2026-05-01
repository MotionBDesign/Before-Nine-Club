import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

export function getSupabase() {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseClient
}

let supabaseAdminClient: SupabaseClient | null = null

export function getSupabaseAdmin() {
  if (supabaseAdminClient) return supabaseAdminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey)
  return supabaseAdminClient
}

export type Member = {
  id: string
  email: string
  full_name: string
  phone: string | null
  stripe_customer_id: string | null
  subscription_status: 'active' | 'paused' | 'cancelled' | 'inactive'
  subscription_id: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export type Event = {
  id: string
  title: string
  description: string | null
  event_date: string
  location: string | null
  max_attendees: number | null
  created_at: string
}

export type RSVP = {
  id: string
  member_id: string
  event_id: string
  status: 'yes' | 'no' | 'maybe'
  created_at: string
  updated_at: string
}
