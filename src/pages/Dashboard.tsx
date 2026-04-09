import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { clientesApi, consultasApi, historicoApi } from '../lib/api'
import { Consulta, Cliente, HistoricoContato, SIT_CONS_COLOR, SIT_CONS_LABEL, CONS_TIPO_LABEL } from '../types'
import { Users, CalendarDays, Bell, Flame, Clock, CheckCircle2, AlertTriangle, MessageSquareText, ChevronRight } from 'lucide-react'
import { format, isToday, isTomorrow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'

function StatCard({ label, value, icon: Icon, color, bg, to }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string; to: string
}) {
  return (
    <Link to={to} className="rounded-2xl p-5 card-hover block" style={{ background:'var(--bg-card)', border:'1px solid var(--border)', textDecoration:'none' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:bg }}>
          <Icon size={20} style={{ color }}/>
        </div>
        <ChevronRight size={14} style={{ color:'var(--text-muted)' }}/>
      </div>
      <p className="text-3xl font-bold" style={{ color:'var(--text-primary)' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>{label}</p>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [consultasHoje, setConsultasHoje] = useState<Consulta[]>([])
  const [proximas, setProximas] = useState<Consulta[]>([])
  const [recenteHistorico, setRecenteHistorico] = useState<HistoricoContato[]>([])
  const [stats, setStats] = useState({ totalClientes:0, leadsQuentes:0, alertasPendentes:0, captacaoAtiva:0 })
  const [clientesMap, setClientesMap] = useState<Record<string, Cliente>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      try {
        // Carregar clientes
        const clientes = await clientesApi.list()
        const cmap: Record<string, Cliente> = {}
        clientes.forEach(c => { cmap[c.id] = c })
        setClientesMap(cmap)

        // Carregar consultas
        const todasConsultas = await consultasApi.list()
        const now = new Date()
        const inicioDia = new Date(now); inicioDia.setHours(0,0,0,0)
        const fimDia = new Date(now); fimDia.setHours(23,59,59,999)
        const fim7dias = new Date(now.getTime() + 7*86400000)

        const hoje = todasConsultas.filter(c => {
          const d = new Date(c.data_hora)
          return d >= inicioDia && d <= fimDia
        })
        const prox = todasConsultas.filter(c => {
          const d = new Date(c.data_hora)
          return d > fimDia && d <= fim7dias && !['cancelada','realizada'].includes(c.situacao)
        }).slice(0, 5)

        // Alertas pendentes
        const alertas = todasConsultas.filter(c => {
          const d = new Date(c.data_hora)
          const em48h = new Date(now.getTime() + 2*86400000)
          return d >= now && d <= em48h && !c.alerta_enviado_d1 && c.situacao !== 'cancelada'
        })

        // Histórico recente
        const hist = await historicoApi.listAll()

        setConsultasHoje(hoje)
        setProximas(prox)
        setRecenteHistorico(hist.slice(0, 6))
        setStats({
          totalClientes: clientes.filter(c => c.situacao === 'ativo').length,
          leadsQuentes: clientes.filter(c => c.lead_quente).length,
          alertasPendentes: alertas.length,
          captacaoAtiva: 0,
        })
      } catch (err) {
        console.error('Dashboard error:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  const formatDataHora = (iso: string) => {
    const d = new Date(iso)
    if (isToday(d)) return `Hoje às ${format(d,'HH:mm')}`
    if (isTomorrow(d)) return `Amanhã às ${format(d,'HH:mm')}`
    return format(d,"dd/MM • HH:mm")
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor:'var(--accent)' }}/>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold" style={{ color:'var(--text-primary)' }}>
          Bom dia, {user?.user_metadata?.name?.split(' ')[0] ?? 'usuário'} 👋
        </h2>
        <p className="text-sm mt-1" style={{ color:'var(--text-muted)' }}>
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Clientes Ativos"    value={stats.totalClientes}    icon={Users}        color="#4f56f7" bg="rgba(79,86,247,0.12)"  to="/clientes"/>
        <StatCard label="Leads Quentes"      value={stats.leadsQuentes}     icon={Flame}        color="#f59e0b" bg="rgba(245,158,11,0.12)" to="/clientes"/>
        <StatCard label="Alertas Pendentes"  value={stats.alertasPendentes} icon={Bell}         color="#ec4899" bg="rgba(236,72,153,0.12)" to="/agenda"/>
        <StatCard label="Consultas Hoje"     value={consultasHoje.length}   icon={CalendarDays} color="#10b981" bg="rgba(16,185,129,0.12)" to="/agenda"/>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Agenda de hoje */}
        <div className="xl:col-span-2 rounded-2xl p-5" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} style={{ color:'var(--accent)' }}/>
              <h3 className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Agenda de Hoje</h3>
              {consultasHoje.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background:'var(--accent)', color:'white' }}>
                  {consultasHoje.length}
                </span>
              )}
            </div>
            <Link to="/agenda" className="text-xs font-medium" style={{ color:'var(--accent)', textDecoration:'none' }}>Ver tudo →</Link>
          </div>

          {consultasHoje.length === 0 ? (
            <div className="flex items-center justify-center h-24 rounded-xl" style={{ background:'var(--bg-elevated)', border:'1px dashed var(--border)' }}>
              <p className="text-sm" style={{ color:'var(--text-muted)' }}>Nenhuma consulta hoje 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {consultasHoje.map(c => {
                const cliente = clientesMap[c.cliente_id]
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'var(--bg-elevated)' }}>
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
                      style={{ background:'var(--accent-muted)', border:'1px solid rgba(79,86,247,0.2)' }}>
                      <div className="text-center">
                        <p className="text-xs font-bold leading-none" style={{ color:'var(--accent)' }}>{format(new Date(c.data_hora),'HH')}</p>
                        <p className="text-xs leading-none" style={{ color:'var(--text-muted)' }}>{format(new Date(c.data_hora),'mm')}h</p>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color:'var(--text-primary)' }}>{cliente?.nome ?? '—'}</p>
                      <p className="text-xs" style={{ color:'var(--text-muted)' }}>
                        {CONS_TIPO_LABEL[c.tipo]} • {c.modalidade}{c.local ? ` • ${c.local}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-lg text-xs border ${SIT_CONS_COLOR[c.situacao]}`}>
                        {SIT_CONS_LABEL[c.situacao]}
                      </span>
                      {c.alerta_enviado_dia
                        ? <CheckCircle2 size={14} style={{ color:'#10b981' }} aria-label="Alerta enviado"/>
                        : <Bell size={14} style={{ color:'#f59e0b' }} aria-label="Alerta pendente"/>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Próximas */}
          {proximas.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium mb-3" style={{ color:'var(--text-muted)' }}>Próximas consultas</p>
              <div className="space-y-2">
                {proximas.map(c => {
                  const cliente = clientesMap[c.cliente_id]
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background:'var(--bg-elevated)' }}>
                      <Clock size={13} style={{ color:'var(--text-muted)', flexShrink:0 }}/>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium" style={{ color:'var(--text-primary)' }}>{cliente?.nome ?? '—'}</span>
                        <span className="text-xs ml-2" style={{ color:'var(--text-muted)' }}>{formatDataHora(c.data_hora)}</span>
                      </div>
                      {!c.alerta_enviado_d1 && (
                        <AlertTriangle size={13} style={{ color:'#f59e0b', flexShrink:0 }} aria-label="Alerta pendente"/>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Histórico recente */}
        <div className="rounded-2xl p-5" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquareText size={16} style={{ color:'var(--accent)' }}/>
              <h3 className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Atividade Recente</h3>
            </div>
            <Link to="/historico" className="text-xs font-medium" style={{ color:'var(--accent)', textDecoration:'none' }}>Ver tudo →</Link>
          </div>
          <div className="space-y-3">
            {recenteHistorico.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color:'var(--text-muted)' }}>Nenhuma atividade ainda</p>
            ) : recenteHistorico.map(h => {
              const cliente = clientesMap[h.cliente_id]
              return (
                <div key={h.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: h.direcao==='entrada' ? 'rgba(79,86,247,0.15)' : 'rgba(16,185,129,0.15)',
                      border: `1px solid ${h.direcao==='entrada' ? 'rgba(79,86,247,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    }}>
                    {h.direcao==='entrada'
                      ? <MessageSquareText size={12} style={{ color:'var(--accent)' }}/>
                      : <CheckCircle2 size={12} style={{ color:'#10b981' }}/>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{cliente?.nome ?? '—'}</p>
                    <p className="text-xs line-clamp-1 mt-0.5" style={{ color:'var(--text-muted)' }}>{h.conteudo}</p>
                    <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)', opacity:0.7 }}>
                      {format(new Date(h.created_at),"dd/MM HH:mm")}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
