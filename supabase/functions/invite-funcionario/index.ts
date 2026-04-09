import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { nome, email, senha, role, vendedor_id, owner_id } = await req.json()

    if (!email?.trim() || !nome?.trim()) {
      return new Response(JSON.stringify({ error: 'Nome e e-mail são obrigatórios' }), { status: 400, headers: cors })
    }
    if (!owner_id) {
      return new Response(JSON.stringify({ error: 'owner_id é obrigatório' }), { status: 400, headers: cors })
    }

    // Create or invite user
    let userId: string
    if (senha?.trim()?.length >= 6) {
      const { data, error } = await admin.auth.admin.createUser({
        email: email.trim(), password: senha.trim(),
        email_confirm: true, user_metadata: { name: nome.trim() },
      })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
      userId = data.user.id
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
        data: { name: nome.trim() },
      })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
      userId = data.user.id
    }

    // Get or create org
    const { data: orgs } = await admin.from('organizacoes')
      .select('id').eq('owner_id', owner_id).order('created_at').limit(1)
    let orgId = orgs?.[0]?.id
    if (!orgId) {
      const { data: newOrg } = await admin.from('organizacoes')
        .insert({ nome: 'Minha Empresa', owner_id }).select('id').single()
      orgId = newOrg?.id
    }

    // Create funcionario record
    const { error: funcErr } = await admin.from('funcionarios').insert({
      user_id: userId, nome: nome.trim(), email: email.trim(),
      role: role ?? 'vendedor', vendedor_id: vendedor_id ?? null,
      ativo: true, owner_id,
    })
    if (funcErr) {
      await admin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: 'Erro no banco: ' + funcErr.message }), { status: 400, headers: cors })
    }

    // Add to org_membros for RLS (ignore unique constraint errors)
    if (orgId) {
      await admin.from('org_membros').upsert({
        org_id: orgId, user_id: userId, role: role ?? 'vendedor',
        vendedor_id: vendedor_id ?? null, ativo: true,
      }, { onConflict: 'org_id,user_id' })
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
