import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

serve(async (req) => {
  const url = new URL(req.url)
  const userId = url.searchParams.get('id')
  const role = url.searchParams.get('role')

  if (!userId || !role) {
    return new Response('Missing parameters (id or role)', { status: 400 })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Update public.Users Role and set IsActive = true
    const { data: userData, error: updateError } = await supabaseClient
      .from('Users')
      .update({ Role: role, IsActive: true })
      .eq('UserID', userId)
      .select('Email, DisplayName')
      .single()

    if (updateError) throw updateError

    // 2. Update auth.users metadata so JWT token reflects the new role
    await supabaseClient.auth.admin.updateUserById(userId, {
        user_metadata: { role }
    })

    // 3. Send confirmation email to the user
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (RESEND_API_KEY && userData) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'IRMS System <onboarding@resend.dev>',
            to: [userData.Email],
            subject: `Akaun Anda Telah Diluluskan!`,
            html: `
              <h2>Selamat Datang ke IRMS, ${userData.DisplayName}!</h2>
              <p>Akaun anda telah disemak dan diluluskan sebagai <strong>${role}</strong>.</p>
              <p>Anda kini boleh log masuk ke dalam sistem.</p>
              <br/>
              <p>Terima kasih.</p>
            `,
          }),
        })
    }

    // 4. Return success HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Approval Success</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6; margin: 0; }
            .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 100%; }
            h1 { color: #10b981; margin-bottom: 1rem; }
            p { color: #4b5563; line-height: 1.5; }
            .role-badge { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 999px; font-weight: 600; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <svg style="width: 64px; height: 64px; color: #10b981; margin: 0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h1>Berjaya!</h1>
            <p>Pengguna telah diluluskan. Role yang ditetapkan:</p>
            <div class="role-badge">${role}</div>
            <p style="margin-top: 1.5rem; font-size: 0.875rem;">Satu email pengesahan telah dihantar kepada pengguna.</p>
          </div>
        </body>
      </html>
    `

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
      status: 200,
    })
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 400 })
  }
})
