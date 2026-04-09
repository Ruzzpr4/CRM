import { Cliente, Consulta, HistoricoContato, Captacao } from '../types'
import { Vendedor } from '../types/vendedor'
import { Meta } from '../types/vendedor'

export const MOCK_USER = {
  id: 'mock-user-001',
  email: 'voce@empresa.com',
  user_metadata: { name: 'Usuário Demo' },
}

// Todos vazios — o sistema começa limpo
export const MOCK_CLIENTES: Cliente[] = []
export const MOCK_CONSULTAS: Consulta[] = []
export const MOCK_HISTORICO: HistoricoContato[] = []
export const MOCK_CAPTACAO: Captacao[] = []
export const MOCK_VENDEDORES: Vendedor[] = []
export const MOCK_METAS: Meta[] = []
