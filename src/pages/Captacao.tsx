import ReactDOM from 'react-dom'
import { useState, useEffect, useCallback } from 'react'
import { captacaoApi, clientesApi } from '../lib/api'
import { Captacao, Cliente, SIT_CAP_COLOR, SIT_CAP_LABEL, CANAL_COLOR, CANAL_LABEL, CaptacaoSituacao, CanalTipo } from '../types'
import { Plus, Search, Phone, Mail, MessageSquareText, Pencil, Trash2, ArrowRight, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const COLUNAS: CaptacaoSituacao[] = ['novo','em_contato','agendado','convertido','perdido']

function CaptacaoModal({ item, onSave, onClose, clientes }: { item?: Captacao|null; onSave:(d:Partial<Captacao>)=>void; onClose:()=>void; clientes:Cliente[] }) {
  const blank = { nome:'', telefone:'', email:'', canal:'' as ''|CanalTipo, situacao:'novo' as CaptacaoSituacao, horario_contato:'', observacao:'' }
  const [f, setF] = useState(blank)
  useEffect(() => { if(item) setF({ nome:item.nome??'', telefone:item.telefone??'', email:item.email??'', canal:(item.canal??'') as ''|CanalTipo, situacao:item.situacao, horario_contato:item.horario_contato??'', observacao:item.observacao??'' }) }, [item])
  const set = (k:string,v:unknown)=>setF(p=>({...p,[k]:v}))
  return (
    <div // outside click disabled
      style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:9999, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 16px', overflowY:'auto' }}>
      <div className="relative w-full max-w-md rounded-2xl p-5 animate-fade-in" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
        <h3 className="font-bold text-lg mb-4" style={{ color:'var(--text-primary)' }}>{item?'Editar Lead':'Novo Lead'}</h3>
        <div className="space-y-3">
          <div><label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Nome</label><input value={f.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome do prospect" className="input-field"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Telefone</label><input value={f.telefone} onChange={e=>set('telefone',e.target.value)} placeholder="(00) 9 0000-0000" className="input-field"/></div>
            <div><label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Canal</label>
              <select value={f.canal} onChange={e=>set('canal',e.target.value)} className="input-field" style={{ appearance:'none' }}>
                <option value="">—</option>
                {(['whatsapp','linkedin','instagram','gmail','telefone','site','indicacao','outro'] as CanalTipo[]).map(c=><option key={c} value={c}>{CANAL_LABEL[c]}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>E-mail</label><input type="email" value={f.email} onChange={e=>set('email',e.target.value)} placeholder="email@exemplo.com" className="input-field"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Status</label>
              <select value={f.situacao} onChange={e=>set('situacao',e.target.value)} className="input-field" style={{ appearance:'none' }}>
                {COLUNAS.concat(['sem_interesse']).map(s=><option key={s} value={s}>{SIT_CAP_LABEL[s]}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Melhor Horário</label><input value={f.horario_contato} onChange={e=>set('horario_contato',e.target.value)} placeholder="Ex: Manhãs" className="input-field"/></div>
          </div>
          <div><label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Observação</label><textarea value={f.observacao} onChange={e=>set('observacao',e.target.value)} rows={3} className="input-field resize-none" placeholder="Contexto do lead..."/></div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button onClick={()=>onSave(f)} className="btn-primary flex-1 justify-center">Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function CaptacaoPage() {
  const [leads, setLeads] = useState<Captacao[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Captacao|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    
      setLeads(await captacaoApi.list({ search: search||undefined }))
      setClientes(await clientesApi.list())
      setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Captacao>) => {
    if (editing) await captacaoApi.update(editing.id, data)
    else await captacaoApi.create({ ...data, num_contatos:0, houve_venda:false, origem_webhook:false } as Omit<Captacao,'id'|'created_at'|'updated_at'|'user_id'>)
    setModalOpen(false); setEditing(null); load()
  }

  const converterCliente = async (cap: Captacao) => {
    const nome = cap.nome ?? 'Cliente'
    if (!window.confirm("Confirmar?")) return
    const cli = await clientesApi.create({ nome, telefone1:cap.telefone??'', tipo_telefone1:'celular', tipo:'F', situacao:'ativo', email:cap.email, canal_origem:cap.canal, lead_quente:false, observacao:cap.observacao } as Omit<Cliente,'id'|'created_at'|'updated_at'|'user_id'>)
    await captacaoApi.update(cap.id, { situacao:'convertido', convertido_em:cli.id })
    load()
  }

  const byStatus = (s: CaptacaoSituacao) => leads.filter(l => l.situacao === s)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." className="input-field" style={{paddingLeft:'2.25rem'}}/>
        </div>
        <button onClick={()=>{setEditing(null);setModalOpen(true)}} className="btn-primary"><Plus size={15}/> Novo Lead</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor:'var(--accent)' }}/></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight:'calc(100vh - 200px)' }}>
          {COLUNAS.map(status => {
            const items = byStatus(status)
            return (
              <div key={status} className="flex flex-col flex-shrink-0 rounded-2xl overflow-hidden"
                style={{ width:260, background:'var(--bg-card)', border:'1px solid var(--border)' }}>
                <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom:'1px solid var(--border)' }}>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${SIT_CAP_COLOR[status]}`}>{SIT_CAP_LABEL[status]}</span>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background:'var(--bg-elevated)', color:'var(--text-muted)' }}>{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {items.map(lead => (
                    <div key={lead.id} className="rounded-xl p-3" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)' }}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>{lead.nome ?? 'Sem nome'}</p>
                          {lead.canal && (
                            <span className="text-xs" style={{ color:CANAL_COLOR[lead.canal] }}>{CANAL_LABEL[lead.canal]}</span>
                          )}
                        </div>
                        <div className="action-btns" style={{ display:"flex", gap:4, opacity:0, transition:"opacity .15s" }}>
                          <button onClick={()=>{setEditing(lead);setModalOpen(true)}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'2px' }}><Pencil size={12}/></button>
                          <button onClick={async ()=>{if(window.confirm("Confirmar esta ação?")){await captacaoApi.delete(lead.id);load()}}} style={{ background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'2px' }}><Trash2 size={12}/></button>
                        </div>
                      </div>

                      {lead.telefone && (
                        <a href={`tel:${lead.telefone}`} className="flex items-center gap-1.5 text-xs mb-1" style={{ color:'var(--text-muted)', textDecoration:'none' }}>
                          <Phone size={11}/>{lead.telefone}
                        </a>
                      )}
                      {lead.email && <p className="flex items-center gap-1.5 text-xs mb-1" style={{ color:'var(--text-muted)' }}><Mail size={11}/>{lead.email}</p>}
                      {lead.observacao && <p className="text-xs mt-2 line-clamp-2" style={{ color:'var(--text-muted)' }}>{lead.observacao}</p>}

                      {lead.data_ultimo_contato && (
                        <p className="text-xs mt-2 flex items-center gap-1" style={{ color:'var(--text-muted)' }}>
                          <Clock size={10}/>{formatDistanceToNow(new Date(lead.data_ultimo_contato),{locale:ptBR,addSuffix:true})}
                        </p>
                      )}

                      {status === 'agendado' && (
                        <button onClick={()=>converterCliente(lead)}
                          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{ background:'rgba(16,185,129,0.1)', color:'#10b981', border:'1px solid rgba(16,185,129,0.2)', cursor:'pointer' }}>
                          <ArrowRight size={12}/> Converter em Cliente
                        </button>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="flex items-center justify-center h-16 rounded-xl" style={{ border:'1px dashed var(--border)' }}>
                      <p className="text-xs" style={{ color:'var(--text-muted)' }}>Vazio</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && <CaptacaoModal item={editing} onSave={handleSave} onClose={()=>{setModalOpen(false);setEditing(null)}} clientes={clientes}/>}
    </div>
  )
}
