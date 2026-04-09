import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
type Theme = 'dark' | 'light'
interface Ctx { theme: Theme; toggleTheme: () => void }
const ThemeContext = createContext<Ctx>({ theme: 'dark', toggleTheme: () => {} })
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('crm_theme') as Theme) || 'dark')
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('crm_theme', theme) }, [theme])
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)
