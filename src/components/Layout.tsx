import { useState } from 'react'
import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { Zap, LayoutDashboard, Users, CalendarDays, MessageSquareText, Filter, Settings, LogOut, ChevronRight, Sun, Moon, Menu, UserCheck, Target, Package, UsersRound, ShoppingBag, DollarSign, Award, ShoppingCart, Clock, BarChart2, HeartHandshake } from 'lucide-react'

const ALL_NAV = [
  { to:'/',              icon:LayoutDashboard,   label:'Dashboard',    exact:true,  perm:null },
  { to:'/clientes',     icon:Users,             label:'Clientes',     perm:'clientes' },
  { to:'/agenda',       icon:CalendarDays,      label:'Agenda',       perm:'agenda' },
  { to:'/historico',    icon:MessageSquareText, label:'Histórico',    perm:'historico' },
  { to:'/captacao',     icon:Filter,            label:'Captação',     perm:'captacao' },
  { to:'/pedidos',      icon:ShoppingCart,      label:'Pedidos',      perm:'vendas' },
  { to:'/vendas',       icon:ShoppingBag,       label:'Vendas',       perm:'vendas' },
  { to:'/financeiro',   icon:DollarSign,        label:'Financeiro',   perm:'vendas' },
  { to:'/comissoes',    icon:Award,             label:'Comissões',    perm:'vendas' },
  { to:'/estoque',      icon:Package,           label:'Estoque',      perm:'estoque' },
  { to:'/equipe',       icon:UserCheck,         label:'Equipe',       perm:'equipe' },
  { to:'/metas',        icon:Target,            label:'Metas',        perm:'metas' },
  { to:'/ponto',        icon:Clock,             label:'Ponto',        perm:null },
  { to:'/funcionarios', icon:UsersRound,        label:'Funcionários', perm:'funcionarios' },
  { to:'/relatorios',   icon:BarChart2,         label:'Relatórios',   perm:null },
  { to:'/rh',            icon:HeartHandshake,    label:'RH',           perm:'funcionarios' },
]

export default function Layout() {
  const { user, signOut, permissions } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [col, setCol] = useState(false)
  const [mob, setMob] = useState(false)
  const loc = useLocation()

  const visibleNav = ALL_NAV.filter(n => !n.perm || permissions[n.perm as keyof typeof permissions])
  const title = [...visibleNav, { to:'/configuracoes', label:'Configurações' }, { to:'/financeiro', label:'Financeiro' }, { to:'/comissoes', label:'Comissões' }, { to:'/pedidos', label:'Pedidos' }, { to:'/ponto', label:'Ponto' }, { to:'/relatorios', label:'Relatórios' }, { to:'/rh', label:'RH' }]
    .find(n => ('exact' in n && n.exact) ? loc.pathname===n.to : loc.pathname.startsWith(n.to))?.label ?? 'ProspectCRM'
  const W = col ? 52 : 210

  const Sidebar = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 12px', flexShrink:0 }}>
        <div style={{ width:30, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent)', flexShrink:0 }}>
          <Zap size={15} color="white"/>
        </div>
        {!col && <span style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)' }}>ProspectCRM</span>}
      </div>

      <nav style={{ flex:1, padding:'0 6px', overflowY:'auto', display:'flex', flexDirection:'column', gap:1 }}>
        {visibleNav.map(({ to, icon:Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact} onClick={() => setMob(false)}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:9,
              textDecoration:'none', fontWeight:500, fontSize:13, transition:'all .15s',
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? 'white' : 'var(--text-secondary)',
              boxShadow: isActive ? '0 2px 12px rgba(124,127,245,.28)' : 'none',
            })}>
            <Icon size={15} style={{ flexShrink:0 }}/>
            {!col && label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding:'6px 6px 10px', flexShrink:0, borderTop:'1px solid var(--border)', marginTop:6 }}>
        <button onClick={toggleTheme} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 10px', borderRadius:9, background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', fontSize:13 }}>
          {theme==='dark'?<Sun size={14}/>:<Moon size={14}/>}
          {!col && (theme==='dark'?'Tema Claro':'Tema Escuro')}
        </button>
        {permissions.configuracoes && (
          <NavLink to="/configuracoes" onClick={()=>setMob(false)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:9, textDecoration:'none', color:'var(--text-secondary)', fontSize:13, fontWeight:500 }}>
            <Settings size={14}/>{!col && 'Configurações'}
          </NavLink>
        )}
        <div style={{ margin:'6px 0', height:1, background:'var(--border)' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px' }}>
          <div style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, background:'var(--accent-muted)', color:'var(--accent)', flexShrink:0 }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          {!col && <>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.user_metadata?.name || user?.email?.split('@')[0]}</p>
              <p style={{ fontSize:10, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</p>
            </div>
            <button onClick={signOut} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:3, flexShrink:0 }}
              onMouseEnter={e=>(e.currentTarget.style.color='var(--danger)')}
              onMouseLeave={e=>(e.currentTarget.style.color='var(--text-muted)')}>
              <LogOut size={13}/>
            </button>
          </>}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg-primary)' }}>
      <aside className="hidden lg:flex flex-col" style={{ width:W, flexShrink:0, background:'var(--bg-secondary)', borderRight:'1px solid var(--border)', transition:'width .25s', position:'relative' }}>
        <Sidebar/>
        <button onClick={()=>setCol(!col)} style={{ position:'absolute', right:-11, top:22, width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-raised)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-muted)' }}>
          <ChevronRight size={11} style={{ transform:col?'rotate(0)':'rotate(180deg)', transition:'transform .25s' }}/>
        </button>
      </aside>
      {mob && (
        <div className="lg:hidden" style={{ position:'fixed', inset:0, zIndex:50, display:'flex' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(3px)' }} onClick={()=>setMob(false)}/>
          <aside style={{ position:'relative', width:210, background:'var(--bg-secondary)', borderRight:'1px solid var(--border)' }}><Sidebar/></aside>
        </div>
      )}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 18px', borderBottom:'1px solid var(--border)', background:'var(--bg-secondary)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button className="lg:hidden" onClick={()=>setMob(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }}><Menu size={17}/></button>
            <h1 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{title}</h1>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'var(--accent-muted)', color:'var(--accent)', fontWeight:600 }}>
              {permissions.role === 'admin' ? 'Admin' : permissions.role.charAt(0).toUpperCase() + permissions.role.slice(1)}
            </span>
            <button onClick={toggleTheme} style={{ background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:7, padding:'5px 7px', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }}>
              {theme==='dark'?<Sun size={14}/>:<Moon size={14}/>}
            </button>
          </div>
        </header>
        <main style={{ flex:1, overflowY:'auto', padding:18 }}><Outlet/></main>
      </div>
    </div>
  )
}