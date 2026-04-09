import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import { ROLE_LABELS, FuncionarioRole } from '../types/funcionario'
import { Plus, Users, Crown, Pencil, Trash2, UserPlus, X, Search, ChevronDown, ChevronRight, Lock } from 'lucide-react'

interface Equipe { id:string; org_id:string; nome:string; descricao?:string; cor:string; created_at:string }
interface OrgMembro { id:string; org_id:string; user_id:string; role:FuncionarioRole; vendedor_id?:string; equipe_id?:string; ativo:boolean; funcionarios?:{nome:string;email:string} }
interface Funcionario { id:string; user_id:string; nome:string; email:string; role:FuncionarioRole; vendedor_id?:string; ativo:boolean }

const COR_OPCOES = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316']
const ROLE_COLORS: Record<FuncionarioRole,{bg:string;color:string}> = {
  admin:{bg:'rgba(168,85,247,.15)',color:'#c084fc'},
  supervisor:{bg:'rgba(96,165,250,.15)',color:'#60a5fa'},
  vendedor:{bg:'rgba(124,127,245,.15)',color:'#a5b4fc'},
  estoque:{bg:'rgba(52,211,153,.15)',color:'#34d399'},
  visualizador:{bg:'rgba(148,163,184,.15)',color:'#94a3b8'},
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'var(--text-secondary)'}}>{label}</label>
      {children}
    </div>
  )
}

