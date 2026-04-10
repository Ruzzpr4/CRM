import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, Search, TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle, Clock, Pencil, Trash2, X } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../contexts/ToastContext'

type StatusCP = 'aberto'|'pago'|'atrasado'|'parcial'|'cancelado'
type StatusCR = 'aberto'|'recebido'|'atrasado'|'parcial'|'cancelado'
type FormaPag = 'dinheiro'|'pix'|'cartao_credito'|'cartao_debito'|'boleto'|'transferencia'|'cheque'|'outro'

const STATUS_LABEL: Record<string,string> = { aberto:'Aberto', pago:'Pago', recebido:'Recebido', atrasado:'Atrasado', parcial:'Parcial', cancelado:'Cancelado' }
const STATUS_COLOR: Record<string,string> = {
  aberto:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  pago:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  recebido:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  atrasado:'bg-red-500/15 text-red-400 border-red-500/30',
  parcial:'bg-amber-500/15 text-amber-400 border-amber-500/30',
  cancelado:'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}
const FORMA_LABEL: Record<string,string> = { dinheiro:'Dinheiro', pix:'PIX', cartao_credito:'Cartão Crédito', cartao_debito:'Cartão Débito', boleto:'Boleto', transferencia:'Transferência', cheque:'Cheque', outro:'Outro' }
const FORMAS: FormaPag[] = ['dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia','cheque','outro']

function fmt(v: number) { return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }) }

interface ContaPagar {
  id: string; descricao: string; fornecedor?: string; valor: number; valor_pago: number
  data_emissao: string; data_vencimento: string; data_pagamento?: string
  status: StatusCP; categoria?: string; observacao?: string; vendedor_id?: string; equipe_id?: string; created_at: string
}
interface ContaReceber {
  id: string; descricao: string; cliente_nome?: string; valor: number; valor_recebido: number
  data_emissao: string; data_vencimento: string; data_recebimento?: string
  status: StatusCR; forma_pagamento?: FormaPag; categoria?: string; observacao?: string; vendedor_id?: string; equipe_id?: string; created_at: string
}

