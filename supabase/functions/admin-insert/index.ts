import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_TABLES = ['org_membros', 'funcionarios']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { table, data } = await req.json()

    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: 'Tabela não permitida' }), { status: 403, headers: cors })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { error } = await admin.from(table).upsert(data, { onConflict: 'org_id,user_id' })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })

    return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})