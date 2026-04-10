import { useState, useEffect, useCallback } from 'react'
import { metasApi, vendedoresApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Meta } from '../types/vendedor'
import { Vendedor, CARGO_LABELS } from '../types/vendedor'
import Modal from '../components/Modal'
import { useToast } from '../contexts/ToastContext'
import { Target, TrendingUp, Plus, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { format, startOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function pct(r:number,m:number){ return !m?0:Math.min(100,Math.round(r/m*100)) }

function Barra({ r, m, color }: { r:number; m:number; color:string }) {
  const p = pct(r,m)
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:11,color:'var(--text-muted)'}}>{r} / {m}</span>
        <span style={{fontSize:11,fontWeight:700,color:p>=100?'var(--success)':p>=70?color:'#fbbf24'}}>{p}%</span>
      </div>
      <div style={{height:6,borderRadius:99,background:'var(--bg-raised)',overflow:'hidden'}}>
        <div style={{height:'100%',borderRadius:99,width:`${p}%`,background:p>=100?'var(--success)':p>=70?color:'#fbbf24',transition:'width .5s'}}/>
      </div>
    </div>
  )
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'var(--text-secondary)'}}>{label}</label>
      {children}
    </div>
  )
}

function MetaModal({ vendedores, metas, periodo, onSave, onClose }: {
  vendedores:Vendedor[]; metas:Meta[]; periodo:string; onSave:(d:Partial<Meta>)=>Promise<void>; onClose:()=>void
}) {
  const [vendedorId, setVendedorId] = useState('')
  const [f, setF] = useState({meta_dia:0, meta_mes:0, meta_valor:0})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!vendedorId) return
    const ex = metas.find(m=>m.vendedor_id===vendedorId)
    if (ex) setF({meta_dia:ex.meta_dia, meta_mes:ex.meta_mes, meta_valor:ex.meta_valor})
  }, [vendedorId, metas])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendedorId) { setFormError('Selecione o vendedor'); return }
    setSaving(true)
    try {
      await onSave({vendedor_id:vendedorId, periodo, meta_dia:Number(f.meta_dia), meta_mes:Number(f.meta_mes), meta_valor:Number(f.meta_valor), realizado_mes:0, realizado_valor:0})
    } catch(err:any) { setFormError(err?.message??'Erro ao salvar') }
    setSaving(false)
  }

  return (
    <Modal title="Definir Meta" onClose={onClose} maxWidth={420}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        <button type="button" disabled={saving} className="btn-primary flex-1 justify-center"
          onClick={()=>(document.getElementById('meta-form') as HTMLFormElement)?.requestSubmit()}>
          {saving?'Salvando...':'Salvar Meta'}
        </button>
      </>}>
      <form id="meta-form" onSubmit={handleSubmit} className="space-y-4">
        {formError&&<div style={{padding:'10px',borderRadius:10,background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.3)',fontSize:13,color:'var(--danger)'}}>{formError}</div>}
        <Field label="Vendedor *">
          <select required value={vendedorId} onChange={e=>setVendedorId(e.target.value)} className="input-field" style={{appearance:'none'}}>
            <option value="">Selecione...</option>
            {vendedores.filter(v=>v.situacao).map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
          <Field label="Meta/dia"><input type="number" min="0" value={f.meta_dia} onChange={e=>setF(p=>({...p,meta_dia:+e.target.value}))} className="input-field"/></Field>
          <Field label="Meta/mês"><input type="number" min="0" value={f.meta_mes} onChange={e=>setF(p=>({...p,meta_mes:+e.target.value}))} className="input-field"/></Field>
          <Field label="Meta R$"><input type="number" min="0" step="100" value={f.meta_valor} onChange={e=>setF(p=>({...p,meta_valor:+e.target.value}))} className="input-field"/></Field>
        </div>
      </form>
    </Modal>
  )
}

export default function Metas() {
  const { permissions, vendedorId: myVendedorId, ownerId, equipeId } = useAuth()
  const [metas, setMetas] = useState<Meta[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [periodo, setPeriodo] = useState(() => startOfMonth(new Date()).toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const { supabase } = await import('../lib/supabase')

    // Get vendedor_ids from equipe members
    let equipeVendedorIds: string[] = []
    if (!permissions.isAdmin && equipeId) {
      // Get all members of the team
      const { data: membros } = await supabase.from('org_membros')
        .select('user_id').eq('equipe_id', equipeId).eq('ativo', true)
      const userIds = (membros ?? []).map((m: any) => m.user_id)
      if (userIds.length) {
        // Get their vendedor_ids from funcionarios
        const { data: funcs } = await supabase.from('funcionarios')
          .select('vendedor_id').in('user_id', userIds).not('vendedor_id', 'is', null)
        equipeVendedorIds = (funcs ?? []).map((f: any) => f.vendedor_id).filter(Boolean)
      }
    }

    // Get vendedores filtered by equipe
    let v = await vendedoresApi.list({situacao:true, equipe_id: equipeId || undefined})
    if (!permissions.isAdmin) {
      if (permissions.role === 'supervisor' && equipeVendedorIds.length) {
        v = v.filter(vend => equipeVendedorIds.includes(vend.id))
      } else if (permissions.role === 'vendedor' && myVendedorId) {
        v = v.filter(vend => vend.id === myVendedorId)
      }
    }
    setVendedores(v)

    // Get metas for period
    let metaQuery = supabase.from('metas').select('*, vendedores(nome,cargo,equipe)').eq('periodo', periodo)
    if (!permissions.isAdmin) {
      if (permissions.role === 'supervisor' && equipeVendedorIds.length) {
        metaQuery = metaQuery.in('vendedor_id', equipeVendedorIds)
      } else if (permissions.role === 'vendedor' && myVendedorId) {
        metaQuery = metaQuery.eq('vendedor_id', myVendedorId)
      }
    }
    const {data: metasData} = await metaQuery
    
    // Get real realizado from vendas this month (use UTC to avoid timezone issues)
    const [ano, mes] = periodo.split('-').map(Number)
    const inicioMes = new Date(Date.UTC(ano, mes-1, 1, 0, 0, 0))
    const fimMes   = new Date(Date.UTC(ano, mes,   0, 23, 59, 59))
    
    const {data: vendasMes} = await supabase.from('vendas')
      .select('vendedor_id, total, status')
      .gte('data_venda', inicioMes.toISOString())
      .lte('data_venda', fimMes.toISOString())
      .in('status', ['confirmada','entregue'])

    // Merge realizado from vendas into metas
    const metasComRealizado = (metasData??[]).map((m:any) => {
      const vendasVendedor = (vendasMes??[]).filter((v:any) => v.vendedor_id === m.vendedor_id)
      return {
        ...m,
        realizado_mes: vendasVendedor.length,
        realizado_valor: vendasVendedor.reduce((s:number,v:any)=>s+v.total, 0),
      }
    })

    setMetas(metasComRealizado as Meta[])
    setLoading(false)
  }, [periodo, permissions, myVendedorId])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Meta>) => {
    await metasApi.upsert(data as Omit<Meta,'id'|'created_at'|'updated_at'|'user_id'>)
    toast.success('Meta salva!')
    setModal(false); load()
  }

  const navPeriodo = (dir:-1|1) => {
    const d = new Date(periodo+'T12:00')
    setPeriodo(startOfMonth(dir===-1?subMonths(d,1):addMonths(d,1)).toISOString().split('T')[0])
  }

  const totalMeta = metas.reduce((s,m)=>s+m.meta_mes,0)
  const totalReal = metas.reduce((s,m)=>s+m.realizado_mes,0)
  const totalMetaVal = metas.reduce((s,m)=>s+m.meta_valor,0)
  const totalRealVal = metas.reduce((s,m)=>s+m.realizado_valor,0)
  const vendedoresSemMeta = vendedores.filter(v=>!metas.find(m=>m.vendedor_id===v.id))

  return (
    <div className="space-y-5 animate-fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>navPeriodo(-1)} className="btn-ghost" style={{padding:'7px 10px'}}><ChevronLeft size={15}/></button>
          <h2 style={{fontSize:18,fontWeight:700,color:'var(--text-primary)',textTransform:'capitalize'}}>
            {format(new Date(periodo+'T12:00'),"MMMM 'de' yyyy",{locale:ptBR})}
          </h2>
          <button onClick={()=>navPeriodo(1)} className="btn-ghost" style={{padding:'7px 10px'}}><ChevronRight size={15}/></button>
        </div>
        {(permissions.isAdmin||permissions.role==='supervisor') && (
          <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={14}/> Definir Meta</button>
        )}
      </div>

      {/* Totais */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {label:'Meta (atend.)',  v:totalMeta,                 color:'var(--accent)'},
          {label:'Realizado',      v:totalReal,                 color:'var(--success)'},
          {label:'Meta R$',        v:`R$ ${totalMetaVal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color:'#fbbf24'},
          {label:'Faturado R$',    v:`R$ ${totalRealVal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color:'#ec4899'},
        ].map(({label,v,color})=>(
          <div key={label} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <p style={{fontSize:20,fontWeight:700,color}}>{v}</p>
            <p style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{label}</p>
          </div>
        ))}
      </div>

      {/* Barra geral */}
      {totalMeta>0&&(
        <div className="rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
          <p style={{fontSize:13,fontWeight:600,color:'var(--text-secondary)',marginBottom:12}}>Progresso Geral da Equipe</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div><p style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>Atendimentos</p><Barra r={totalReal} m={totalMeta} color="var(--accent)"/></div>
            <div><p style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>Financeiro</p><Barra r={totalRealVal} m={totalMetaVal} color="#f59e0b"/></div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:160}}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {metas.map(m=>{
            const vend = vendedores.find(v=>v.id===m.vendedor_id)
            const bateu = pct(m.realizado_mes, m.meta_mes)>=100
            return (
              <div key={m.id} className="rounded-2xl p-5" style={{background:'var(--bg-card)',border:`1px solid ${bateu?'rgba(52,211,153,.3)':'var(--border)'}`}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:38,height:38,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,background:'var(--accent-muted)',color:'var(--accent)'}}>
                      {(vend?.nome??'?')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{vend?.nome??'—'}</p>
                      <p style={{fontSize:11,color:'var(--text-muted)'}}>{vend?.cargo?CARGO_LABELS[vend.cargo]:''}{vend?.equipe?` · ${vend.equipe}`:''}</p>
                    </div>
                  </div>
                  {bateu&&<span style={{fontSize:18}}>🏆</span>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div><p style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>Atendimentos</p><Barra r={m.realizado_mes} m={m.meta_mes} color="var(--accent)"/></div>
                  {m.meta_valor>0&&<div><p style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>Financeiro</p><Barra r={m.realizado_valor} m={m.meta_valor} color="#f59e0b"/></div>}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,borderTop:'1px solid var(--border)',paddingTop:10}}>
                    <div style={{background:'var(--bg-raised)',padding:'6px 8px',borderRadius:8}}><p style={{fontSize:10,color:'var(--text-muted)'}}>Meta/dia</p><p style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{m.meta_dia}</p></div>
                    <div style={{background:'var(--bg-raised)',padding:'6px 8px',borderRadius:8}}><p style={{fontSize:10,color:'var(--text-muted)'}}>Meta/mês</p><p style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>{m.meta_mes}</p></div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Vendedores sem meta */}
          {permissions.isAdmin&&vendedoresSemMeta.map(v=>(
            <div key={v.id} className="rounded-2xl p-5" style={{background:'transparent',border:'2px dashed var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <div style={{width:38,height:38,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,background:'var(--bg-raised)',color:'var(--text-muted)'}}>{v.nome[0]}</div>
                <div><p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{v.nome}</p><p style={{fontSize:11,color:'var(--text-muted)'}}>Sem meta definida</p></div>
              </div>
              <button onClick={()=>setModal(true)} className="btn-ghost" style={{width:'100%',justifyContent:'center',fontSize:12}}><Plus size={12}/> Definir meta</button>
            </div>
          ))}
        </div>
      )}

      {modal&&<MetaModal vendedores={vendedores} metas={metas} periodo={periodo} onSave={handleSave} onClose={()=>setModal(false)}/>}
    </div>
  )
}