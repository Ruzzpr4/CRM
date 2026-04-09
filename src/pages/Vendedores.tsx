import { useState, useEffect, useCallback } from 'react'
import { vendedoresApi } from '../lib/api'
import { Vendedor, CARGO_LABELS, TURNO_LABELS, VendedorCargo, VendedorTurno } from '../types/vendedor'
import Modal from '../components/Modal'
import { Plus, Search, User, Phone, Mail, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react'

// ─── Definido FORA do componente para não causar remount a cada render ─────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Modal de Vendedor ────────────────────────────────────────────────────
function VendedorModal({ item, todos, onSave, onClose }: {
  item?: Vendedor | null
  todos: Vendedor[]
  onSave: (d: Partial<Vendedor>) => Promise<void>
  onClose: () => void
}) {
  const [f, setF] = useState({
    nome: '', apelido: '', cpf: '', rg: '', email: '', telefone1: '',
    cargo: 'vendedor' as VendedorCargo, turno: 'manha' as VendedorTurno,
    equipe: '', coordenador_id: '', data_admissao: '', situacao: true,
    tipo_comissao: 'venda_total' as 'venda_total' | 'parcelas',
    percentual_comissao: 0, observacoes: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (item) {
      setF({
        nome: item.nome ?? '', apelido: item.apelido ?? '', cpf: item.cpf ?? '',
        rg: item.rg ?? '', email: item.email ?? '', telefone1: item.telefone1 ?? '',
        cargo: item.cargo ?? 'vendedor', turno: (item.turno ?? 'manha') as VendedorTurno,
        equipe: item.equipe ?? '', coordenador_id: item.coordenador_id ?? '',
        data_admissao: item.data_admissao ?? '', situacao: item.situacao ?? true,
        tipo_comissao: (item.tipo_comissao ?? 'venda_total') as 'venda_total' | 'parcelas',
        percentual_comissao: item.percentual_comissao ?? 0,
        observacoes: item.observacoes ?? '',
      })
    }
  }, [item])

  const set = (k: string, v: unknown) => setF(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ ...f, percentual_comissao: Number(f.percentual_comissao), coordenador_id: f.coordenador_id || undefined })
    } catch (err: any) {
      setFormError('Erro ao salvar: ' + (err?.message ?? 'Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  const supervisores = todos.filter(v => v.id !== item?.id && v.situacao && (v.cargo === 'supervisor' || v.cargo === 'gerente'))

  return (
    <Modal
      title={item ? 'Editar Vendedor' : 'Novo Vendedor'}
      onClose={onClose}
      maxWidth="max-w-xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button type="button" onClick={() => { const el = document.getElementById('vend-form') as HTMLFormElement; if(el) el.requestSubmit(); }} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="vend-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Nome Completo *">
              <input required value={f.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" className="input-field" />
            </Field>
          </div>

          <Field label="Apelido">
            <input value={f.apelido} onChange={e => set('apelido', e.target.value)} placeholder="Como é chamado" className="input-field" />
          </Field>

          <Field label="CPF">
            <input value={f.cpf} onChange={e => set('cpf', e.target.value)} placeholder="000.000.000-00" className="input-field" />
          </Field>

          <Field label="E-mail">
            <input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="email@empresa.com" className="input-field" />
          </Field>

          <Field label="Telefone">
            <input value={f.telefone1} onChange={e => set('telefone1', e.target.value)} placeholder="(00) 9 0000-0000" className="input-field" />
          </Field>

          <Field label="Cargo">
            <select value={f.cargo} onChange={e => set('cargo', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
              {(Object.keys(CARGO_LABELS) as VendedorCargo[]).map(k => (
                <option key={k} value={k}>{CARGO_LABELS[k]}</option>
              ))}
            </select>
          </Field>

          <Field label="Turno">
            <select value={f.turno} onChange={e => set('turno', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
              {(Object.keys(TURNO_LABELS) as VendedorTurno[]).map(k => (
                <option key={k} value={k}>{TURNO_LABELS[k]}</option>
              ))}
            </select>
          </Field>

          <Field label="Equipe">
            <input value={f.equipe} onChange={e => set('equipe', e.target.value)} placeholder="Nome da equipe" className="input-field" />
          </Field>

          <Field label="Coordenador / Supervisor">
            <select value={f.coordenador_id} onChange={e => set('coordenador_id', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
              <option value="">— Nenhum —</option>
              {supervisores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              {/* Se não há supervisores, mostrar todos os outros */}
              {supervisores.length === 0 && todos.filter(v => v.id !== item?.id && v.situacao).map(v => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </Field>

          <Field label="Data de Admissão">
            <input type="date" value={f.data_admissao} onChange={e => set('data_admissao', e.target.value)} className="input-field" />
          </Field>

          <Field label="% Comissão">
            <input type="number" step="0.1" min="0" max="100" value={f.percentual_comissao}
              onChange={e => set('percentual_comissao', e.target.value)} className="input-field" />
          </Field>

          <Field label="Tipo de Comissão">
            <select value={f.tipo_comissao} onChange={e => set('tipo_comissao', e.target.value)} className="input-field" style={{ appearance: 'none' }}>
              <option value="venda_total">Sobre Venda Total</option>
              <option value="parcelas">Sobre Parcelas</option>
            </select>
          </Field>
        </div>

        <Field label="Observações">
          <textarea value={f.observacoes} onChange={e => set('observacoes', e.target.value)}
            rows={2} className="input-field resize-none" placeholder="Notas internas..." />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer" style={{ userSelect: 'none' }}>
          <input type="checkbox" checked={f.situacao} onChange={e => set('situacao', e.target.checked)} className="w-4 h-4 accent-emerald-400" />
          <span className="text-sm font-medium" style={{ color: f.situacao ? '#10b981' : 'var(--text-muted)' }}>
            {f.situacao ? '✅ Ativo' : '❌ Inativo'}
          </span>
        </label>
      </form>
    </Modal>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────
export default function Vendedores() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vendedor | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setVendedores(await vendedoresApi.list({ search: search || undefined }))
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Vendedor>) => {
    if (editing) await vendedoresApi.update(editing.id, data)
    else await vendedoresApi.create(data as Omit<Vendedor, 'id' | 'created_at' | 'updated_at' | 'user_id'>)
    setModalOpen(false)
    setEditing(null)
    load()
  }

  const supervisores = vendedores.filter(v => v.cargo === 'supervisor' || v.cargo === 'gerente')

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF..." className="input-field" style={{paddingLeft:'2.25rem'}} />
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true) }} className="btn-primary">
          <Plus size={15} /> Novo Vendedor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: vendedores.length, color: 'var(--accent)' },
          { label: 'Ativos', value: vendedores.filter(v => v.situacao).length, color: '#10b981' },
          { label: 'Supervisores', value: supervisores.length, color: '#f59e0b' },
          { label: 'Inativos', value: vendedores.filter(v => !v.situacao).length, color: '#8b87b8' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--accent)' }} />
        </div>
      ) : vendedores.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <User size={28} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum vendedor cadastrado</p>
          <button onClick={() => { setEditing(null); setModalOpen(true) }} className="btn-primary text-sm">
            <Plus size={14} /> Cadastrar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {vendedores.map(v => {
            const coord = vendedores.find(x => x.id === v.coordenador_id)
            return (
              <div key={v.id} className="rounded-2xl p-5 card-hover" onMouseEnter={e=>{const b=e.currentTarget.querySelector(".action-btns") as HTMLElement;if(b)b.style.opacity="1"}} onMouseLeave={e=>{const b=e.currentTarget.querySelector(".action-btns") as HTMLElement;if(b)b.style.opacity="0"}}
                style={{ background: 'var(--bg-card)', border: `1px solid ${v.situacao ? 'var(--border)' : 'rgba(239,68,68,0.15)'}` }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                      style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(79,86,247,0.2)' }}>
                      {v.nome[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{v.nome}</p>
                      {v.apelido && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>"{v.apelido}"</p>}
                    </div>
                  </div>
                  <div className="action-btns" style={{ display:"flex", gap:4, opacity:0, transition:"opacity .15s" }}>
                    <button onClick={() => { setEditing(v); setModalOpen(true) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={async () => { if (window.confirm("Confirmar?")) { await vendedoresApi.delete(v.id); load() } }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="badge" style={{ background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'rgba(79,86,247,0.2)' }}>
                    {CARGO_LABELS[v.cargo]}
                  </span>
                  {v.turno && (
                    <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                      {TURNO_LABELS[v.turno]}
                    </span>
                  )}
                  {v.situacao
                    ? <span className="flex items-center gap-1 text-xs" style={{ color: '#10b981' }}><CheckCircle size={11} />Ativo</span>
                    : <span className="flex items-center gap-1 text-xs" style={{ color: '#f87171' }}><XCircle size={11} />Inativo</span>
                  }
                </div>

                {v.equipe && <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Equipe: <span style={{ color: 'var(--text-secondary)' }}>{v.equipe}</span></p>}
                {coord && <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Supervisor: <span style={{ color: 'var(--text-secondary)' }}>{coord.nome}</span></p>}

                <div className="space-y-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  {v.telefone1 && <a href={`tel:${v.telefone1}`} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}><Phone size={11} />{v.telefone1}</a>}
                  {v.email && <a href={`mailto:${v.email}`} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}><Mail size={11} />{v.email}</a>}
                  {v.percentual_comissao > 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💰 Comissão: <span style={{ color: '#10b981', fontWeight: 600 }}>{v.percentual_comissao}%</span></p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <VendedorModal item={editing} todos={vendedores} onSave={handleSave} onClose={() => { setModalOpen(false); setEditing(null) }} />
      )}
    </div>
  )
}
