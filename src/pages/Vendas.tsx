import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { clientesApi, vendedoresApi, estoqueApi } from '../lib/api'
import { Cliente } from '../types'
import { Vendedor } from '../types/vendedor'
import { ProdutoEstoque } from '../types/estoque'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../contexts/ToastContext'
import { Plus, Search, ShoppingBag, CheckCircle, XCircle, Clock, Truck, FileText, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type VendaStatus = 'rascunho'|'pendente'|'confirmada'|'cancelada'|'entregue'
interface VendaItem { id:string; descricao:string; quantidade:number; preco_unit:number; total:number; produto_id?:string }
interface Venda {
  id:string; cliente_id?:string; vendedor_id?:string; status:VendaStatus
  canal?:string; forma_pagamento?:string; subtotal:number; desconto:number; total:number
  observacoes?:string; data_venda:string; user_id:string; created_at:string
  clientes?:{nome:string}; vendedores?:{nome:string}
}

const STATUS_CFG: Record<VendaStatus,{label:string;color:string;bg:string;icon:React.ReactNode}> = {
  rascunho:  {label:'Rascunho',  color:'var(--text-muted)', bg:'var(--bg-raised)',          icon:<FileText size={12}/>},
  pendente:  {label:'Pendente',  color:'#fbbf24',           bg:'rgba(251,191,36,.1)',        icon:<Clock size={12}/>},
  confirmada:{label:'Confirmada',color:'var(--success)',    bg:'rgba(52,211,153,.1)',        icon:<CheckCircle size={12}/>},
  entregue:  {label:'Entregue',  color:'#60a5fa',           bg:'rgba(96,165,250,.1)',        icon:<Truck size={12}/>},
  cancelada: {label:'Cancelada', color:'var(--danger)',     bg:'rgba(248,113,113,.1)',       icon:<XCircle size={12}/>},
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'var(--text-secondary)'}}>{label}</label>
      {children}
    </div>
  )
}

