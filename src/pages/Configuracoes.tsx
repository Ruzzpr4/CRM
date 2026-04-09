import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Copy, Eye, EyeOff, CheckCircle, Webhook, Shield, Bell, MessageSquareText } from 'lucide-react'

const TEMPLATES_PADRAO = [
  { tipo:'lembrete_d2', nome:'Lembrete D-2', canal:'whatsapp',
    conteudo:'Olá, {{nome_cliente}}! 😊 Passando para lembrar que sua *{{tipo_consulta}}* está agendada para {{data_consulta}} às {{hora_consulta}}. Local: {{local}}. Qualquer dúvida, estamos à disposição!' },
  { tipo:'lembrete_d1', nome:'Lembrete D-1', canal:'whatsapp',
    conteudo:'Olá, {{nome_cliente}}! Amanhã é o dia da sua consulta às {{hora_consulta}}. 📅 Confirme sua presença respondendo "SIM" ou nos avise caso precise reagendar. Até amanhã!' },
  { tipo:'lembrete_dia', nome:'Lembrete no Dia', canal:'whatsapp',
    conteudo:'Bom dia, {{nome_cliente}}! Hoje é o dia da sua *{{tipo_consulta}}* às {{hora_consulta}}. Aguardamos você! 🏥' },
  { tipo:'boas_vindas', nome:'Boas-vindas', canal:'whatsapp',
    conteudo:'Olá, {{nome_cliente}}! Seja bem-vindo(a)! 🎉 Sua consulta foi agendada para {{data_consulta}} às {{hora_consulta}}. Qualquer dúvida, estamos aqui.' },
]

const VARIAVEIS = ['{{nome_cliente}}','{{data_consulta}}','{{hora_consulta}}','{{tipo_consulta}}','{{local}}','{{consultor}}']

export default function Configuracoes() {
  const { user } = useAuth()
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState<string|null>(null)
  const [alertaDias, setAlertaDias] = useState([2,1])

  const webhookSecret = import.meta.env.VITE_WEBHOOK_SECRET ?? 'configure-em-.env'
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://seu-projeto.supabase.co'
  const webhookUrl = `${supabaseUrl}/functions/v1/webhook-crm`

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text); setCopied(key); setTimeout(()=>setCopied(null),2000)
  }

  const examplePayload = JSON.stringify({
    secret: "seu-webhook-secret",
    canal: "whatsapp",
    nome: "João Silva",
    telefone: "(11) 9 9999-8888",
    email: "joao@email.com",
    observacao: "Paciente indicado pelo Dr. Roberto. Queixa de dores lombares.",
    situacao: "novo"
  }, null, 2)

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Alertas */}
      <section className="rounded-2xl p-6" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.3)' }}>
            <Bell size={17} style={{ color:'#f59e0b' }}/>
          </div>
          <div>
            <h2 className="font-bold" style={{ color:'var(--text-primary)' }}>Alertas de Consulta</h2>
            <p className="text-xs" style={{ color:'var(--text-muted)' }}>Configure quando os lembretes são enviados</p>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium" style={{ color:'var(--text-secondary)' }}>Enviar lembrete automaticamente:</p>
          <div className="flex flex-wrap gap-2">
            {[3,2,1,0].map(d => (
              <label key={d} className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
                style={{ background: alertaDias.includes(d)?'var(--accent-muted)':'var(--bg-elevated)', border:`1px solid ${alertaDias.includes(d)?'var(--accent)':'var(--border)'}` }}>
                <input type="checkbox" checked={alertaDias.includes(d)}
                  onChange={e => setAlertaDias(prev => e.target.checked ? [...prev,d] : prev.filter(x=>x!==d))}
                  className="accent-blue-500"/>
                <span className="text-sm font-medium" style={{ color:alertaDias.includes(d)?'var(--accent)':'var(--text-secondary)' }}>
                  {d === 0 ? 'Dia da consulta' : `${d} dia${d>1?'s':''} antes`}
                </span>
              </label>
            ))}
          </div>
          <div className="p-3 rounded-xl" style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
            <p className="text-xs" style={{ color:'#f59e0b' }}>
              As mensagens serão enviados via webhook.
            </p>
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="rounded-2xl p-6" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'rgba(79,86,247,0.12)', border:'1px solid rgba(79,86,247,0.3)' }}>
            <MessageSquareText size={17} style={{ color:'var(--accent)' }}/>
          </div>
          <div>
            <h2 className="font-bold" style={{ color:'var(--text-primary)' }}>Templates de Mensagem</h2>
            <p className="text-xs" style={{ color:'var(--text-muted)' }}>Modelos de lembrete automático</p>
          </div>
        </div>

        <div className="mb-4 p-3 rounded-xl" style={{ background:'var(--bg-elevated)' }}>
          <p className="text-xs font-medium mb-2" style={{ color:'var(--text-secondary)' }}>Variáveis disponíveis:</p>
          <div className="flex flex-wrap gap-1.5">
            {VARIAVEIS.map(v => (
              <button key={v} onClick={()=>copy(v,'var'+v)} className="px-2 py-1 rounded-lg text-xs font-mono transition-all"
                style={{ background:'var(--bg-card)', color:copied==='var'+v?'#10b981':'var(--accent)', border:`1px solid ${copied==='var'+v?'rgba(16,185,129,0.3)':'rgba(79,86,247,0.2)'}`, cursor:'pointer' }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {TEMPLATES_PADRAO.map(t => (
            <div key={t.tipo} className="rounded-xl p-4" style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>{t.nome}</p>
                <div className="flex gap-1">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'rgba(37,211,102,0.12)', color:'#25D366' }}>WhatsApp</span>
                  <button onClick={()=>copy(t.conteudo,'tpl'+t.tipo)} className="p-1 rounded"
                    style={{ background:'none', border:'none', cursor:'pointer', color:copied==='tpl'+t.tipo?'#10b981':'var(--text-muted)' }}>
                    {copied==='tpl'+t.tipo?<CheckCircle size={14}/>:<Copy size={14}/>}
                  </button>
                </div>
              </div>
              <p className="text-xs leading-relaxed" style={{ color:'var(--text-secondary)' }}>{t.conteudo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Conta */}
      <section className="rounded-2xl p-6" style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
        <h2 className="font-bold mb-4" style={{ color:'var(--text-primary)' }}>Conta</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
            style={{ background:'var(--accent-muted)', color:'var(--accent)', border:'1px solid rgba(79,86,247,0.3)' }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm" style={{ color:'var(--text-primary)' }}>{user?.user_metadata?.name ?? 'Usuário'}</p>
            <p className="text-xs" style={{ color:'var(--text-muted)' }}>{user?.email}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
