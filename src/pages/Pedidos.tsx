import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, Search, ShoppingCart, CheckCircle, Clock, XCircle, Pencil, Trash2, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { format } from 'date-fns'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../contexts/ToastContext'
import { clientesApi, vendedoresApi } from '../lib/api'
import { Cliente } from '../types'
import { Vendedor } from '../types/vendedor'

type StatusPed = 'digitado'|'verificado'|'aprovado'|'concluido'|'cancelado'
type FormaPag = 'dinheiro'|'pix'|'cartao_credito'|'cartao_debito'|'boleto'|'transferencia'|'cheque'|'outro'

const STATUS_LABEL: Record<StatusPed,string> = { digitado:'Digitado', verificado:'Verificado', aprovado:'Aprovado', concluido:'Concluído', cancelado:'Cancelado' }
const STATUS_COLOR: Record<StatusPed,string> = {
  digitado:'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  verificado:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  aprovado:'bg-violet-500/15 text-violet-400 border-violet-500/30',
  concluido:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelado:'bg-red-500/15 text-red-400 border-red-500/30',
}
const FORMA_LABEL: Record<FormaPag,string> = { dinheiro:'Dinheiro', pix:'PIX', cartao_credito:'Cartão Crédito', cartao_debito:'Cartão Débito', boleto:'Boleto', transferencia:'Transferência', cheque:'Cheque', outro:'Outro' }
const FORMAS: FormaPag[] = ['dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia','cheque','outro']
const STATUS_FLOW: StatusPed[] = ['digitado','verificado','aprovado','concluido']

function fmt(v:number) { return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }

interface PedidoItem { id?:string; descricao:string; quantidade:number; preco_unitario:number; desconto:number; percentual_comissao:number; subtotal:number }
interface Pedido {
  id:string; numero:number; cliente_id?:string; cliente_nome?:string; vendedor_id?:string
  status:StatusPed; forma_pagamento?:FormaPag; valor_subtotal:number; valor_desconto:number
  valor_acrescimo:number; valor_total:number; data_pedido:string; observacao?:string
  motivo_cancelamento?:string; created_at:string
  clientes?:{nome:string}; vendedores?:{nome:string}
  pedidos_itens?: PedidoItem[]
}

function ItemRow({ item, onChange, onRemove, readOnly }: { item:PedidoItem; onChange:(k:string,v:any)=>void; onRemove:()=>void; readOnly?:boolean }) {
  return (
    <div className="grid gap-2 mb-2" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto'}}>
      <input value={item.descricao} onChange={e=>onChange('descricao',e.target.value)} placeholder="Produto/Serviço" className="input-field text-xs py-1.5" disabled={readOnly}/>
      <input type="number" value={item.quantidade} onChange={e=>onChange('quantidade',Number(e.target.value))} placeholder="Qtd" className="input-field text-xs py-1.5" disabled={readOnly}/>
      <input type="number" step="0.01" value={item.preco_unitario} onChange={e=>onChange('preco_unitario',Number(e.target.value))} placeholder="Preço" className="input-field text-xs py-1.5" disabled={readOnly}/>
      <input type="number" step="0.01" value={item.desconto} onChange={e=>onChange('desconto',Number(e.target.value))} placeholder="Desc." className="input-field text-xs py-1.5" disabled={readOnly}/>
      <input type="number" step="0.1" value={item.percentual_comissao} onChange={e=>onChange('percentual_comissao',Number(e.target.value))} placeholder="% Com." className="input-field text-xs py-1.5" disabled={readOnly}/>
      {!readOnly&&<button onClick={onRemove} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'0 4px'}}><XCircle size={14}/></button>}
    </div>
  )
}

