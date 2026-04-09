import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import ReactDOM from 'react-dom'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type TType = 'success'|'error'|'warning'|'info'
interface T { id: string; type: TType; msg: string; out?: boolean }
interface Ctx { toast: Record<TType, (m: string) => void> }

const Ctx = createContext<Ctx>({ toast: { success:()=>{}, error:()=>{}, warning:()=>{}, info:()=>{} } })
const ICONS = { success:<CheckCircle2 size={15}/>, error:<XCircle size={15}/>, warning:<AlertTriangle size={15}/>, info:<Info size={15}/> }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<T[]>([])
  const remove = useCallback((id: string) => {
    setToasts(p => p.map(t => t.id === id ? { ...t, out: true } : t))
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 240)
  }, [])
  const add = useCallback((type: TType, msg: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(p => [...p.slice(-4), { id, type, msg }])
    setTimeout(() => remove(id), 4000)
  }, [remove])
  const toast = { success:(m:string)=>add('success',m), error:(m:string)=>add('error',m), warning:(m:string)=>add('warning',m), info:(m:string)=>add('info',m) }
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && ReactDOM.createPortal(
        <div className="toast-wrap">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type} ${t.out ? 'out' : ''}`}>
              {ICONS[t.type]}
              <span style={{ flex:1 }}>{t.msg}</span>
              <button onClick={() => remove(t.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'inherit',opacity:.5,display:'flex',alignItems:'center' }}><X size={13}/></button>
            </div>
          ))}
        </div>, document.body
      )}
    </Ctx.Provider>
  )
}
export const useToast = () => useContext(Ctx)
