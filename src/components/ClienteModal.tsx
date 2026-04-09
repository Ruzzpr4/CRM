import { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { X, Save, AlertCircle } from 'lucide-react'
import { Cliente, ClienteSituacao, CanalTipo, CANAL_LABEL } from '../types'

// Definidos FORA do componente para não causar perda de foco
function Field({ label, children, error, required }: {
  label: string; children: React.ReactNode; error?: string; required?: boolean
}) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, fontWeight:500, marginBottom:5, color:'var(--text-secondary)' }}>
        {label}{required && <span style={{ color:'var(--danger)', marginLeft:2 }}>*</span>}
      </label>
      {children}
      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, fontSize:11, color:'var(--danger)' }}>
          <AlertCircle size={11}/> {error}
        </div>
      )}
    </div>
  )
}

function Sel({ value, onChange, options }: {
  value: string; onChange:(v:string)=>void; options:[string,string][]
}) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} className="input-field" style={{appearance:'none'}}>
      {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
    </select>
  )
}

// Banner de erro geral no topo do form
function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
      borderRadius:10, marginBottom:16,
      background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)',
    }}>
      <AlertCircle size={15} style={{ color:'var(--danger)', flexShrink:0 }}/>
      <p style={{ fontSize:13, color:'var(--danger)', margin:0 }}>{message}</p>
    </div>
  )
}

interface Props {
  cliente?: Cliente|null
  onSave:(data:Partial<Cliente>)=>Promise<void>
  onClose:()=>void
}

