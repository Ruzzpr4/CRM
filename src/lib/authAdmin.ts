/**
 * authAdmin.ts — Operações administrativas via Edge Functions (servidor)
 * A service key NUNCA é usada no frontend — fica segura nas Edge Functions do Supabase
 */
import { supabase } from './supabase'

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.supabase.co/functions/v1') ?? ''

async function callFunction(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro na função do servidor')
  return data
}

export async function adminCreateUser(email: string, password: string, name: string): Promise<{ user_id: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  return callFunction('invite-funcionario', {
    email, senha: password, nome: name,
    owner_id: user?.id,
  })
}

export async function adminUpdateUserPassword(userId: string, newPassword: string): Promise<void> {
  await callFunction('reset-senha-funcionario', {
    user_id: userId,
    nova_senha: newPassword,
  })
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await callFunction('admin-delete-user', { user_id: userId })
}

export async function adminInsert(table: string, data: Record<string, unknown>): Promise<string | null> {
  try {
    await callFunction('admin-insert', { table, data })
    return null
  } catch (err: any) {
    return err?.message ?? 'Erro ao inserir'
  }
}