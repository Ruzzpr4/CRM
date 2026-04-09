import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { vendedoresApi, IS_MOCK } from '../lib/api'
import { Vendedor } from '../types/vendedor'
import { Funcionario, FuncionarioRole, ROLE_LABELS } from '../types/funcionario'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { useToast } from '../contexts/ToastContext'
import { Plus, Search, Mail, Phone, Pencil, Shield, CheckCircle, XCircle, Key, Copy, CheckCircle2, Users, RefreshCw } from 'lucide-react'

const MODULOS = [
  { key:'clientes',     label:'Clientes',     desc:'Ver e gerenciar clientes' },
  { key:'agenda',       label:'Agenda',       desc:'Ver e criar consultas' },
  { key:'historico',    label:'Histórico',    desc:'Histórico de comunicações' },
  { key:'equipe',       label:'Equipe',       desc:'Ver membros da equipe' },
  { key:'metas',        label:'Metas',        desc:'Metas e resultados' },
  { key:'captacao',     label:'Captação',     desc:'Gerenciar leads' },
  { key:'estoque',      label:'Estoque',      desc:'Gerenciar estoque' },
  { key:'funcionarios', label:'Funcionários', desc:'Criar e editar acessos (admin only)' },
]

const ROLE_PERMS_DISPLAY: Record<FuncionarioRole, Record<string,boolean>> = {
  admin:       { clientes:true,  agenda:true,  historico:true,  equipe:true,  metas:true,  captacao:true,  estoque:true,  funcionarios:true  },
  supervisor:  { clientes:true,  agenda:true,  historico:true,  equipe:true,  metas:true,  captacao:true,  estoque:true,  funcionarios:false },
  vendedor:    { clientes:true,  agenda:true,  historico:true,  equipe:false, metas:false, captacao:true,  estoque:false, funcionarios:false },
  estoque:     { clientes:false, agenda:false, historico:false, equipe:false, metas:false, captacao:false, estoque:true,  funcionarios:false },
  visualizador:{ clientes:true,  agenda:true,  historico:true,  equipe:true,  metas:true,  captacao:true,  estoque:true,  funcionarios:false },
}

function gerarSenha() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i=0;i<8;i++) s += chars[Math.floor(Math.random()*chars.length)]
  return s + '!' + Math.floor(Math.random()*90+10)
}

function Field({ label, children, error }: { label:string; children:React.ReactNode; error?:string }) {
  return (
    <div>
      <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'var(--text-secondary)'}}>{label}</label>
      {children}
      {error && <p className="field-error">⚠ {error}</p>}
    </div>
  )
}

