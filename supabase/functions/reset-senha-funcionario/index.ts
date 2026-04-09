import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { user_id, nova_senha } = await req.json()
    if (!user_id || !nova_senha) {
      return new Response(JSON.stringify({ error: 'user_id e nova_senha obrigatórios' }), { status: 400, headers: cors })
    }
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: nova_senha,
    })
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
    }
    return new Response(JSON.stringify({ success: true, email: data.user.email }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('reset-senha error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