function PedidoModal({ item, clientes, vendedores, onSave, onClose }: { item?: Pedido|null; clientes:Cliente[]; vendedores:Vendedor[]; onSave:(d:any,itens:PedidoItem[])=>Promise<void>; onClose:()=>void }) {
  const [f, setF] = useState({ cliente_id:'', cliente_nome:'', vendedor_id:'', status:'digitado' as StatusPed, forma_pagamento:'pix' as FormaPag, valor_desconto:'0', valor_acrescimo:'0', data_pedido:format(new Date(),'yyyy-MM-dd'), observacao:'', motivo_cancelamento:'' })
  const [itens, setItens] = useState<PedidoItem[]>([{ descricao:'', quantidade:1, preco_unitario:0, desconto:0, percentual_comissao:0, subtotal:0 }])
  const [saving, setSaving] = useState(false)
  const set = (k:string,v:unknown) => setF(p=>({...p,[k]:v}))

  useEffect(()=>{
    if (item) {
      setF({ cliente_id:item.cliente_id??'', cliente_nome:item.cliente_nome??'', vendedor_id:item.vendedor_id??'', status:item.status, forma_pagamento:item.forma_pagamento??'pix', valor_desconto:String(item.valor_desconto), valor_acrescimo:String(item.valor_acrescimo), data_pedido:item.data_pedido, observacao:item.observacao??'', motivo_cancelamento:item.motivo_cancelamento??'' })
      if (item.pedidos_itens?.length) setItens(item.pedidos_itens)
    }
  },[item])

  const updateItem = (i:number, k:string, v:any) => {
    setItens(prev => {
      const next = [...prev]
      next[i] = {...next[i], [k]:v}
      const it = next[i]
      next[i].subtotal = Math.max(0, (it.quantidade * it.preco_unitario) - it.desconto)
      return next
    })
  }

  const addItem = () => setItens(p=>[...p,{ descricao:'', quantidade:1, preco_unitario:0, desconto:0, percentual_comissao:0, subtotal:0 }])
  const removeItem = (i:number) => setItens(p=>p.filter((_,j)=>j!==i))

  const subtotal = itens.reduce((s,i)=>s+i.subtotal,0)
  const total = subtotal - Number(f.valor_desconto) + Number(f.valor_acrescimo)

  const [formError, setFormError] = useState('')
  const handleSubmit = async () => {
    setFormError('')
    if (!itens.some(i=>i.descricao.trim())) {
      setFormError('Adicione ao menos um item com descrição preenchida.')
      return
    }
    setSaving(true)
    const clienteNome = clientes.find(c=>c.id===f.cliente_id)?.nome ?? f.cliente_nome
    await onSave({ ...f, cliente_id:f.cliente_id||null, vendedor_id:f.vendedor_id||null, cliente_nome:clienteNome, valor_subtotal:subtotal, valor_desconto:Number(f.valor_desconto), valor_acrescimo:Number(f.valor_acrescimo), valor_total:total, motivo_cancelamento:f.motivo_cancelamento||null }, itens.filter(i=>i.descricao))
    setSaving(false)
  }

  return (
    <Modal title={item?`Editar Pedido #${item.numero}`:'Novo Pedido'} onClose={onClose} maxWidth="max-w-2xl"
      footer={<><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button><button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Salvando...':'Salvar'}</button></>}>
      {formError&&<div className="mx-1 mb-2 px-3 py-2 rounded-lg text-sm" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171'}}>{formError}</div>}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Cliente</label>
            <select value={f.cliente_id} onChange={e=>set('cliente_id',e.target.value)} className="input-field" style={{appearance:'none'}}>
              <option value="">Selecione ou digite abaixo</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Nome do Cliente (manual)</label><input value={f.cliente_nome} onChange={e=>set('cliente_nome',e.target.value)} className="input-field" placeholder="Ou digite o nome"/></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Vendedor</label>
            <select value={f.vendedor_id} onChange={e=>set('vendedor_id',e.target.value)} className="input-field" style={{appearance:'none'}}>
              <option value="">— Nenhum —</option>
              {vendedores.filter(v=>v.situacao).map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Forma Pagamento</label>
            <select value={f.forma_pagamento} onChange={e=>set('forma_pagamento',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {FORMAS.map(f=><option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Data</label><input type="date" value={f.data_pedido} onChange={e=>set('data_pedido',e.target.value)} className="input-field"/></div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium" style={{color:'var(--text-secondary)'}}>Itens do Pedido</label>
            <button onClick={addItem} className="btn-ghost text-xs py-1 px-3"><Plus size={12}/> Adicionar</button>
          </div>
          <div className="text-xs font-medium grid gap-2 mb-1 px-1" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto', color:'var(--text-muted)'}}>
            <span>Produto/Serviço</span><span>Qtd</span><span>Preço</span><span>Desc.</span><span>%Com.</span><span/>
          </div>
          {itens.map((it,i)=><ItemRow key={i} item={it} onChange={(k,v)=>updateItem(i,k,v)} onRemove={()=>removeItem(i)}/>)}
        </div>

        <div className="rounded-xl p-3" style={{background:'var(--bg-elevated)'}}>
          <div className="flex justify-between text-sm mb-1"><span style={{color:'var(--text-muted)'}}>Subtotal</span><span style={{color:'var(--text-primary)'}}>{fmt(subtotal)}</span></div>
          <div className="grid grid-cols-2 gap-3 my-2">
            <div><label className="block text-xs mb-1" style={{color:'var(--text-muted)'}}>Desconto</label><input type="number" step="0.01" value={f.valor_desconto} onChange={e=>set('valor_desconto',e.target.value)} className="input-field py-1"/></div>
            <div><label className="block text-xs mb-1" style={{color:'var(--text-muted)'}}>Acréscimo</label><input type="number" step="0.01" value={f.valor_acrescimo} onChange={e=>set('valor_acrescimo',e.target.value)} className="input-field py-1"/></div>
          </div>
          <div className="flex justify-between font-bold"><span style={{color:'var(--text-primary)'}}>Total</span><span style={{color:'var(--accent)'}}>{fmt(total)}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Status</label>
            <select value={f.status} onChange={e=>set('status',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {(['digitado','verificado','aprovado','concluido','cancelado'] as StatusPed[]).map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          {f.status==='cancelado'&&<div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Motivo Cancelamento</label><input value={f.motivo_cancelamento} onChange={e=>set('motivo_cancelamento',e.target.value)} className="input-field"/></div>}
        </div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Observação</label><textarea value={f.observacao} onChange={e=>set('observacao',e.target.value)} rows={2} className="input-field resize-none"/></div>
      </div>
    </Modal>
  )
}

export default function Pedidos() {
  const { ownerId, permissions, vendedorId, equipeId, user } = useAuth()
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Pedido|null>(null)
  const [expanded, setExpanded] = useState<string|null>(null)
  const [deletando, setDeletando] = useState<Pedido|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [cls, vends, { data }] = await Promise.all([
      clientesApi.list(),
      vendedoresApi.list({ equipe_id: equipeId || undefined }),
      supabase.from('pedidos').select('*, pedidos_itens(*)').eq('user_id', ownerId).order('created_at', { ascending: false })
    ])
    setClientes(cls)
    setVendedores(vends)
    let result = (data ?? []) as Pedido[]

    if (permissions.isAdmin) {
      // Admin vê tudo
    } else if (permissions.role === 'supervisor' && equipeId) {
      // Supervisor vê apenas pedidos da sua equipe
      result = result.filter(p => (p as any).equipe_id === equipeId)
    } else if (permissions.role === 'supervisor' && !equipeId) {
      result = []
    } else if (vendedorId) {
      // Vendedor vê só os próprios
      result = result.filter(p => p.vendedor_id === vendedorId)
    }

    setPedidos(result)
    setLoading(false)
  }, [ownerId, permissions.isAdmin, permissions.role, vendedorId, equipeId])

  useEffect(() => { load() }, [load])

  const save = async (data: any, itens: PedidoItem[]) => {
    try {
      let pedidoId = editing?.id
      if (editing) {
        const { error } = await supabase.from('pedidos').update({...data, updated_at: new Date().toISOString()}).eq('id', editing.id)
        if (error) throw new Error(error.message)
        await supabase.from('pedidos_itens').delete().eq('pedido_id', editing.id)
      } else {
        const { data: novo, error } = await supabase.from('pedidos').insert({...data, user_id: ownerId, equipe_id: equipeId || null}).select().single()
        if (error) throw new Error(error.message)
        pedidoId = novo?.id
      }
      if (pedidoId && itens.length) {
        const { error: errItens } = await supabase.from('pedidos_itens').insert(itens.map(it=>({...it, pedido_id:pedidoId, user_id:ownerId, equipe_id:equipeId||null})))
        if (errItens) throw new Error(errItens.message)
      }

      // Gera comissões automaticamente se o pedido tem vendedor e itens com % comissão
      if (!editing && data.vendedor_id && pedidoId) {
        const itensCom = itens.filter(it => it.percentual_comissao > 0 && it.descricao)
        if (itensCom.length > 0) {
          const periodo_ref = format(new Date(), 'yyyy-MM')
          const comissoes = itensCom.map(it => ({
            vendedor_id: data.vendedor_id,
            pedido_id: pedidoId,
            descricao: `Comissão: ${it.descricao} (Pedido #)`,
            valor_base: it.subtotal,
            percentual: it.percentual_comissao,
            valor_comissao: Math.round(it.subtotal * it.percentual_comissao / 100 * 100) / 100,
            tipo: 'venda',
            status: 'pendente',
            periodo_ref,
            data_referencia: data.data_pedido,
            user_id: ownerId,
            equipe_id: equipeId || null,
          }))
          await supabase.from('comissoes').insert(comissoes)
        }
      }

      toast.success(editing?'Pedido atualizado':'Pedido criado')
      setModal(false); setEditing(null); load()
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message ?? 'Tente novamente'))
    }
  }

  const avancarStatus = async (p: Pedido) => {
    const idx = STATUS_FLOW.indexOf(p.status)
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return
    const next = STATUS_FLOW[idx + 1]
    await supabase.from('pedidos').update({ status: next, updated_at: new Date().toISOString() }).eq('id', p.id)
    toast.success(`Pedido ${STATUS_LABEL[next]}`)
    load()
  }

  const filtrados = pedidos.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !search || String(p.numero).includes(q) || (p.cliente_nome??'').toLowerCase().includes(q)
    const matchStatus = !filtroStatus || p.status === filtroStatus
    return matchSearch && matchStatus
  })

  const totalGeral = filtrados.filter(p=>p.status!=='cancelado').reduce((s,p)=>s+p.valor_total,0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{color:'var(--text-primary)'}}>Pedidos</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{filtrados.length} pedidos · Total: {fmt(totalGeral)}</p>
        </div>
        <button onClick={()=>{setEditing(null);setModal(true)}} className="btn-primary"><Plus size={14}/> Novo Pedido</button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {(['','digitado','verificado','aprovado','concluido','cancelado'] as const).map(s=>(
          <button key={s} onClick={()=>setFiltroStatus(s)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:filtroStatus===s?'var(--accent)':'var(--bg-elevated)', color:filtroStatus===s?'white':'var(--text-muted)', border:'1px solid transparent'}}>
            {s===''?'Todos':STATUS_LABEL[s as StatusPed]}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por número ou cliente..." className="input-field" style={{paddingLeft:'2.25rem'}}/>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/></div>
      ) : filtrados.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{color:'var(--text-muted)'}}>Nenhum pedido encontrado</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map(p=>(
            <div key={p.id} className="rounded-xl overflow-hidden" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <div className="p-4 flex items-center gap-3">
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-xs font-bold" style={{color:'var(--accent)'}}>#{p.numero}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{p.cliente_nome??'— Sem cliente —'}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs border ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    {p.forma_pagamento&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-muted)'}}>{FORMA_LABEL[p.forma_pagamento]}</span>}
                  </div>
                  <div className="flex gap-3 text-xs" style={{color:'var(--text-muted)'}}>
                    <span>{format(new Date(p.data_pedido+'T12:00:00'),'dd/MM/yyyy')}</span>
                    {p.pedidos_itens&&<span>{p.pedidos_itens.length} item(ns)</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold" style={{color:'var(--text-primary)'}}>{fmt(p.valor_total)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={()=>setExpanded(expanded===p.id?null:p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}>
                    {expanded===p.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                  </button>
                  <button onClick={()=>{setEditing(p);setModal(true)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}><Pencil size={13}/></button>
                  {permissions.isAdmin&&<button onClick={()=>setDeletando(p)} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:4}}><Trash2 size={13}/></button>}
                </div>
              </div>

              {expanded===p.id&&(
                <div className="px-4 pb-4 space-y-3 animate-fade-in" style={{borderTop:'1px solid var(--border)'}}>
                  {p.pedidos_itens&&p.pedidos_itens.length>0&&(
                    <div className="pt-3">
                      <p className="text-xs font-medium mb-2" style={{color:'var(--text-muted)'}}>Itens</p>
                      <div className="space-y-1">
                        {p.pedidos_itens.map((it,i)=>(
                          <div key={i} className="flex justify-between text-xs py-1" style={{borderBottom:'0.5px solid var(--border)',color:'var(--text-secondary)'}}>
                            <span>{it.descricao} × {it.quantidade}</span>
                            <span>{fmt((it as any).subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.observacao&&<p className="text-xs" style={{color:'var(--text-muted)'}}>{p.observacao}</p>}
                  {(permissions.isAdmin||permissions.role==='supervisor')&&p.status!=='concluido'&&p.status!=='cancelado'&&(
                    <button onClick={()=>avancarStatus(p)} className="btn-primary text-xs py-1.5 px-4">
                      Avançar → {STATUS_LABEL[STATUS_FLOW[STATUS_FLOW.indexOf(p.status)+1]]}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal&&<PedidoModal item={editing} clientes={clientes} vendedores={vendedores} onSave={save} onClose={()=>{setModal(false);setEditing(null)}}/>}
      {deletando&&<ConfirmModal title="Excluir pedido" message={`Excluir pedido #${deletando.numero}?`} confirmLabel="Excluir" danger onConfirm={async()=>{ await supabase.from('pedidos_itens').delete().eq('pedido_id',deletando!.id); await supabase.from('pedidos').delete().eq('id',deletando!.id); setDeletando(null); load() }} onCancel={()=>setDeletando(null)}/>}
    </div>
  )
}