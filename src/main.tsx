import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Limpa dados de sessões mock anteriores
const mockKeys = ['crm_clientes','crm_consultas','crm_historico','crm_captacao',
                  'crm_vendedores','crm_metas','crm_produtos','crm_movimentos',
                  'crm_funcionarios','crm_mock_auth']
mockKeys.forEach(k => localStorage.removeItem(k))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
