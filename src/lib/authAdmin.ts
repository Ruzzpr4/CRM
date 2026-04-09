// Direct Supabase Auth Admin API calls using service role key
// This eliminates the need for Edge Functions entirely

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string

interface CreateUserResult {
  user_id: string
  error?: string
}

export async function adminCreateUser(email: string, password: string, name: string): Promise<CreateUserResult> {
  if (!SERVICE_KEY || SERVICE_KEY === 'your-service-role-key-here') {
    throw new Error('SERVICE_KEY não configurada. Adicione VITE_SUPABASE_SERVICE_KEY no arquivo .env')
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.msg || data.message || data.error_description || 'Erro ao criar usuário')
  }

  return { user_id: data.id }
}

export async function adminUpdateUserPassword(userId: string, newPassword: string): Promise<void> {
  if (!SERVICE_KEY || SERVICE_KEY === 'your-service-role-key-here') {
    throw new Error('SERVICE_KEY não configurada')
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ password: newPassword }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.msg || data.message || 'Erro ao atualizar senha')
  }
}

export async function adminDeleteUser(userId: string): Promise<void> {
  if (!SERVICE_KEY || SERVICE_KEY === 'your-service-role-key-here') return

  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  })
}

export async function adminInsert(table: string, data: Record<string, unknown>): Promise<string | null> {
  if (!SERVICE_KEY || SERVICE_KEY === 'your-service-role-key-here') {
    return 'SERVICE_KEY não configurada no .env'
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return err.message || err.hint || 'Erro ao inserir'
  }
  return null // null = success
}