function CPModal({ item, onSave, onClose }: { item?: ContaPagar|null; onSave:(d:any)=>Promise<void>; onClose:()=>void }) {
  const [f, setF] = useState({ descricao:'', fornecedor:'', valor:'', valor_pago:'0', data_emissao:format(new Date(),'yyyy-MM-dd'), data_vencimento:'', data_pagamento:'', status:'aberto' as StatusCP, categoria:'', observacao:'' })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:unknown) => setF(p=>({...p,[k]:v}))
  useEffect(()=>{ if(item) setF({ descricao:item.descricao, fornecedor:item.fornecedor??'', valor:String(item.valor), valor_pago:String(item.valor_pago), data_emissao:item.data_emissao, data_vencimento:item.data_vencimento, data_pagamento:item.data_pagamento??'', status:item.status, categoria:item.categoria??'', observacao:item.observacao??'' }) },[item])
  const handleSubmit = async () => {
    if (!f.descricao||!f.valor||!f.data_vencimento) return
    setSaving(true)
    await onSave({ ...f, valor:Number(f.valor), valor_pago:Number(f.valor_pago), data_pagamento:f.data_pagamento||null })
    setSaving(false)
  }
  return (
    <Modal title={item?'Editar Conta a Pagar':'Nova Conta a Pagar'} onClose={onClose} maxWidth="max-w-lg"
      footer={<><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button><button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Salvando...':'Salvar'}</button></>}>
      <div className="space-y-3">
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Descrição *</label><input value={f.descricao} onChange={e=>set('descricao',e.target.value)} className="input-field"/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Fornecedor</label><input value={f.fornecedor} onChange={e=>set('fornecedor',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Categoria</label><input value={f.categoria} onChange={e=>set('categoria',e.target.value)} className="input-field" placeholder="Ex: Aluguel"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Valor *</label><input type="number" step="0.01" value={f.valor} onChange={e=>set('valor',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Valor Pago</label><input type="number" step="0.01" value={f.valor_pago} onChange={e=>set('valor_pago',e.target.value)} className="input-field"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Emissão</label><input type="date" value={f.data_emissao} onChange={e=>set('data_emissao',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Vencimento *</label><input type="date" value={f.data_vencimento} onChange={e=>set('data_vencimento',e.target.value)} className="input-field"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Data Pagamento</label><input type="date" value={f.data_pagamento} onChange={e=>set('data_pagamento',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Status</label>
            <select value={f.status} onChange={e=>set('status',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {(['aberto','pago','atrasado','parcial','cancelado'] as StatusCP[]).map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Observação</label><textarea value={f.observacao} onChange={e=>set('observacao',e.target.value)} rows={2} className="input-field resize-none"/></div>
      </div>
    </Modal>
  )
}

function CRModal({ item, onSave, onClose }: { item?: ContaReceber|null; onSave:(d:any)=>Promise<void>; onClose:()=>void }) {
  const [f, setF] = useState({ descricao:'', cliente_nome:'', valor:'', valor_recebido:'0', data_emissao:format(new Date(),'yyyy-MM-dd'), data_vencimento:'', data_recebimento:'', status:'aberto' as StatusCR, forma_pagamento:'pix' as FormaPag, categoria:'', observacao:'' })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:unknown) => setF(p=>({...p,[k]:v}))
  useEffect(()=>{ if(item) setF({ descricao:item.descricao, cliente_nome:item.cliente_nome??'', valor:String(item.valor), valor_recebido:String(item.valor_recebido), data_emissao:item.data_emissao, data_vencimento:item.data_vencimento, data_recebimento:item.data_recebimento??'', status:item.status, forma_pagamento:item.forma_pagamento??'pix', categoria:item.categoria??'', observacao:item.observacao??'' }) },[item])
  const handleSubmit = async () => {
    if (!f.descricao||!f.valor||!f.data_vencimento) return
    setSaving(true)
    await onSave({ ...f, valor:Number(f.valor), valor_recebido:Number(f.valor_recebido), data_recebimento:f.data_recebimento||null })
    setSaving(false)
  }
  return (
    <Modal title={item?'Editar Conta a Receber':'Nova Conta a Receber'} onClose={onClose} maxWidth="max-w-lg"
      footer={<><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button><button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Salvando...':'Salvar'}</button></>}>
      <div className="space-y-3">
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Descrição *</label><input value={f.descricao} onChange={e=>set('descricao',e.target.value)} className="input-field"/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Cliente</label><input value={f.cliente_nome} onChange={e=>set('cliente_nome',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Categoria</label><input value={f.categoria} onChange={e=>set('categoria',e.target.value)} className="input-field" placeholder="Ex: Mensalidade"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Valor *</label><input type="number" step="0.01" value={f.valor} onChange={e=>set('valor',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Valor Recebido</label><input type="number" step="0.01" value={f.valor_recebido} onChange={e=>set('valor_recebido',e.target.value)} className="input-field"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Vencimento *</label><input type="date" value={f.data_vencimento} onChange={e=>set('data_vencimento',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Data Recebimento</label><input type="date" value={f.data_recebimento} onChange={e=>set('data_recebimento',e.target.value)} className="input-field"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Forma Pagamento</label>
            <select value={f.forma_pagamento} onChange={e=>set('forma_pagamento',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {FORMAS.map(f=><option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Status</label>
            <select value={f.status} onChange={e=>set('status',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {(['aberto','recebido','atrasado','parcial','cancelado'] as StatusCR[]).map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Observação</label><textarea value={f.observacao} onChange={e=>set('observacao',e.target.value)} rows={2} className="input-field resize-none"/></div>
      </div>
    </Modal>
  )
}

export default function Financeiro() {
  const { ownerId, permissions, equipeId } = useAuth()
  const { toast } = useToast()
  const [aba, setAba] = useState<'pagar'|'receber'|'fluxo'>('pagar')
  const [cp, setCp] = useState<ContaPagar[]>([])
  const [cr, setCr] = useState<ContaReceber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalCP, setModalCP] = useState(false)
  const [modalCR, setModalCR] = useState(false)
  const [editCP, setEditCP] = useState<ContaPagar|null>(null)
  const [editCR, setEditCR] = useState<ContaReceber|null>(null)
  const [deletando, setDeletando] = useState<{id:string;tipo:'cp'|'cr'}|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const uid = ownerId
    const [rcp, rcr] = await Promise.all([
      supabase.from('contas_pagar').select('*').eq('user_id', uid).order('data_vencimento'),
      supabase.from('contas_receber').select('*').eq('user_id', uid).order('data_vencimento'),
    ])
    const hoje = format(new Date(), 'yyyy-MM-dd')
    let cpData = (rcp.data ?? []) as ContaPagar[]
    let crData = (rcr.data ?? []) as ContaReceber[]

    // Filtra por equipe para supervisor e vendedor
    if (!permissions.isAdmin) {
      if (equipeId) {
        cpData = cpData.filter(c => c.equipe_id === equipeId)
        crData = crData.filter(c => c.equipe_id === equipeId)
      } else {
        cpData = []
        crData = []
      }
    }

    setCp(cpData.map(c => c.status === 'aberto' && c.data_vencimento < hoje ? {...c, status:'atrasado'} : c))
    setCr(crData.map(c => c.status === 'aberto' && c.data_vencimento < hoje ? {...c, status:'atrasado'} : c))
    setLoading(false)
  }, [ownerId, permissions.isAdmin, permissions.role, equipeId])

  useEffect(() => { load() }, [load])

  const saveCP = async (data: any) => {
    if (editCP) {
      await supabase.from('contas_pagar').update({...data, updated_at: new Date().toISOString()}).eq('id', editCP.id)
      toast.success('Conta atualizada')
    } else {
      await supabase.from('contas_pagar').insert({...data, user_id: ownerId, equipe_id: equipeId || null})
      toast.success('Conta cadastrada')
    }
    setModalCP(false); setEditCP(null); load()
  }

  const saveCR = async (data: any) => {
    if (editCR) {
      await supabase.from('contas_receber').update({...data, updated_at: new Date().toISOString()}).eq('id', editCR.id)
      toast.success('Conta atualizada')
    } else {
      await supabase.from('contas_receber').insert({...data, user_id: ownerId, equipe_id: equipeId || null})
      toast.success('Conta cadastrada')
    }
    setModalCR(false); setEditCR(null); load()
  }

  const confirmarDelete = async () => {
    if (!deletando) return
    if (deletando.tipo === 'cp') await supabase.from('contas_pagar').delete().eq('id', deletando.id)
    else await supabase.from('contas_receber').delete().eq('id', deletando.id)
    toast.success('Registro excluído')
    setDeletando(null); load()
  }

  const cpFilt = cp.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search || c.descricao.toLowerCase().includes(q) || (c.fornecedor??'').toLowerCase().includes(q)
    const matchStatus = !filtroStatus || c.status === filtroStatus
    return matchSearch && matchStatus
  })
  const crFilt = cr.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search || c.descricao.toLowerCase().includes(q) || (c.cliente_nome??'').toLowerCase().includes(q)
    const matchStatus = !filtroStatus || c.status === filtroStatus
    return matchSearch && matchStatus
  })

  const totalPagar = cp.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+(c.valor-c.valor_pago),0)
  const totalReceber = cr.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+(c.valor-c.valor_recebido),0)
  const totalAtrasadoP = cp.filter(c=>c.status==='atrasado').reduce((s,c)=>s+(c.valor-c.valor_pago),0)
  const totalAtrasadoR = cr.filter(c=>c.status==='atrasado').reduce((s,c)=>s+(c.valor-c.valor_recebido),0)

  const StatCard = ({label,value,icon:Icon,color}:{label:string;value:string;icon:any;color:string}) => (
    <div className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{color:'var(--text-muted)'}}>{label}</span>
        <Icon size={16} style={{color}} />
      </div>
      <p className="text-xl font-bold" style={{color:'var(--text-primary)'}}>{value}</p>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{color:'var(--text-primary)'}}>Financeiro</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Contas a pagar e receber</p>
        </div>
        {(permissions.isAdmin || permissions.role === 'supervisor') && (
          <div className="flex gap-2">
            <button onClick={()=>{setEditCP(null);setModalCP(true)}} className="btn-ghost"><TrendingDown size={14}/> A Pagar</button>
            <button onClick={()=>{setEditCR(null);setModalCR(true)}} className="btn-primary"><TrendingUp size={14}/> A Receber</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total a Pagar" value={fmt(totalPagar)} icon={TrendingDown} color="#f87171"/>
        <StatCard label="Total a Receber" value={fmt(totalReceber)} icon={TrendingUp} color="#34d399"/>
        <StatCard label="Atrasado (Pagar)" value={fmt(totalAtrasadoP)} icon={AlertTriangle} color="#f59e0b"/>
        <StatCard label="Saldo Projetado" value={fmt(totalReceber-totalPagar)} icon={DollarSign} color={totalReceber-totalPagar>=0?'#34d399':'#f87171'}/>
      </div>

      <div className="flex gap-1 rounded-xl p-1" style={{background:'var(--bg-elevated)'}}>
        {(['pagar','receber','fluxo'] as const).map(t=>(
          <button key={t} onClick={()=>setAba(t)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{background:aba===t?'var(--bg-card)':'transparent', color:aba===t?'var(--text-primary)':'var(--text-muted)', border:aba===t?'1px solid var(--border)':'1px solid transparent'}}>
            {t==='pagar'?'Contas a Pagar':t==='receber'?'Contas a Receber':'Fluxo de Caixa'}
          </button>
        ))}
      </div>

      {aba !== 'fluxo' && (
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." className="input-field" style={{paddingLeft:'2.25rem'}}/>
          </div>
          <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} className="input-field w-40" style={{appearance:'none'}}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/></div>
      ) : aba === 'pagar' ? (
        <div className="space-y-2">
          {cpFilt.length === 0 ? <p className="text-center py-12 text-sm" style={{color:'var(--text-muted)'}}>Nenhuma conta a pagar</p> : cpFilt.map(c=>(
            <div key={c.id} className="rounded-xl p-4 flex items-center gap-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{c.descricao}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs border ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                <div className="flex gap-4 text-xs" style={{color:'var(--text-muted)'}}>
                  {c.fornecedor&&<span>{c.fornecedor}</span>}
                  <span>Vence: {format(new Date(c.data_vencimento+'T12:00:00'),'dd/MM/yyyy')}</span>
                  {c.categoria&&<span>{c.categoria}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm" style={{color:'var(--text-primary)'}}>{fmt(c.valor)}</p>
                {c.valor_pago>0&&<p className="text-xs" style={{color:'var(--text-muted)'}}>Pago: {fmt(c.valor_pago)}</p>}
              </div>
              {(permissions.isAdmin||permissions.role==="supervisor")&&(
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={()=>{setEditCP(c);setModalCP(true)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}><Pencil size={13}/></button>
                  <button onClick={()=>setDeletando({id:c.id,tipo:'cp'})} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:4}}><Trash2 size={13}/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : aba === 'receber' ? (
        <div className="space-y-2">
          {crFilt.length === 0 ? <p className="text-center py-12 text-sm" style={{color:'var(--text-muted)'}}>Nenhuma conta a receber</p> : crFilt.map(c=>(
            <div key={c.id} className="rounded-xl p-4 flex items-center gap-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{c.descricao}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs border ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  {c.forma_pagamento&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-muted)'}}>{FORMA_LABEL[c.forma_pagamento]}</span>}
                </div>
                <div className="flex gap-4 text-xs" style={{color:'var(--text-muted)'}}>
                  {c.cliente_nome&&<span>{c.cliente_nome}</span>}
                  <span>Vence: {format(new Date(c.data_vencimento+'T12:00:00'),'dd/MM/yyyy')}</span>
                  {c.categoria&&<span>{c.categoria}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm" style={{color:'var(--text-primary)'}}>{fmt(c.valor)}</p>
                {c.valor_recebido>0&&<p className="text-xs" style={{color:'var(--text-muted)'}}>Recebido: {fmt(c.valor_recebido)}</p>}
              </div>
              {(permissions.isAdmin||permissions.role==="supervisor")&&(
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={()=>{setEditCR(c);setModalCR(true)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}><Pencil size={13}/></button>
                  <button onClick={()=>setDeletando({id:c.id,tipo:'cr'})} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:4}}><Trash2 size={13}/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <h3 className="font-semibold text-sm mb-4" style={{color:'var(--text-primary)'}}>Resumo do Fluxo de Caixa</h3>
            <div className="space-y-3">
              {[...cp.filter(c=>c.status!=='cancelado').map(c=>({tipo:'saida',desc:c.descricao,valor:c.valor,data:c.data_vencimento,status:c.status})),
                ...cr.filter(c=>c.status!=='cancelado').map(c=>({tipo:'entrada',desc:c.descricao,valor:c.valor,data:c.data_vencimento,status:c.status}))]
                .sort((a,b)=>a.data.localeCompare(b.data))
                .map((l,i)=>(
                <div key={i} className="flex items-center justify-between py-2" style={{borderBottom:'0.5px solid var(--border)'}}>
                  <div className="flex items-center gap-3">
                    {l.tipo==='entrada'?<TrendingUp size={14} style={{color:'#34d399'}}/>:<TrendingDown size={14} style={{color:'#f87171'}}/>}
                    <div>
                      <p className="text-sm" style={{color:'var(--text-primary)'}}>{l.desc}</p>
                      <p className="text-xs" style={{color:'var(--text-muted)'}}>{format(new Date(l.data+'T12:00:00'),'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  <span className="font-medium text-sm" style={{color:l.tipo==='entrada'?'#34d399':'#f87171'}}>
                    {l.tipo==='entrada'?'+':'-'}{fmt(l.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalCP&&<CPModal item={editCP} onSave={saveCP} onClose={()=>{setModalCP(false);setEditCP(null)}}/>}
      {modalCR&&<CRModal item={editCR} onSave={saveCR} onClose={()=>{setModalCR(false);setEditCR(null)}}/>}
      {deletando&&<ConfirmModal title="Excluir registro" message="Confirma a exclusão?" confirmLabel="Excluir" danger onConfirm={confirmarDelete} onCancel={()=>setDeletando(null)}/>}
    </div>
  )
}