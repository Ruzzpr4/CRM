// Tipos de Vendedor e Metas — baseado em crv_funcionario e metas do banco legado

export type VendedorCargo = 'vendedor' | 'supervisor' | 'gerente' | 'diretor' | 'outro'
export type VendedorTurno = 'manha' | 'tarde' | 'noite' | 'integral' | 'outro'

export interface Vendedor {
  id: string
  created_at: string
  updated_at: string

  nome: string
  apelido?: string
  cpf?: string
  rg?: string
  email?: string
  telefone1?: string
  telefone2?: string

  cargo: VendedorCargo
  turno?: VendedorTurno
  equipe?: string
  coordenador_id?: string  // ID de outro vendedor supervisor

  data_admissao?: string
  data_desligamento?: string
  situacao: boolean        // true = ativo

  // Comissão (baseado em tpcalccomissao)
  tipo_comissao?: 'venda_total' | 'parcelas'
  percentual_comissao?: number

  observacoes?: string
  foto_url?: string

  // Endereço
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string

  user_id: string
}

export interface Meta {
  id: string
  created_at: string
  updated_at: string

  vendedor_id: string
  periodo: string          // '2024-01-01' = Janeiro/2024 (primeiro dia do mês)

  // Metas (baseado em mt_qtd_dia, mt_qtd_mes)
  meta_dia: number         // meta de atendimentos por dia
  meta_mes: number         // meta de atendimentos por mês
  meta_valor: number       // meta financeira/vendas do mês

  // Realizado
  realizado_mes: number
  realizado_valor: number

  user_id: string

  // joined
  vendedor?: Vendedor
}

export const CARGO_LABELS: Record<VendedorCargo, string> = {
  vendedor: 'Vendedor', supervisor: 'Supervisor', gerente: 'Gerente',
  diretor: 'Diretor', outro: 'Outro',
}

export const TURNO_LABELS: Record<VendedorTurno, string> = {
  manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral', outro: 'Outro',
}