export default function ClienteModal({ cliente, onSave, onClose }: Props) {
  const [f, setF] = useState({
    nome:'', apelido:'', tipo:'F' as 'F'|'J', sexo:'' as ''|'M'|'F'|'O',
    estado_civil:'', data_nascimento:'', cpf:'', rg:'', cnpj:'',
    telefone1:'', tipo_telefone1:'celular' as any,
    telefone2:'', tipo_telefone2:'celular' as any,
    email:'', whatsapp:'',
    cep:'', endereco:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'', pais:'Brasil',
    situacao:'ativo' as ClienteSituacao, canal_origem:'' as ''|CanalTipo,
    lead_quente:false, consentimento_lgpd:false,
    sintomas:'', restricoes:'', restricoes_obs:'', observacao:'',
  })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'dados'|'contato'|'clinico'>('dados')
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    if (cliente) {
      setF({
        nome:cliente.nome??'', apelido:cliente.apelido??'', tipo:cliente.tipo??'F',
        sexo:(cliente.sexo??'') as any, estado_civil:(cliente.estado_civil??'') as any,
        data_nascimento:cliente.data_nascimento??'', cpf:cliente.cpf??'', rg:cliente.rg??'', cnpj:cliente.cnpj??'',
        telefone1:cliente.telefone1??'', tipo_telefone1:cliente.tipo_telefone1??'celular',
        telefone2:cliente.telefone2??'', tipo_telefone2:cliente.tipo_telefone2??'celular',
        email:cliente.email??'', whatsapp:cliente.whatsapp??'',
        cep:cliente.cep??'', endereco:cliente.endereco??'', numero:cliente.numero??'',
        complemento:cliente.complemento??'', bairro:cliente.bairro??'',
        cidade:cliente.cidade??'', estado:cliente.estado??'', pais:cliente.pais??'Brasil',
        situacao:cliente.situacao??'ativo', canal_origem:(cliente.canal_origem??'') as any,
        lead_quente:cliente.lead_quente??false, consentimento_lgpd:cliente.consentimento_lgpd??false,
        sintomas:cliente.sintomas??'', restricoes:cliente.restricoes??'',
        restricoes_obs:cliente.restricoes_obs??'', observacao:cliente.observacao??'',
      })
    }
  }, [cliente])

  const set = (k:string, v:unknown) => {
    setF(p=>({...p,[k]:v}))
    // Clear field error on change
    if (errors[k]) setErrors(p=>({...p,[k]:''}))
    setGlobalError('')
  }

  const validate = (): boolean => {
    const e: Record<string,string> = {}
    if (!f.nome.trim()) { e.nome = 'Nome é obrigatório'; }
    if (!f.telefone1.trim()) { e.telefone1 = 'Telefone principal é obrigatório'; }
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) { e.email = 'E-mail inválido'; }
    if (f.cpf && f.cpf.replace(/\D/g,'').length > 0 && f.cpf.replace(/\D/g,'').length !== 11) { e.cpf = 'CPF deve ter 11 dígitos'; }
    setErrors(e)
    // If has errors in contato tab, switch to show them
    if (e.telefone1 && tab !== 'contato') setTab('contato')
    else if (e.nome && tab !== 'dados') setTab('dados')
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalError('')
    if (!validate()) {
      setGlobalError('Corrija os campos destacados antes de salvar.')
      return
    }
    setSaving(true)
    try {
      await onSave({ ...f, sexo:f.sexo||undefined, estado_civil:(f.estado_civil||undefined) as any, canal_origem:f.canal_origem||undefined })
      // onSave closes the modal on success
    } catch (err: any) {
      // Show error inline — don't close modal
      const msg = err?.message ?? err?.error_description ?? JSON.stringify(err)
      if (msg.includes('violates') || msg.includes('duplicate')) {
        setGlobalError('Já existe um cliente com este CPF ou e-mail.')
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setGlobalError('Erro de conexão. Verifique sua internet e tente novamente.')
      } else {
        setGlobalError('Erro ao salvar: ' + msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const TABS = [['dados','Dados Pessoais'],['contato','Contato & Endereço'],['clinico','Observações']] as const
  const hasErrorInTab = {
    dados: !!(errors.nome || errors.cpf || errors.email),
    contato: !!(errors.telefone1),
    clinico: false,
  }

  const modal = (
    <div
      // outside click disabled — use X or Escape
      style={{
        position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:9999,
        background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
        display:'flex', alignItems:'flex-start', justifyContent:'center',
        padding:'32px 16px', overflowY:'auto',
      }}>
      <div className="animate-fade-in" style={{
        width:'100%', maxWidth:640, background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:16, display:'flex', flexDirection:'column', flexShrink:0, marginBottom:32,
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
            {cliente ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', alignItems:'center', padding:4 }}>
            <X size={18}/>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, padding:'12px 20px 0' }}>
          {TABS.map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)}
              style={{
                padding:'7px 16px', borderRadius:10, fontSize:12, fontWeight:500, cursor:'pointer', border:'none',
                background: tab===key ? 'var(--accent)' : 'var(--bg-raised)',
                color: tab===key ? 'white' : 'var(--text-secondary)',
                position:'relative',
              }}>
              {label}
              {hasErrorInTab[key as keyof typeof hasErrorInTab] && (
                <span style={{ position:'absolute', top:-4, right:-4, width:8, height:8, borderRadius:'50%', background:'var(--danger)' }}/>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding:'16px 20px' }}>
            {globalError && <ErrorBanner message={globalError}/>}

            {tab === 'dados' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <Field label="Nome Completo" required error={errors.nome}>
                    <input value={f.nome} onChange={e=>set('nome',e.target.value)}
                      placeholder="Nome completo do cliente"
                      className={`input-field ${errors.nome?'error':''}`}/>
                  </Field>
                </div>
                <Field label="Apelido">
                  <input value={f.apelido} onChange={e=>set('apelido',e.target.value)} placeholder="Como prefere ser chamado" className="input-field"/>
                </Field>
                <Field label="Tipo">
                  <Sel value={f.tipo} onChange={v=>set('tipo',v)} options={[['F','Pessoa Física'],['J','Pessoa Jurídica']]}/>
                </Field>
                <Field label="Sexo">
                  <Sel value={f.sexo} onChange={v=>set('sexo',v)} options={[['','—'],['M','Masculino'],['F','Feminino'],['O','Outro']]}/>
                </Field>
                <Field label="Estado Civil">
                  <Sel value={f.estado_civil} onChange={v=>set('estado_civil',v)} options={[['','—'],['solteiro','Solteiro(a)'],['casado','Casado(a)'],['divorciado','Divorciado(a)'],['viuvo','Viúvo(a)'],['outro','Outro']]}/>
                </Field>
                <Field label="Data de Nascimento">
                  <input type="date" value={f.data_nascimento} onChange={e=>set('data_nascimento',e.target.value)} className="input-field"/>
                </Field>
                <Field label="CPF" error={errors.cpf}>
                  <input value={f.cpf} onChange={e=>set('cpf',e.target.value)} placeholder="000.000.000-00" className={`input-field ${errors.cpf?'error':''}`}/>
                </Field>
                <Field label="RG">
                  <input value={f.rg} onChange={e=>set('rg',e.target.value)} placeholder="0.000.000" className="input-field"/>
                </Field>
                {f.tipo==='J' && (
                  <Field label="CNPJ">
                    <input value={f.cnpj} onChange={e=>set('cnpj',e.target.value)} placeholder="00.000.000/0000-00" className="input-field"/>
                  </Field>
                )}
                <Field label="Situação">
                  <Sel value={f.situacao} onChange={v=>set('situacao',v)} options={[['ativo','Ativo'],['inativo','Inativo'],['em_espera','Em Espera'],['arquivado','Arquivado']]}/>
                </Field>
                <Field label="Canal de Origem">
                  <Sel value={f.canal_origem} onChange={v=>set('canal_origem',v)} options={[['','—'],...(Object.entries(CANAL_LABEL) as [CanalTipo,string][]).map(([k,v])=>[k,v] as [string,string])]}/>
                </Field>
                <div style={{ gridColumn:'1/-1', display:'flex', gap:20 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer' }}>
                    <input type="checkbox" checked={f.lead_quente} onChange={e=>set('lead_quente',e.target.checked)} style={{ width:15, height:15, accentColor:'#f59e0b' }}/>
                    <span style={{ fontSize:13, color:f.lead_quente?'#f59e0b':'var(--text-secondary)' }}>🔥 Lead Quente</span>
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer' }}>
                    <input type="checkbox" checked={f.consentimento_lgpd} onChange={e=>set('consentimento_lgpd',e.target.checked)} style={{ width:15, height:15, accentColor:'var(--accent)' }}/>
                    <span style={{ fontSize:13, color:'var(--text-secondary)' }}>✅ Consentimento LGPD</span>
                  </label>
                </div>
              </div>
            )}

            {tab === 'contato' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <Field label="Telefone Principal" required error={errors.telefone1}>
                  <input value={f.telefone1} onChange={e=>set('telefone1',e.target.value)} placeholder="(00) 9 0000-0000" className={`input-field ${errors.telefone1?'error':''}`}/>
                </Field>
                <Field label="Tipo">
                  <Sel value={f.tipo_telefone1} onChange={v=>set('tipo_telefone1',v)} options={[['celular','Celular'],['fixo','Fixo'],['comercial','Comercial'],['whatsapp','WhatsApp']]}/>
                </Field>
                <Field label="Telefone Alternativo">
                  <input value={f.telefone2} onChange={e=>set('telefone2',e.target.value)} placeholder="(00) 0000-0000" className="input-field"/>
                </Field>
                <Field label="Tipo">
                  <Sel value={f.tipo_telefone2} onChange={v=>set('tipo_telefone2',v)} options={[['celular','Celular'],['fixo','Fixo'],['comercial','Comercial'],['whatsapp','WhatsApp']]}/>
                </Field>
                <Field label="E-mail" error={errors.email}>
                  <input type="email" value={f.email} onChange={e=>set('email',e.target.value)} placeholder="email@exemplo.com" className={`input-field ${errors.email?'error':''}`}/>
                </Field>
                <Field label="WhatsApp">
                  <input value={f.whatsapp} onChange={e=>set('whatsapp',e.target.value)} placeholder="(00) 9 0000-0000" className="input-field"/>
                </Field>
                <div style={{ gridColumn:'1/-1', height:1, background:'var(--border)' }}/>
                <Field label="CEP">
                  <input value={f.cep} onChange={e=>set('cep',e.target.value)} placeholder="00000-000" className="input-field"/>
                </Field>
                <div/>
                <div style={{ gridColumn:'1/-1' }}>
                  <Field label="Endereço">
                    <input value={f.endereco} onChange={e=>set('endereco',e.target.value)} placeholder="Rua / Avenida" className="input-field"/>
                  </Field>
                </div>
                <Field label="Número"><input value={f.numero} onChange={e=>set('numero',e.target.value)} placeholder="Nº" className="input-field"/></Field>
                <Field label="Complemento"><input value={f.complemento} onChange={e=>set('complemento',e.target.value)} placeholder="Apto, Sala..." className="input-field"/></Field>
                <Field label="Bairro"><input value={f.bairro} onChange={e=>set('bairro',e.target.value)} placeholder="Bairro" className="input-field"/></Field>
                <Field label="Cidade"><input value={f.cidade} onChange={e=>set('cidade',e.target.value)} placeholder="Cidade" className="input-field"/></Field>
                <Field label="Estado (UF)"><input value={f.estado} onChange={e=>set('estado',e.target.value.toUpperCase().slice(0,2))} placeholder="SP" maxLength={2} className="input-field"/></Field>
                <Field label="País"><input value={f.pais} onChange={e=>set('pais',e.target.value)} className="input-field"/></Field>
              </div>
            )}

            {tab === 'clinico' && (
              <div className="space-y-4">
                <Field label="Queixas / Sintomas / Motivo de interesse">
                  <textarea value={f.sintomas} onChange={e=>set('sintomas',e.target.value)} rows={3} placeholder="Descreva as principais queixas..." className="input-field resize-none"/>
                </Field>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <Field label="Restrições / Alergias">
                    <input value={f.restricoes} onChange={e=>set('restricoes',e.target.value)} placeholder="Ex: Alergia a dipirona" className="input-field"/>
                  </Field>
                  <Field label="Obs. sobre Restrições">
                    <input value={f.restricoes_obs} onChange={e=>set('restricoes_obs',e.target.value)} placeholder="Detalhes..." className="input-field"/>
                  </Field>
                </div>
                <Field label="Observações Gerais">
                  <textarea value={f.observacao} onChange={e=>set('observacao',e.target.value)} rows={4} placeholder="Notas internas, preferências..." className="input-field resize-none"/>
                </Field>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display:'flex', gap:12, padding:'14px 20px', borderTop:'1px solid var(--border)' }}>
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center" style={{ opacity:saving?.6:1 }}>
              <Save size={14}/>{saving ? 'Salvando...' : cliente ? 'Salvar alterações' : 'Adicionar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return ReactDOM.createPortal(modal, document.body)
}
