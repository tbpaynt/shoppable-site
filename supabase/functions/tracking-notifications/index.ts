import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Shippo } from 'https://esm.sh/shippo@1.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const shippo = new Shippo(Deno.env.get('SHIPPO_API_KEY'))

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the payload from the request
    const payload = await req.json()
    const { type, record, old_record } = payload

    // Only process tracking_info updates
    if (type !== 'UPDATE' || !record || !old_record) {
      return new Response(JSON.stringify({ message: 'Invalid payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Get the order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, users(email)')
      .eq('id', record.order_id)
      .single()

    if (orderError || !order) {
      throw new Error('Failed to fetch order details')
    }

    // Check if user wants notifications for this order
    const { data: notificationPref, error: prefError } = await supabaseClient
      .from('notification_preferences')
      .select('email_notifications')
      .eq('order_id', record.order_id)
      .eq('user_id', order.user_id)
      .single()

    if (prefError || !notificationPref?.email_notifications) {
      return new Response(JSON.stringify({ message: 'Notifications not enabled for this order' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Register webhook with Shippo for tracking updates
    const webhook = await shippo.webhook.create({
      url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/tracking-webhook`,
      events: ['track_updated'],
      metadata: {
        order_id: order.id,
        user_id: order.user_id
      }
    })

    // Update tracking info in our database with Shippo's tracking ID
    const { error: updateError } = await supabaseClient
      .from('tracking_info')
      .update({
        shippo_tracking_id: webhook.id,
        shippo_webhook_id: webhook.id
      })
      .eq('order_id', order.id)

    if (updateError) {
      throw new Error('Failed to update tracking info')
    }

    return new Response(JSON.stringify({ message: 'Tracking webhook registered successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 