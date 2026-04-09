import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Zap, Lock, Mail } from 'lucide-react'
import { IS_MOCK } from '../lib/api'

export default function Login() {
  const { signIn } = useAuth()
  const mode = 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [success, setSuccess] = useState<string|null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null); setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ background:'var(--bg-primary)' }}>
      {/* Left */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background:'linear-gradient(135deg, #0d0d1a 0%, #111130 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage:'linear-gradient(rgba(79,86,247,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(79,86,247,0.3) 1px, transparent 1px)', backgroundSize:'40px 40px' }}/>
        <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background:'radial-gradient(circle, #4f56f7, transparent)' }}/>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'var(--accent)' }}><Zap size={18} color="white"/></div>
          <span className="text-lg font-bold text-white">ProspectCRM</span>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-white">
            Gestão completa<br/><span style={{ color:'var(--accent)' }}>dos seus clientes.</span>
          </h1>
          <p style={{ color:'#8b87b8', lineHeight:1.7, maxWidth:380 }}>
            Cadastro de clientes, agendamentos de consultas, histórico de comunicações e alertas automáticos — tudo em um só lugar.
          </p>
          <div className="space-y-3">
            {[
              'Cadastro completo com CPF, RG e histórico clínico',
              'Agenda com alertas D-2, D-1 e no dia da consulta',
              'Histórico unificado de WhatsApp, LinkedIn e Gmail',
              'Pipeline de captação de novos clientes',
            ].map(f=>(
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background:'rgba(79,86,247,0.2)', border:'1px solid rgba(79,86,247,0.4)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background:'var(--accent)' }}/>
                </div>
                <span style={{ color:'#8b87b8', fontSize:14 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 rounded-2xl p-4 flex items-center gap-4"
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
          {IS_MOCK && (
            <p className="text-xs" style={{ color:'#f59e0b' }}>
              🧪 Modo demonstração ativo — use qualquer e-mail e senha para entrar
            </p>
          )}
          {!IS_MOCK && (
            <p className="text-xs" style={{ color:'#8b87b8' }}></p>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'var(--accent)' }}><Zap size={18} color="white"/></div>
            <span className="text-lg font-bold" style={{ color:'var(--text-primary)' }}>ProspectCRM</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1" style={{ color:'var(--text-primary)' }}>
              Bem-vindo de volta
            </h2>
            <p style={{ color:'var(--text-muted)', fontSize:14 }}>
              Entre para acessar o CRM
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>E-mail</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="voce@exemplo.com" className="input-field" style={{paddingLeft:'2.25rem'}}/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color:'var(--text-secondary)' }}>Senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
                <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required
                  placeholder={IS_MOCK?'Qualquer senha':'Mínimo 8 caracteres'} className="input-field pr-10" style={{paddingLeft:'2.25rem'}}/>
                <button type="button" onClick={()=>setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>
                  {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </div>
            {error && <div className="rounded-xl p-3 text-sm" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171' }}>{error}</div>}
            {success && <div className="rounded-xl p-3 text-sm" style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', color:'#34d399' }}>{success}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center" style={{ opacity:loading?.6:1 }}>
              {loading?'Aguarde...':'Entrar'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color:'var(--text-muted)' }}>
            Acesso restrito. Solicite seu acesso ao administrador.
          </p>
        </div>
      </div>
    </div>
  )
}
