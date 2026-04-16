import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Users, Clock, Calendar, AlertTriangle, Plus, Pencil, Trash2, CheckCircle, XCircle, FileText, ChevronDown, ChevronUp, Briefcase } from 'lucide-react'
import { format, differenceInMinutes, eachDayOfInterval, isWeekend, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../contexts/ToastContext'

// ─── Types ──────────────────────────────────────────────────
type AusenciaTipo = 'falta'|'atestado'|'atraso'|'saida_antecipada'|'ferias'|'licenca'|'abono'|'hora_extra'
type ContratTipo = 'clt'|'pj'|'estagio'|'autonomo'|'outro'

const AUSENCIA_LABEL: Record<AusenciaTipo,string> = {
  falta:'Falta', atestado:'Atestado', atraso:'Atraso', saida_antecipada:'Saída Antecipada',
  ferias:'Férias', licenca:'Licença', abono:'Abono', hora_extra:'Hora Extra'
}
const AUSENCIA_COLOR: Record<AusenciaTipo,string> = {
  falta:'bg-red-500/15 text-red-400 border-red-500/30',
  atestado:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  atraso:'bg-amber-500/15 text-amber-400 border-amber-500/30',
  saida_antecipada:'bg-orange-500/15 text-orange-400 border-orange-500/30',
  ferias:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  licenca:'bg-violet-500/15 text-violet-400 border-violet-500/30',
  abono:'bg-teal-500/15 text-teal-400 border-teal-500/30',
  hora_extra:'bg-pink-500/15 text-pink-400 border-pink-500/30',
}
const CONTRAT_LABEL: Record<ContratTipo,string> = { clt:'CLT', pj:'PJ', estagio:'Estágio', autonomo:'Autônomo', outro:'Outro' }
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

interface Funcionario {
  id: string; nome: string; email: string; role: string; ativo: boolean
  turno_id?: string; cargo_id?: string; salario?: number
  data_admissao?: string; data_demissao?: string; tipo_contrato?: ContratTipo
  user_id: string; owner_id: string
  rh_cargos?: { nome: string }
  rh_turnos?: { nome: string; hora_entrada: string; hora_saida: string }
}
interface Cargo { id: string; nome: string; descricao?: string; salario_base?: number }
interface Turno { id: string; nome: string; hora_entrada: string; hora_saida: string; hora_intervalo_ini?: string; hora_intervalo_fim?: string; dias_semana: string }
interface Ausencia {
  id: string; funcionario_id: string; tipo: AusenciaTipo; data_inicio: string; data_fim?: string
  hora_inicio?: string; hora_fim?: string; motivo?: string; aprovado?: boolean; owner_id: string; created_at: string
  funcionarios?: { nome: string }
}

// ─── Cargo Modal ─────────────────────────────────────────────
function CargoModal({ item, onSave, onClose }: { item?: Cargo|null; onSave:(d:any)=>Promise<void>; onClose:()=>void }) {
  const [f, setF] = useState({ nome:'', descricao:'', salario_base:'' })
  const [saving, setSaving] = useState(false)
  useEffect(()=>{ if(item) setF({ nome:item.nome, descricao:item.descricao??'', salario_base:String(item.salario_base??'') }) },[item])
  const handleSubmit = async () => {
    if (!f.nome) return
    setSaving(true)
    await onSave({ nome:f.nome, descricao:f.descricao||null, salario_base:f.salario_base?Number(f.salario_base):null })
    setSaving(false)
  }
  return (
    <Modal title={item?'Editar Cargo':'Novo Cargo'} onClose={onClose} maxWidth="max-w-md"
      footer={<><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button><button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Salvando...':'Salvar'}</button></>}>
      <div className="space-y-3">
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Nome do Cargo *</label><input value={f.nome} onChange={e=>setF(p=>({...p,nome:e.target.value}))} className="input-field" placeholder="Ex: Vendedor Sênior"/></div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Salário Base</label><input type="number" step="0.01" value={f.salario_base} onChange={e=>setF(p=>({...p,salario_base:e.target.value}))} className="input-field" placeholder="R$ 0,00"/></div>
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Descrição</label><textarea value={f.descricao} onChange={e=>setF(p=>({...p,descricao:e.target.value}))} rows={2} className="input-field resize-none" placeholder="Responsabilidades do cargo..."/></div>
      </div>
    </Modal>
  )
}

// ─── Turno Modal ─────────────────────────────────────────────
function TurnoModal({ item, onSave, onClose }: { item?: Turno|null; onSave:(d:any)=>Promise<void>; onClose:()=>void }) {
  const [f, setF] = useState({ nome:'', hora_entrada:'08:00', hora_saida:'17:00', hora_intervalo_ini:'12:00', hora_intervalo_fim:'13:00', dias:'1,2,3,4,5' })
  const [saving, setSaving] = useState(false)
  useEffect(()=>{ if(item) setF({ nome:item.nome, hora_entrada:item.hora_entrada, hora_saida:item.hora_saida, hora_intervalo_ini:item.hora_intervalo_ini??'12:00', hora_intervalo_fim:item.hora_intervalo_fim??'13:00', dias:item.dias_semana??'1,2,3,4,5' }) },[item])
  const toggleDia = (d: number) => {
    const arr = f.dias.split(',').map(Number).filter(Boolean)
    const next = arr.includes(d) ? arr.filter(x=>x!==d) : [...arr,d].sort()
    setF(p=>({...p,dias:next.join(',')}))
  }
  const diasArr = f.dias.split(',').map(Number).filter(Boolean)
  const handleSubmit = async () => {
    if (!f.nome) return
    setSaving(true)
    await onSave({ nome:f.nome, hora_entrada:f.hora_entrada, hora_saida:f.hora_saida, hora_intervalo_ini:f.hora_intervalo_ini||null, hora_intervalo_fim:f.hora_intervalo_fim||null, dias_semana:f.dias })
    setSaving(false)
  }
  return (
    <Modal title={item?'Editar Turno':'Novo Turno'} onClose={onClose} maxWidth="max-w-md"
      footer={<><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button><button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Salvando...':'Salvar'}</button></>}>
      <div className="space-y-3">
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Nome do Turno *</label><input value={f.nome} onChange={e=>setF(p=>({...p,nome:e.target.value}))} className="input-field" placeholder="Ex: Comercial Manhã"/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Entrada</label><input type="time" value={f.hora_entrada} onChange={e=>setF(p=>({...p,hora_entrada:e.target.value}))} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Saída</label><input type="time" value={f.hora_saida} onChange={e=>setF(p=>({...p,hora_saida:e.target.value}))} className="input-field"/></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Início Intervalo</label><input type="time" value={f.hora_intervalo_ini} onChange={e=>setF(p=>({...p,hora_intervalo_ini:e.target.value}))} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Fim Intervalo</label><input type="time" value={f.hora_intervalo_fim} onChange={e=>setF(p=>({...p,hora_intervalo_fim:e.target.value}))} className="input-field"/></div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-2" style={{color:'var(--text-secondary)'}}>Dias da Semana</label>
          <div className="flex gap-1">
            {DIAS_SEMANA.map((d,i)=>(
              <button key={i} type="button" onClick={()=>toggleDia(i)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{background:diasArr.includes(i)?'var(--accent)':'var(--bg-elevated)', color:diasArr.includes(i)?'white':'var(--text-muted)', border:'1px solid var(--border)'}}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Ausência Modal ───────────────────────────────────────────
function AusenciaModal({ funcionarios, item, onSave, onClose, meuFuncId, isAdmin }:
  { funcionarios: Funcionario[]; item?: Ausencia|null; onSave:(d:any)=>Promise<void>; onClose:()=>void; meuFuncId?: string|null; isAdmin: boolean }) {
  const [f, setF] = useState({ funcionario_id: meuFuncId??'', tipo:'falta' as AusenciaTipo, data_inicio:format(new Date(),'yyyy-MM-dd'), data_fim:'', hora_inicio:'', hora_fim:'', motivo:'' })
  const [saving, setSaving] = useState(false)
  useEffect(()=>{ if(item) setF({ funcionario_id:item.funcionario_id, tipo:item.tipo, data_inicio:item.data_inicio, data_fim:item.data_fim??'', hora_inicio:item.hora_inicio??'', hora_fim:item.hora_fim??'', motivo:item.motivo??'' }) },[item])
  const handleSubmit = async () => {
    if (!f.funcionario_id||!f.data_inicio) return
    setSaving(true)
    await onSave({ ...f, data_fim:f.data_fim||null, hora_inicio:f.hora_inicio||null, hora_fim:f.hora_fim||null, motivo:f.motivo||null })
    setSaving(false)
  }
  const showHoras = ['atraso','saida_antecipada','hora_extra'].includes(f.tipo)
  return (
    <Modal title={item?'Editar Ocorrência':'Nova Ocorrência'} onClose={onClose} maxWidth="max-w-md"
      footer={<><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button><button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Salvando...':'Salvar'}</button></>}>
      <div className="space-y-3">
        {isAdmin && (
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Funcionário *</label>
            <select value={f.funcionario_id} onChange={e=>setF(p=>({...p,funcionario_id:e.target.value}))} className="input-field" style={{appearance:'none'}}>
              <option value="">Selecione...</option>
              {funcionarios.filter(fn=>fn.ativo).map(fn=><option key={fn.id} value={fn.id}>{fn.nome}</option>)}
            </select>
          </div>
        )}
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Tipo *</label>
          <select value={f.tipo} onChange={e=>setF(p=>({...p,tipo:e.target.value as AusenciaTipo}))} className="input-field" style={{appearance:'none'}}>
            {(Object.entries(AUSENCIA_LABEL) as [AusenciaTipo,string][]).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Data Início *</label><input type="date" value={f.data_inicio} onChange={e=>setF(p=>({...p,data_inicio:e.target.value}))} className="input-field"/></div>
          <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Data Fim</label><input type="date" value={f.data_fim} onChange={e=>setF(p=>({...p,data_fim:e.target.value}))} className="input-field"/></div>
        </div>
        {showHoras && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Hora Início</label><input type="time" value={f.hora_inicio} onChange={e=>setF(p=>({...p,hora_inicio:e.target.value}))} className="input-field"/></div>
            <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Hora Fim</label><input type="time" value={f.hora_fim} onChange={e=>setF(p=>({...p,hora_fim:e.target.value}))} className="input-field"/></div>
          </div>
        )}
        <div><label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Motivo / Observação</label><textarea value={f.motivo} onChange={e=>setF(p=>({...p,motivo:e.target.value}))} rows={2} className="input-field resize-none" placeholder="Descreva o motivo..."/></div>
      </div>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function RH() {
  const { ownerId, permissions, user } = useAuth()
  const { toast } = useToast()
  const [aba, setAba] = useState<'funcionarios'|'ausencias'|'turnos'|'cargos'|'espelho'>('funcionarios')
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [loading, setLoading] = useState(true)
  const [mesRef, setMesRef] = useState(format(new Date(),'yyyy-MM'))
  const [funcFiltro, setFuncFiltro] = useState('')
  const [meuFuncId, setMeuFuncId] = useState<string|null>(null)

  // Modais
  const [modalCargo, setModalCargo] = useState(false)
  const [editCargo, setEditCargo] = useState<Cargo|null>(null)
  const [modalTurno, setModalTurno] = useState(false)
  const [editTurno, setEditTurno] = useState<Turno|null>(null)
  const [modalAusencia, setModalAusencia] = useState(false)
  const [editAusencia, setEditAusencia] = useState<Ausencia|null>(null)
  const [deletando, setDeletando] = useState<{id:string;tipo:'cargo'|'turno'|'ausencia'}|null>(null)
  const [expandedFunc, setExpandedFunc] = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [ano, mes] = mesRef.split('-').map(Number)
    const inicio = mesRef + '-01'
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fim = mesRef + '-' + String(ultimoDia).padStart(2,'0')

    const { data: meFunc } = await supabase.from('funcionarios').select('id').eq('user_id', user?.id??'').maybeSingle()
    if (meFunc) setMeuFuncId(meFunc.id)

    const [{ data: funcs }, { data: cargosData }, { data: turnosData }, { data: ausData }] = await Promise.all([
      supabase.from('funcionarios').select('*, rh_cargos(nome), rh_turnos(nome,hora_entrada,hora_saida)').eq('owner_id', ownerId).order('nome'),
      supabase.from('rh_cargos').select('*').eq('user_id', ownerId).order('nome'),
      supabase.from('rh_turnos').select('*').eq('user_id', ownerId).order('nome'),
      supabase.from('rh_ausencias').select('*, funcionarios(nome)').eq('owner_id', ownerId)
        .gte('data_inicio', inicio).lte('data_inicio', fim).order('data_inicio', {ascending:false}),
    ])

    setFuncionarios((funcs??[]) as Funcionario[])
    setCargos((cargosData??[]) as Cargo[])
    setTurnos((turnosData??[]) as Turno[])
    setAusencias((ausData??[]) as Ausencia[])
    setLoading(false)
  }, [ownerId, user, mesRef])

  useEffect(() => { if (ownerId) load() }, [load, ownerId])

  const salvarCargo = async (data: any) => {
    if (editCargo) await supabase.from('rh_cargos').update(data).eq('id', editCargo.id)
    else await supabase.from('rh_cargos').insert({...data, user_id: ownerId})
    toast.success(editCargo?'Cargo atualizado':'Cargo criado')
    setModalCargo(false); setEditCargo(null); load()
  }

  const salvarTurno = async (data: any) => {
    if (editTurno) await supabase.from('rh_turnos').update(data).eq('id', editTurno.id)
    else await supabase.from('rh_turnos').insert({...data, user_id: ownerId})
    toast.success(editTurno?'Turno atualizado':'Turno criado')
    setModalTurno(false); setEditTurno(null); load()
  }

  const salvarAusencia = async (data: any) => {
    if (editAusencia) await supabase.from('rh_ausencias').update(data).eq('id', editAusencia.id)
    else await supabase.from('rh_ausencias').insert({...data, owner_id: ownerId})
    toast.success(editAusencia?'Ocorrência atualizada':'Ocorrência registrada')
    setModalAusencia(false); setEditAusencia(null); load()
  }

  const aprovarAusencia = async (id: string, aprovado: boolean) => {
    await supabase.from('rh_ausencias').update({ aprovado, aprovado_por: user?.id }).eq('id', id)
    toast.success(aprovado?'Aprovada':'Reprovada')
    load()
  }

  const confirmarDelete = async () => {
    if (!deletando) return
    if (deletando.tipo==='cargo') await supabase.from('rh_cargos').delete().eq('id', deletando.id)
    else if (deletando.tipo==='turno') await supabase.from('rh_turnos').delete().eq('id', deletando.id)
    else await supabase.from('rh_ausencias').delete().eq('id', deletando.id)
    toast.success('Excluído')
    setDeletando(null); load()
  }

  // Espelho de ponto: busca registros do mês para funcionário selecionado
  const [registrosPonto, setRegistrosPonto] = useState<any[]>([])
  useEffect(() => {
    if (aba !== 'espelho' || !funcFiltro) return
    const [ano, mes] = mesRef.split('-').map(Number)
    const inicio = mesRef + '-01'
    const fim = mesRef + '-' + String(new Date(ano, mes, 0).getDate()).padStart(2,'0')
    supabase.from('ponto_registros').select('*').eq('owner_id', ownerId)
      .eq('funcionario_id', funcFiltro).gte('data_hora', inicio).lte('data_hora', fim+'T23:59:59')
      .order('data_hora').then(({data}) => setRegistrosPonto(data??[]))
  }, [aba, funcFiltro, mesRef, ownerId])

  // Calcula espelho: por dia, entrada/saída/horas
  const espelho = (() => {
    if (!funcFiltro) return []
    const [ano, mes] = mesRef.split('-').map(Number)
    const dias = eachDayOfInterval({ start: new Date(ano, mes-1, 1), end: new Date(ano, mes-1, new Date(ano, mes, 0).getDate()) })
    return dias.map(dia => {
      const dStr = format(dia, 'yyyy-MM-dd')
      const regs = registrosPonto.filter(r => r.data_hora.startsWith(dStr)).sort((a:any,b:any)=>a.data_hora.localeCompare(b.data_hora))
      const entrada = regs.find((r:any)=>r.tipo==='entrada')
      const saida = regs.find((r:any)=>r.tipo==='saida')
      const ausenciaDia = ausencias.find(a=>a.funcionario_id===funcFiltro && a.data_inicio<=dStr && (a.data_fim??dStr)>=dStr)
      let horasTrab = '—'
      if (entrada && saida) {
        const mins = differenceInMinutes(new Date(saida.data_hora), new Date(entrada.data_hora))
        const h = Math.floor(mins/60); const m = mins%60
        horasTrab = `${h}h${m>0?String(m).padStart(2,'0')+'min':''}`
      }
      return {
        dia: dStr, diaSemana: format(dia,'EEE',{locale:ptBR}), fimSemana: isWeekend(dia),
        entrada: entrada ? format(new Date(entrada.data_hora),'HH:mm') : '—',
        saida: saida ? format(new Date(saida.data_hora),'HH:mm') : '—',
        horasTrab, ausencia: ausenciaDia ? AUSENCIA_LABEL[ausenciaDia.tipo] : null,
        regs: regs.length,
      }
    })
  })()

  const totalHorasEspelho = (() => {
    let totalMin = 0
    espelho.forEach(d => {
      if (d.horasTrab !== '—') {
        const match = d.horasTrab.match(/(\d+)h(?:(\d+)min)?/)
        if (match) totalMin += Number(match[1])*60 + Number(match[2]??0)
      }
    })
    return `${Math.floor(totalMin/60)}h${totalMin%60>0?String(totalMin%60).padStart(2,'0')+'min':''}`
  })()

  const ABAS = [
    {id:'funcionarios',label:'Funcionários',icon:Users},
    {id:'ausencias',label:'Ocorrências',icon:AlertTriangle},
    {id:'espelho',label:'Espelho de Ponto',icon:FileText},
    {id:'turnos',label:'Turnos',icon:Clock},
    {id:'cargos',label:'Cargos',icon:Briefcase},
  ] as const

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{color:'var(--text-primary)'}}>Recursos Humanos</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Cargos, turnos, ausências e espelho de ponto</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {aba==='cargos'&&permissions.isAdmin&&<button onClick={()=>{setEditCargo(null);setModalCargo(true)}} className="btn-primary"><Plus size={14}/> Novo Cargo</button>}
          {aba==='turnos'&&permissions.isAdmin&&<button onClick={()=>{setEditTurno(null);setModalTurno(true)}} className="btn-primary"><Plus size={14}/> Novo Turno</button>}
          {aba==='ausencias'&&<button onClick={()=>{setEditAusencia(null);setModalAusencia(true)}} className="btn-primary"><Plus size={14}/> Nova Ocorrência</button>}
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto rounded-xl p-1" style={{background:'var(--bg-elevated)'}}>
        {ABAS.map(({id,label,icon:Icon})=>(
          <button key={id} onClick={()=>setAba(id as any)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-shrink-0"
            style={{background:aba===id?'var(--bg-card)':'transparent', color:aba===id?'var(--text-primary)':'var(--text-muted)', border:aba===id?'1px solid var(--border)':'1px solid transparent'}}>
            <Icon size={12}/>{label}
          </button>
        ))}
      </div>

      {/* Filtro de mês */}
      {(aba==='ausencias'||aba==='espelho')&&(
        <div className="flex gap-3 items-center flex-wrap">
          <input type="month" value={mesRef} onChange={e=>setMesRef(e.target.value)} className="input-field w-40"/>
          {aba==='espelho'&&(
            <select value={funcFiltro} onChange={e=>setFuncFiltro(e.target.value)} className="input-field w-52" style={{appearance:'none'}}>
              <option value="">Selecione um funcionário</option>
              {funcionarios.filter(f=>f.ativo).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/></div>
      ) : aba==='funcionarios' ? (
        /* ── Funcionários ── */
        <div className="space-y-2">
          {funcionarios.length===0?<p className="text-center py-10 text-sm" style={{color:'var(--text-muted)'}}>Nenhum funcionário cadastrado</p>:
          funcionarios.map(fn=>(
            <div key={fn.id} className="rounded-xl overflow-hidden" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <div className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{background:'var(--accent-light)',color:'var(--accent)'}}>
                  {fn.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{fn.nome}</span>
                    <span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-muted)'}}>{fn.role}</span>
                    {!fn.ativo&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'rgba(248,113,113,0.1)',color:'#f87171'}}>Inativo</span>}
                  </div>
                  <div className="flex gap-3 text-xs mt-0.5" style={{color:'var(--text-muted)'}}>
                    <span>{fn.email}</span>
                    {fn.rh_cargos&&<span>· {fn.rh_cargos.nome}</span>}
                    {fn.rh_turnos&&<span>· {fn.rh_turnos.nome} ({fn.rh_turnos.hora_entrada.substring(0,5)}–{fn.rh_turnos.hora_saida.substring(0,5)})</span>}
                    {fn.data_admissao&&<span>· Adm: {format(new Date(fn.data_admissao+'T12:00:00'),'dd/MM/yyyy')}</span>}
                    {fn.salario&&<span>· R$ {fn.salario.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                  </div>
                </div>
                <button onClick={()=>setExpandedFunc(expandedFunc===fn.id?null:fn.id)}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}>
                  {expandedFunc===fn.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                </button>
              </div>
              {expandedFunc===fn.id&&(
                <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in" style={{borderTop:'0.5px solid var(--border)',paddingTop:12}}>
                  {[
                    {label:'Tipo Contrato',val:fn.tipo_contrato?CONTRAT_LABEL[fn.tipo_contrato]:'—'},
                    {label:'Cargo',val:fn.rh_cargos?.nome??'—'},
                    {label:'Turno',val:fn.rh_turnos?.nome??'—'},
                    {label:'Admissão',val:fn.data_admissao?format(new Date(fn.data_admissao+'T12:00:00'),'dd/MM/yyyy'):'—'},
                  ].map(it=>(
                    <div key={it.label} className="rounded-lg p-2" style={{background:'var(--bg-elevated)'}}>
                      <p className="text-xs" style={{color:'var(--text-muted)'}}>{it.label}</p>
                      <p className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{it.val}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : aba==='ausencias' ? (
        /* ── Ausências ── */
        <div className="space-y-2">
          {ausencias.length===0?<p className="text-center py-10 text-sm" style={{color:'var(--text-muted)'}}>Nenhuma ocorrência no período</p>:
          ausencias.map(a=>(
            <div key={a.id} className="rounded-xl p-4 flex items-start gap-3" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{a.funcionarios?.nome??'—'}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs border ${AUSENCIA_COLOR[a.tipo]}`}>{AUSENCIA_LABEL[a.tipo]}</span>
                  {a.aprovado===true&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'rgba(52,211,153,0.1)',color:'#34d399'}}>Aprovada</span>}
                  {a.aprovado===false&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'rgba(248,113,113,0.1)',color:'#f87171'}}>Reprovada</span>}
                  {(a.aprovado===null||a.aprovado===undefined)&&<span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'rgba(245,158,11,0.1)',color:'#f59e0b'}}>Pendente</span>}
                </div>
                <div className="flex gap-3 text-xs" style={{color:'var(--text-muted)'}}>
                  <span>{format(new Date(a.data_inicio+'T12:00:00'),'dd/MM/yyyy')}{a.data_fim&&a.data_fim!==a.data_inicio?` até ${format(new Date(a.data_fim+'T12:00:00'),'dd/MM/yyyy')}`:''}</span>
                  {a.hora_inicio&&<span>{a.hora_inicio}{a.hora_fim?`–${a.hora_fim}`:''}</span>}
                  {a.motivo&&<span>· {a.motivo}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {permissions.isAdmin&&a.aprovado===null&&<>
                  <button onClick={()=>aprovarAusencia(a.id,true)} title="Aprovar" style={{background:'none',border:'none',cursor:'pointer',color:'#34d399',padding:4}}><CheckCircle size={14}/></button>
                  <button onClick={()=>aprovarAusencia(a.id,false)} title="Reprovar" style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:4}}><XCircle size={14}/></button>
                </>}
                {permissions.isAdmin&&<>
                  <button onClick={()=>{setEditAusencia(a);setModalAusencia(true)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}><Pencil size={13}/></button>
                  <button onClick={()=>setDeletando({id:a.id,tipo:'ausencia'})} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:4}}><Trash2 size={13}/></button>
                </>}
              </div>
            </div>
          ))}
        </div>
      ) : aba==='espelho' ? (
        /* ── Espelho de Ponto ── */
        !funcFiltro ? (
          <div className="text-center py-12 rounded-xl" style={{border:'2px dashed var(--border)'}}>
            <FileText size={32} style={{color:'var(--text-muted)',margin:'0 auto 8px'}}/>
            <p className="text-sm" style={{color:'var(--text-muted)'}}>Selecione um funcionário para ver o espelho</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>
                {funcionarios.find(f=>f.id===funcFiltro)?.nome} — {mesRef}
              </p>
              <span className="text-sm font-bold" style={{color:'var(--accent)'}}>Total: {totalHorasEspelho}</span>
            </div>
            <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'var(--bg-elevated)'}}>
                    {['Data','Dia','Entrada','Saída','Horas','Ocorrência'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.4px',borderBottom:'1px solid var(--border)'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {espelho.map(d=>(
                    <tr key={d.dia} style={{
                      background:d.fimSemana?'var(--bg-elevated)':'transparent',
                      borderBottom:'0.5px solid var(--border)',
                      opacity:d.fimSemana?0.6:1
                    }}>
                      <td style={{padding:'7px 12px',color:'var(--text-secondary)'}}>{format(new Date(d.dia+'T12:00:00'),'dd/MM')}</td>
                      <td style={{padding:'7px 12px',color:'var(--text-muted)',textTransform:'capitalize'}}>{d.diaSemana}</td>
                      <td style={{padding:'7px 12px',color:d.entrada!=='—'?'#34d399':'var(--text-muted)',fontFamily:'monospace'}}>{d.entrada}</td>
                      <td style={{padding:'7px 12px',color:d.saida!=='—'?'#f87171':'var(--text-muted)',fontFamily:'monospace'}}>{d.saida}</td>
                      <td style={{padding:'7px 12px',color:d.horasTrab!=='—'?'var(--accent)':'var(--text-muted)',fontWeight:d.horasTrab!=='—'?600:400}}>{d.horasTrab}</td>
                      <td style={{padding:'7px 12px'}}>
                        {d.ausencia&&<span className={`px-2 py-0.5 rounded-lg text-xs border ${AUSENCIA_COLOR['falta']}`}>{d.ausencia}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : aba==='turnos' ? (
        /* ── Turnos ── */
        <div className="space-y-2">
          {turnos.length===0?<p className="text-center py-10 text-sm" style={{color:'var(--text-muted)'}}>Nenhum turno cadastrado</p>:
          turnos.map(t=>(
            <div key={t.id} className="rounded-xl p-4 flex items-center gap-3" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <Clock size={15} style={{color:'var(--accent)',flexShrink:0}}/>
              <div className="flex-1">
                <p className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{t.nome}</p>
                <div className="flex gap-3 text-xs mt-0.5" style={{color:'var(--text-muted)'}}>
                  <span>{t.hora_entrada.substring(0,5)} – {t.hora_saida.substring(0,5)}</span>
                  {t.hora_intervalo_ini&&<span>· Intervalo {t.hora_intervalo_ini.substring(0,5)}–{t.hora_intervalo_fim?.substring(0,5)}</span>}
                  <span>· {t.dias_semana.split(',').map(d=>DIAS_SEMANA[Number(d)]).join(', ')}</span>
                </div>
              </div>
              {permissions.isAdmin&&(
                <div className="flex gap-1">
                  <button onClick={()=>{setEditTurno(t);setModalTurno(true)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}><Pencil size={13}/></button>
                  <button onClick={()=>setDeletando({id:t.id,tipo:'turno'})} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:4}}><Trash2 size={13}/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ── Cargos ── */
        <div className="space-y-2">
          {cargos.length===0?<p className="text-center py-10 text-sm" style={{color:'var(--text-muted)'}}>Nenhum cargo cadastrado</p>:
          cargos.map(c=>(
            <div key={c.id} className="rounded-xl p-4 flex items-center gap-3" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
              <Briefcase size={15} style={{color:'var(--accent)',flexShrink:0}}/>
              <div className="flex-1">
                <p className="font-medium text-sm" style={{color:'var(--text-primary)'}}>{c.nome}</p>
                <div className="flex gap-3 text-xs mt-0.5" style={{color:'var(--text-muted)'}}>
                  {c.salario_base&&<span>Salário base: R$ {c.salario_base.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                  {c.descricao&&<span>· {c.descricao}</span>}
                </div>
              </div>
              {permissions.isAdmin&&(
                <div className="flex gap-1">
                  <button onClick={()=>{setEditCargo(c);setModalCargo(true)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:4}}><Pencil size={13}/></button>
                  <button onClick={()=>setDeletando({id:c.id,tipo:'cargo'})} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:4}}><Trash2 size={13}/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalCargo&&<CargoModal item={editCargo} onSave={salvarCargo} onClose={()=>{setModalCargo(false);setEditCargo(null)}}/>}
      {modalTurno&&<TurnoModal item={editTurno} onSave={salvarTurno} onClose={()=>{setModalTurno(false);setEditTurno(null)}}/>}
      {modalAusencia&&<AusenciaModal funcionarios={funcionarios} item={editAusencia} onSave={salvarAusencia} onClose={()=>{setModalAusencia(false);setEditAusencia(null)}} meuFuncId={meuFuncId} isAdmin={permissions.isAdmin}/>}
      {deletando&&<ConfirmModal title="Confirmar exclusão" message="Deseja excluir este registro?" confirmLabel="Excluir" danger onConfirm={confirmarDelete} onCancel={()=>setDeletando(null)}/>}
    </div>
  )
}