import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, Search, CheckCircle, Clock, DollarSign, Percent, Pencil, Trash2, Award } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../contexts/ToastContext'
import { vendedoresApi } from '../lib/api'
import { Vendedor } from '../types/vendedor'

type StatusCom = 'pendente'|'validado'|'pago'|'cancelado'
type TipoCom = 'venda'|'supervisor'|'bonus'|'desconto'

const STATUS_LABEL: Record<StatusCom,string> = { pendente:'Pendente', validado:'Validado', pago:'Pago', cancelado:'Cancelado' }
const STATUS_COLOR: Record<StatusCom,string> = {
  pendente:'bg-amber-500/15 text-amber-400 border-amber-500/30',
  validado:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  pago:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelado:'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}
const TIPO_LABEL: Record<TipoCom,string> = { venda:'Venda', supervisor:'Supervisor', bonus:'Bônus', desconto:'Desconto' }

function fmt(v:number) { return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }

interface Comissao {
  id: string; vendedor_id: string; descricao: string; valor_base: number
  percentual: number; valor_comissao: number; tipo: TipoCom; status: StatusCom
  periodo_ref?: string; data_referencia?: string; data_pagamento?: string
  observacao?: string; created_at: string
  vendedores?: { nome: string }
}

function ComissaoModal({ item, vendedores, onSave, onClose }: { item?: Comissao|null; vendedores: Vendedor[]; onSave:(d:any)=>Promise<void>; onClose:()=>void }) {
  const [f, setF] = useState({ vendedor_id:'', descricao:'', valor_base:'', percentual:'', valor_comissao:'', tipo:'venda' as TipoCom, status:'pendente' as StatusCom, periodo_ref:format(new Date(),'yyyy-MM'), data_referencia:format(new Date(),'yyyy-MM-dd'), data_pagamento:'', observacao:'' })
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:unknown) => setF(p=>({...p,[k]:v}))

  useEffect(()=>{
    if (item) setF({ vendedor_id:item.vendedor_id, descricao:item.descricao, valor_base:String(item.valor_base), percentual:String(item.percentual), valor_comissao:String(item.valor_comissao), tipo:item.tipo, status:item.status, periodo_ref:item.periodo_ref??'', data_referencia:item.data_referencia??'', data_pagamento:item.data_pagamento??'', observacao:item.observacao??'' })
  },[item])

  // Calcula comissão automaticamente
  useEffect(()=>{
    const base = Number(f.valor_base)
    const perc = Number(f.percentual)
    if (base && perc) set('valor_comissao', String(Math.round(base * perc / 100 * 100)/100))
  },[f.valor_base, f.percentual])

  const handleSubmit = async () => {
    if (!f.vendedor_id||!f.descricao||!f.valor_base) return
    setSaving(true)
    await onSave({ ...f, valor_base:Number(f.valor_base), percentual:Number(f.percentual), valor_comissao:Number(f.valor_comissao), data_pagamento:f.data_pagamento||null, data_referencia:f.data_referencia||null })
    setSaving(false)
  }

  return (
    <Modal title={item?'Editar Comissão':'Nova Comissão'} onClose={onClose} maxWidth="max-w-lg"
      footer={<><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button><button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Salvando...':'Salvar'}</button></>}>
      <div className="space-y-3">
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Vendedor *</label>
          <select value={f.vendedor_id} onChange={e=>set('vendedor_id',e.target.value)} className="input-field" style={{appearance:'none'}}>
            <option value="">Selecione...</option>
            {vendedores.filter(v=>v.situacao).map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Descrição *</label><input value={f.descricao} onChange={e=>set('descricao',e.target.value)} className="input-field" placeholder="Ex: Comissão venda curso React"/></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Valor Base *</label><input type="number" step="0.01" value={f.valor_base} onChange={e=>set('valor_base',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>% Comissão</label><input type="number" step="0.1" max="100" value={f.percentual} onChange={e=>set('percentual',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Valor Comissão</label><input type="number" step="0.01" value={f.valor_comissao} onChange={e=>set('valor_comissao',e.target.value)} className="input-field"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Tipo</label>
            <select value={f.tipo} onChange={e=>set('tipo',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {(['venda','supervisor','bonus','desconto'] as TipoCom[]).map(t=><option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Status</label>
            <select value={f.status} onChange={e=>set('status',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {(['pendente','validado','pago','cancelado'] as StatusCom[]).map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Período Ref.</label><input type="month" value={f.periodo_ref} onChange={e=>set('periodo_ref',e.target.value)} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Data Pagamento</label><input type="date" value={f.data_pagamento} onChange={e=>set('data_pagamento',e.target.value)} className="input-field"/></div>
        </div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Observação</label><textarea value={f.observacao} onChange={e=>set('observacao',e.target.value)} rows={2} className="input-field resize-none"/></div>
      </div>
    </Modal>
  )
}

export default function Comissoes() {
  const { ownerId, permissions, vendedorId, equipeId } = useAuth()
  const { toast } = useToast()
  const [comissoes, setComissoes] = useState<Comissao[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Comissao|null>(null)
  const [deletando, setDeletando] = useState<Comissao|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [vends, { data }] = await Promise.all([
      vendedoresApi.list({ equipe_id: equipeId || undefined }),
      supabase.from('comissoes').select('*, vendedores(nome)').eq('user_id', ownerId).order('created_at', { ascending: false })
    ])
    setVendedores(vends)
    let result = (data ?? []) as Comissao[]

    if (permissions.isAdmin) {
      // Admin vê tudo
    } else if (permissions.role === 'supervisor' && equipeId) {
      // Supervisor vê apenas comissões da sua equipe
      result = result.filter(c => (c as any).equipe_id === equipeId)
    } else if (permissions.role === 'supervisor' && !equipeId) {
      result = []
    } else if (vendedorId) {
      // Vendedor vê só as próprias
      result = result.filter(c => c.vendedor_id === vendedorId)
    }

    setComissoes(result)
    setLoading(false)
  }, [ownerId, permissions.isAdmin, permissions.role, vendedorId, equipeId])

  useEffect(() => { load() }, [load])

  const save = async (data: any) => {
    if (editing) {
      await supabase.from('comissoes').update({...data, updated_at: new Date().toISOString()}).eq('id', editing.id)
      toast.success('Comissão atualizada')
    } else {
      await supabase.from('comissoes').insert({...data, user_id: ownerId, equipe_id: equipeId || null})
      toast.success('Comissão cadastrada')
    }
    setModal(false); setEditing(null); load()
  }

  const validar = async (c: Comissao) => {
    await supabase.from('comissoes').update({ status: 'validado', updated_at: new Date().toISOString() }).eq('id', c.id)
    toast.success('Comissão validada')
    load()
  }

  const marcarPago = async (c: Comissao) => {
    await supabase.from('comissoes').update({ status: 'pago', data_pagamento: format(new Date(),'yyyy-MM-dd'), updated_at: new Date().toISOString() }).eq('id', c.id)
    toast.success('Comissão marcada como paga')
    load()
  }

  const filtradas = comissoes.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search || c.descricao.toLowerCase().includes(q) || (c.vendedores?.nome??'').toLowerCase().includes(q)
    const matchStatus = !filtroStatus || c.status === filtroStatus
    const matchPeriodo = !filtroPeriodo || c.periodo_ref === filtroPeriodo
    return matchSearch && matchStatus && matchPeriodo
  })

  const totalPendente = filtradas.filter(c=>c.status==='pendente').reduce((s,c)=>s+c.valor_comissao,0)
  const totalValidado = filtradas.filter(c=>c.status==='validado').reduce((s,c)=>s+c.valor_comissao,0)
  const totalPago = filtradas.filter(c=>c.status==='pago').reduce((s,c)=>s+c.valor_comissao,0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{color:'var(--text-primary)'}}>Comissões</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Gestão de comissões por vendedor</p>
        </div>
        {(permissions.isAdmin || permissions.role === 'supervisor') && (
          <button onClick={()=>{setEditing(null);setModal(true)}} className="btn-primary"><Plus size={14}/> Nova Comissão</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[{label:'Pendente',val:totalPendente,color:'#f59e0b'},{label:'Validado',val:totalValidado,color:'#60a5fa'},{label:'Pago',val:totalPago,color:'#34d399'}].map(s=>(
          <div key={s.label} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <p className="text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>{s.label}</p>
            <p className="text-xl font-bold" style={{color:s.color}}>{fmt(s.val)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." className="input-field" style={{paddingLeft:'2.25rem'}}/>
        </div>
        <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} className="input-field w-36" style={{appearance:'none'}}>
          <option value="">Todos status</option>
          {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <input type="month" value={filtroPeriodo} onChange={e=>setFiltroPeriodo(e.target.value)} className="input-field w-40"/>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/></div>
      ) : filtradas.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{color:'var(--text-muted)'}}>Nenhuma comissão encontrada</p>
      ) : (
        <div className="space-y-2">
          {filtradas.map(c=>(
            <div key={c.id} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <div className="flex items-start gap-3">
                <Award size={16} style={{color:'var(--accent)',marginTop:2,flexShrink:0}}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{c.descricao}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs border ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-muted)'}}>{TIPO_LABEL[c.tipo]}</span>
                  </div>
                  <div className="flex gap-4 text-xs flex-wrap" style={{color:'var(--text-muted)'}}>
                    <span>{c.vendedores?.nome??'—'}</span>
                    {c.periodo_ref&&<span>Ref: {c.periodo_ref}</span>}
                    <span>Base: {fmt(c.valor_base)}</span>
                    <span>{c.percentual}%</span>
                    {c.data_pagamento&&<span>Pago em: {format(new Date(c.data_pagamento+'T12:00:00'),'dd/MM/yyyy')}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-base" style={{color:'var(--accent)'}}>{fmt(c.valor_comissao)}</p>
                </div>
                {(permissions.isAdmin || permissions.role === "supervisor") && (
                  <div className="flex gap-1 flex-shrink-0">
                    {c.status==='pendente'&&<button onClick={()=>validar(c)} title="Validar" style={{background:'none',border:'none',cursor:'pointer',color:'#60a5fa',padding:4}}><CheckCircle size={14}/></button>}
                    {c.status==='validado'&&<button onClick={()=>marcarPago(c)} title="Marcar como pago" style={{background:'none',border:'none',cursor:'pointer',color:'#34d399',padding:4}}><DollarSign size={14}/></button>}
                    <button onClick={()=>{setEditing(c);setModal(true)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}><Pencil size={13}/></button>
                    <button onClick={()=>setDeletando(c)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:4}}><Trash2 size={13}/></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal&&<ComissaoModal item={editing} vendedores={vendedores} onSave={save} onClose={()=>{setModal(false);setEditing(null)}}/>}
      {deletando&&<ConfirmModal title="Excluir comissão" message={`Excluir comissão de "${deletando.descricao}"?`} confirmLabel="Excluir" danger onConfirm={async()=>{ await supabase.from('comissoes').delete().eq('id',deletando.id); setDeletando(null); load() }} onCancel={()=>setDeletando(null)}/>}
    </div>
  )
}