function NovaVendaModal({ clientes, vendedores, produtos, ownerId, onSave, onClose }: {
  clientes:Cliente[]; vendedores:Vendedor[]; produtos:ProdutoEstoque[]
  ownerId:string; onSave:()=>void; onClose:()=>void
}) {
  const { vendedorId } = useAuth()
  const { toast } = useToast()
  const [f, setF] = useState({
    cliente_id:'', vendedor_id: vendedorId ?? '',
    status:'confirmada' as VendaStatus, canal:'', forma_pagamento:'',
    desconto:0, observacoes:'', data_venda: new Date().toISOString().split('T')[0],
  })
  const [itens, setItens] = useState<VendaItem[]>([{id:'1',descricao:'',quantidade:1,preco_unit:0,total:0}])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [estoqueBaixo, setEstoqueBaixo] = useState<string[]>([])

  const set = (k:string, v:unknown) => { setF(p=>({...p,[k]:v})); setFormError('') }

  const updateItem = (idx:number, k:string, v:unknown) => {
    setItens(prev => prev.map((it,i) => {
      if (i !== idx) return it
      const u = {...it, [k]:v}
      if (k==='quantidade'||k==='preco_unit') u.total = Number(u.quantidade)*Number(u.preco_unit)
      // Check estoque when produto selected or quantity changed
      if (k==='produto_id' && v) {
        const prod = produtos.find(p=>p.id===v)
        if (prod) { u.descricao = prod.nome; u.preco_unit = prod.preco_venda??0; u.total = u.preco_unit*Number(u.quantidade) }
      }
      return u
    }))
  }

  // Validate estoque when items change
  useEffect(() => {
    const baixo: string[] = []
    itens.forEach(it => {
      if (!it.produto_id) return
      const prod = produtos.find(p=>p.id===it.produto_id)
      if (prod && Number(it.quantidade) > prod.quantidade) {
        baixo.push(`${prod.nome}: estoque ${prod.quantidade}, pedido ${it.quantidade}`)
      }
    })
    setEstoqueBaixo(baixo)
  }, [itens, produtos])

  const addItem = () => setItens(p=>[...p, {id:Date.now().toString(),descricao:'',quantidade:1,preco_unit:0,total:0}])
  const removeItem = (idx:number) => setItens(p=>p.filter((_,i)=>i!==idx))

  const subtotal = itens.reduce((s,it)=>s+it.total,0)
  const total = subtotal - Number(f.desconto)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const itensFiltrados = itens.filter(it=>it.descricao.trim())
    if (!itensFiltrados.length) { setFormError('Adicione pelo menos um item.'); return }
    if (estoqueBaixo.length) { setFormError('Estoque insuficiente para um ou mais itens.'); return }
    setSaving(true)
    try {
      const { supabase } = await import('../lib/supabase')

      // 1. Create venda
      const {data:venda, error:ve} = await supabase.from('vendas').insert({
        cliente_id: f.cliente_id||null, vendedor_id: f.vendedor_id||null,
        status: f.status, canal: f.canal||null, forma_pagamento: f.forma_pagamento||null,
        subtotal, desconto: Number(f.desconto), total,
        observacoes: f.observacoes||null,
        data_venda: new Date(`${f.data_venda}T12:00`).toISOString(),
        user_id: ownerId,
      }).select().single()
      if (ve) throw new Error(ve.message)

      // 2. Create itens
      await supabase.from('venda_itens').insert(
        itensFiltrados.map(it=>({venda_id:venda.id, descricao:it.descricao, quantidade:Number(it.quantidade), preco_unit:Number(it.preco_unit), total:it.total, produto_id:it.produto_id||null}))
      )

      // 3. Decrement estoque for each produto
      for (const it of itensFiltrados) {
        if (it.produto_id) {
          await estoqueApi.registrarMovimento(it.produto_id, 'saida', Number(it.quantidade), `Venda #${venda.id.slice(-6).toUpperCase()}`)
        }
      }

      // 4. Update meta realizado for the vendedor this month
      if (f.vendedor_id && (f.status === 'confirmada' || f.status === 'entregue')) {
        const iniciMes = new Date(); iniciMes.setDate(1); iniciMes.setHours(0,0,0,0)
        const periodo = iniciMes.toISOString().split('T')[0]
        // Increment realizado_mes by 1, realizado_valor by total
        const {data:meta} = await supabase.from('metas')
          .select('id, realizado_mes, realizado_valor')
          .eq('vendedor_id', f.vendedor_id).eq('periodo', periodo).maybeSingle()
        if (meta) {
          await supabase.from('metas').update({
            realizado_mes: (meta.realizado_mes||0) + 1,
            realizado_valor: (meta.realizado_valor||0) + total,
          }).eq('id', meta.id)
        }
      }

      toast.success('Venda registrada com sucesso!')
      onSave()
    } catch (err:any) {
      setFormError('Erro ao registrar: ' + (err?.message ?? 'Tente novamente.'))
    }
    setSaving(false)
  }

  return (
    <Modal title="Registrar Venda" onClose={onClose} maxWidth={680}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        <button type="button" disabled={saving||!!estoqueBaixo.length} className="btn-primary flex-1 justify-center"
          style={{opacity:(saving||!!estoqueBaixo.length)?.6:1}}
          onClick={()=>(document.getElementById('venda-form') as HTMLFormElement)?.requestSubmit()}>
          {saving?'Registrando...':'Registrar Venda'}
        </button>
      </>}>
      <form id="venda-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.3)',fontSize:13,color:'var(--danger)'}}>{formError}</div>}
        {estoqueBaixo.length>0 && (
          <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(251,191,36,.08)',border:'1px solid rgba(251,191,36,.3)'}}>
            <p style={{fontSize:12,fontWeight:600,color:'#fbbf24',marginBottom:4,display:'flex',alignItems:'center',gap:6}}><AlertTriangle size={13}/>Estoque insuficiente</p>
            {estoqueBaixo.map(m=><p key={m} style={{fontSize:12,color:'var(--text-secondary)'}}>{m}</p>)}
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Cliente">
            <select value={f.cliente_id} onChange={e=>set('cliente_id',e.target.value)} className="input-field" style={{appearance:'none'}}>
              <option value="">— Selecione —</option>
              {clientes.sort((a,b)=>a.nome.localeCompare(b.nome)).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Vendedor">
            <select value={f.vendedor_id} onChange={e=>set('vendedor_id',e.target.value)} className="input-field" style={{appearance:'none'}}>
              <option value="">— Selecione —</option>
              {vendedores.filter(v=>v.situacao).map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={e=>set('status',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {(Object.keys(STATUS_CFG) as VendaStatus[]).map(s=><option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
            </select>
          </Field>
          <Field label="Data">
            <input type="date" value={f.data_venda} onChange={e=>set('data_venda',e.target.value)} className="input-field"/>
          </Field>
          <Field label="Canal">
            <input value={f.canal} onChange={e=>set('canal',e.target.value)} placeholder="WhatsApp, Loja, Site..." className="input-field"/>
          </Field>
          <Field label="Forma de Pagamento">
            <select value={f.forma_pagamento} onChange={e=>set('forma_pagamento',e.target.value)} className="input-field" style={{appearance:'none'}}>
              <option value="">— Selecione —</option>
              {['Dinheiro','PIX','Cartão de Crédito','Cartão de Débito','Boleto','Transferência','Outros'].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        {/* Itens */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)'}}>Itens da Venda</label>
            <button type="button" onClick={addItem} className="btn-ghost" style={{padding:'4px 10px',fontSize:12}}><Plus size={12}/> Item</button>
          </div>
          <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 90px 90px 28px',padding:'8px 12px',background:'var(--bg-raised)',borderBottom:'1px solid var(--border)'}}>
              {['Produto / Descrição','Qtd','Preço','Total','Estoque',''].map(h=><span key={h} style={{fontSize:11,fontWeight:600,color:'var(--text-muted)'}}>{h}</span>)}
            </div>
            {itens.map((it,i)=>{
              const prod = produtos.find(p=>p.id===it.produto_id)
              const semEstoque = prod && Number(it.quantidade) > prod.quantidade
              return (
                <div key={it.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 90px 90px 28px',padding:'6px 8px',borderTop:'1px solid var(--border)',alignItems:'center',gap:4,background:semEstoque?'rgba(248,113,113,.03)':'transparent'}}>
                  {/* Produto selector + descrição */}
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    <select value={it.produto_id??''} onChange={e=>updateItem(i,'produto_id',e.target.value||undefined)} className="input-field" style={{appearance:'none',padding:'4px 8px',fontSize:11}}>
                      <option value="">— Do estoque —</option>
                      {produtos.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome} (estq: {p.quantidade})</option>)}
                    </select>
                    <input value={it.descricao} onChange={e=>updateItem(i,'descricao',e.target.value)} placeholder="Ou descreva manualmente" className="input-field" style={{padding:'4px 8px',fontSize:11}}/>
                  </div>
                  <input type="number" min="0.01" step="0.01" value={it.quantidade} onChange={e=>updateItem(i,'quantidade',e.target.value)} className="input-field" style={{padding:'5px 6px',fontSize:12,textAlign:'center'}}/>
                  <input type="number" min="0" step="0.01" value={it.preco_unit} onChange={e=>updateItem(i,'preco_unit',e.target.value)} className="input-field" style={{padding:'5px 6px',fontSize:12,textAlign:'center'}}/>
                  <span style={{fontSize:12,fontWeight:700,color:'var(--success)',textAlign:'right'}}>R$ {it.total.toFixed(2)}</span>
                  <span style={{fontSize:11,color:semEstoque?'var(--danger)':'var(--text-muted)',textAlign:'center'}}>
                    {prod ? `${prod.quantidade} ${prod.unidade}` : '—'}
                  </span>
                  {itens.length>1&&<button type="button" onClick={()=>removeItem(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',display:'flex',alignItems:'center'}}><XCircle size={14}/></button>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Totais */}
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <div style={{width:240}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:13,color:'var(--text-muted)'}}>
              <span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 0',gap:8,fontSize:13,color:'var(--text-muted)'}}>
              <span>Desconto (R$)</span>
              <input type="number" min="0" step="0.01" value={f.desconto} onChange={e=>set('desconto',e.target.value)} className="input-field" style={{width:90,padding:'4px 8px',fontSize:12,textAlign:'right'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontSize:15,fontWeight:700,color:'var(--text-primary)',borderTop:'1px solid var(--border)'}}>
              <span>Total</span><span style={{color:'var(--success)'}}>R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <Field label="Observações">
          <textarea value={f.observacoes} onChange={e=>set('observacoes',e.target.value)} rows={2} className="input-field resize-none" placeholder="Notas..."/>
        </Field>
      </form>
    </Modal>
  )
}

export default function Vendas() {
  const { ownerId, permissions, vendedorId, equipeId } = useAuth()
  const [vendas, setVendas] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<VendaStatus|''>('')
  const [modal, setModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string|null>(null)
  const [cancelando, setCancelando] = useState<Venda|null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const { supabase } = await import('../lib/supabase')
    let q = supabase.from('vendas').select('*, clientes(nome), vendedores(nome)').order('data_venda', {ascending:false})
    if (filtroStatus) q = q.eq('status', filtroStatus)
    if (!permissions.isAdmin) {
      if (permissions.role === 'supervisor' && equipeId) {
        // Get team members' vendedor_ids
        const { supabase: sb } = await import('../lib/supabase')
        const { data: membros } = await sb.from('org_membros')
          .select('user_id').eq('equipe_id', equipeId).eq('ativo', true)
        const userIds = (membros ?? []).map((m: any) => m.user_id)
        if (userIds.length) {
          const { data: funcs } = await sb.from('funcionarios')
            .select('vendedor_id').in('user_id', userIds).not('vendedor_id', 'is', null)
          const vids = (funcs ?? []).map((f: any) => f.vendedor_id).filter(Boolean)
          if (vids.length) q = q.in('vendedor_id', vids)
        }
      } else if (permissions.role === 'vendedor' && vendedorId) {
        q = q.eq('vendedor_id', vendedorId)
      }
    }
    const {data} = await q
    setVendas((data??[]) as Venda[])
    const [c,v,p] = await Promise.all([clientesApi.list(), vendedoresApi.list({ equipe_id: equipeId || undefined }), estoqueApi.listProdutos()])
    setClientes(c); setVendedores(v); setProdutos(p)
    setLoading(false)
  }, [ownerId, filtroStatus, vendedorId, permissions])

  useEffect(() => { if (ownerId) load() }, [load, ownerId])

  const cancelarVenda = async () => {
    if (!cancelando) return
    const { supabase } = await import('../lib/supabase')
    await supabase.from('vendas').update({status:'cancelada'}).eq('id', cancelando.id)
    toast.success('Venda cancelada')
    setCancelando(null); load()
  }

  const filtered = vendas.filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (v.clientes?.nome??'').toLowerCase().includes(q)||(v.vendedores?.nome??'').toLowerCase().includes(q)
  })

  const totalMes = vendas.filter(v => {
    const d = new Date(v.data_venda), now = new Date()
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()&&v.status!=='cancelada'
  }).reduce((s,v)=>s+v.total,0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--text-primary)'}}>Vendas</h2>
          <p style={{fontSize:13,color:'var(--text-muted)',marginTop:2}}>{vendas.length} registro{vendas.length!==1?'s':''}</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <div style={{position:'relative'}}>
            <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." className="input-field" style={{paddingLeft:'1.9rem',width:180}}/>
          </div>
          <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value as VendaStatus|'')} className="input-field" style={{appearance:'none',width:140}}>
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_CFG) as VendaStatus[]).map(s=><option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
          <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={14}/> Nova Venda</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {label:'Faturamento no mês', value:`R$ ${totalMes.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color:'var(--success)'},
          {label:'Confirmadas', value:vendas.filter(v=>v.status==='confirmada'||v.status==='entregue').length, color:'var(--accent)'},
          {label:'Pendentes', value:vendas.filter(v=>v.status==='pendente').length, color:'#fbbf24'},
          {label:'Canceladas', value:vendas.filter(v=>v.status==='cancelada').length, color:'var(--danger)'},
        ].map(({label,value,color})=>(
          <div key={label} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <p style={{fontSize:20,fontWeight:700,color}}>{value}</p>
            <p style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:160}}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/>
        </div>
      ) : filtered.length===0 ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,gap:12}}>
          <ShoppingBag size={36} style={{color:'var(--text-muted)'}}/>
          <p style={{color:'var(--text-muted)',fontSize:14}}>Nenhuma venda registrada</p>
          <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={14}/> Registrar venda</button>
        </div>
      ) : (
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 110px 120px 32px',padding:'10px 16px',background:'var(--bg-raised)',borderBottom:'1px solid var(--border)'}}>
            {['Cliente','Vendedor','Data','Status','Total',''].map(h=><span key={h} style={{fontSize:11,fontWeight:600,color:'var(--text-muted)'}}>{h}</span>)}
          </div>
          {filtered.map(v=>{
            const sc = STATUS_CFG[v.status]
            const exp = expandedId===v.id
            return (
              <div key={v.id} style={{borderTop:'1px solid var(--border)'}}>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 110px 120px 32px',padding:'12px 16px',alignItems:'center',cursor:'pointer'}}
                  onClick={()=>setExpandedId(exp?null:v.id)}>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{v.clientes?.nome??'Sem cliente'}</p>
                    {v.canal&&<p style={{fontSize:11,color:'var(--text-muted)'}}>{v.canal}</p>}
                  </div>
                  <p style={{fontSize:12,color:'var(--text-secondary)'}}>{v.vendedores?.nome??'—'}</p>
                  <p style={{fontSize:12,color:'var(--text-muted)'}}>{format(new Date(v.data_venda),'dd/MM/yyyy')}</p>
                  <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:sc.bg,color:sc.color,width:'fit-content'}}>
                    {sc.icon}{sc.label}
                  </span>
                  <span style={{fontSize:14,fontWeight:700,color:'var(--success)'}}>R$ {v.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                  {exp?<ChevronUp size={14} style={{color:'var(--text-muted)'}}/>:<ChevronDown size={14} style={{color:'var(--text-muted)'}}/>}
                </div>
                {exp&&(
                  <div style={{padding:'10px 16px 14px',background:'var(--bg-raised)',borderTop:'1px solid var(--border)'}}>
                    <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:10}}>
                      {v.forma_pagamento&&<p style={{fontSize:12,color:'var(--text-muted)'}}>💳 {v.forma_pagamento}</p>}
                      {v.desconto>0&&<p style={{fontSize:12,color:'var(--text-muted)'}}>🏷️ Desconto: R$ {v.desconto.toFixed(2)}</p>}
                      {v.observacoes&&<p style={{fontSize:12,color:'var(--text-muted)'}}>📝 {v.observacoes}</p>}
                    </div>
                    {v.status!=='cancelada'&&(
                      <button onClick={()=>setCancelando(v)} style={{background:'rgba(248,113,113,.1)',border:'1px solid rgba(248,113,113,.3)',borderRadius:8,padding:'5px 12px',fontSize:12,fontWeight:600,color:'var(--danger)',cursor:'pointer'}}>
                        Cancelar venda
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal&&<NovaVendaModal clientes={clientes} vendedores={vendedores} produtos={produtos} ownerId={ownerId} onSave={()=>{setModal(false);load()}} onClose={()=>setModal(false)}/>}
      {cancelando&&<ConfirmModal title="Cancelar venda" message={`Cancelar a venda de R$ ${cancelando.total.toFixed(2)}? O estoque não será revertido automaticamente.`} confirmLabel="Cancelar venda" danger onConfirm={cancelarVenda} onCancel={()=>setCancelando(null)}/>}
    </div>
  )
}