// ─── Modal criar/editar equipe (admin only) ──────────────────
function EquipeModal({ item, orgId, onSave, onClose }: { item?:Equipe|null; orgId:string; onSave:(eq?:Equipe)=>void; onClose:()=>void }) {
  const { toast } = useToast()
  const [nome, setNome] = useState(item?.nome??'')
  const [descricao, setDescricao] = useState(item?.descricao??'')
  const [cor, setCor] = useState(item?.cor??'#6366f1')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) { setFormError('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const { supabase } = await import('../lib/supabase')
      let resolvedOrgId = orgId
      if (!resolvedOrgId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Não autenticado')
        const { data: orgs } = await supabase.from('organizacoes').select('id').eq('owner_id', user.id).order('created_at').limit(1)
        if (!orgs?.[0]) throw new Error('Organização não encontrada')
        resolvedOrgId = orgs[0].id
      }
      if (item) {
        const { error } = await supabase.from('equipes').update({ nome:nome.trim(), descricao:descricao||null, cor, updated_at:new Date().toISOString() }).eq('id', item.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('equipes').insert({ org_id:resolvedOrgId, nome:nome.trim(), descricao:descricao||null, cor })
        if (error) throw new Error(error.message)
      }
      toast.success(item ? 'Equipe atualizada!' : 'Equipe criada!')
      // Re-fetch
      const { supabase: sb } = await import('../lib/supabase')
      const { data: eq } = await sb.from('equipes').select('*').eq('org_id', resolvedOrgId).order('created_at').limit(50)
      onSave(eq ? (eq as Equipe[]).find(e=>e.nome===nome.trim()) : undefined)
    } catch(err:any) { setFormError('Erro: ' + (err?.message??'Tente novamente.')) }
    setSaving(false)
  }

  return (
    <Modal title={item?`Editar — ${item.nome}`:'Nova Equipe'} onClose={onClose} maxWidth={420}
      footer={<><button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        <button type="button" disabled={saving} className="btn-primary flex-1 justify-center"
          onClick={()=>(document.getElementById('equipe-form') as HTMLFormElement)?.requestSubmit()}>
          {saving?'Salvando...':item?'Salvar':'Criar'}
        </button></>}>
      <form id="equipe-form" onSubmit={handleSubmit} className="space-y-4">
        {formError&&<div style={{padding:'10px',borderRadius:10,background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.3)',fontSize:13,color:'var(--danger)'}}>{formError}</div>}
        {!orgId&&<div style={{padding:'10px',borderRadius:10,background:'rgba(251,191,36,.08)',border:'1px solid rgba(251,191,36,.3)',fontSize:12,color:'#fbbf24'}}>Aguardando organização...</div>}
        <Field label="Nome *"><input value={nome} onChange={e=>{setNome(e.target.value);setFormError('')}} placeholder="Ex: Equipe Cursos" className="input-field"/></Field>
        <Field label="Descrição"><input value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Breve descrição" className="input-field"/></Field>
        <Field label="Cor">
          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            {COR_OPCOES.map(c=><button key={c} type="button" onClick={()=>setCor(c)} style={{width:28,height:28,borderRadius:7,background:c,border:'none',cursor:'pointer',outline:cor===c?`3px solid ${c}`:undefined,outlineOffset:2,opacity:cor===c?1:.5,transform:cor===c?'scale(1.2)':'scale(1)',transition:'all .15s'}}/>)}
          </div>
        </Field>
      </form>
    </Modal>
  )
}

// ─── Modal adicionar / criar membro ─────────────────────────
function AddMembroModal({ equipe, orgId, membrosAtuais, podeGerenciarEquipe, onSave, onClose }: {
  equipe:Equipe; orgId:string; membrosAtuais:OrgMembro[]
  podeGerenciarEquipe:boolean; onSave:()=>void; onClose:()=>void
}) {
  const { toast } = useToast()
  const { ownerId } = useAuth()
  const [aba, setAba] = useState<'buscar'|'criar'>('buscar')
  const [todos, setTodos] = useState<Funcionario[]>([])
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<Funcionario|null>(null)
  const [role, setRole] = useState<FuncionarioRole>('vendedor')
  const [saving, setSaving] = useState(false)
  // Create form state
  const [novo, setNovo] = useState({ nome:'', email:'', senha:gerarSenha(), role:'vendedor' as FuncionarioRole })
  const [erros, setErros] = useState<Record<string,string>>({})
  const [formError, setFormError] = useState('')

  function gerarSenha() {
    const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let s=''; for(let i=0;i<8;i++) s+=c[Math.floor(Math.random()*c.length)]
    return s+'!'+Math.floor(Math.random()*90+10)
  }

  useEffect(() => {
    import('../lib/supabase').then(({supabase})=>{
      supabase.from('funcionarios').select('*').eq('ativo',true).then(({data})=>{
        const atuais = new Set(membrosAtuais.map(m=>m.user_id))
        setTodos(((data??[]) as Funcionario[]).filter(f=>!atuais.has(f.user_id)))
      })
    })
  }, [membrosAtuais])

  const filtrados = todos.filter(f=>
    f.nome.toLowerCase().includes(search.toLowerCase()) ||
    f.email.toLowerCase().includes(search.toLowerCase())
  )

  const resolveOrgId = async (supabase: any, userId: string) => {
    if (orgId) return orgId
    const { data: func } = await supabase.from('funcionarios').select('owner_id').eq('user_id', userId).maybeSingle()
    const adminId = func?.owner_id ?? userId
    const { data: orgs } = await supabase.from('organizacoes').select('id').eq('owner_id', adminId).order('created_at').limit(1)
    return orgs?.[0]?.id ?? null
  }

  const addToTeam = async (userId: string, role: FuncionarioRole, vendedorId?: string) => {
    const { supabase } = await import('../lib/supabase')
    const { adminInsert } = await import('../lib/authAdmin')
    const { data: { user } } = await supabase.auth.getUser()
    const resolvedOrgId = await resolveOrgId(supabase, user?.id ?? '')
    if (!resolvedOrgId) throw new Error('Organização não encontrada')

    const { data: existing } = await supabase.from('org_membros').select('id')
      .eq('org_id', resolvedOrgId).eq('user_id', userId).maybeSingle()

    if (existing) {
      // Update via admin API (PATCH)
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY
      if (SERVICE_KEY && SERVICE_KEY !== 'your-service-role-key-here') {
        await fetch(`${SUPABASE_URL}/rest/v1/org_membros?id=eq.${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type':'application/json', 'apikey':SERVICE_KEY, 'Authorization':`Bearer ${SERVICE_KEY}`, 'Prefer':'return=minimal' },
          body: JSON.stringify({ equipe_id: equipe.id, role })
        })
      } else {
        // Fallback: try regular client
        const { error } = await supabase.from('org_membros').update({ equipe_id: equipe.id, role }).eq('id', existing.id)
        if (error) throw new Error(error.message)
      }
    } else {
      const err = await adminInsert('org_membros', {
        org_id: resolvedOrgId, user_id: userId, role,
        equipe_id: equipe.id, vendedor_id: vendedorId ?? null, ativo: true
      })
      if (err) throw new Error(err)
    }
  }

  const handleAdd = async () => {
    if (!sel) return
    setSaving(true)
    try {
      await addToTeam(sel.user_id, role, sel.vendedor_id)
      toast.success(`${sel.nome} adicionado à equipe!`)
      onSave()
    } catch(err:any) { toast.error('Erro: '+(err?.message??'Tente novamente')) }
    setSaving(false)
  }

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    const errosNovos: Record<string,string> = {}
    if (!novo.nome.trim()) errosNovos.nome = 'Nome é obrigatório'
    if (!novo.email.trim()) errosNovos.email = 'E-mail é obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo.email)) errosNovos.email = 'E-mail inválido'
    if (novo.senha.length < 6) errosNovos.senha = 'Mínimo 6 caracteres'
    if (Object.keys(errosNovos).length > 0) { setErros(errosNovos); return }

    setSaving(true)
    setFormError('')
    try {
      const { adminCreateUser } = await import('../lib/authAdmin')
      const { supabase } = await import('../lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()

      // Find admin owner_id
      const { data: func } = await supabase.from('funcionarios').select('owner_id').eq('user_id', user?.id ?? '').maybeSingle()
      const adminId = func?.owner_id ?? ownerId ?? user?.id ?? ''

      // Create auth user
      const { user_id: newUserId } = await adminCreateUser(novo.email, novo.senha, novo.nome)

      // Get org
      const { data: orgs } = await supabase.from('organizacoes').select('id').eq('owner_id', adminId).order('created_at').limit(1)
      const orgIdResolved = orgs?.[0]?.id

      // Insert funcionario using admin client to bypass RLS
      const { adminInsert, adminDeleteUser } = await import('../lib/authAdmin')
      
      // Auto-create vendedor record if role is vendedor/supervisor
      let vendedorId: string | null = null
      if (['vendedor', 'supervisor'].includes(novo.role)) {
        const vendRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/vendedores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            nome: novo.nome.trim(),
            email: novo.email.trim(),
            cargo: novo.role === 'supervisor' ? 'supervisor' : 'vendedor',
            situacao: true,
            user_id: adminId,
          }),
        })
        if (vendRes.ok) {
          const vendData = await vendRes.json()
          vendedorId = vendData?.[0]?.id ?? null
        }
      }

      const funcInsertErr = await adminInsert('funcionarios', {
        user_id: newUserId, nome: novo.nome.trim(), email: novo.email.trim(),
        role: novo.role, ativo: true, owner_id: adminId,
        vendedor_id: vendedorId,
      })
      if (funcInsertErr) { await adminDeleteUser(newUserId); throw new Error(funcInsertErr) }

      // Add to org + team
      if (orgIdResolved) {
        const membroErr = await adminInsert('org_membros', {
          org_id: orgIdResolved, user_id: newUserId, role: novo.role,
          equipe_id: equipe.id, vendedor_id: vendedorId, ativo: true
        })
        if (membroErr) console.warn('org_membros insert warning:', membroErr)
      }

      toast.success(`${novo.nome} criado e adicionado à equipe! Senha: ${novo.senha}`)
      onSave()
    } catch(err:any) {
      const msg = err?.message ?? ''
      setFormError(msg.includes('SERVICE_KEY') ? 'Configure VITE_SUPABASE_SERVICE_KEY no .env para criar funcionários.' : 'Erro: ' + msg)
    }
    setSaving(false)
  }

  const rolesDisponiveis: FuncionarioRole[] = ['vendedor','visualizador']

  return (
    <Modal title={`Adicionar à ${equipe.nome}`} onClose={onClose} maxWidth={500}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        {aba==='buscar'
          ? <button type="button" disabled={saving||!sel} onClick={handleAdd} className="btn-primary flex-1 justify-center" style={{opacity:!sel?.5:1}}>{saving?'Adicionando...':'Adicionar à equipe'}</button>
          : <button type="button" disabled={saving} onClick={handleCriar as any} className="btn-primary flex-1 justify-center" form="criar-form">{saving?'Criando...':'Criar e adicionar'}</button>
        }
      </>}>
      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:16}}>
        <button type="button" onClick={()=>setAba('buscar')} style={{flex:1,padding:'8px',borderRadius:9,fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:aba==='buscar'?'var(--accent)':'var(--bg-raised)',color:aba==='buscar'?'white':'var(--text-secondary)'}}>
          🔍 Buscar existente
        </button>
        <button type="button" onClick={()=>setAba('criar')} style={{flex:1,padding:'8px',borderRadius:9,fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:aba==='criar'?'var(--accent)':'var(--bg-raised)',color:aba==='criar'?'white':'var(--text-secondary)'}}>
          ➕ Criar novo acesso
        </button>
      </div>

      {aba==='buscar' && (
        <div className="space-y-4">
          <div style={{position:'relative'}}>
            <Search size={13} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none'}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="input-field" style={{paddingLeft:'2rem'}}/>
          </div>
          <div style={{maxHeight:220,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
            {filtrados.length===0
              ? <div style={{textAlign:'center',padding:'28px 0'}}>
                  <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:10}}>{todos.length===0?'Nenhum funcionário cadastrado ainda.':'Nenhum resultado para a busca.'}</p>
                  <button type="button" onClick={()=>setAba('criar')} className="btn-ghost" style={{fontSize:12}}>➕ Criar novo acesso</button>
                </div>
              : filtrados.map(f=>{
                  const active=sel?.id===f.id
                  return (
                    <div key={f.id} onClick={()=>setSel(active?null:f)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,cursor:'pointer',background:active?'var(--accent-muted)':'var(--bg-raised)',border:`1px solid ${active?'var(--accent)':'var(--border)'}`,transition:'all .15s'}}>
                      <div style={{width:32,height:32,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,background:'var(--accent-muted)',color:'var(--accent)',flexShrink:0}}>{f.nome[0]?.toUpperCase()}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{f.nome}</p>
                        <p style={{fontSize:11,color:'var(--text-muted)'}}>{f.email}</p>
                      </div>
                      {active&&<div style={{width:18,height:18,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'white',fontWeight:700}}>✓</div>}
                    </div>
                  )
                })
            }
          </div>
          {sel&&(
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:6,color:'var(--text-secondary)'}}>Cargo de {sel.nome}</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6}}>
                {rolesDisponiveis.map(r=>(
                  <button key={r} type="button" onClick={()=>setRole(r)} style={{padding:'8px',borderRadius:9,border:`1px solid ${role===r?'var(--accent)':'var(--border)'}`,background:role===r?'var(--accent-muted)':'transparent',color:role===r?'var(--accent)':'var(--text-muted)',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aba==='criar' && (
        <form id="criar-form" onSubmit={handleCriar} className="space-y-4">
          {formError&&<div style={{padding:'10px 14px',borderRadius:10,background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.3)',fontSize:13,color:'var(--danger)'}}>{formError}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'var(--text-secondary)'}}>Nome Completo *</label>
              <input value={novo.nome} onChange={e=>{setNovo(p=>({...p,nome:e.target.value}));setErros(p=>({...p,nome:''}))}} placeholder="Nome do funcionário" className={`input-field ${erros.nome?'error':''}`}/>
              {erros.nome&&<p style={{fontSize:11,color:'var(--danger)',marginTop:3}}>⚠ {erros.nome}</p>}
            </div>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'var(--text-secondary)'}}>E-mail *</label>
              <input type="email" value={novo.email} onChange={e=>{setNovo(p=>({...p,email:e.target.value}));setErros(p=>({...p,email:''}))}} placeholder="email@empresa.com" className={`input-field ${erros.email?'error':''}`}/>
              {erros.email&&<p style={{fontSize:11,color:'var(--danger)',marginTop:3}}>⚠ {erros.email}</p>}
            </div>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'var(--text-secondary)'}}>Cargo</label>
              <select value={novo.role} onChange={e=>setNovo(p=>({...p,role:e.target.value as FuncionarioRole}))} className="input-field" style={{appearance:'none'}}>
                {rolesDisponiveis.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:500,marginBottom:5,color:'var(--text-secondary)'}}>Senha de Acesso *</label>
            <div style={{display:'flex',gap:7}}>
              <input value={novo.senha} onChange={e=>{setNovo(p=>({...p,senha:e.target.value}));setErros(p=>({...p,senha:''}))}} className={`input-field ${erros.senha?'error':''}`} style={{fontFamily:'monospace',fontWeight:600,letterSpacing:1}}/>
              <button type="button" onClick={()=>setNovo(p=>({...p,senha:gerarSenha()}))} className="btn-ghost" style={{padding:'9px 11px',flexShrink:0}}>↻</button>
              <button type="button" onClick={()=>navigator.clipboard.writeText(novo.senha)} className="btn-ghost" style={{padding:'9px 11px',flexShrink:0}}>⎘</button>
            </div>
            {erros.senha&&<p style={{fontSize:11,color:'var(--danger)',marginTop:3}}>⚠ {erros.senha}</p>}
            <p style={{fontSize:11,color:'#fbbf24',marginTop:5}}>⚠ Copie a senha agora — não será exibida novamente.</p>
          </div>
        </form>
      )}
    </Modal>
  )
}

// ─── Card de membro ──────────────────────────────────────────
function MembroCard({ m, canRemove, onRemove }: { m:OrgMembro; canRemove:boolean; onRemove:()=>void }) {
  const rc = ROLE_COLORS[m.role]
  const nome = m.funcionarios?.nome??'—'
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,background:'var(--bg-card)',border:'1px solid var(--border)'}}
      onMouseEnter={e=>{if(canRemove){const b=e.currentTarget.querySelector('.rem-btn') as HTMLElement;if(b)b.style.opacity='1'}}}
      onMouseLeave={e=>{const b=e.currentTarget.querySelector('.rem-btn') as HTMLElement;if(b)b.style.opacity='0'}}>
      <div style={{width:34,height:34,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,background:rc.bg,color:rc.color,flexShrink:0}}>{nome[0]?.toUpperCase()}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nome}</p>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{fontSize:10,fontWeight:600,padding:'1px 6px',borderRadius:20,background:rc.bg,color:rc.color}}>{ROLE_LABELS[m.role]}</span>
          {m.funcionarios?.email&&<span style={{fontSize:11,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.funcionarios.email}</span>}
        </div>
      </div>
      {canRemove&&<button className="rem-btn" onClick={onRemove} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',opacity:0,transition:'opacity .15s',flexShrink:0,display:'flex',alignItems:'center',padding:4}}><X size={14}/></button>}
    </div>
  )
}

// ─── Card de Equipe ──────────────────────────────────────────
function EquipeCard({ equipe, orgId, canEdit, canDelete, canManageMembers, onEdit, onRequestDelete, onReload }: {
  equipe:Equipe; orgId:string; canEdit:boolean; canDelete:boolean; canManageMembers:boolean
  onEdit:()=>void; onRequestDelete:()=>void; onReload:()=>void
}) {
  const { permissions } = useAuth()
  const [membros, setMembros] = useState<OrgMembro[]>([])
  const [expanded, setExpanded] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [removendo, setRemovendo] = useState<OrgMembro|null>(null)
  const { toast } = useToast()

  const loadMembros = useCallback(async () => {
    const { supabase } = await import('../lib/supabase')
    const { data: membrosData } = await supabase.from('org_membros').select('*').eq('equipe_id',equipe.id).eq('ativo',true)
    if (!membrosData?.length) { setMembros([]); return }
    const userIds = membrosData.map((m:any)=>m.user_id)
    const { data: funcsData } = await supabase.from('funcionarios').select('user_id,nome,email').in('user_id',userIds)
    const funcsMap: Record<string,{nome:string;email:string}> = {}
    ;(funcsData??[]).forEach((f:any)=>{ funcsMap[f.user_id]={nome:f.nome,email:f.email} })
    setMembros(membrosData.map((m:any)=>({...m,funcionarios:funcsMap[m.user_id]??null})) as OrgMembro[])
  }, [equipe.id])

  useEffect(() => { loadMembros() }, [loadMembros])

  const confirmarRemocao = async () => {
    if (!removendo) return
    const { supabase } = await import('../lib/supabase')
    await supabase.from('org_membros').update({equipe_id:null}).eq('id',removendo.id)
    toast.success(`${removendo.funcionarios?.nome??'Membro'} removido`)
    setRemovendo(null); loadMembros()
  }

  const supervisores = membros.filter(m=>m.role==='supervisor'||m.role==='admin')
  const outros = membros.filter(m=>m.role!=='supervisor'&&m.role!=='admin')

  return (
    <>
      <div className="rounded-2xl" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'13px 16px',borderBottom:expanded?'1px solid var(--border)':'none'}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:equipe.cor,flexShrink:0}}/>
          <button onClick={()=>setExpanded(!expanded)} style={{flex:1,display:'flex',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',textAlign:'left',minWidth:0}}>
            <span style={{fontSize:15,fontWeight:700,color:'var(--text-primary)'}}>{equipe.nome}</span>
            {equipe.descricao&&<span style={{fontSize:12,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>— {equipe.descricao}</span>}
            <span style={{flexShrink:0,marginLeft:'auto',fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--bg-raised)',color:'var(--text-muted)'}}>{membros.length} membro{membros.length!==1?'s':''}</span>
            {expanded?<ChevronDown size={13} style={{color:'var(--text-muted)',flexShrink:0}}/>:<ChevronRight size={13} style={{color:'var(--text-muted)',flexShrink:0}}/>}
          </button>
          <div style={{display:'flex',gap:4,flexShrink:0}}>
            {canManageMembers&&<button onClick={()=>setAddModal(true)} className="btn-ghost" style={{padding:'5px 10px',fontSize:12}}><UserPlus size={12}/> Adicionar</button>}
            {canEdit&&<button onClick={onEdit} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'5px 6px',display:'flex',alignItems:'center'}}><Pencil size={13}/></button>}
            {canDelete&&<button onClick={onRequestDelete} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',padding:'5px 6px',display:'flex',alignItems:'center'}}><Trash2 size={13}/></button>}
            {!canEdit&&!canDelete&&!canManageMembers&&<Lock size={13} style={{color:'var(--text-muted)',padding:'5px 6px'}}/>}
          </div>
        </div>

        {expanded&&(
          <div style={{padding:'14px 16px'}}>
            {membros.length===0?(
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <Users size={24} style={{color:'var(--text-muted)',margin:'0 auto 8px'}}/>
                <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:canManageMembers?12:0}}>Nenhum membro nesta equipe</p>
                {canManageMembers&&<button onClick={()=>setAddModal(true)} className="btn-ghost" style={{fontSize:12}}><UserPlus size={12}/> Adicionar membro</button>}
              </div>
            ):(
              <div className="space-y-4">
                {supervisores.length>0&&(
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:8}}><Crown size={11} style={{color:'#fbbf24'}}/><span style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.8}}>Liderança</span></div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:6}}>
                      {supervisores.map(m=><MembroCard key={m.id} m={m} canRemove={canManageMembers} onRemove={()=>setRemovendo(m)}/>)}
                    </div>
                  </div>
                )}
                {outros.length>0&&(
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:8}}><Users size={11} style={{color:'var(--text-muted)'}}/><span style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:.8}}>Membros</span></div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:6}}>
                      {outros.map(m=><MembroCard key={m.id} m={m} canRemove={canManageMembers} onRemove={()=>setRemovendo(m)}/>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {addModal&&<AddMembroModal equipe={equipe} orgId={orgId} membrosAtuais={membros} podeGerenciarEquipe={permissions.isAdmin} onSave={()=>{loadMembros();setAddModal(false)}} onClose={()=>setAddModal(false)}/>}
      {removendo&&<ConfirmModal title="Remover membro" message={`Remover ${removendo.funcionarios?.nome??'este membro'} da equipe?`} confirmLabel="Remover" danger onConfirm={confirmarRemocao} onCancel={()=>setRemovendo(null)}/>}
    </>
  )
}

// ─── Página ──────────────────────────────────────────────────
export default function Equipe() {
  const { permissions, equipeId } = useAuth()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [currentOrgId, setCurrentOrgId] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Equipe|null>(null)
  const [deletando, setDeletando] = useState<Equipe|null>(null)
  const { toast } = useToast()

  const isAdmin = permissions.isAdmin
  const isSupervisor = permissions.role === 'supervisor' || (permissions.role as string) === 'gerente'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (isAdmin) {
        // Admin: find their org, show all equipes
        const { data: orgs } = await supabase.from('organizacoes').select('id').eq('owner_id', user.id).order('created_at').limit(1)
        let orgId = orgs?.[0]?.id ?? null
        if (!orgId) {
          const { data: newOrg } = await supabase.from('organizacoes').insert({nome: user.user_metadata?.name??'Minha Empresa', owner_id: user.id}).select('id').single()
          orgId = newOrg?.id ?? null
        }
        if (!orgId) return
        setCurrentOrgId(orgId)
        const { data: eqs } = await supabase.from('equipes').select('*').eq('org_id', orgId).order('created_at')
        setEquipes((eqs ?? []) as Equipe[])
      } else {
        // Supervisor: get equipe_id directly from org_membros
        const { data: membro } = await supabase.from('org_membros')
          .select('equipe_id, org_id')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .maybeSingle()
        const myEquipeId = membro?.equipe_id ?? equipeId ?? null
        if (membro?.org_id) setCurrentOrgId(membro.org_id)
        if (!myEquipeId) { setEquipes([]); return }
        const { data: eqs } = await supabase.from('equipes').select('*').eq('id', myEquipeId)
        setEquipes((eqs ?? []) as Equipe[])
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err?.message ?? 'Tente novamente'))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, equipeId])

  useEffect(() => { load() }, [load])

  const confirmarDelete = async () => {
    if (!deletando) return
    const { supabase } = await import('../lib/supabase')
    await supabase.from('org_membros').update({equipe_id:null}).eq('equipe_id',deletando.id)
    await supabase.from('equipes').delete().eq('id',deletando.id)
    toast.success(`Equipe "${deletando.nome}" excluída`)
    setDeletando(null); load()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--text-primary)'}}>Equipes</h2>
          <p style={{fontSize:13,color:'var(--text-muted)',marginTop:2}}>
            {equipes.length} equipe{equipes.length!==1?'s':''}
            {!isAdmin&&isSupervisor&&<span style={{marginLeft:6,fontSize:11,padding:'2px 8px',borderRadius:20,background:'var(--accent-muted)',color:'var(--accent)'}}>Minha equipe</span>}
          </p>
        </div>
        {isAdmin&&(
          <button onClick={()=>{setEditing(null);setModal(true)}} className="btn-primary"><Plus size={14}/> Nova Equipe</button>
        )}
      </div>

      {loading ? (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200}}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/>
        </div>
      ) : equipes.length===0 ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:260,gap:14,borderRadius:16,border:'2px dashed var(--border)'}}>
          <Users size={40} style={{color:'var(--text-muted)'}}/>
          <div style={{textAlign:'center'}}>
            <p style={{fontSize:15,fontWeight:600,color:'var(--text-primary)',marginBottom:4}}>
              {isAdmin?'Nenhuma equipe criada':'Você não está em nenhuma equipe'}
            </p>
            <p style={{fontSize:13,color:'var(--text-muted)'}}>
              {isAdmin?'Crie equipes para organizar seus funcionários.':'Peça ao administrador para te adicionar a uma equipe.'}
            </p>
          </div>
          {isAdmin&&<button onClick={()=>{setEditing(null);setModal(true)}} className="btn-primary"><Plus size={14}/> Criar primeira equipe</button>}
        </div>
      ) : (
        <div className="space-y-4">
          {equipes.map(eq=>{
            const isMyTeam = !isAdmin && equipeId === eq.id
            const canEdit = isAdmin
            const canDelete = isAdmin
            const canManage = isAdmin || isMyTeam
            return (
              <EquipeCard key={eq.id} equipe={eq} orgId={currentOrgId}
                canEdit={canEdit} canDelete={canDelete} canManageMembers={canManage}
                onEdit={()=>{setEditing(eq);setModal(true)}}
                onRequestDelete={()=>setDeletando(eq)}
                onReload={load}/>
            )
          })}
        </div>
      )}

      {modal&&isAdmin&&<EquipeModal item={editing} orgId={currentOrgId}
        onSave={(eq)=>{setModal(false);setEditing(null);if(eq&&!editing)setEquipes(p=>[...p,eq]);else if(eq&&editing)setEquipes(p=>p.map(e=>e.id===eq.id?eq:e));setTimeout(load,300)}}
        onClose={()=>{setModal(false);setEditing(null)}}/>}

      {deletando&&<ConfirmModal title="Excluir equipe" message={`Excluir "${deletando.nome}"? Os membros serão desvinculados.`} confirmLabel="Excluir" danger onConfirm={confirmarDelete} onCancel={()=>setDeletando(null)}/>}
    </div>
  )
}
