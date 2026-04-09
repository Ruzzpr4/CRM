// supabase/functions/webhook-crm/index.ts
// Deploy: npx supabase functions deploy webhook-crm

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar secret
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    const body = await req.json()

    if (!webhookSecret || body.secret !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: invalid secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validação básica
    if (!body.nome || !body.canal) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: nome, canal' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar canal
    const VALID_CHANNELS = ['linkedin', 'gmail', 'whatsapp', 'instagram', 'telefone', 'outro']
    if (!VALID_CHANNELS.includes(body.canal)) {
      return new Response(
        JSON.stringify({ error: `Canal inválido. Use: ${VALID_CHANNELS.join(' | ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter user_id do owner (primeira conta do sistema ou via header)
    // Para múltiplos usuários: envie o user_id no payload
    const ownerId = body.user_id || Deno.env.get('DEFAULT_USER_ID')
    if (!ownerId) {
      return new Response(
        JSON.stringify({ error: 'user_id não configurado. Defina DEFAULT_USER_ID nas secrets da function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Criar cliente Supabase com service role (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Checar duplicata por email (se informado)
    if (body.email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', ownerId)
        .eq('email', body.email)
        .maybeSingle()

      if (existing) {
        // Atualizar ao invés de duplicar
        const { data, error } = await supabase
          .from('contacts')
          .update({
            etapa: body.etapa ?? undefined,
            resumo_conversa: body.resumo ?? body.mensagem ?? undefined,
            avaliacao_atualizada: body.avaliacao ?? undefined,
            lead_quente: body.lead_quente ?? undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, action: 'updated', contact: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Inserir novo contato
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        nome: body.nome,
        empresa: body.empresa ?? null,
        email: body.email ?? null,
        telefone: body.telefone ?? null,
        cnpj: body.cnpj ?? null,
        canal: body.canal,
        etapa: body.etapa ?? 'mensagem_respondida',
        resumo_conversa: body.resumo ?? body.mensagem ?? null,
        avaliacao_inicial: body.avaliacao ?? null,
        lead_quente: body.lead_quente ?? false,
        notas: body.extra ? JSON.stringify(body.extra) : null,
        data_primeiro_contato: new Date().toISOString().split('T')[0],
        data_ultimo_contato: new Date().toISOString().split('T')[0],
        user_id: ownerId,
      })
      .select()
      .single()

    if (error) throw error

    // Registrar atividade
    await supabase.from('activities').insert({
      contact_id: data.id,
      tipo: 'webhook',
      descricao: `Lead recebido via ${body.canal} pelo webhook do n8n`,
      user_id: ownerId,
    })

    return new Response(
      JSON.stringify({ success: true, action: 'created', contact: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
