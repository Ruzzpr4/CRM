import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Agenda from './pages/Agenda'
import Historico from './pages/Historico'
import Equipe from './pages/Equipe'
import Metas from './pages/Metas'
import Captacao from './pages/Captacao'
import Estoque from './pages/Estoque'
import Funcionarios from './pages/Funcionarios'
import Configuracoes from './pages/Configuracoes'
import Vendas from './pages/Vendas'

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading, permissionsReady } = useAuth()
  if (loading || !permissionsReady) return (
    <div style={{ display:'flex', height:'100vh', width:'100vw', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)' }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor:'var(--accent)' }}/>
    </div>
  )
  if (!user) return <Navigate to="/login" replace/>
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace/> : <Login/>}/>
      <Route path="/" element={<Guard><Layout/></Guard>}>
        <Route index element={<Dashboard/>}/>
        <Route path="clientes" element={<Clientes/>}/>
        <Route path="agenda" element={<Agenda/>}/>
        <Route path="historico" element={<Historico/>}/>
        <Route path="equipe" element={<Equipe/>}/>
        <Route path="metas" element={<Metas/>}/>
        <Route path="captacao" element={<Captacao/>}/>
        <Route path="vendas" element={<Vendas/>}/>
        <Route path="estoque" element={<Estoque/>}/>
        <Route path="funcionarios" element={<Funcionarios/>}/>
        <Route path="configuracoes" element={<Configuracoes/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes/>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
