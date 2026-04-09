import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { FuncionarioRole } from '../types/funcionario'

export interface UserPermissions {
  clientes:boolean; agenda:boolean; historico:boolean; equipe:boolean
  metas:boolean; captacao:boolean; estoque:boolean; vendas:boolean
  funcionarios:boolean; configuracoes:boolean; isAdmin:boolean; role:FuncionarioRole
}

const ADMIN_PERMS: UserPermissions = {
  clientes:true, agenda:true, historico:true, equipe:true, metas:true,
  captacao:true, estoque:true, vendas:true, funcionarios:true, configuracoes:true,
  isAdmin:true, role:'admin'
}

export const ROLE_PERMS: Record<FuncionarioRole, UserPermissions> = {
  admin:       { ...ADMIN_PERMS },
  supervisor:  { clientes:true,  agenda:true,  historico:true,  equipe:true,  metas:true,  captacao:true,  estoque:true,  vendas:true,  funcionarios:false, configuracoes:false, isAdmin:false, role:'supervisor' },
  vendedor:    { clientes:true,  agenda:true,  historico:true,  equipe:false, metas:false, captacao:true,  estoque:false, vendas:true,  funcionarios:false, configuracoes:false, isAdmin:false, role:'vendedor' },
  estoque:     { clientes:false, agenda:false, historico:false, equipe:false, metas:false, captacao:false, estoque:true,  vendas:false, funcionarios:false, configuracoes:false, isAdmin:false, role:'estoque' },
  visualizador:{ clientes:true,  agenda:true,  historico:true,  equipe:true,  metas:true,  captacao:true,  estoque:true,  vendas:false, funcionarios:false, configuracoes:false, isAdmin:false, role:'visualizador' },
}

interface OrgInfo { id:string; nome:string; owner_id:string }

interface AuthCtx {
  user:User|null; loading:boolean; permissions:UserPermissions
  orgInfo:OrgInfo|null; vendedorId:string|null; equipeId:string|null; ownerId:string; permissionsReady:boolean
  signIn:(e:string,p:string)=>Promise<{error?:string}>
  signUp:(e:string,p:string,n:string)=>Promise<{error?:string}>
  signOut:()=>Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user:null, loading:true, permissions:ADMIN_PERMS,
  orgInfo:null, vendedorId:null, equipeId:null, ownerId:'', permissionsReady:false,
  signIn:async()=>({}), signUp:async()=>({}), signOut:async()=>{},
})

export function AuthProvider({ children }: { children:ReactNode }) {
  const [user, setUser] = useState<User|null>(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<UserPermissions>(ADMIN_PERMS)
  const [orgInfo, setOrgInfo] = useState<OrgInfo|null>(null)
  const [vendedorId, setVendedorId] = useState<string|null>(null)
  const [equipeId, setEquipeId] = useState<string|null>(null)
  const [ownerId, setOwnerId] = useState<string>('')
  const [permissionsReady, setPermissionsReady] = useState(false)

  const resolveUserRole = async (u: User) => {
    try {
      const { supabase } = await import('../lib/supabase')

      // Check if this user has a funcionarios record owned by someone else
      const { data: func } = await supabase.from('funcionarios')
        .select('role, owner_id, vendedor_id')
        .eq('user_id', u.id)
        .eq('ativo', true)
        .maybeSingle()

      if (func?.owner_id && func.owner_id !== u.id) {
        // Is a funcionário of another admin
        const role = (func.role as FuncionarioRole) || 'vendedor'
        setPermissions(ROLE_PERMS[role] ?? ROLE_PERMS.vendedor)
        setVendedorId(func.vendedor_id ?? null)
        setOwnerId(func.owner_id)

        const [{ data: org }, { data: membro }] = await Promise.all([
          supabase.from('organizacoes').select('id,nome,owner_id').eq('owner_id', func.owner_id).order('created_at').limit(1).maybeSingle(),
          supabase.from('org_membros').select('equipe_id').eq('user_id', u.id).maybeSingle(),
        ])
        if (org) setOrgInfo(org as OrgInfo)
        setEquipeId(membro?.equipe_id ?? null)
      } else {
        // Is admin
        const { data: orgs } = await supabase.from('organizacoes')
          .select('id,nome,owner_id').eq('owner_id', u.id).order('created_at').limit(1)
        setPermissions(ADMIN_PERMS)
        setOwnerId(u.id)
        setVendedorId(null)
        setEquipeId(null)
        if (orgs?.[0]) setOrgInfo(orgs[0] as OrgInfo)
      }
    } catch {
      // On error: default to admin (better than blocking)
      setPermissions(ADMIN_PERMS)
      setOwnerId(u.id)
    } finally {
      setPermissionsReady(true)
    }
  }

  useEffect(() => {
    import('../lib/supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user)
          await resolveUserRole(session.user)
        }
        setPermissionsReady(true)
        setLoading(false)
      }).catch(() => { setPermissionsReady(true); setLoading(false) })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          setOwnerId(u.id)
          resolveUserRole(u)
        } else {
          setPermissions(ADMIN_PERMS)
          setOrgInfo(null); setVendedorId(null); setEquipeId(null); setOwnerId('')
        }
      })
      return () => subscription.unsubscribe()
    })
  }, [])

  const signIn = async (email:string, password:string) => {
    const { supabase } = await import('../lib/supabase')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? { error: error.message } : {}
  }
  const signUp = async (email:string, password:string, name:string) => {
    const { supabase } = await import('../lib/supabase')
    const { error } = await supabase.auth.signUp({ email, password, options:{ data:{ name } } })
    return error ? { error: error.message } : {}
  }
  const signOut = async () => {
    const { supabase } = await import('../lib/supabase')
    const { clearApiCache } = await import('../lib/api')
    clearApiCache()
    await supabase.auth.signOut()
    setPermissions(ADMIN_PERMS); setOrgInfo(null); setVendedorId(null); setEquipeId(null); setOwnerId('')
  }

  return (
    <Ctx.Provider value={{ user, loading, permissions, orgInfo, vendedorId, equipeId, ownerId, permissionsReady, signIn, signUp, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