function FuncModal({ item, vendedores, ownerEmail, onSave, onClose }: {
  item?: Funcionario|null; vendedores: Vendedor[]; ownerEmail: string
  onSave:(d:Partial<Funcionario>&{senha?:string})=>Promise<void>; onClose:()=>void
}) {
  const [f, setF] = useState({nome:'', email:'', telefone:'', role:'vendedor' as FuncionarioRole, vendedor_id:'', ativo:true, senha:gerarSenha()})
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aba, setAba] = useState<'dados'|'permissoes'>('dados')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (item) setF({nome:item.nome, email:item.email, telefone:item.telefone??'', role:item.role, vendedor_id:item.vendedor_id??'', ativo:item.ativo, senha:''})
  }, [item])

  const set = (k:string,v:unknown) => { setF(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:''})); setFormError('') }

  const validate = () => {
    const e: Record<string,string> = {}
    if (!f.nome.trim()) e.nome = 'Nome é obrigatório'
    if (!f.email.trim()) e.email = 'E-mail é obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'E-mail inválido'
    if (!item && f.senha.length < 6) e.senha = 'Senha deve ter pelo menos 6 caracteres'
    setErrors(e); return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({...f, vendedor_id:f.vendedor_id||undefined})
    } catch(err:any) {
      setFormError(err?.message ?? 'Erro ao salvar. Tente novamente.')
    }
    setSaving(false)
  }

  const perms = ROLE_PERMS_DISPLAY[f.role]

  return (
    <Modal title={item?`Editar — ${item.nome}`:'Novo Acesso'} onClose={onClose} maxWidth={540}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        <button type="button" disabled={saving} className="btn-primary flex-1 justify-center"
          onClick={()=>(document.getElementById('func-form') as HTMLFormElement)?.requestSubmit()}>
          {saving?'Salvando...':item?'Salvar':'Criar acesso'}
        </button>
      </>}>
      <div style={{display:'flex',gap:6,marginBottom:16}}>
        {(['dados','permissoes'] as const).map(a=>(
          <button key={a} type="button" onClick={()=>setAba(a)}
            style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:aba===a?'var(--accent)':'var(--bg-raised)',color:aba===a?'white':'var(--text-secondary)'}}>
            {a==='dados'?'👤 Dados':'🔐 Permissões'}
          </button>
        ))}
      </div>
      <form id="func-form" onSubmit={handleSubmit}>
        {formError && <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.3)',fontSize:13,color:'var(--danger)',marginBottom:14}}>{formError}</div>}
        {aba==='dados' && (
          <div className="space-y-4">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{gridColumn:'1/-1'}}>
                <Field label="Nome Completo *" error={errors.nome}>
                  <input value={f.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome do funcionário" className={`input-field ${errors.nome?'error':''}`}/>
                </Field>
              </div>
              <Field label="E-mail *" error={errors.email}>
                <input type="email" value={f.email} onChange={e=>set('email',e.target.value)} placeholder="email@empresa.com" className={`input-field ${errors.email?'error':''}`}/>
              </Field>
              <Field label="Telefone">
                <input value={f.telefone} onChange={e=>set('telefone',e.target.value)} placeholder="(00) 9 0000-0000" className="input-field"/>
              </Field>
            </div>
            <Field label="Perfil de Acesso">
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
                {(Object.keys(ROLE_LABELS) as FuncionarioRole[]).map(r=>(
                  <button key={r} type="button" onClick={()=>set('role',r)}
                    style={{padding:'7px 4px',borderRadius:8,border:`1px solid ${f.role===r?'var(--accent)':'var(--border)'}`,background:f.role===r?'var(--accent-muted)':'transparent',color:f.role===r?'var(--accent)':'var(--text-muted)',fontSize:10,fontWeight:700,cursor:'pointer',textAlign:'center',lineHeight:1.3}}>
                    {ROLE_LABELS[r].split(' ')[0]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Vincular ao Vendedor (opcional)">
              <select value={f.vendedor_id} onChange={e=>set('vendedor_id',e.target.value)} className="input-field" style={{appearance:'none'}}>
                <option value="">— Não vincular —</option>
                {vendedores.filter(v=>v.situacao).map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </Field>
            {!item && (
              <Field label="Senha de Acesso *" error={errors.senha}>
                <div style={{display:'flex',gap:7}}>
                  <input value={f.senha} onChange={e=>set('senha',e.target.value)} className={`input-field ${errors.senha?'error':''}`} style={{fontFamily:'monospace',fontWeight:600,letterSpacing:1}}/>
                  <button type="button" onClick={()=>set('senha',gerarSenha())} className="btn-ghost" style={{padding:'9px 11px',flexShrink:0}} title="Gerar nova"><RefreshCw size={13}/></button>
                  <button type="button" onClick={()=>{navigator.clipboard.writeText(f.senha);setCopied(true);setTimeout(()=>setCopied(false),2000)}} className="btn-ghost" style={{padding:'9px 11px',flexShrink:0,color:copied?'var(--success)':undefined}}>{copied?<CheckCircle2 size={13}/>:<Copy size={13}/>}</button>
                </div>
                <p style={{fontSize:11,color:'var(--warning)',marginTop:6}}>⚠ Anote a senha — ela não será exibida novamente após salvar.</p>
              </Field>
            )}
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none'}}>
              <input type="checkbox" checked={f.ativo} onChange={e=>set('ativo',e.target.checked)} style={{width:15,height:15,accentColor:'var(--success)'}}/>
              <span style={{fontSize:13,fontWeight:500,color:f.ativo?'var(--success)':'var(--text-muted)'}}>{f.ativo?'✅ Conta ativa':'❌ Conta inativa'}</span>
            </label>
          </div>
        )}
        {aba==='permissoes' && (
          <div className="space-y-2">
            <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>
              Permissões do perfil <strong style={{color:'var(--accent)'}}>{ROLE_LABELS[f.role]}</strong>
            </p>
            {MODULOS.map(m=>(
              <div key={m.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:10,background:perms[m.key]?'rgba(52,211,153,.05)':'var(--bg-raised)',border:`1px solid ${perms[m.key]?'rgba(52,211,153,.15)':'var(--border)'}`}}>
                <div>
                  <p style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{m.label}</p>
                  <p style={{fontSize:11,color:'var(--text-muted)'}}>{m.desc}</p>
                </div>
                {perms[m.key]?<CheckCircle size={15} style={{color:'var(--success)',flexShrink:0}}/>:<XCircle size={15} style={{color:'var(--border)',flexShrink:0}}/>}
              </div>
            ))}
          </div>
        )}
      </form>
    </Modal>
  )
}

// Reset senha modal
function ResetSenhaModal({ func, onClose }: { func:Funcionario; onClose:()=>void }) {
  const [novaSenha, setNovaSenha] = useState(gerarSenha())
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const { toast } = useToast()

  const handleReset = async () => {
    setSaving(true)
    try {
      const { adminUpdateUserPassword } = await import('../lib/authAdmin')
      await adminUpdateUserPassword(func.user_id, novaSenha)
      setDone(true)
      toast.success('Senha redefinida!')
    } catch(err:any) {
      toast.error('Erro: ' + (err?.message ?? 'Tente novamente'))
    }
    setSaving(false)
  }

  return (
    <Modal title={`Redefinir Senha — ${func.nome}`} onClose={onClose} maxWidth={420}
      footer={done
        ? <button onClick={onClose} className="btn-primary flex-1 justify-center">Fechar</button>
        : <><button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
           <button onClick={handleReset} disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Redefinindo...':'Redefinir Senha'}</button></>}>
      {done ? (
        <div style={{textAlign:'center',padding:'8px 0'}}>
          <CheckCircle size={40} style={{color:'var(--success)',margin:'0 auto 12px'}}/>
          <p style={{fontWeight:700,fontSize:15,color:'var(--text-primary)',marginBottom:8}}>Senha redefinida!</p>
          <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:12}}>Nova senha do funcionário:</p>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',borderRadius:10,background:'var(--bg-raised)',border:'1px solid var(--border)'}}>
            <code style={{fontSize:16,fontWeight:700,color:'var(--accent)',letterSpacing:1,flex:1}}>{novaSenha}</code>
            <button onClick={()=>{navigator.clipboard.writeText(novaSenha);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{background:'none',border:'none',cursor:'pointer',color:copied?'var(--success)':'var(--text-muted)'}}>{copied?<CheckCircle2 size={16}/>:<Copy size={16}/>}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(251,191,36,.08)',border:'1px solid rgba(251,191,36,.25)',fontSize:12,color:'#fbbf24'}}>
            ⚠ A senha atual será substituída imediatamente.
          </div>
          <Field label="Nova senha">
            <div style={{display:'flex',gap:7}}>
              <input value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} className="input-field" style={{fontFamily:'monospace',fontWeight:700,letterSpacing:1}}/>
              <button type="button" onClick={()=>setNovaSenha(gerarSenha())} className="btn-ghost" style={{padding:'9px 11px',flexShrink:0}}><RefreshCw size={13}/></button>
              <button type="button" onClick={()=>{navigator.clipboard.writeText(novaSenha);setCopied(true);setTimeout(()=>setCopied(false),2000)}} className="btn-ghost" style={{padding:'9px 11px',flexShrink:0,color:copied?'var(--success)':undefined}}>{copied?<CheckCircle2 size={13}/>:<Copy size={13}/>}</button>
            </div>
          </Field>
        </div>
      )}
    </Modal>
  )
}

export default function Funcionarios() {
  const { user, ownerId } = useAuth()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Funcionario|null>(null)
  const [resetModal, setResetModal] = useState<Funcionario|null>(null)
  const [deletando, setDeletando] = useState<Funcionario|null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const v = await vendedoresApi.list()
    setVendedores(v)
    const { supabase } = await import('../lib/supabase')
    let q = supabase.from('funcionarios').select('*').eq('owner_id', ownerId||user?.id||'')
    if (search) q = q.ilike('nome', `%${search}%`)
    const { data } = await q
    setFuncionarios((data??[]) as Funcionario[])
    setLoading(false)
  }, [search, ownerId, user?.id])

  useEffect(() => { if (ownerId||user?.id) load() }, [load])

  const handleSave = async (data: Partial<Funcionario> & { senha?: string }) => {
    const { supabase } = await import('../lib/supabase')
    const { adminCreateUser } = await import('../lib/authAdmin')
    const adminId = ownerId || user?.id || ''

    if (editing) {
      const { error } = await supabase.from('funcionarios')
        .update({ nome:data.nome, role:data.role, vendedor_id:data.vendedor_id??null, ativo:data.ativo, telefone:data.telefone??null })
        .eq('id', editing.id)
      if (error) throw new Error(error.message)
      await supabase.from('org_membros').update({ role:data.role }).eq('user_id', editing.user_id)
    } else {
      if (!data.senha || data.senha.length < 6) throw new Error('Senha deve ter pelo menos 6 caracteres')

      const { user_id: newUserId } = await adminCreateUser(data.email!, data.senha, data.nome!)

      // Get or create org
      const { data: orgs } = await supabase.from('organizacoes').select('id').eq('owner_id', adminId).order('created_at').limit(1)
      let orgId = orgs?.[0]?.id
      if (!orgId) {
        const { data: newOrg } = await supabase.from('organizacoes').insert({ nome:'Minha Empresa', owner_id:adminId }).select('id').single()
        orgId = newOrg?.id
      }

      // Auto-create vendedor record for vendedor/supervisor roles
      let resolvedVendedorId = data.vendedor_id ?? null
      if (!resolvedVendedorId && ['vendedor','supervisor'].includes(data.role ?? '')) {
        const { data: newVend, error: vendErr } = await supabase.from('vendedores').insert({
          nome: data.nome!, email: data.email,
          cargo: data.role === 'supervisor' ? 'supervisor' : 'vendedor',
          situacao: true, user_id: adminId,
        }).select('id').single()
        if (!vendErr) resolvedVendedorId = newVend?.id ?? null
      }

      // Insert funcionario record
      const { error: funcErr } = await supabase.from('funcionarios').insert({
        user_id: newUserId, nome: data.nome, email: data.email,
        role: data.role ?? 'vendedor', vendedor_id: resolvedVendedorId,
        ativo: true, owner_id: adminId
      })
      if (funcErr) {
        const { adminDeleteUser } = await import('../lib/authAdmin')
        await adminDeleteUser(newUserId)
        throw new Error('Erro no banco: ' + funcErr.message)
      }

      // Add to org_membros for RLS access
      if (orgId) {
        await supabase.from('org_membros').upsert({
          org_id: orgId, user_id: newUserId, role: data.role ?? 'vendedor',
          vendedor_id: resolvedVendedorId, ativo: true
        }, { onConflict: 'org_id,user_id' })
      }
    }

    toast.success(editing ? 'Acesso atualizado!' : 'Funcionário cadastrado!')
    setModal(false); setEditing(null); load()
  }

  const handleDelete = async () => {
    if (!deletando) return
    const { supabase } = await import('../lib/supabase')
    await supabase.from('funcionarios').update({ ativo:false }).eq('id', deletando.id)
    await supabase.from('org_membros').update({ ativo:false }).eq('user_id', deletando.user_id)
    toast.success('Acesso desativado')
    setDeletando(null); load()
  }

  const ROLE_COLOR: Record<FuncionarioRole,{bg:string;color:string}> = {
    admin:{bg:'rgba(168,85,247,.12)',color:'#c084fc'},
    supervisor:{bg:'rgba(96,165,250,.12)',color:'#60a5fa'},
    vendedor:{bg:'var(--accent-muted)',color:'var(--accent)'},
    estoque:{bg:'rgba(52,211,153,.12)',color:'var(--success)'},
    visualizador:{bg:'var(--bg-raised)',color:'var(--text-secondary)'},
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:200}}>
          <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar funcionário..." className="input-field" style={{paddingLeft:'2rem'}}/>
        </div>
        <button onClick={()=>{setEditing(null);setModal(true)}} className="btn-primary"><Plus size={14}/> Novo Acesso</button>
      </div>

      <div style={{padding:'12px 16px',borderRadius:12,background:'var(--accent-soft)',border:'1px solid var(--accent-muted)',fontSize:12,color:'var(--text-secondary)',display:'flex',gap:10,alignItems:'flex-start'}}>
        <Shield size={14} style={{color:'var(--accent)',flexShrink:0,marginTop:1}}/>
        <div>
          Cada funcionário tem login próprio (e-mail + senha). <strong style={{color:'var(--text-primary)'}}>Copie a senha</strong> ao criar — ela não será exibida depois.
        </div>
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:160}}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/>
        </div>
      ) : funcionarios.length===0 ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,gap:12}}>
          <Users size={36} style={{color:'var(--text-muted)'}}/>
          <p style={{color:'var(--text-muted)',fontSize:14}}>Nenhum acesso cadastrado</p>
          <button onClick={()=>{setEditing(null);setModal(true)}} className="btn-primary"><Plus size={14}/> Criar primeiro acesso</button>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {funcionarios.map(f=>{
            const rc=ROLE_COLOR[f.role]
            return (
              <div key={f.id} className="rounded-2xl p-4 card-hover" style={{background:'var(--bg-card)',border:`1px solid ${f.ativo?'var(--border)':'rgba(248,113,113,.15)'}`}}
                onMouseEnter={e=>{const b=e.currentTarget.querySelector('.action-btns') as HTMLElement;if(b)b.style.opacity='1'}}
                onMouseLeave={e=>{const b=e.currentTarget.querySelector('.action-btns') as HTMLElement;if(b)b.style.opacity='0'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <div style={{width:42,height:42,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:700,background:rc.bg,color:rc.color,flexShrink:0}}>{f.nome[0]?.toUpperCase()}</div>
                    <div>
                      <p style={{fontWeight:700,fontSize:13,color:'var(--text-primary)'}}>{f.nome}</p>
                      <span style={{display:'inline-block',padding:'1px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:rc.bg,color:rc.color,marginTop:2}}>{ROLE_LABELS[f.role]}</span>
                    </div>
                  </div>
                  <div className="action-btns" style={{display:'flex',gap:4,opacity:0,transition:'opacity .15s'}}>
                    <button onClick={()=>setResetModal(f)} title="Redefinir senha" style={{background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.25)',borderRadius:7,cursor:'pointer',color:'#fbbf24',padding:'5px 7px',display:'flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600}}>
                      <Key size={11}/> Senha
                    </button>
                    <button onClick={()=>{setEditing(f);setModal(true)}} style={{background:'var(--bg-raised)',border:'1px solid var(--border)',borderRadius:7,cursor:'pointer',color:'var(--text-muted)',padding:'5px 7px',display:'flex',alignItems:'center'}}><Pencil size={12}/></button>
                    <button onClick={()=>setDeletando(f)} style={{background:'rgba(248,113,113,.1)',border:'1px solid rgba(248,113,113,.25)',borderRadius:7,cursor:'pointer',color:'var(--danger)',padding:'5px 7px',display:'flex',alignItems:'center'}}><XCircle size={12}/></button>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4,borderTop:'1px solid var(--border)',paddingTop:10}}>
                  <a href={`mailto:${f.email}`} style={{fontSize:12,color:'var(--text-muted)',textDecoration:'none',display:'flex',alignItems:'center',gap:5}}><Mail size={10}/>{f.email}</a>
                  {f.telefone&&<p style={{fontSize:12,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:5}}><Phone size={10}/>{f.telefone}</p>}
                  {f.ativo
                    ? <span style={{fontSize:11,color:'var(--success)',display:'flex',alignItems:'center',gap:3}}><CheckCircle size={9}/>Conta ativa</span>
                    : <span style={{fontSize:11,color:'var(--danger)',display:'flex',alignItems:'center',gap:3}}><XCircle size={9}/>Conta inativa</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal&&<FuncModal item={editing} vendedores={vendedores} ownerEmail={user?.email??''} onSave={handleSave} onClose={()=>{setModal(false);setEditing(null)}}/>}
      {resetModal&&<ResetSenhaModal func={resetModal} onClose={()=>setResetModal(null)}/>}
      {deletando&&<ConfirmModal title="Desativar acesso" message={`Desativar a conta de ${deletando.nome}? O funcionário não conseguirá mais fazer login.`} confirmLabel="Desativar" danger onConfirm={handleDelete} onCancel={()=>setDeletando(null)}/>}
    </div>
  )
}
