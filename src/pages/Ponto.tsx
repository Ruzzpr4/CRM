import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Clock, LogIn, LogOut, Coffee, Search, AlertCircle, CheckCircle, Calendar, Users } from 'lucide-react'
import { format, differenceInMinutes, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Modal from '../components/Modal'
import { useToast } from '../contexts/ToastContext'

type TipoPonto = 'entrada'|'saida'|'intervalo_inicio'|'intervalo_fim'
type TipoJust = 'falta'|'atraso'|'saida_antecipada'|'hora_extra'

const TIPO_LABEL: Record<TipoPonto,string> = { entrada:'Entrada', saida:'Saída', intervalo_inicio:'Intervalo Início', intervalo_fim:'Intervalo Fim' }
const TIPO_ICON: Record<TipoPonto,any> = { entrada:LogIn, saida:LogOut, intervalo_inicio:Coffee, intervalo_fim:Coffee }
const TIPO_COLOR: Record<TipoPonto,string> = { entrada:'#34d399', saida:'#f87171', intervalo_inicio:'#f59e0b', intervalo_fim:'#60a5fa' }
const JUST_LABEL: Record<TipoJust,string> = { falta:'Falta', atraso:'Atraso', saida_antecipada:'Saída Antecipada', hora_extra:'Hora Extra' }

interface RegistroPonto {
  id: string; funcionario_id: string; user_id_func: string; tipo: TipoPonto
  data_hora: string; observacao?: string; owner_id: string; created_at: string
  funcionarios?: { nome: string; email: string }
}
interface Justificativa {
  id: string; funcionario_id: string; data_referencia: string; tipo: TipoJust
  motivo: string; aprovado?: boolean; aprovado_por?: string; owner_id: string; created_at: string
  funcionarios?: { nome: string }
}
interface Funcionario { id: string; user_id: string; nome: string; email: string; role: string; ativo: boolean }

function JustModal({ funcId, onSave, onClose }: { funcId:string; onSave:(d:any)=>Promise<void>; onClose:()=>void }) {
  const [f, setF] = useState({ data_referencia:format(new Date(),'yyyy-MM-dd'), tipo:'falta' as TipoJust, motivo:'' })
  const [saving, setSaving] = useState(false)
  const handleSubmit = async () => {
    if (!f.motivo) return
    setSaving(true)
    await onSave({ ...f, funcionario_id: funcId })
    setSaving(false)
  }
  return (
    <Modal title="Registrar Justificativa" onClose={onClose} maxWidth="max-w-md"
      footer={<><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button><button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Salvando...':'Salvar'}</button></>}>
      <div className="space-y-3">
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Data</label><input type="date" value={f.data_referencia} onChange={e=>setF(p=>({...p,data_referencia:e.target.value}))} className="input-field"/></div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Tipo</label>
          <select value={f.tipo} onChange={e=>setF(p=>({...p,tipo:e.target.value as TipoJust}))} className="input-field" style={{appearance:'none'}}>
            {(['falta','atraso','saida_antecipada','hora_extra'] as TipoJust[]).map(t=><option key={t} value={t}>{JUST_LABEL[t]}</option>)}
          </select>
        </div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Motivo *</label><textarea value={f.motivo} onChange={e=>setF(p=>({...p,motivo:e.target.value}))} rows={3} className="input-field resize-none" placeholder="Descreva o motivo..."/></div>
      </div>
    </Modal>
  )
}

export default function Ponto() {
  const { ownerId, permissions, user, equipeId } = useAuth()
  const { toast } = useToast()
  const [aba, setAba] = useState<'registrar'|'historico'|'justificativas'>('registrar')
  const [registros, setRegistros] = useState<RegistroPonto[]>([])
  const [justificativas, setJustificativas] = useState<Justificativa[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [meuFuncId, setMeuFuncId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [mesRef, setMesRef] = useState(format(new Date(),'yyyy-MM'))
  const [funcFiltro, setFuncFiltro] = useState('')
  const [justModal, setJustModal] = useState(false)
  const [registrando, setRegistrando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const inicioDate = new Date(mesRef+'-01')
    const fimDate = new Date(inicioDate.getFullYear(), inicioDate.getMonth()+1, 0)
    const inicio = format(inicioDate, 'yyyy-MM-dd')
    const fim = format(fimDate, 'yyyy-MM-dd')

    // Busca funcionário do usuário logado
    const { data: meFunc } = await supabase.from('funcionarios').select('id,nome,email,role,ativo,user_id').eq('user_id', user?.id??'').maybeSingle()
    if (meFunc) {
      setMeuFuncId(meFunc.id)
    } else if (permissions.isAdmin && user?.id) {
      // Admin não tem registro em funcionarios — usa o próprio user_id como func_id virtual
      // Cria um registro temporário ou usa user_id diretamente
      setMeuFuncId(user.id)
    }

    let funcsQuery = supabase.from('funcionarios').select('id,nome,email,role,ativo,user_id').eq('owner_id', ownerId).eq('ativo', true)
    // Supervisor vê apenas funcionários da sua equipe
    if (!permissions.isAdmin && permissions.role === 'supervisor' && equipeId) {
      const { data: membros } = await supabase.from('org_membros').select('user_id').eq('equipe_id', equipeId).eq('ativo', true)
      const userIds = (membros ?? []).map((m: any) => m.user_id).filter(Boolean)
      if (userIds.length) funcsQuery = funcsQuery.in('user_id', userIds)
      else { setFuncionarios([]); setLoading(false); return }
    }
    const { data: funcs } = await funcsQuery
    setFuncionarios((funcs??[]) as Funcionario[])

    let qReg = supabase.from('ponto_registros').select('*, funcionarios(nome,email)').eq('owner_id', ownerId).gte('data_hora', inicio+'T00:00:00').lte('data_hora', fim+'T23:59:59+00:00').order('data_hora', {ascending:false})
    if (!permissions.isAdmin && permissions.role === 'supervisor' && equipeId) {
      const { data: membros } = await supabase.from('org_membros').select('user_id').eq('equipe_id', equipeId).eq('ativo', true)
      const userIds = (membros ?? []).map((m: any) => m.user_id).filter(Boolean)
      if (userIds.length) {
        const { data: funcsEquipe } = await supabase.from('funcionarios').select('id').in('user_id', userIds)
        const funcIds = (funcsEquipe ?? []).map((f: any) => f.id)
        if (funcIds.length) qReg = qReg.in('funcionario_id', funcIds)
      }
    } else if (!permissions.isAdmin && !['supervisor'].includes(permissions.role) && meFunc) {
      qReg = qReg.eq('funcionario_id', meFunc.id)
    }

    let qJust = supabase.from('ponto_justificativas').select('*, funcionarios(nome)').eq('owner_id', ownerId).gte('data_referencia', inicio).lte('data_referencia', fim).order('data_referencia', {ascending:false})
    if (!permissions.isAdmin && !['supervisor'].includes(permissions.role) && meFunc) qJust = qJust.eq('funcionario_id', meFunc.id)

    const [{ data: regs }, { data: justs }] = await Promise.all([qReg, qJust])
    setRegistros((regs??[]) as RegistroPonto[])
    setJustificativas((justs??[]) as Justificativa[])
    setLoading(false)
  }, [ownerId, permissions, user, mesRef])

  useEffect(() => { load() }, [load])

  const registrarPonto = async (tipo: TipoPonto) => {
    if (!meuFuncId) { toast.error('Seu usuário não está vinculado a um funcionário'); return }
    setRegistrando(true)
    try {
      // Para admin, funcionario_id pode ser o próprio user_id se não tiver registro em funcionarios
      const { data: funcCheck } = await supabase.from('funcionarios').select('id').eq('user_id', user?.id??'').maybeSingle()
      const funcId = funcCheck?.id ?? meuFuncId
      if (!funcId) {
        toast.error('Não foi possível identificar seu registro de funcionário.')
        setRegistrando(false)
        return
      }
      const { error } = await supabase.from('ponto_registros').insert({
        funcionario_id: funcId,
        user_id_func: user?.id,
        tipo,
        data_hora: new Date().toISOString(),
        owner_id: ownerId
      })
      if (error) {
        toast.error('Erro ao registrar: ' + error.message)
      } else {
        toast.success(`${TIPO_LABEL[tipo]} registrada com sucesso!`)
        load()
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message ?? 'Tente novamente'))
    } finally {
      setRegistrando(false)
    }
  }

  const salvarJustificativa = async (data: any) => {
    await supabase.from('ponto_justificativas').insert({ ...data, owner_id: ownerId })
    toast.success('Justificativa registrada')
    setJustModal(false)
    load()
  }

  const aprovarJustificativa = async (id: string, aprovado: boolean) => {
    await supabase.from('ponto_justificativas').update({ aprovado, aprovado_por: user?.id }).eq('id', id)
    toast.success(aprovado ? 'Justificativa aprovada' : 'Justificativa reprovada')
    load()
  }

  // Banco de horas: calcula minutos trabalhados no mês por funcionário
  const calcBancoHoras = (funcId: string) => {
    const regsFunc = registros.filter(r => r.funcionario_id === funcId)
    let totalMin = 0
    const entradas = regsFunc.filter(r => r.tipo === 'entrada').sort((a,b) => a.data_hora.localeCompare(b.data_hora))
    const saidas = regsFunc.filter(r => r.tipo === 'saida').sort((a,b) => a.data_hora.localeCompare(b.data_hora))
    for (let i = 0; i < Math.min(entradas.length, saidas.length); i++) {
      const entrada = new Date(entradas[i].data_hora)
      const saida = new Date(saidas[i].data_hora)
      if (saida > entrada) totalMin += differenceInMinutes(saida, entrada)
    }
    const horas = Math.floor(totalMin / 60)
    const min = totalMin % 60
    return `${horas}h${min > 0 ? `${min}min` : ''}`
  }

  const regsFiltrados = registros.filter(r => !funcFiltro || r.funcionario_id === funcFiltro)

  // Agrupados por data
  const regsPorData: Record<string, RegistroPonto[]> = {}
  regsFiltrados.forEach(r => {
    const dt = format(new Date(r.data_hora), 'yyyy-MM-dd')
    if (!regsPorData[dt]) regsPorData[dt] = []
    regsPorData[dt].push(r)
  })

  const ultimoRegistro = registros.find(r => r.user_id_func === user?.id)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{color:'var(--text-primary)'}}>Ponto Eletrônico</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Registro e controle de ponto</p>
        </div>
        <input type="month" value={mesRef} onChange={e=>setMesRef(e.target.value)} className="input-field w-40"/>
      </div>

      {/* Card de registro rápido */}
      <div className="rounded-2xl p-6" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
        <div className="flex items-center gap-3 mb-4">
          <Clock size={20} style={{color:'var(--accent)'}}/>
          <div>
            <p className="font-semibold" style={{color:'var(--text-primary)'}}>Registrar Ponto</p>
            <p className="text-xs" style={{color:'var(--text-muted)'}}>{format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", {locale:ptBR})}</p>
          </div>
        </div>
        {ultimoRegistro && (
          <p className="text-xs mb-4" style={{color:'var(--text-muted)'}}>
            Último registro: {TIPO_LABEL[ultimoRegistro.tipo]} em {format(new Date(ultimoRegistro.data_hora), "dd/MM 'às' HH:mm")}
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['entrada','saida','intervalo_inicio','intervalo_fim'] as TipoPonto[]).map(tipo=>{
            const Icon = TIPO_ICON[tipo]
            return (
              <button key={tipo} onClick={()=>registrarPonto(tipo)} disabled={registrando}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                style={{background:'var(--bg-elevated)',border:`1px solid var(--border)`,color:TIPO_COLOR[tipo],cursor:'pointer'}}>
                <Icon size={20}/>
                <span className="text-xs font-medium" style={{color:'var(--text-primary)'}}>{TIPO_LABEL[tipo]}</span>
              </button>
            )
          })}
        </div>
        <button onClick={()=>setJustModal(true)} className="btn-ghost mt-3 text-xs py-1.5"><AlertCircle size={13}/> Registrar Justificativa</button>
      </div>

      {/* Banco de horas (admin/supervisor) */}
      {(permissions.isAdmin || permissions.role === 'supervisor') && funcionarios.length > 0 && (
        <div className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} style={{color:'var(--accent)'}}/>
            <p className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>Banco de Horas — {mesRef}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {funcionarios.map(f=>(
              <div key={f.id} className="rounded-lg p-3" style={{background:'var(--bg-elevated)'}}>
                <p className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{f.nome}</p>
                <p className="text-lg font-bold" style={{color:'var(--accent)'}}>{calcBancoHoras(f.id)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 rounded-xl p-1" style={{background:'var(--bg-elevated)'}}>
        {(['historico','justificativas'] as const).map(t=>(
          <button key={t} onClick={()=>setAba(t)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{background:aba===t?'var(--bg-card)':'transparent', color:aba===t?'var(--text-primary)':'var(--text-muted)', border:aba===t?'1px solid var(--border)':'1px solid transparent'}}>
            {t==='historico'?'Histórico de Registros':'Justificativas'}
          </button>
        ))}
      </div>

      {(permissions.isAdmin || permissions.role === 'supervisor') && aba === 'historico' && (
        <select value={funcFiltro} onChange={e=>setFuncFiltro(e.target.value)} className="input-field w-56" style={{appearance:'none'}}>
          <option value="">Todos os funcionários</option>
          {funcionarios.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/></div>
      ) : aba === 'historico' ? (
        <div className="space-y-4">
          {Object.keys(regsPorData).length === 0 ? (
            <p className="text-center py-8 text-sm" style={{color:'var(--text-muted)'}}>Nenhum registro no período</p>
          ) : Object.entries(regsPorData).sort(([a],[b])=>b.localeCompare(a)).map(([data, regs])=>(
            <div key={data} className="rounded-xl overflow-hidden" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <div className="px-4 py-2" style={{borderBottom:'0.5px solid var(--border)',background:'var(--bg-elevated)'}}>
                <p className="text-xs font-semibold" style={{color:'var(--text-secondary)'}}>{format(new Date(data+'T12:00:00'),'EEEE, dd/MM/yyyy',{locale:ptBR})}</p>
              </div>
              <div className="divide-y" style={{borderColor:'var(--border)'}}>
                {regs.sort((a,b)=>a.data_hora.localeCompare(b.data_hora)).map(r=>{
                  const Icon = TIPO_ICON[r.tipo]
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <Icon size={14} style={{color:TIPO_COLOR[r.tipo],flexShrink:0}}/>
                      <div className="flex-1">
                        <span className="text-sm" style={{color:'var(--text-primary)'}}>{TIPO_LABEL[r.tipo]}</span>
                        {r.funcionarios&&<span className="text-xs ml-2" style={{color:'var(--text-muted)'}}>— {r.funcionarios.nome}</span>}
                      </div>
                      <span className="text-sm font-mono" style={{color:'var(--text-secondary)'}}>{format(new Date(r.data_hora),'HH:mm:ss')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {justificativas.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{color:'var(--text-muted)'}}>Nenhuma justificativa no período</p>
          ) : justificativas.map(j=>(
            <div key={j.id} className="rounded-xl p-4 flex items-start gap-3" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <AlertCircle size={15} style={{color:'#f59e0b',marginTop:2,flexShrink:0}}/>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {j.funcionarios&&<span className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{j.funcionarios.nome}</span>}
                  <span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-muted)'}}>{JUST_LABEL[j.tipo]}</span>
                  {j.aprovado===true&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'rgba(52,211,153,0.1)',color:'#34d399'}}>Aprovada</span>}
                  {j.aprovado===false&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'rgba(248,113,113,0.1)',color:'#f87171'}}>Reprovada</span>}
                  {j.aprovado===undefined||j.aprovado===null&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'rgba(245,158,11,0.1)',color:'#f59e0b'}}>Pendente</span>}
                </div>
                <p className="text-xs mb-1" style={{color:'var(--text-muted)'}}>{format(new Date(j.data_referencia+'T12:00:00'),'dd/MM/yyyy')} — {j.motivo}</p>
              </div>
              {permissions.isAdmin && j.aprovado === null && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={()=>aprovarJustificativa(j.id,true)} className="btn-ghost text-xs py-1 px-2" style={{color:'#34d399'}}><CheckCircle size={12}/> Aprovar</button>
                  <button onClick={()=>aprovarJustificativa(j.id,false)} className="btn-ghost text-xs py-1 px-2" style={{color:'#f87171'}}>Reprovar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {justModal && meuFuncId && <JustModal funcId={meuFuncId} onSave={salvarJustificativa} onClose={()=>setJustModal(false)}/>}
    </div>
  )
}