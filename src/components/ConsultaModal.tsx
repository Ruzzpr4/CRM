import { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { X, Save } from 'lucide-react'
import { Consulta, Cliente, ConsultaSituacao, ConsultaTipo, ConsultaModalidade, AlertaCanal } from '../types'
import { Vendedor } from '../types/vendedor'
import { consultasApi, vendedoresApi } from '../lib/api'
import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'

// Fora do componente para não perder foco
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

interface Props {
  consulta?: Consulta | null
  clientes: Cliente[]
  onSave: (d: Partial<Consulta>) => Promise<void>
  onClose: () => void
}

export default function ConsultaModal({ consulta, clientes, onSave, onClose }: Props) {
  const [f, setF] = useState({
    cliente_id: '', vendedor_id: '', data: '', hora: '09:00',
    tipo: 'consulta' as ConsultaTipo,
    modalidade: 'presencial' as ConsultaModalidade,
    local: '', situacao: 'agendada' as ConsultaSituacao,
    duracao_min: 60, motivo: '', observacoes: '',
    anotacoes_pos: '', resultado: '', motivo_cancelamento: '',
    alerta_canal: 'whatsapp' as AlertaCanal,
    alerta_enviado_d2: false, alerta_enviado_d1: false, alerta_enviado_dia: false,
  })
  const [saving, setSaving] = useState(false)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [conflito, setConflito] = useState<Consulta | null>(null)
  const [checkingConflito, setCheckingConflito] = useState(false)

  useEffect(() => {
    vendedoresApi.list({ situacao: true }).then(setVendedores)
  }, [])

  useEffect(() => {
    if (consulta) {
      const d = new Date(consulta.data_hora)
      setF({
        cliente_id: consulta.cliente_id,
        vendedor_id: consulta.vendedor_id ?? '',
        data: format(d, 'yyyy-MM-dd'),
        hora: format(d, 'HH:mm'),
        tipo: consulta.tipo,
        modalidade: consulta.modalidade,
        local: consulta.local ?? '',
        situacao: consulta.situacao,
        duracao_min: consulta.duracao_min ?? 60,
        motivo: consulta.motivo ?? '',
        observacoes: consulta.observacoes ?? '',
        anotacoes_pos: consulta.anotacoes_pos ?? '',
        resultado: consulta.resultado ?? '',
        motivo_cancelamento: consulta.motivo_cancelamento ?? '',
        alerta_canal: consulta.alerta_canal ?? 'whatsapp',
        alerta_enviado_d2: consulta.alerta_enviado_d2,
        alerta_enviado_d1: consulta.alerta_enviado_d1,
        alerta_enviado_dia: consulta.alerta_enviado_dia,
      })
    }
  }, [consulta])

  // Verificar conflito de horário
  useEffect(() => {
    if (!f.vendedor_id || !f.data || !f.hora) { setConflito(null); return }
    const timer = setTimeout(async () => {
      setCheckingConflito(true)
      const dataHora = new Date(`${f.data}T${f.hora}:00`).toISOString()
      const c = await consultasApi.checkConflito(f.vendedor_id, dataHora, Number(f.duracao_min), consulta?.id)
      setConflito(c)
      setCheckingConflito(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [f.vendedor_id, f.data, f.hora, f.duracao_min, consulta?.id])

  const set = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }))

  const [formError, setFormError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!f.cliente_id) { setFormError('Selecione um cliente antes de salvar.'); return }
    if (!f.data || !f.hora) { setFormError('Data e hora são obrigatórios.'); return }
    if (conflito) { setFormError('Conflito de horário! Este vendedor já tem consulta neste horário.'); return }
    setSaving(true)
    try {
      const data_hora = new Date(`${f.data}T${f.hora}:00`).toISOString()
      const { data: _d, hora: _h, ...rest } = f
      await onSave({ ...rest, data_hora, duracao_min: Number(f.duracao_min), vendedor_id: f.vendedor_id || undefined, consultor_id: undefined })
    } catch (err: any) {
      setFormError('Erro ao salvar: ' + (err?.message ?? 'Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  const tipoOptions: [ConsultaTipo, string][] = [
    ['consulta','Consulta'], ['retorno','Retorno'], ['avaliacao','Avaliação'],
    ['urgencia','Urgência'], ['ligacao','Ligação'], ['outro','Outro'],
  ]
  const modalOptions: [ConsultaModalidade, string][] = [
    ['presencial','Presencial'], ['online','Online'], ['telefone','Telefone'], ['domicilio','Domicílio'],
  ]
  const sitOptions: [ConsultaSituacao, string][] = [
    ['agendada','Agendada'], ['confirmada','Confirmada'], ['realizada','Realizada'],
    ['cancelada','Cancelada'], ['faltou','Faltou'], ['reagendada','Reagendada'],
  ]

  const modal = (
    <div
      // outside click disabled
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 16px', overflowY: 'auto',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 540,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          flexShrink: 0, marginBottom: 32,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {consulta ? 'Editar Consulta' : 'Agendar Consulta'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form id="consulta-form" onSubmit={handleSubmit} style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

            {/* Cliente */}
            <Field label="Cliente *">
              <select required value={f.cliente_id} onChange={e => set('cliente_id', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
                <option value="">Selecione o cliente...</option>
                {clientes.filter(c => c.situacao !== 'arquivado').sort((a, b) => a.nome.localeCompare(b.nome)).map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </Field>

            {/* Vendedor */}
            <Field label="Vendedor / Consultor">
              <select value={f.vendedor_id} onChange={e => set('vendedor_id', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
                <option value="">— Sem vendedor —</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.nome}{v.equipe ? ` (${v.equipe})` : ''}</option>
                ))}
              </select>
            </Field>

            {/* Data e Hora */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Data *">
                <input required type="date" value={f.data} onChange={e => set('data', e.target.value)} className="input-field" />
              </Field>
              <Field label="Hora *">
                <input required type="time" value={f.hora} onChange={e => set('hora', e.target.value)} className="input-field" />
              </Field>
            </div>

            {/* Conflito de horário */}
            {f.vendedor_id && f.data && f.hora && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: conflito ? 'rgba(239,68,68,0.08)' : checkingConflito ? 'var(--bg-elevated)' : 'rgba(16,185,129,0.06)',
                border: `1px solid ${conflito ? 'rgba(239,68,68,0.3)' : checkingConflito ? 'var(--border)' : 'rgba(16,185,129,0.2)'}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {conflito ? (
                  <>
                    <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#f87171' }}>Conflito de horário! Este vendedor já tem consulta neste horário.</span>
                  </>
                ) : checkingConflito ? (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Verificando disponibilidade...</span>
                ) : (
                  <span style={{ fontSize: 12, color: '#10b981' }}>✓ Horário disponível para este vendedor</span>
                )}
              </div>
            )}

            {/* Tipo, Duração, Modalidade, Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Tipo">
                <select value={f.tipo} onChange={e => set('tipo', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
                  {tipoOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Duração (min)">
                <input type="number" min={15} max={480} step={15} value={f.duracao_min} onChange={e => set('duracao_min', Number(e.target.value) || 60)} className="input-field" />
              </Field>
              <Field label="Modalidade">
                <select value={f.modalidade} onChange={e => set('modalidade', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
                  {modalOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={f.situacao} onChange={e => set('situacao', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
                  {sitOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Local / Link">
              <input value={f.local} onChange={e => set('local', e.target.value)} placeholder="Ex: Consultório 1 ou link Google Meet" className="input-field" />
            </Field>

            <Field label="Motivo da Consulta">
              <input value={f.motivo} onChange={e => set('motivo', e.target.value)} placeholder="Motivo principal" className="input-field" />
            </Field>

            <Field label="Observações">
              <textarea value={f.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} placeholder="Instruções, itens para trazer..." className="input-field resize-none" />
            </Field>

            {['realizada', 'faltou'].includes(f.situacao) && (
              <>
                <Field label="Anotações Pós-consulta">
                  <textarea value={f.anotacoes_pos} onChange={e => set('anotacoes_pos', e.target.value)} rows={3} placeholder="Registro do atendimento..." className="input-field resize-none" />
                </Field>
                <Field label="Resultado / Encaminhamento">
                  <textarea value={f.resultado} onChange={e => set('resultado', e.target.value)} rows={2} placeholder="Diagnóstico, prescrição..." className="input-field resize-none" />
                </Field>
              </>
            )}

            {f.situacao === 'cancelada' && (
              <Field label="Motivo do Cancelamento">
                <input value={f.motivo_cancelamento} onChange={e => set('motivo_cancelamento', e.target.value)} placeholder="Por que foi cancelado?" className="input-field" />
              </Field>
            )}

            {/* Alertas */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>🔔 Alertas</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Canal de Alerta">
                  <select value={f.alerta_canal} onChange={e => set('alerta_canal', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="sms">SMS</option>
                    <option value="todos">Todos</option>
                  </select>
                </Field>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 22 }}>
                  {([['alerta_enviado_d2', 'D-2 enviado'], ['alerta_enviado_d1', 'D-1 enviado'], ['alerta_enviado_dia', 'No dia enviado']] as [string, string][]).map(([k, l]) => (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={f[k as keyof typeof f] as boolean} onChange={e => set(k, e.target.checked)} style={{ width: 14, height: 14, accentColor: '#4f56f7' }} />
                      {l} ✓
                    </label>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button type="button" onClick={() => { const el = document.getElementById('consulta-form') as HTMLFormElement; if(el) el.requestSubmit(); }} disabled={saving || !!conflito} className="btn-primary flex-1 justify-center"
            style={{ opacity: (saving || !!conflito) ? 0.6 : 1 }}>
            <Save size={15} />{saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(modal, document.body)
}