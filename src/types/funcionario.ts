// Tipos para sistema multi-usuário

export type FuncionarioRole = 'admin' | 'supervisor' | 'vendedor' | 'estoque' | 'visualizador'

export const ROLE_LABELS: Record<FuncionarioRole, string> = {
  admin:       'Administrador',
  supervisor:  'Supervisor',
  vendedor:    'Vendedor / Consultor',
  estoque:     'Estoque',
  visualizador:'Visualizador',
}

export const ROLE_COLORS: Record<FuncionarioRole, string> = {
  admin:       'bg-red-500/15 text-red-400 border-red-500/30',
  supervisor:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  vendedor:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  estoque:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  visualizador:'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

// Permissões por role
export const ROLE_PERMISSIONS: Record<FuncionarioRole, {
  clientes: boolean
  agenda: boolean
  historico: boolean
  vendedores: boolean
  metas: boolean
  captacao: boolean
  estoque: boolean
  funcionarios: boolean // só admin
  configuracoes: boolean
}> = {
  admin:       { clientes:true,  agenda:true,  historico:true,  vendedores:true,  metas:true,  captacao:true,  estoque:true,  funcionarios:true,  configuracoes:true  },
  supervisor:  { clientes:true,  agenda:true,  historico:true,  vendedores:true,  metas:true,  captacao:true,  estoque:true,  funcionarios:false, configuracoes:false },
  vendedor:    { clientes:true,  agenda:true,  historico:true,  vendedores:false, metas:false, captacao:true,  estoque:false, funcionarios:false, configuracoes:false },
  estoque:     { clientes:false, agenda:false, historico:false, vendedores:false, metas:false, captacao:false, estoque:true,  funcionarios:false, configuracoes:false },
  visualizador:{ clientes:true,  agenda:true,  historico:true,  vendedores:true,  metas:true,  captacao:true,  estoque:true,  funcionarios:false, configuracoes:false },
}

export interface Funcionario {
  id: string
  user_id: string          // auth.users(id) — conta de login
  nome: string
  email: string
  telefone?: string
  role: FuncionarioRole
  vendedor_id?: string     // vinculado a um vendedor cadastrado
  ativo: boolean
  created_at: string
  updated_at: string
  owner_id: string         // quem criou (admin)
}

// Re-export for AuthContext
export const ROLE_PERMS_MAP = {
  admin:'admin', supervisor:'supervisor', vendedor:'vendedor', estoque:'estoque', visualizador:'visualizador'
} as const
