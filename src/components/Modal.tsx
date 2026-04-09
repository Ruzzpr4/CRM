import { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  maxWidth?: string | number  // string: "max-w-md" / number: 580 (px)
  children: React.ReactNode
  footer?: React.ReactNode
}

const STR_WIDTHS: Record<string, number> = {
  'max-w-sm': 384, 'max-w-md': 448, 'max-w-lg': 512,
  'max-w-xl': 580, 'max-w-2xl': 672, 'max-w-3xl': 768,
}

export default function Modal({ title, onClose, maxWidth = 580, children, footer }: Props) {
  const maxW = typeof maxWidth === 'string' ? (STR_WIDTHS[maxWidth] ?? 580) : maxWidth

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const modal = (
    <div
      // Outside click intentionally disabled — use X button or Escape
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '32px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: maxW,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          marginBottom: 32,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            display: 'flex', gap: 12, padding: '16px 20px',
            borderTop: '1px solid var(--border)', flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return ReactDOM.createPortal(modal, document.body)
}
