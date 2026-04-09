import { useState, useEffect, useCallback } from 'react'
import { consultasApi, clientesApi, historicoApi } from '../lib/api'
import { Consulta, Cliente, SIT_CONS_COLOR, SIT_CONS_LABEL, CONS_TIPO_LABEL } from '../types'
import { Plus, CalendarDays, Clock, Bell, CheckCircle2, AlertTriangle, Search, Pencil, Trash2, X, MapPin, MessageSquareText } from 'lucide-react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ConsultaModal from '../components/ConsultaModal'
import ConfirmModal from '../components/ConfirmModal'

const SITUACOES = ['agendada','confirmada','realizada','cancelada','faltou','reagendada'] as const

export default function Agenda() {
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [clientesMap, setClientesMap] = useState<Record<string,Cliente>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sitFiltro, setSitFiltro] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Consulta|null>(null)
  const [detalhe, setDetalhe] = useState<Consulta|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    
      const clientes = await clientesApi.list()
      const cmap: Record<string,Cliente> = {}
      clientes.forEach(c => { cmap[c.id] = c })
      setClientesMap(cmap)
      let data = await consultasApi.list(sitFiltro ? { situacao: sitFiltro } : {})
      if (search) {
        const q = search.toLowerCase()
        data = data.filter(c => (cmap[c.cliente_id]?.nome??'').toLowerCase().includes(q) || (c.motivo??'').toLowerCase().includes(q))
      }
      setConsultas(data)
      setLoading(false)
  }, [search, sitFiltro])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Consulta>) => {
    if (editing) {
      await consultasApi.update(editing.id, data)
      if (data.situacao === 'confirmada' || data.situacao === 'cancelada') {
        await historicoApi.create({
          cliente_id: editing.cliente_id,
          consulta_id: editing.id,
          tipo: data.situacao === 'confirmada' ? 'agendamento' : 'cancelamento',
          direcao: 'saida',
          conteudo: data.situacao === 'confirmada' ? 'Consulta confirmada.' : `Consulta cancelada. Motivo: ${data.motivo_cancelamento??'—'}`,
          origem_webhook: false,
        })
      }
    } else {
      const nova = await consultasApi.create(data as Omit<Consulta,'id'|'created_at'|'updated_at'|'user_id'>)
      await historicoApi.create({
        cliente_id: nova.cliente_id,
        consulta_id: nova.id,
        tipo: 'agendamento',
        direcao: 'saida',
        conteudo: `Consulta agendada para ${format(new Date(nova.data_hora), "dd/MM/yyyy 'às' HH:mm")}.`,
        origem_webhook: false,
      })
    }
    setModalOpen(false); setEditing(null); load()
  }

  const enviarAlerta = async (c: Consulta) => {
    await consultasApi.update(c.id, { alerta_enviado_d1: true, alerta_enviado_dia: true })
    await historicoApi.create({
      cliente_id: c.cliente_id, consulta_id: c.id,
      tipo: 'alerta_enviado', canal: c.alerta_canal === 'todos' ? 'whatsapp' : (c.alerta_canal === 'email' ? 'gmail' : c.alerta_canal) as import('../types').CanalTipo,
      direcao: 'saida',
      conteudo: `Lembrete enviado via ${c.alerta_canal}: Consulta em ${format(new Date(c.data_hora), "dd/MM 'às' HH:mm")}.`,
      resultado: 'Enviado (simulado)',
      origem_webhook: false,
    })
    load()
  }

  const formatDH = (iso: string) => {
    const d = new Date(iso)
    if (isToday(d)) return `Hoje, ${format(d,'HH:mm')}`
    if (isTomorrow(d)) return `Amanhã, ${format(d,'HH:mm')}`
    return format(d, "dd/MM/yyyy 'às' HH:mm")
  }

  const alertaPendente = (c: Consulta) => !c.alerta_enviado_d1 && !['cancelada','realizada'].includes(c.situacao)

  // Group
  const hoje = consultas.filter(c => isToday(new Date(c.data_hora)))
  const futuras = consultas.filter(c => !isToday(new Date(c.data_hora)) && !isPast(new Date(c.data_hora)) && !['cancelada'].includes(c.situacao))
  const passadas = consultas.filter(c => (isPast(new Date(c.data_hora)) && !isToday(new Date(c.data_hora))) || c.situacao === 'cancelada')

  const ConsultaCard = ({ c }: { c: Consulta }) => {
    const cliente = clientesMap[c.cliente_id]
    const pendente = alertaPendente(c)
    return (
      <div className="rounded-xl overflow-hidden card-hover"
        style={{ background:'var(--bg-card)', border:`1px solid ${detalhe?.id===c.id?'var(--accent)':'var(--border)'}` }}>
        <button onClick={()=>setDetalhe(detalhe?.id===c.id?null:c)} className="w-full text-left p-4"
          style={{ background:'none', border:'none', cursor:'pointer' }}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-center w-12">
              <p className="text-lg font-black leading-none" style={{ color:'var(--accent)' }}>{format(new Date(c.data_hora),'dd')}</p>
              <p className="text-xs" style={{ color:'var(--text-muted)' }}>{format(new Date(c.data_hora),'MMM',{locale:ptBR})}</p>
              <p className="text-xs font-bold mt-0.5" style={{ color:'var(--text-secondary)' }}>{format(new Date(c.data_hora),'HH:mm')}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>{cliente?.nome ?? '—'}</p>
                <span className={`px-2 py-0.5 rounded-lg text-xs border ${SIT_CONS_COLOR[c.situacao]}`}>{SIT_CONS_LABEL[c.situacao]}</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>
                {CONS_TIPO_LABEL[c.tipo]} • {c.modalidade}{c.local?` • ${c.local}`:''}
              </p>
              {c.motivo && <p className="text-xs mt-1 line-clamp-1" style={{ color:'var(--text-muted)' }}>{c.motivo}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {c.alerta_enviado_dia ? <CheckCircle2 size={15} style={{ color:'#10b981' }}/> : pendente ? <AlertTriangle size={15} style={{ color:'#f59e0b' }}/> : null}
              {pendente && (
                <button onClick={e=>{e.stopPropagation();enviarAlerta(c)}}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{ background:'rgba(79,86,247,0.1)', color:'var(--accent)', border:'1px solid rgba(79,86,247,0.2)' }}>
                  <Bell size={11}/> Alertar
                </button>
              )}
            </div>
          </div>
        </button>

        {detalhe?.id === c.id && (
          <div className="px-4 pb-4 space-y-3 animate-fade-in" style={{ borderTop:'1px solid var(--border)' }}>
            <div className="pt-3 grid grid-cols-2 gap-2">
              {c.observacoes && <div className="col-span-2 p-3 rounded-lg" style={{ background:'var(--bg-elevated)' }}><p className="text-xs" style={{ color:'var(--text-muted)' }}>Observações</p><p className="text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>{c.observacoes}</p></div>}
              {c.anotacoes_pos && <div className="col-span-2 p-3 rounded-lg" style={{ background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.15)' }}><p className="text-xs" style={{ color:'#10b981' }}>Anotações Pós-consulta</p><p className="text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>{c.anotacoes_pos}</p></div>}
              {c.resultado && <div className="col-span-2 p-3 rounded-lg" style={{ background:'rgba(79,86,247,0.06)', border:'1px solid rgba(79,86,247,0.15)' }}><p className="text-xs" style={{ color:'var(--accent)' }}>Resultado</p><p className="text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>{c.resultado}</p></div>}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{setEditing(c);setModalOpen(true)}} className="btn-ghost flex-1 justify-center text-sm py-2"><Pencil size={13}/> Editar</button>
              <button onClick={async ()=>{if(window.confirm("Confirmar esta ação?")){await consultasApi.delete(c.id);setDetalhe(null);load()}}} className="btn-ghost py-2 px-3" style={{ color:'#f87171', borderColor:'rgba(248,113,113,0.3)' }}><Trash2 size={13}/></button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const Section = ({ title, items, empty }: { title:string; items:Consulta[]; empty:string }) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-semibold" style={{ color:'var(--text-secondary)' }}>{title}</p>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background:'var(--bg-elevated)', color:'var(--text-muted)' }}>{items.length}</span>
      </div>
      {items.length === 0
        ? <p className="text-sm py-4 text-center" style={{ color:'var(--text-muted)' }}>{empty}</p>
        : <div className="space-y-3">{items.map(c=><ConsultaCard key={c.id} c={c}/>)}</div>
      }
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por cliente ou motivo..." className="input-field" style={{paddingLeft:'2.25rem'}}/>
        </div>
        <select value={sitFiltro} onChange={e=>setSitFiltro(e.target.value)} className="input-field sm:w-48" style={{ appearance:'none' }}>
          <option value="">Todos os status</option>
          {SITUACOES.map(s=><option key={s} value={s}>{SIT_CONS_LABEL[s]}</option>)}
        </select>
        <button onClick={()=>{setEditing(null);setModalOpen(true)}} className="btn-primary">
          <Plus size={15}/> Agendar Consulta
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor:'var(--accent)' }}/></div>
      ) : (
        <div className="space-y-8">
          <Section title="Hoje" items={hoje} empty="Nenhuma consulta hoje"/>
          <Section title="Próximas" items={futuras} empty="Nenhuma consulta futura agendada"/>
          {passadas.length > 0 && <Section title="Anteriores" items={passadas} empty=""/>}
        </div>
      )}

      {modalOpen && (
        <ConsultaModal consulta={editing} clientes={Object.values(clientesMap)} onSave={handleSave} onClose={()=>{setModalOpen(false);setEditing(null)}}/>
      )}
    </div>
  )
}
