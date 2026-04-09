/**
 * api.ts — Camada de dados dual-mode
 * IS_MOCK=true  → localStorage (dados fictícios)
 * IS_MOCK=false → Supabase (banco real)
 */
import { Cliente, Consulta, HistoricoContato, Captacao } from '../types'
import { Vendedor, Meta } from '../types/vendedor'
import { MOCK_CLIENTES, MOCK_CONSULTAS, MOCK_HISTORICO, MOCK_CAPTACAO,
         MOCK_VENDEDORES, MOCK_METAS, MOCK_USER } from './mockData'

export const IS_MOCK = false // Always use Supabase

// ─── Auth Mock ────────────────────────────────────────────────
export type MockUser = typeof MOCK_USER
const AUTH_KEY = 'crm_mock_auth'
export const mockAuth = {
  getUser: (): MockUser | null => { try { return JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') } catch { return null } },
  signIn: (email: string, password: string): MockUser | null => {
    if (!email || password.length < 3) return null
    const u = { ...MOCK_USER, email }; localStorage.setItem(AUTH_KEY, JSON.stringify(u)); return u
  },
  signUp: (email: string, _p: string, name: string): MockUser => {
    const u = { ...MOCK_USER, email, user_metadata: { name } }
    localStorage.setItem(AUTH_KEY, JSON.stringify(u)); return u
  },
  signOut: () => localStorage.removeItem(AUTH_KEY),
}

// ─── LocalStorage helpers (mock only) ────────────────────────
function load<T>(key: string, defaults: T[]): T[] {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : defaults } catch { return defaults }
}
function save<T>(key: string, data: T[]) { localStorage.setItem(key, JSON.stringify(data)) }
const uid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
const now = () => new Date().toISOString()

// ─── Supabase helpers ─────────────────────────────────────────
// Cache to avoid repeated DB queries per session
let _cachedUserId: string | null = null
let _cachedForUid: string | null = null

async function getSB() {
  const { supabase } = await import('./supabase')
  const { data: { user } } = await supabase.auth.getUser()
  const uid = user?.id ?? ''

  // Use cache if same user
  if (uid && uid === _cachedForUid && _cachedUserId) {
    return { supabase, userId: _cachedUserId }
  }

  // Check if funcionário (only once per session)
  let ownerId = uid
  if (uid) {
    const { data: func } = await supabase
      .from('funcionarios')
      .select('owner_id')
      .eq('user_id', uid)
      .eq('ativo', true)
      .maybeSingle()
    if (func?.owner_id && func.owner_id !== uid) {
      ownerId = func.owner_id
    }
  }

  _cachedForUid = uid
  _cachedUserId = ownerId
  return { supabase, userId: ownerId }
}

// Clear cache on sign out
export function clearApiCache() {
  _cachedUserId = null
  _cachedForUid = null
}

// ─── CLIENTES ────────────────────────────────────────────────
export const clientesApi = {
  async list(filters: { situacao?: string; search?: string; lead_quente?: boolean } = {}): Promise<Cliente[]> {
    if (IS_MOCK) {
      let data = load<Cliente>('crm_clientes', MOCK_CLIENTES)
      if (filters.situacao)        data = data.filter(c => c.situacao === filters.situacao)
      if (filters.lead_quente !== undefined) data = data.filter(c => c.lead_quente === filters.lead_quente)
      if (filters.search) {
        const q = filters.search.toLowerCase()
        data = data.filter(c => c.nome.toLowerCase().includes(q) || (c.cpf??'').includes(q) || (c.telefone1??'').includes(q) || (c.email??'').toLowerCase().includes(q))
      }
      return data.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }
    const { supabase, userId } = await getSB()
    let q = supabase.from('clientes').select('*').order('updated_at', { ascending: false })
    if (filters.situacao)        q = q.eq('situacao', filters.situacao)
    if (filters.lead_quente !== undefined) q = q.eq('lead_quente', filters.lead_quente)
    if (filters.search)          q = q.or(`nome.ilike.%${filters.search}%,cpf.ilike.%${filters.search}%,telefone1.ilike.%${filters.search}%`)
    const { data } = await q
    return (data ?? []) as Cliente[]
  },

  getById(id: string): Cliente | undefined {
    if (IS_MOCK) return load<Cliente>('crm_clientes', MOCK_CLIENTES).find(c => c.id === id)
    return undefined
  },

  async create(data: Omit<Cliente,'id'|'created_at'|'updated_at'|'user_id'>): Promise<Cliente> {
    if (IS_MOCK) {
      const list = load<Cliente>('crm_clientes', MOCK_CLIENTES)
      const item: Cliente = { ...data, id: uid(), created_at: now(), updated_at: now(), user_id: MOCK_USER.id }
      list.unshift(item); save('crm_clientes', list); return item
    }
    const { supabase, userId } = await getSB()
    const { data: item, error: insertErr } = await supabase.from('clientes').insert({ ...data, user_id: userId }).select().single()
    if (insertErr) throw new Error(insertErr.message)
    return item as Cliente
  },

  async update(id: string, data: Partial<Cliente>): Promise<void> {
    if (IS_MOCK) {
      const list = load<Cliente>('crm_clientes', MOCK_CLIENTES)
      const idx = list.findIndex(c => c.id === id); if (idx === -1) return
      list[idx] = { ...list[idx], ...data, updated_at: now() }; save('crm_clientes', list); return
    }
    const { supabase } = await getSB()
    await supabase.from('clientes').update({ ...data, updated_at: now() }).eq('id', id)
  },

  async delete(id: string): Promise<void> {
    if (IS_MOCK) { save('crm_clientes', load<Cliente>('crm_clientes', MOCK_CLIENTES).filter(c => c.id !== id)); return }
    const { supabase } = await getSB()
    await supabase.from('clientes').delete().eq('id', id)
  },

  clearMock: () => localStorage.removeItem('crm_clientes'),
}

// ─── CONSULTAS ───────────────────────────────────────────────
export const consultasApi = {
  async list(filters: { cliente_id?: string; situacao?: string; vendedor_id?: string } = {}): Promise<Consulta[]> {
    if (IS_MOCK) {
      let data = load<Consulta>('crm_consultas', MOCK_CONSULTAS)
      if (filters.cliente_id)  data = data.filter(c => c.cliente_id === filters.cliente_id)
      if (filters.situacao)    data = data.filter(c => c.situacao === filters.situacao)
      if (filters.vendedor_id) data = data.filter(c => c.vendedor_id === filters.vendedor_id)
      return data.sort((a,b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
    }
    const { supabase, userId } = await getSB()
    let q = supabase.from('consultas').select('*, clientes(nome,telefone1,whatsapp,email)').order('data_hora')
    if (filters.cliente_id)  q = q.eq('cliente_id', filters.cliente_id)
    if (filters.situacao)    q = q.eq('situacao', filters.situacao)
    if (filters.vendedor_id) q = q.eq('vendedor_id', filters.vendedor_id)
    const { data } = await q
    return (data ?? []) as Consulta[]
  },

  hoje(): Consulta[] {
    const s = new Date(); s.setHours(0,0,0,0)
    const e = new Date(); e.setHours(23,59,59,999)
    return load<Consulta>('crm_consultas', MOCK_CONSULTAS)
      .filter(c => c.data_hora >= s.toISOString() && c.data_hora <= e.toISOString())
      .sort((a,b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
  },

  proximas(dias = 7): Consulta[] {
    const s = new Date().toISOString()
    const e = new Date(Date.now() + dias*86400000).toISOString()
    return load<Consulta>('crm_consultas', MOCK_CONSULTAS)
      .filter(c => c.data_hora >= s && c.data_hora <= e && !['cancelada','realizada'].includes(c.situacao))
      .sort((a,b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
  },

  // Verifica conflito de horário para um vendedor
  async checkConflito(vendedor_id: string, data_hora: string, duracao_min: number, excludeId?: string): Promise<Consulta | null> {
    const inicio = new Date(data_hora)
    const fim = new Date(inicio.getTime() + duracao_min * 60000)

    if (IS_MOCK) {
      const all = load<Consulta>('crm_consultas', MOCK_CONSULTAS)
        .filter(c => c.vendedor_id === vendedor_id && !['cancelada','faltou'].includes(c.situacao) && c.id !== excludeId)
      return all.find(c => {
        const cIni = new Date(c.data_hora)
        const cFim = new Date(cIni.getTime() + (c.duracao_min ?? 60) * 60000)
        return inicio < cFim && fim > cIni
      }) ?? null
    }
    const { supabase } = await getSB()
    const { data } = await supabase.from('consultas')
      .select('*').eq('vendedor_id', vendedor_id)
      .not('situacao', 'in', '("cancelada","faltou")')
      .neq('id', excludeId ?? '')
      .gte('data_hora', new Date(inicio.getTime() - 4*3600000).toISOString())
      .lte('data_hora', fim.toISOString())
    const conflito = (data ?? []).find((c: Consulta) => {
      const cIni = new Date(c.data_hora)
      const cFim = new Date(cIni.getTime() + (c.duracao_min ?? 60) * 60000)
      return inicio < cFim && fim > cIni
    })
    return (conflito as Consulta) ?? null
  },

  async create(data: Omit<Consulta,'id'|'created_at'|'updated_at'|'user_id'>): Promise<Consulta> {
    if (IS_MOCK) {
      const list = load<Consulta>('crm_consultas', MOCK_CONSULTAS)
      const item: Consulta = { ...data, id: uid(), created_at: now(), updated_at: now(), user_id: MOCK_USER.id }
      list.unshift(item); save('crm_consultas', list); return item
    }
    const { supabase, userId } = await getSB()
    const { data: item, error: insertErr } = await supabase.from('consultas').insert({ ...data, user_id: userId }).select().single()
    if (insertErr) throw new Error(insertErr.message)
    return item as Consulta
  },

  async update(id: string, data: Partial<Consulta>): Promise<void> {
    if (IS_MOCK) {
      const list = load<Consulta>('crm_consultas', MOCK_CONSULTAS)
      const idx = list.findIndex(c => c.id === id); if (idx === -1) return
      list[idx] = { ...list[idx], ...data, updated_at: now() }; save('crm_consultas', list); return
    }
    const { supabase } = await getSB()
    await supabase.from('consultas').update({ ...data, updated_at: now() }).eq('id', id)
  },

  async delete(id: string): Promise<void> {
    if (IS_MOCK) { save('crm_consultas', load<Consulta>('crm_consultas', MOCK_CONSULTAS).filter(c => c.id !== id)); return }
    const { supabase } = await getSB()
    await supabase.from('consultas').delete().eq('id', id)
  },
}

// ─── HISTÓRICO ───────────────────────────────────────────────
export const historicoApi = {
  async list(cliente_id?: string): Promise<HistoricoContato[]> {
    if (IS_MOCK) {
      let data = load<HistoricoContato>('crm_historico', MOCK_HISTORICO)
      if (cliente_id) data = data.filter(h => h.cliente_id === cliente_id)
      return data.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    const { supabase, userId } = await getSB()
    let q = supabase.from('historico_contatos').select('*').order('created_at', { ascending: false })
    if (cliente_id) q = q.eq('cliente_id', cliente_id)
    const { data } = await q
    return (data ?? []) as HistoricoContato[]
  },

  async listAll(): Promise<HistoricoContato[]> { return this.list() },

  async create(data: Omit<HistoricoContato,'id'|'created_at'|'user_id'>): Promise<HistoricoContato> {
    if (IS_MOCK) {
      const list = load<HistoricoContato>('crm_historico', MOCK_HISTORICO)
      const item: HistoricoContato = { ...data, id: uid(), created_at: now(), user_id: MOCK_USER.id }
      list.unshift(item); save('crm_historico', list); return item
    }
    const { supabase, userId } = await getSB()
    const { data: item, error: insertErr } = await supabase.from('historico_contatos').insert({ ...data, user_id: userId }).select().single()
    if (insertErr) throw new Error(insertErr.message)
    return item as HistoricoContato
  },
}

// ─── CAPTAÇÃO ────────────────────────────────────────────────
export const captacaoApi = {
  async list(filters: { situacao?: string; search?: string } = {}): Promise<Captacao[]> {
    if (IS_MOCK) {
      let data = load<Captacao>('crm_captacao', MOCK_CAPTACAO)
      if (filters.situacao) data = data.filter(c => c.situacao === filters.situacao)
      if (filters.search) { const q = filters.search.toLowerCase(); data = data.filter(c => (c.nome??'').toLowerCase().includes(q) || (c.telefone??'').includes(q)) }
      return data.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }
    const { supabase, userId } = await getSB()
    let q = supabase.from('captacao').select('*').order('updated_at', { ascending: false })
    if (filters.situacao) q = q.eq('situacao', filters.situacao)
    if (filters.search)   q = q.or(`nome.ilike.%${filters.search}%,telefone.ilike.%${filters.search}%`)
    const { data } = await q
    return (data ?? []) as Captacao[]
  },

  async create(data: Omit<Captacao,'id'|'created_at'|'updated_at'|'user_id'>): Promise<Captacao> {
    if (IS_MOCK) {
      const list = load<Captacao>('crm_captacao', MOCK_CAPTACAO)
      const item: Captacao = { ...data, id: uid(), created_at: now(), updated_at: now(), user_id: MOCK_USER.id }
      list.unshift(item); save('crm_captacao', list); return item
    }
    const { supabase, userId } = await getSB()
    const { data: item, error: insertErr } = await supabase.from('captacao').insert({ ...data, user_id: userId }).select().single()
    if (insertErr) throw new Error(insertErr.message)
    return item as Captacao
  },

  async update(id: string, data: Partial<Captacao>): Promise<void> {
    if (IS_MOCK) {
      const list = load<Captacao>('crm_captacao', MOCK_CAPTACAO)
      const idx = list.findIndex(c => c.id === id); if (idx === -1) return
      list[idx] = { ...list[idx], ...data, updated_at: now() }; save('crm_captacao', list); return
    }
    const { supabase } = await getSB()
    await supabase.from('captacao').update({ ...data, updated_at: now() }).eq('id', id)
  },

  async delete(id: string): Promise<void> {
    if (IS_MOCK) { save('crm_captacao', load<Captacao>('crm_captacao', MOCK_CAPTACAO).filter(c => c.id !== id)); return }
    const { supabase } = await getSB()
    await supabase.from('captacao').delete().eq('id', id)
  },
}

// ─── VENDEDORES ──────────────────────────────────────────────
export const vendedoresApi = {
  async list(filters: { situacao?: boolean; search?: string } = {}): Promise<Vendedor[]> {
    if (IS_MOCK) {
      let data = load<Vendedor>('crm_vendedores', MOCK_VENDEDORES)
      if (filters.situacao !== undefined) data = data.filter(v => v.situacao === filters.situacao)
      if (filters.search) { const q = filters.search.toLowerCase(); data = data.filter(v => v.nome.toLowerCase().includes(q) || (v.cpf??'').includes(q)) }
      return data.sort((a,b) => a.nome.localeCompare(b.nome))
    }
    const { supabase, userId } = await getSB()
    let q = supabase.from('vendedores').select('*').order('nome')
    if (filters.situacao !== undefined) q = q.eq('situacao', filters.situacao)
    if (filters.search) q = q.ilike('nome', `%${filters.search}%`)
    const { data } = await q
    return (data ?? []) as Vendedor[]
  },

  async create(data: Omit<Vendedor,'id'|'created_at'|'updated_at'|'user_id'>): Promise<Vendedor> {
    if (IS_MOCK) {
      const list = load<Vendedor>('crm_vendedores', MOCK_VENDEDORES)
      const item: Vendedor = { ...data, id: uid(), created_at: now(), updated_at: now(), user_id: MOCK_USER.id }
      list.push(item); save('crm_vendedores', list); return item
    }
    const { supabase, userId } = await getSB()
    const { data: item, error: insertErr } = await supabase.from('vendedores').insert({ ...data, user_id: userId }).select().single()
    if (insertErr) throw new Error(insertErr.message)
    return item as Vendedor
  },

  async update(id: string, data: Partial<Vendedor>): Promise<void> {
    if (IS_MOCK) {
      const list = load<Vendedor>('crm_vendedores', MOCK_VENDEDORES)
      const idx = list.findIndex(v => v.id === id); if (idx === -1) return
      list[idx] = { ...list[idx], ...data, updated_at: now() }; save('crm_vendedores', list); return
    }
    const { supabase } = await getSB()
    await supabase.from('vendedores').update({ ...data, updated_at: now() }).eq('id', id)
  },

  async delete(id: string): Promise<void> {
    if (IS_MOCK) { save('crm_vendedores', load<Vendedor>('crm_vendedores', MOCK_VENDEDORES).filter(v => v.id !== id)); return }
    const { supabase } = await getSB()
    await supabase.from('vendedores').delete().eq('id', id)
  },
}

// ─── METAS ───────────────────────────────────────────────────
export const metasApi = {
  async list(filters: { vendedor_id?: string; periodo?: string } = {}): Promise<Meta[]> {
    if (IS_MOCK) {
      let data = load<Meta>('crm_metas', MOCK_METAS)
      if (filters.vendedor_id) data = data.filter(m => m.vendedor_id === filters.vendedor_id)
      if (filters.periodo)     data = data.filter(m => m.periodo === filters.periodo)
      return data
    }
    const { supabase, userId } = await getSB()
    let q = supabase.from('metas').select('*, vendedores(nome)').order('periodo', { ascending: false })
    if (filters.vendedor_id) q = q.eq('vendedor_id', filters.vendedor_id)
    if (filters.periodo)     q = q.eq('periodo', filters.periodo)
    const { data } = await q
    return (data ?? []) as Meta[]
  },

  async upsert(data: Omit<Meta,'id'|'created_at'|'updated_at'|'user_id'>): Promise<Meta> {
    if (IS_MOCK) {
      const list = load<Meta>('crm_metas', MOCK_METAS)
      const idx = list.findIndex(m => m.vendedor_id === data.vendedor_id && m.periodo === data.periodo)
      if (idx >= 0) { list[idx] = { ...list[idx], ...data, updated_at: now() }; save('crm_metas', list); return list[idx] }
      const item: Meta = { ...data, id: uid(), created_at: now(), updated_at: now(), user_id: MOCK_USER.id }
      list.push(item); save('crm_metas', list); return item
    }
    const { supabase, userId } = await getSB()
    const { data: item, error: upsertErr } = await supabase.from('metas')
      .upsert({ ...data, user_id: userId }, { onConflict: 'vendedor_id,periodo' }).select().single()
    if (upsertErr) throw new Error(upsertErr.message)
    return item as Meta
  },

  async updateRealizado(id: string, realizado_mes: number, realizado_valor?: number): Promise<void> {
    if (IS_MOCK) {
      const list = load<Meta>('crm_metas', MOCK_METAS)
      const idx = list.findIndex(m => m.id === id); if (idx === -1) return
      list[idx] = { ...list[idx], realizado_mes, realizado_valor: realizado_valor ?? list[idx].realizado_valor, updated_at: now() }
      save('crm_metas', list); return
    }
    const { supabase } = await getSB()
    await supabase.from('metas').update({ realizado_mes, realizado_valor, updated_at: now() }).eq('id', id)
  },
}

// Limpar todos os dados do mock (localStorage)
export const clearAllMockData = () => {
  ['crm_clientes','crm_consultas','crm_historico','crm_captacao','crm_vendedores','crm_metas'].forEach(k => localStorage.removeItem(k))
}

// ─── ESTOQUE ─────────────────────────────────────────────────
import { ProdutoEstoque, MovimentoEstoque } from '../types/estoque'

const MOCK_PRODUTOS: ProdutoEstoque[] = []

export const estoqueApi = {
  async listProdutos(filters: { search?: string; categoria?: string; baixoEstoque?: boolean } = {}): Promise<ProdutoEstoque[]> {
    if (IS_MOCK) {
      let data = load<ProdutoEstoque>('crm_produtos', MOCK_PRODUTOS)
      if (filters.search) { const q = filters.search.toLowerCase(); data = data.filter(p => p.nome.toLowerCase().includes(q) || (p.codigo??'').toLowerCase().includes(q)) }
      if (filters.categoria) data = data.filter(p => p.categoria === filters.categoria)
      if (filters.baixoEstoque) data = data.filter(p => p.quantidade <= p.estoque_minimo)
      return data.sort((a,b) => a.nome.localeCompare(b.nome))
    }
    const { supabase, userId } = await getSB()
    let q = supabase.from('produtos_estoque').select('*').eq('ativo', true).order('nome')
    if (filters.search) q = q.or(`nome.ilike.%${filters.search}%,codigo.ilike.%${filters.search}%`)
    if (filters.categoria) q = q.eq('categoria', filters.categoria)
    if (filters.baixoEstoque) q = q.lte('quantidade', 'estoque_minimo')  // handled in app
    const { data } = await q
    return (data ?? []) as ProdutoEstoque[]
  },

  async createProduto(data: Omit<ProdutoEstoque,'id'|'created_at'|'updated_at'|'user_id'>): Promise<ProdutoEstoque> {
    if (IS_MOCK) {
      const list = load<ProdutoEstoque>('crm_produtos', MOCK_PRODUTOS)
      const item: ProdutoEstoque = { ...data, id: uid(), created_at: now(), updated_at: now(), user_id: MOCK_USER.id }
      list.push(item); save('crm_produtos', list); return item
    }
    const { supabase, userId } = await getSB()
    const { data: item, error: insertErr } = await supabase.from('produtos_estoque').insert({ ...data, user_id: userId }).select().single()
    if (insertErr) throw new Error(insertErr.message)
    return item as ProdutoEstoque
  },

  async updateProduto(id: string, data: Partial<ProdutoEstoque>): Promise<void> {
    if (IS_MOCK) {
      const list = load<ProdutoEstoque>('crm_produtos', MOCK_PRODUTOS)
      const idx = list.findIndex(p => p.id === id); if (idx === -1) return
      list[idx] = { ...list[idx], ...data, updated_at: now() }; save('crm_produtos', list); return
    }
    const { supabase } = await getSB()
    await supabase.from('produtos_estoque').update({ ...data, updated_at: now() }).eq('id', id)
  },

  async deleteProduto(id: string): Promise<void> {
    if (IS_MOCK) { save('crm_produtos', load<ProdutoEstoque>('crm_produtos', MOCK_PRODUTOS).filter(p => p.id !== id)); return }
    const { supabase } = await getSB()
    await supabase.from('produtos_estoque').update({ ativo: false }).eq('id', id)
  },

  async registrarMovimento(produtoId: string, tipo: MovimentoEstoque['tipo'], quantidade: number, motivo?: string): Promise<void> {
    if (IS_MOCK) {
      const produtos = load<ProdutoEstoque>('crm_produtos', MOCK_PRODUTOS)
      const idx = produtos.findIndex(p => p.id === produtoId); if (idx === -1) return
      const anterior = produtos[idx].quantidade
      const nova = tipo === 'entrada' || tipo === 'devolucao' ? anterior + quantidade : anterior - quantidade
      produtos[idx].quantidade = Math.max(0, nova)
      produtos[idx].updated_at = now()
      save('crm_produtos', produtos)

      const movs = load<MovimentoEstoque>('crm_movimentos', [])
      movs.unshift({ id: uid(), created_at: now(), produto_id: produtoId, tipo, quantidade, quantidade_anterior: anterior, quantidade_nova: nova, motivo, user_id: MOCK_USER.id })
      save('crm_movimentos', movs)
      return
    }
    const { supabase, userId } = await getSB()
    // Get current quantity
    const { data: prod } = await supabase.from('produtos_estoque').select('quantidade').eq('id', produtoId).single()
    const anterior = (prod as any)?.quantidade ?? 0
    const nova = tipo === 'entrada' || tipo === 'devolucao' ? anterior + quantidade : anterior - quantidade
    await supabase.from('produtos_estoque').update({ quantidade: Math.max(0, nova), updated_at: now() }).eq('id', produtoId)
    await supabase.from('movimentos_estoque').insert({ produto_id: produtoId, tipo, quantidade, quantidade_anterior: anterior, quantidade_nova: nova, motivo, user_id: userId })
  },

  async listMovimentos(produtoId?: string): Promise<MovimentoEstoque[]> {
    if (IS_MOCK) {
      let data = load<MovimentoEstoque>('crm_movimentos', [])
      if (produtoId) data = data.filter(m => m.produto_id === produtoId)
      return data.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50)
    }
    const { supabase, userId } = await getSB()
    let q = supabase.from('movimentos_estoque').select('*, produtos_estoque(nome,codigo)').order('created_at', { ascending: false }).limit(100)
    if (produtoId) q = q.eq('produto_id', produtoId)
    const { data } = await q
    return (data ?? []) as MovimentoEstoque[]
  },

  // Import from spreadsheet data (array of rows)
  async importarPlanilha(rows: Partial<ProdutoEstoque>[]): Promise<{ ok: number; erros: number }> {
    let ok = 0, erros = 0
    for (const row of rows) {
      try {
        if (!row.nome) { erros++; continue }
        await estoqueApi.createProduto({
          nome: row.nome ?? '',
          codigo: row.codigo,
          descricao: row.descricao,
          categoria: row.categoria,
          unidade: (row.unidade as any) ?? 'un',
          quantidade: Number(row.quantidade ?? 0),
          estoque_minimo: Number(row.estoque_minimo ?? 0),
          preco_custo: row.preco_custo ? Number(row.preco_custo) : undefined,
          preco_venda: row.preco_venda ? Number(row.preco_venda) : undefined,
          fornecedor: row.fornecedor,
          localizacao: row.localizacao,
          ativo: true,
        })
        ok++
      } catch { erros++ }
    }
    return { ok, erros }
  },
}
