export type EstoqueMovTipo = 'entrada' | 'saida' | 'ajuste' | 'devolucao'
export type EstoqueUnidade = 'un' | 'cx' | 'kg' | 'g' | 'l' | 'ml' | 'par' | 'pct'

export interface ProdutoEstoque {
  id: string
  created_at: string
  updated_at: string

  codigo?: string          // código interno / SKU
  nome: string
  descricao?: string
  categoria?: string
  unidade: EstoqueUnidade

  quantidade: number       // estoque atual
  estoque_minimo: number   // alerta quando abaixo
  preco_custo?: number
  preco_venda?: number

  fornecedor?: string
  localizacao?: string     // ex: "Prateleira A3"
  ativo: boolean
  user_id: string
}

export interface MovimentoEstoque {
  id: string
  created_at: string
  produto_id: string
  tipo: EstoqueMovTipo
  quantidade: number
  quantidade_anterior: number
  quantidade_nova: number
  motivo?: string
  referencia?: string      // ex: número de pedido
  usuario_id?: string
  user_id: string
  produto?: ProdutoEstoque
}

export const UNIDADE_LABELS: Record<EstoqueUnidade, string> = {
  un:'Unidade', cx:'Caixa', kg:'Kg', g:'Gramas', l:'Litros', ml:'mL', par:'Par', pct:'Pacote'
}

export const MOV_TIPO_LABELS: Record<EstoqueMovTipo, string> = {
  entrada:'Entrada', saida:'Saída', ajuste:'Ajuste', devolucao:'Devolução'
}

export const MOV_TIPO_COLORS: Record<EstoqueMovTipo, string> = {
  entrada:   'text-emerald-400',
  saida:     'text-red-400',
  ajuste:    'text-amber-400',
  devolucao: 'text-blue-400',
}
