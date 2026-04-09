import ReactDOM from 'react-dom'
import { useState, useEffect, useCallback } from 'react'
import { historicoApi, clientesApi } from '../lib/api'
import { HistoricoContato, Cliente, HIST_TIPO_LABEL, CANAL_COLOR, CANAL_LABEL, CanalTipo } from '../types'
import { MessageSquareText, Phone, Mail, Bell, FileText, Plus, Search, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const TIPO_ICONS: Record<string, React.ReactNode> = {
  mensagem: <MessageSquareText size={13}/>, ligacao: <Phone size={13}/>,
  email: <Mail size={13}/>, nota: <FileText size={13}/>,
  alerta_enviado: <Bell size={13}/>, agendamento: <MessageSquareText size={13}/>,
}

const TIPO_COLORS: Record<string, string> = {
  mensagem: '#4f56f7', ligacao: '#10b981', email: '#EA4335',
  nota: '#f59e0b', alerta_enviado: '#8b87b8', agendamento: '#4f56f7',
  cancelamento: '#f87171', reagendamento: '#f59e0b', webhook: '#8b5cf6',
}

export default function Historico() {
  const [historico, setHistorico] = useState<HistoricoContato[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string,Cliente>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [novaNotaOpen, setNovaNotaOpen] = useState(false)
  const [nota, setNota] = useState({ cliente_id:'', tipo:'nota', canal:'', direcao:'saida', conteudo:'' })

  const load = useCallback(async () => {
    setLoading(true)
    
      const clientes = await clientesApi.list()
      const cmap: Record<string,Cliente> = {}
      clientes.forEach(c => { cmap[c.id] = c })
      setClientesMap(cmap)
      let data = await historicoApi.listAll()
      if (search) { const q = search.toLowerCase(); data = data.filter(h => h.conteudo.toLowerCase().includes(q) || (cmap[h.cliente_id]?.nome??'').toLowerCase().includes(q)) }
      if (tipoFiltro) data = data.filter(h => h.tipo === tipoFiltro)
      setHistorico(data)
      setLoading(false)
  }, [search, tipoFiltro])

  useEffect(() => { load() }, [load])

  const salvarNota = async () => {
    if (!nota.cliente_id || !nota.conteudo) return
    await historicoApi.create({ ...nota, tipo: nota.tipo as HistoricoContato['tipo'], canal: nota.canal as CanalTipo|undefined, direcao: nota.direcao as 'entrada'|'saida', origem_webhook:false })
    setNota({ cliente_id:'', tipo:'nota', canal:'', direcao:'saida', conteudo:'' })
    setNovaNotaOpen(false); load()
  }

  const clientes = Object.values(clientesMap).sort((a,b)=>a.nome.localeCompare(b.nome))

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar em mensagens, notas..." className="input-field" style={{paddingLeft:'2.25rem'}}/>
        </div>
        <select value={tipoFiltro} onChange={e=>setTipoFiltro(e.target.value)} className="input-field sm:w-44" style={{ appearance:'none' }}>
          <option value="">Todos os tipos</option>
          {(['mensagem','ligacao','email','nota','agendamento','alerta_enviado','webhook'] as const).map(t=>(
            <option key={t} value={t}>{HIST_TIPO_LABEL[t]}</option>
          ))}
        </select>
        <button onClick={()=>setNovaNotaOpen(true)} className="btn-primary"><Plus size={15}/> Registrar</button>
      </div>

      {/* Nova nota modal */}
      {novaNotaOpen && (
        <div // outside click disabled
      style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:9999, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'32px 16px', overflowY:'auto' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setNovaNotaOpen(false)}/>
          <div className="relative w-full max-w-md rounded-2xl p-5 animate-fade-in" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <h3 className="font-bold text-lg mb-4" style={{ color:'var(--text-primary)' }}>Registrar Contato</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Cliente *</label>
                <select value={nota.cliente_id} onChange={e=>setNota(p=>({...p,cliente_id:e.target.value}))} className="input-field" style={{ appearance:'none' }}>
                  <option value="">Selecione...</option>
                  {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Tipo</label>
                  <select value={nota.tipo} onChange={e=>setNota(p=>({...p,tipo:e.target.value}))} className="input-field" style={{ appearance:'none' }}>
                    <option value="nota">Nota Interna</option>
                    <option value="mensagem">Mensagem</option>
                    <option value="ligacao">Ligação</option>
                    <option value="email">E-mail</option>
                    <option value="reuniao">Reunião</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Direção</label>
                  <select value={nota.direcao} onChange={e=>setNota(p=>({...p,direcao:e.target.value}))} className="input-field" style={{ appearance:'none' }}>
                    <option value="saida">Saída (enviamos)</option>
                    <option value="entrada">Entrada (recebemos)</option>
                  </select>
                </div>
              </div>
              {nota.tipo !== 'nota' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Canal</label>
                  <select value={nota.canal} onChange={e=>setNota(p=>({...p,canal:e.target.value}))} className="input-field" style={{ appearance:'none' }}>
                    <option value="">—</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telefone">Telefone</option>
                    <option value="gmail">E-mail</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Conteúdo *</label>
                <textarea value={nota.conteudo} onChange={e=>setNota(p=>({...p,conteudo:e.target.value}))} rows={4}
                  placeholder="Descreva o contato, o que foi discutido, resultado..." className="input-field resize-none"/>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={()=>setNovaNotaOpen(false)} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={salvarNota} disabled={!nota.cliente_id||!nota.conteudo} className="btn-primary flex-1 justify-center"
                style={{ opacity:(!nota.cliente_id||!nota.conteudo)?.6:1 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor:'var(--accent)' }}/></div>
      ) : historico.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <MessageSquareText size={28} style={{ color:'var(--text-muted)' }}/>
          <p className="text-sm" style={{ color:'var(--text-muted)' }}>Nenhum histórico encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {historico.map((h, idx) => {
            const cliente = clientesMap[h.cliente_id]
            const cor = TIPO_COLORS[h.tipo] ?? '#8b87b8'
            const showDate = idx === 0 || new Date(historico[idx-1].created_at).toDateString() !== new Date(h.created_at).toDateString()
            return (
              <div key={h.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-4">
                    <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                    <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ background:'var(--bg-elevated)', color:'var(--text-muted)', flexShrink:0 }}>
                      {format(new Date(h.created_at), "d 'de' MMMM", { locale:ptBR })}
                    </span>
                    <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                  </div>
                )}
                <div className="flex items-start gap-3 p-4 rounded-xl card-hover" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background:`${cor}15`, border:`1px solid ${cor}30`, color:cor }}>
                    {TIPO_ICONS[h.tipo] ?? <MessageSquareText size={13}/>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>{cliente?.nome ?? '—'}</span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-medium" style={{ background:`${cor}12`, color:cor }}>
                        {HIST_TIPO_LABEL[h.tipo]}
                      </span>
                      {h.canal && (
                        <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background:`${CANAL_COLOR[h.canal]}12`, color:CANAL_COLOR[h.canal] }}>
                          {CANAL_LABEL[h.canal]}
                        </span>
                      )}
                      <span className="text-xs ml-auto" style={{ color:'var(--text-muted)', flexShrink:0 }}>
                        {format(new Date(h.created_at), 'HH:mm')}
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed" style={{ color:'var(--text-secondary)' }}>{h.conteudo}</p>

                    <div className="flex items-center gap-3 mt-1.5">
                      {h.resultado && <span className="text-xs" style={{ color:'#10b981' }}>✓ {h.resultado}</span>}
                      <span className="text-xs" style={{ color:'var(--text-muted)' }}>
                        {h.direcao === 'entrada' ? '← Recebido' : '→ Enviado'}
                        {h.origem_webhook && ' • via n8n'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
