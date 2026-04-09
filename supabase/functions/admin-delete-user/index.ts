import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // Verifica se quem chama é um usuário autenticado (admin)
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: cors })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { user_id } = await req.json()
    if (!user_id) return new Response(JSON.stringify({ error: 'user_id obrigatório' }), { status: 400, headers: cors })

    // Verifica se o caller é owner do funcionário
    const { data: func } = await admin.from('funcionarios')
      .select('owner_id').eq('user_id', user_id).maybeSingle()
    if (!func || func.owner_id !== caller.id) {
      return new Response(JSON.stringify({ error: 'Sem permissão para deletar este usuário' }), { status: 403, headers: cors })
    }

    await admin.from('funcionarios').delete().eq('user_id', user_id)
    await admin.from('org_membros').delete().eq('user_id', user_id)
    await admin.auth.admin.deleteUser(user_id)

    return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})