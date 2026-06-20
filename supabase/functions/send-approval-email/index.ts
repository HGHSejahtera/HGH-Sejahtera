import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, name } = await req.json()

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY')
    
    const FOUNDER_EMAIL = Deno.env.get('FOUNDER_EMAIL')
    if (!FOUNDER_EMAIL) throw new Error('Missing FOUNDER_EMAIL')
    
    const PROJECT_URL = Deno.env.get('SUPABASE_URL')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Lookup the newly created user to get their UUID
    const { data: { users }, error: authError } = await supabaseClient.auth.admin.listUsers()
    if (authError) throw authError
    
    const user = users.find(u => u.email === email)
    if (!user) throw new Error("User not found in auth.users")

    const approveStaffUrl = `${PROJECT_URL}/functions/v1/approve-user?id=${user.id}&role=Staff`
    const approveAgentUrl = `${PROJECT_URL}/functions/v1/approve-user?id=${user.id}&role=Agent`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'IRMS System <onboarding@resend.dev>',
        to: [FOUNDER_EMAIL],
        subject: `New User Registration: ${name}`,
        html: `
          <h2>New Registration Request</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <br/>
          <p>Sila klik salah satu butang di bawah untuk approve user ini:</p>
          <a href="${approveStaffUrl}" style="padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Approve as Staff</a>
          <a href="${approveAgentUrl}" style="padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Approve as Agent</a>
          <br/><br/>
          <p>Jika anda tidak mengenali individu ini, abaikan email ini.</p>
        `,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
