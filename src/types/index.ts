export type ClienteSituacao = 'ativo' | 'inativo' | 'em_espera' | 'arquivado' | 'bloqueado'
export type ClienteTipo = 'F' | 'J'
export type TelTipo = 'celular' | 'fixo' | 'comercial' | 'whatsapp'
export type EstadoCivil = 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro'
export type ConsultaSituacao = 'agendada' | 'confirmada' | 'realizada' | 'cancelada' | 'faltou' | 'reagendada'
export type ConsultaTipo = 'consulta' | 'retorno' | 'avaliacao' | 'urgencia' | 'ligacao' | 'outro'
export type ConsultaModalidade = 'presencial' | 'online' | 'telefone' | 'domicilio'
export type CaptacaoSituacao = 'novo' | 'em_contato' | 'agendado' | 'convertido' | 'perdido' | 'sem_interesse'
export type CanalTipo = 'whatsapp' | 'linkedin' | 'instagram' | 'gmail' | 'telefone' | 'site' | 'indicacao' | 'outro'
export type HistoricoTipo = 'mensagem' | 'ligacao' | 'email' | 'reuniao' | 'agendamento' | 'cancelamento' | 'reagendamento' | 'webhook' | 'nota' | 'alerta_enviado'
export type AlertaCanal = 'whatsapp' | 'sms' | 'email' | 'todos'

export interface Cliente {
  id: string; created_at: string; updated_at: string
  nome: string; apelido?: string; tipo: ClienteTipo
  sexo?: 'M' | 'F' | 'O'; estado_civil?: EstadoCivil
  data_nascimento?: string; cpf?: string; rg?: string; cnpj?: string
  telefone1: string; tipo_telefone1: TelTipo
  telefone2?: string; tipo_telefone2?: TelTipo
  email?: string; whatsapp?: string
  cep?: string; endereco?: string; numero?: string; complemento?: string
  bairro?: string; cidade?: string; estado?: string; pais?: string
  situacao: ClienteSituacao
  canal_origem?: CanalTipo
  consultor_id?: string; indicado_por_id?: string; lead_quente: boolean
  sintomas?: string; restricoes?: string; restricoes_obs?: string; observacao?: string
  limite_credito?: number; desconto_padrao?: number
  quer_nota_fiscal?: boolean; consentimento_lgpd?: boolean
  data_primeiro_contato?: string; data_ultimo_contato?: string; data_ultima_compra?: string
  user_id: string
}

export interface Consulta {
  id: string; created_at: string; updated_at: string
  cliente_id: string; consultor_id?: string; vendedor_id?: string
  data_hora: string; duracao_min: number
  tipo: ConsultaTipo; modalidade: ConsultaModalidade; local?: string
  situacao: ConsultaSituacao; motivo_cancelamento?: string
  motivo?: string; observacoes?: string; anotacoes_pos?: string; resultado?: string
  alerta_canal: AlertaCanal
  alerta_enviado_d2: boolean; alerta_enviado_d1: boolean; alerta_enviado_dia: boolean
  user_id: string; cliente?: Cliente
}

export interface HistoricoContato {
  id: string; created_at: string
  cliente_id: string; consulta_id?: string
  tipo: HistoricoTipo; canal?: CanalTipo
  direcao: 'entrada' | 'saida'
  conteudo: string; resultado?: string
  usuario_id?: string; origem_webhook: boolean
  user_id: string; cliente?: Cliente
}

export interface Captacao {
  id: string; created_at: string; updated_at: string
  nome?: string; telefone?: string; telefone2?: string; email?: string
  canal?: CanalTipo; situacao: CaptacaoSituacao
  num_contatos: number; houve_venda: boolean
  horario_contato?: string; observacao?: string
  convertido_em?: string; data_ultimo_contato?: string
  origem_webhook: boolean; webhook_canal?: CanalTipo
  user_id: string
}

export const SIT_CLI_LABEL: Record<ClienteSituacao, string> = {
  ativo:'Ativo', inativo:'Inativo', em_espera:'Em Espera', arquivado:'Arquivado', bloqueado:'Bloqueado'
}
export const SIT_CLI_COLOR: Record<ClienteSituacao, string> = {
  ativo:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inativo:'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  em_espera:'bg-amber-500/15 text-amber-400 border-amber-500/30',
  arquivado:'bg-slate-500/15 text-slate-400 border-slate-500/30',
  bloqueado:'bg-red-500/15 text-red-400 border-red-500/30',
}
export const SIT_CONS_LABEL: Record<ConsultaSituacao, string> = {
  agendada:'Agendada', confirmada:'Confirmada', realizada:'Realizada',
  cancelada:'Cancelada', faltou:'Faltou', reagendada:'Reagendada'
}
export const SIT_CONS_COLOR: Record<ConsultaSituacao, string> = {
  agendada:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  confirmada:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  realizada:'bg-violet-500/15 text-violet-400 border-violet-500/30',
  cancelada:'bg-red-500/15 text-red-400 border-red-500/30',
  faltou:'bg-orange-500/15 text-orange-400 border-orange-500/30',
  reagendada:'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
}
export const SIT_CAP_LABEL: Record<CaptacaoSituacao, string> = {
  novo:'Novo', em_contato:'Em Contato', agendado:'Agendado',
  convertido:'Convertido', perdido:'Perdido', sem_interesse:'Sem Interesse'
}
export const SIT_CAP_COLOR: Record<CaptacaoSituacao, string> = {
  novo:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  em_contato:'bg-amber-500/15 text-amber-400 border-amber-500/30',
  agendado:'bg-violet-500/15 text-violet-400 border-violet-500/30',
  convertido:'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  perdido:'bg-red-500/15 text-red-400 border-red-500/30',
  sem_interesse:'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}
export const CANAL_LABEL: Record<CanalTipo, string> = {
  whatsapp:'WhatsApp', linkedin:'LinkedIn', instagram:'Instagram',
  gmail:'Gmail', telefone:'Telefone', site:'Site', indicacao:'Indicação', outro:'Outro'
}
export const CANAL_COLOR: Record<CanalTipo, string> = {
  whatsapp:'#25D366', linkedin:'#0A66C2', instagram:'#E1306C',
  gmail:'#EA4335', telefone:'#8b87b8', site:'#4f56f7', indicacao:'#f59e0b', outro:'#6b7280'
}
export const HIST_TIPO_LABEL: Record<HistoricoTipo, string> = {
  mensagem:'Mensagem', ligacao:'Ligação', email:'E-mail', reuniao:'Reunião',
  agendamento:'Agendamento', cancelamento:'Cancelamento', reagendamento:'Reagendamento',
  webhook:'Webhook', nota:'Nota', alerta_enviado:'Alerta Enviado'
}
export const CONS_TIPO_LABEL: Record<ConsultaTipo, string> = {
  consulta:'Consulta', retorno:'Retorno', avaliacao:'Avaliação',
  urgencia:'Urgência', ligacao:'Ligação', outro:'Outro'
}
