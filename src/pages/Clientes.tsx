import { useState, useEffect, useCallback } from 'react'
import { clientesApi, historicoApi } from '../lib/api'
import { Cliente, SIT_CLI_COLOR, SIT_CLI_LABEL, CANAL_COLOR, CANAL_LABEL, CanalTipo } from '../types'
import ClienteModal from '../components/ClienteModal'
import { Plus, Search, SlidersHorizontal, Users, Flame, Phone, Mail, MapPin, Clock, Pencil, Trash2, MessageSquareText, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSearchParams } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [situacaoFiltro, setSituacaoFiltro] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente|null>(null)
  const [detalhe, setDetalhe] = useState<Cliente|null>(null)
  const [searchParams] = useSearchParams()

  const load = useCallback(async () => {
    setLoading(true)
    const hotOnly = searchParams.get('hot') === '1'
    const data = await clientesApi.list({
      search: search||undefined,
      situacao: situacaoFiltro||undefined,
      lead_quente: hotOnly ? true : undefined,
    })
    setClientes(data)
    setLoading(false)
  }, [search, situacaoFiltro, searchParams])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Cliente>) => {
    // Called by ClienteModal — if it throws, modal shows the error (stays open)
    if (editing) {
      await clientesApi.update(editing.id, data)
    } else {
      await clientesApi.create(data as Omit<Cliente,'id'|'created_at'|'updated_at'|'user_id'>)
    }
    // Only runs if no error was thrown
    setModalOpen(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (id: string, nome: string) => {
    if (window.confirm("Confirmar?")) { await clientesApi.delete(id); load() }
  }

  const [historicoCliente, setHistoricoCliente] = useState<import('../types').HistoricoContato[]>([])
  useEffect(() => {
    if (!detalhe) { setHistoricoCliente([]); return }
    historicoApi.list(detalhe.id).then(setHistoricoCliente)
  }, [detalhe])

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden" style={{ height:'calc(100vh - 73px)' }}>
      {/* List panel */}
      <div className="flex flex-col w-full lg:w-96 flex-shrink-0" style={{ borderRight:'1px solid var(--border)', background:'var(--bg-secondary)' }}>
        {/* Toolbar */}
        <div className="p-4 space-y-3" style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, CPF, telefone..." className="input-field text-sm" style={{paddingLeft:'2.25rem'}}/>
            </div>
            <button onClick={()=>setShowFilters(!showFilters)} className="btn-ghost px-3"
              style={{ color:showFilters?'var(--accent)':undefined, borderColor:showFilters?'var(--accent)':undefined }}>
              <SlidersHorizontal size={14}/>
            </button>
            <button onClick={()=>{setEditing(null);setModalOpen(true)}} className="btn-primary px-3">
              <Plus size={14}/>
            </button>
          </div>

          {showFilters && (
            <div className="animate-fade-in">
              <select value={situacaoFiltro} onChange={e=>setSituacaoFiltro(e.target.value)}
                className="input-field text-sm" style={{ appearance:'none' }}>
                <option value="">Todos os status</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="em_espera">Em Espera</option>
                <option value="arquivado">Arquivado</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Users size={12} style={{ color:'var(--text-muted)' }}/>
            <span className="text-xs" style={{ color:'var(--text-muted)' }}>
              {loading ? 'Carregando...' : `${clientes.length} cliente${clientes.length!==1?'s':''}`}
            </span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor:'var(--accent)' }}/>
            </div>
          ) : clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 p-6">
              <Users size={28} style={{ color:'var(--text-muted)' }}/>
              <div className="text-center">
                <p className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Nenhum cliente</p>
                <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>
                  {search||situacaoFiltro ? 'Tente ajustar os filtros' : 'Cadastre o primeiro cliente'}
                </p>
              </div>
            </div>
          ) : clientes.map(c => (
            <button key={c.id} onClick={()=>setDetalhe(c)} className="w-full text-left p-4 transition-all"
              style={{ background:detalhe?.id===c.id?'var(--bg-elevated)':'transparent', borderBottom:'1px solid var(--border)', border:'none', borderBottomColor:'var(--border)', borderBottomStyle:'solid', borderBottomWidth:1, cursor:'pointer' }}>
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background:'var(--accent-muted)', color:'var(--accent)', border:'1px solid rgba(79,86,247,0.2)' }}>
                    {c.nome[0]?.toUpperCase()}
                  </div>
                  {c.lead_quente && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background:'rgba(245,158,11,0.2)', border:'1px solid rgba(245,158,11,0.4)' }}>
                      <Flame size={9} style={{ color:'#f59e0b' }}/>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate" style={{ color:'var(--text-primary)' }}>{c.nome}</p>
                    <span className={`px-1.5 py-0.5 rounded text-xs border flex-shrink-0 ${SIT_CLI_COLOR[c.situacao]}`}>{SIT_CLI_LABEL[c.situacao]}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>{c.cpf ?? c.email ?? c.telefone1}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs" style={{ color:'var(--text-muted)' }}>{c.telefone1}</p>
                    {c.canal_origem && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background:`${CANAL_COLOR[c.canal_origem as CanalTipo]}15`, color:CANAL_COLOR[c.canal_origem as CanalTipo] }}>
                        {CANAL_LABEL[c.canal_origem as CanalTipo]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="hidden lg:flex flex-1 flex-col overflow-hidden">
        {detalhe ? (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="p-6" style={{ borderBottom:'1px solid var(--border)' }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
                    style={{ background:'var(--accent-muted)', color:'var(--accent)', border:'1px solid rgba(79,86,247,0.2)' }}>
                    {detalhe.nome[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold" style={{ color:'var(--text-primary)' }}>{detalhe.nome}</h2>
                      {detalhe.lead_quente && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold hot-lead-badge"
                          style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)' }}>
                          <Flame size={11}/> Lead Quente
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-0.5" style={{ color:'var(--text-muted)' }}>{detalhe.apelido ?? detalhe.cpf ?? detalhe.email}</p>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded-lg text-xs border ${SIT_CLI_COLOR[detalhe.situacao]}`}>{SIT_CLI_LABEL[detalhe.situacao]}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>{setEditing(detalhe);setModalOpen(true)}} className="btn-ghost text-sm py-2"><Pencil size={14}/> Editar</button>
                  <button onClick={()=>{handleDelete(detalhe.id,detalhe.nome);setDetalhe(null)}} className="btn-ghost text-sm py-2" style={{ color:'#f87171', borderColor:'rgba(248,113,113,0.3)' }}><Trash2 size={14}/></button>
                  <button onClick={()=>setDetalhe(null)} className="p-2 rounded-lg" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={16}/></button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {l:'CPF', v:detalhe.cpf},{l:'RG', v:detalhe.rg},
                  {l:'Data de Nascimento', v:detalhe.data_nascimento?new Date(detalhe.data_nascimento+'T12:00').toLocaleDateString('pt-BR'):null},
                  {l:'Estado Civil', v:detalhe.estado_civil},
                  {l:'E-mail', v:detalhe.email},{l:'WhatsApp', v:detalhe.whatsapp},
                  {l:'Cidade/UF', v:detalhe.cidade?`${detalhe.cidade}${detalhe.estado?'/'+detalhe.estado:''}`:null},
                  {l:'Canal Origem', v:detalhe.canal_origem?CANAL_LABEL[detalhe.canal_origem as CanalTipo]:null},
                  {l:'LGPD', v:detalhe.consentimento_lgpd?'Consentimento dado':'Pendente'},
                ].filter(i=>i.v).map(({l,v})=>(
                  <div key={l} className="rounded-xl p-3" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)' }}>
                    <p className="text-xs mb-0.5" style={{ color:'var(--text-muted)' }}>{l}</p>
                    <p className="text-sm font-medium" style={{ color:'var(--text-primary)' }}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Contatos rápidos */}
              <div className="flex gap-2">
                {detalhe.telefone1 && (
                  <a href={`tel:${detalhe.telefone1}`} className="btn-ghost flex-1 justify-center text-sm py-2">
                    <Phone size={14}/> Ligar
                  </a>
                )}
                {detalhe.whatsapp && (
                  <a href={`https://wa.me/55${detalhe.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    className="btn-ghost flex-1 justify-center text-sm py-2" style={{ color:'#25D366', borderColor:'rgba(37,211,102,0.3)' }}>
                    <MessageSquareText size={14}/> WhatsApp
                  </a>
                )}
                {detalhe.email && (
                  <a href={`mailto:${detalhe.email}`} className="btn-ghost flex-1 justify-center text-sm py-2">
                    <Mail size={14}/> E-mail
                  </a>
                )}
              </div>

              {/* Endereço */}
              {detalhe.endereco && (
                <div className="rounded-xl p-4" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin size={13} style={{ color:'var(--text-muted)' }}/>
                    <p className="text-xs font-medium" style={{ color:'var(--text-muted)' }}>Endereço</p>
                  </div>
                  <p className="text-sm" style={{ color:'var(--text-secondary)' }}>
                    {detalhe.endereco}{detalhe.numero?`, ${detalhe.numero}`:''}
                    {detalhe.complemento?` — ${detalhe.complemento}`:''}
                    {detalhe.bairro?`, ${detalhe.bairro}`:''} {detalhe.cidade}{detalhe.estado?`/${detalhe.estado}`:''}
                    {detalhe.cep?` — CEP ${detalhe.cep}`:''}
                  </p>
                </div>
              )}

              {detalhe.sintomas && (
                <div className="rounded-xl p-4" style={{ background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.15)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color:'#f59e0b' }}>Queixas / Sintomas</p>
                  <p className="text-sm leading-relaxed" style={{ color:'var(--text-secondary)' }}>{detalhe.sintomas}</p>
                </div>
              )}
              {detalhe.restricoes && (
                <div className="rounded-xl p-4" style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color:'#f87171' }}>⚠️ Restrições / Alergias</p>
                  <p className="text-sm" style={{ color:'var(--text-secondary)' }}>{detalhe.restricoes}</p>
                  {detalhe.restricoes_obs && <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>{detalhe.restricoes_obs}</p>}
                </div>
              )}
              {detalhe.observacao && (
                <div className="rounded-xl p-4" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color:'var(--text-muted)' }}>Observações</p>
                  <p className="text-sm leading-relaxed" style={{ color:'var(--text-secondary)' }}>{detalhe.observacao}</p>
                </div>
              )}

              {/* Histórico recente */}
              {historicoCliente.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={13} style={{ color:'var(--text-muted)' }}/>
                    <p className="text-xs font-medium" style={{ color:'var(--text-muted)' }}>Histórico Recente</p>
                  </div>
                  <div className="space-y-2">
                    {historicoCliente.slice(0,4).map(h=>(
                      <div key={h.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background:'var(--bg-elevated)' }}>
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: h.direcao==='entrada'?'var(--accent)':'#10b981' }}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs line-clamp-2" style={{ color:'var(--text-secondary)' }}>{h.conteudo}</p>
                          <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>
                            {formatDistanceToNow(new Date(h.created_at),{locale:ptBR,addSuffix:true})}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)' }}>
              <Users size={28} style={{ color:'var(--text-muted)' }}/>
            </div>
            <p className="text-sm" style={{ color:'var(--text-muted)' }}>Selecione um cliente para ver os detalhes</p>
            <button onClick={()=>{setEditing(null);setModalOpen(true)}} className="btn-primary text-sm"><Plus size={14}/> Novo Cliente</button>
          </div>
        )}
      </div>

      {modalOpen && (
        <ClienteModal cliente={editing} onSave={handleSave} onClose={()=>{setModalOpen(false);setEditing(null)}}/>
      )}
    </div>
  )
}
