const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, token, eventId, organizationId, role } = await req.json()

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get event and org info
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const [{ data: event }, { data: org }] = await Promise.all([
      supabaseAdmin.from('events').select('title').eq('id', eventId).single(),
      supabaseAdmin.from('organizations').select('name').eq('id', organizationId).single(),
    ])

    const eventTitle = event?.title || 'an event'
    const orgName = org?.name || 'An organization'
    
    // For now, log the invitation details (email sending would be configured separately)
    console.log(`Invitation email would be sent to ${email} for event "${eventTitle}" by org "${orgName}" with role "${role}" and token "${token}"`)

    // The accept link
    const siteUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '').replace('https://api.', 'https://') || ''
    const acceptUrl = `${siteUrl}/accept-invite?token=${token}`

    console.log(`Accept URL: ${acceptUrl}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Invitation processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
