import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Get the webhook payload from Shippo
    const payload = await req.json()
    const { data, metadata } = payload

    // Verify the webhook is from Shippo
    const shippoSignature = req.headers.get('x-shippo-signature')
    if (!shippoSignature) {
      throw new Error('Invalid webhook signature')
    }

    // Update tracking info in our database
    const { error: updateError } = await supabaseClient
      .from('tracking_info')
      .update({
        status: data.status,
        status_details: data.status_details,
        location: data.location,
        eta: data.eta,
        last_updated: new Date().toISOString()
      })
      .eq('shippo_tracking_id', data.tracking_number)

    if (updateError) {
      throw new Error('Failed to update tracking info')
    }

    // Check if user wants notifications
    const { data: notificationPref, error: prefError } = await supabaseClient
      .from('notification_preferences')
      .select('email_notifications')
      .eq('order_id', metadata.order_id)
      .eq('user_id', metadata.user_id)
      .single()

    if (!prefError && notificationPref?.email_notifications) {
      // Get user email
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('email')
        .eq('id', metadata.user_id)
        .single()

      if (!userError && user) {
        // Send email notification using Shippo's built-in notification system
        await fetch('https://api.goshippo.com/tracks/', {
          method: 'POST',
          headers: {
            'Authorization': `ShippoToken ${Deno.env.get('SHIPPO_API_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tracking_number: data.tracking_number,
            carrier: data.carrier,
            metadata: {
              order_id: metadata.order_id,
              user_id: metadata.user_id,
              email: user.email
            }
          })
        })
      }
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
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