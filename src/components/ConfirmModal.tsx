import ReactDOM from 'react-dom'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false, onConfirm, onCancel
}: Props) {
  return ReactDOM.createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      }}
    >
      <div className="animate-fade-in" style={{
        width:'100%', maxWidth:400,
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:16, padding:24, display:'flex', flexDirection:'column', gap:16,
      }}>
        {/* Icon + Title */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{
            width:40, height:40, borderRadius:12, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            background: danger ? 'rgba(248,113,113,.12)' : 'rgba(251,191,36,.12)',
          }}>
            {danger
              ? <Trash2 size={18} style={{ color:'var(--danger)' }}/>
              : <AlertTriangle size={18} style={{ color:'#fbbf24' }}/>
            }
          </div>
          <div>
            <p style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>{title}</p>
            <p style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.5 }}>{message}</p>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} className="btn-ghost flex-1 justify-center" style={{ justifyContent:'center' }}>
            <X size={14}/> {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              padding:'9px 18px', borderRadius:10, border:'none', cursor:'pointer',
              fontFamily:'Syne, sans-serif', fontWeight:600, fontSize:13,
              background: danger ? 'rgba(248,113,113,.15)' : 'var(--accent)',
              color: danger ? 'var(--danger)' : 'white',
              transition:'all .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            {danger ? <Trash2 size={14}/> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
