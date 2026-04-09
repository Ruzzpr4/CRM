-- ============================================================
-- ProspectCRM — Schema PostgreSQL (Supabase)
-- Baseado na estrutura do banco legado dados_crv (MySQL/MariaDB)
-- Modernizado: UUID, RLS, TIMESTAMPTZ, enums tipados, pg_trgm
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- GRUPOS / PERMISSÕES
-- ============================================================
CREATE TABLE public.grupos (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo     CHAR(1) NOT NULL UNIQUE,
  nome       VARCHAR(40) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'operador',
  situacao   BOOLEAN NOT NULL DEFAULT TRUE,
  is_super   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.grupos (codigo, nome, role, is_super) VALUES
  ('A','Administrador','admin',TRUE),
  ('S','Supervisor','supervisor',FALSE),
  ('O','Operador','operador',FALSE),
  ('C','Consultor','consultor',FALSE),
  ('V','Visualizador','visualizador',FALSE);

-- ============================================================
-- EQUIPES
-- ============================================================
CREATE TABLE public.equipes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo         VARCHAR(12) NOT NULL UNIQUE,
  nome           VARCHAR(40) NOT NULL,
  tipo           TEXT NOT NULL DEFAULT 'receptivo'
                 CHECK (tipo IN ('receptivo','ativo','recompra','site','distribuidor','outros')),
  coordenador_id UUID,
  situacao       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USUÁRIOS DO SISTEMA
-- ============================================================
CREATE TABLE public.usuarios (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       VARCHAR(100) NOT NULL,
  apelido    VARCHAR(30),
  email      VARCHAR(100) NOT NULL,
  telefone   VARCHAR(20),
  cpf        VARCHAR(14),
  cargo      VARCHAR(50),
  grupo_id   UUID REFERENCES public.grupos(id),
  equipe_id  UUID REFERENCES public.equipes(id),
  situacao   BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.equipes
  ADD CONSTRAINT fk_equipe_coord
  FOREIGN KEY (coordenador_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- ============================================================
-- CANAIS DE COMUNICAÇÃO
-- ============================================================
CREATE TABLE public.canais (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(40) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outro'
       CHECK (tipo IN ('whatsapp','linkedin','instagram','gmail','telefone','site','indicacao','outro')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.canais (nome, tipo) VALUES
  ('WhatsApp','whatsapp'),('LinkedIn','linkedin'),
  ('Instagram','instagram'),('Gmail','gmail'),
  ('Telefone Ativo','telefone'),('Telefone Receptivo','telefone'),
  ('Site','site'),('Indicação','indicacao');

-- ============================================================
-- CAMPANHAS
-- ============================================================
CREATE TABLE public.campanhas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  data_inicio DATE,
  data_fim    DATE,
  situacao    BOOLEAN NOT NULL DEFAULT TRUE,
  canal_id    UUID REFERENCES public.canais(id),
  criado_por  UUID REFERENCES public.usuarios(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLIENTES  (tabela principal — baseado em clientes + clientes_cigam)
-- ============================================================
CREATE TABLE public.clientes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificação
  nome              VARCHAR(100) NOT NULL,
  apelido           VARCHAR(30),
  tipo              CHAR(1) NOT NULL DEFAULT 'F' CHECK (tipo IN ('F','J')),
  sexo              CHAR(1) CHECK (sexo IN ('M','F','O')),
  estado_civil      TEXT CHECK (estado_civil IN ('solteiro','casado','divorciado','viuvo','outro')),
  data_nascimento   DATE,
  cpf               VARCHAR(14),
  rg                VARCHAR(20),
  cnpj              VARCHAR(18),

  -- Contato
  telefone1         VARCHAR(20) NOT NULL,
  tipo_telefone1    TEXT DEFAULT 'celular'
                    CHECK (tipo_telefone1 IN ('celular','fixo','comercial','whatsapp')),
  telefone2         VARCHAR(20),
  tipo_telefone2    TEXT CHECK (tipo_telefone2 IN ('celular','fixo','comercial','whatsapp')),
  email             VARCHAR(100),
  whatsapp          VARCHAR(20),

  -- Endereço
  cep               VARCHAR(9),
  endereco          VARCHAR(100),
  numero            VARCHAR(10),
  complemento       VARCHAR(60),
  bairro            VARCHAR(60),
  cidade            VARCHAR(60),
  estado            CHAR(2),
  pais              VARCHAR(30) DEFAULT 'Brasil',

  -- CRM
  situacao          TEXT NOT NULL DEFAULT 'ativo'
                    CHECK (situacao IN ('ativo','inativo','em_espera','arquivado','bloqueado')),
  canal_origem_id   UUID REFERENCES public.canais(id),
  campanha_id       UUID REFERENCES public.campanhas(id),
  consultor_id      UUID REFERENCES public.usuarios(id),
  indicado_por_id   UUID REFERENCES public.clientes(id),
  lead_quente       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Dados clínicos/comerciais (baseado em cli_sintomas, cli_restricao, cli_observacao)
  sintomas          TEXT,
  restricoes        TEXT,
  restricoes_obs    TEXT,
  observacao        TEXT,

  -- Financeiro
  limite_credito    NUMERIC(10,2) DEFAULT 0,
  desconto_padrao   NUMERIC(5,2)  DEFAULT 0,
  quer_nota_fiscal  BOOLEAN NOT NULL DEFAULT FALSE,

  -- LGPD
  consentimento_lgpd BOOLEAN NOT NULL DEFAULT FALSE,
  consentimento_at   TIMESTAMPTZ,

  -- Datas
  data_primeiro_contato DATE,
  data_ultimo_contato   TIMESTAMPTZ,
  data_ultima_compra    DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_cli_user       ON public.clientes(user_id);
CREATE INDEX idx_cli_cpf        ON public.clientes(cpf);
CREATE INDEX idx_cli_tel1       ON public.clientes(telefone1);
CREATE INDEX idx_cli_situacao   ON public.clientes(situacao);
CREATE INDEX idx_cli_hot        ON public.clientes(lead_quente);
CREATE INDEX idx_cli_updated    ON public.clientes(updated_at DESC);
CREATE INDEX idx_cli_nome_trgm  ON public.clientes USING gin(nome gin_trgm_ops);

-- ============================================================
-- CONSULTAS / AGENDAMENTOS
-- ============================================================
CREATE TABLE public.consultas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id      UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  consultor_id    UUID REFERENCES public.usuarios(id),

  data_hora       TIMESTAMPTZ NOT NULL,
  duracao_min     INT DEFAULT 60,
  tipo            TEXT NOT NULL DEFAULT 'consulta'
                  CHECK (tipo IN ('consulta','retorno','avaliacao','urgencia','ligacao','outro')),
  modalidade      TEXT NOT NULL DEFAULT 'presencial'
                  CHECK (modalidade IN ('presencial','online','telefone','domicilio')),
  local           TEXT,

  situacao        TEXT NOT NULL DEFAULT 'agendada'
                  CHECK (situacao IN ('agendada','confirmada','realizada','cancelada','faltou','reagendada')),
  motivo_cancelamento TEXT,
  motivo          TEXT,
  observacoes     TEXT,
  anotacoes_pos   TEXT,
  resultado       TEXT,

  -- Controle de alertas
  alerta_canal    TEXT DEFAULT 'whatsapp'
                  CHECK (alerta_canal IN ('whatsapp','sms','email','todos')),
  alerta_enviado_d2  BOOLEAN NOT NULL DEFAULT FALSE,
  alerta_enviado_d1  BOOLEAN NOT NULL DEFAULT FALSE,
  alerta_enviado_dia BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_cons_cliente  ON public.consultas(cliente_id);
CREATE INDEX idx_cons_data     ON public.consultas(data_hora);
CREATE INDEX idx_cons_sit      ON public.consultas(situacao);
CREATE INDEX idx_cons_user     ON public.consultas(user_id);
CREATE INDEX idx_cons_alertas  ON public.consultas(data_hora, alerta_enviado_d1, situacao);

-- ============================================================
-- HISTÓRICO DE CONTATOS  (baseado em captacao_historico + sac_acompanhamentos)
-- ============================================================
CREATE TABLE public.historico_contatos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id      UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  consulta_id     UUID REFERENCES public.consultas(id) ON DELETE SET NULL,

  tipo            TEXT NOT NULL DEFAULT 'mensagem'
                  CHECK (tipo IN ('mensagem','ligacao','email','reuniao','agendamento',
                    'cancelamento','reagendamento','webhook','nota','alerta_enviado')),
  canal_id        UUID REFERENCES public.canais(id),
  direcao         TEXT NOT NULL DEFAULT 'entrada'
                  CHECK (direcao IN ('entrada','saida')),
  conteudo        TEXT NOT NULL,
  resultado       TEXT,
  usuario_id      UUID REFERENCES public.usuarios(id),

  origem_webhook  BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_payload JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_hist_cliente  ON public.historico_contatos(cliente_id);
CREATE INDEX idx_hist_created  ON public.historico_contatos(created_at DESC);
CREATE INDEX idx_hist_user     ON public.historico_contatos(user_id);

-- ============================================================
-- CAPTAÇÃO / LEADS
-- ============================================================
CREATE TABLE public.captacao (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            VARCHAR(100),
  telefone        VARCHAR(20),
  telefone2       VARCHAR(20),
  email           VARCHAR(100),
  canal_id        UUID REFERENCES public.canais(id),
  campanha_id     UUID REFERENCES public.campanhas(id),

  situacao        TEXT NOT NULL DEFAULT 'novo'
                  CHECK (situacao IN ('novo','em_contato','agendado','convertido','perdido','sem_interesse')),
  num_contatos    INT NOT NULL DEFAULT 0,
  houve_venda     BOOLEAN NOT NULL DEFAULT FALSE,
  horario_contato VARCHAR(30),
  observacao      TEXT,
  convertido_em   UUID REFERENCES public.clientes(id),
  data_ultimo_contato TIMESTAMPTZ,

  origem_webhook  BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_canal   TEXT,
  webhook_payload JSONB,

  operador_id     UUID REFERENCES public.usuarios(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_cap_user    ON public.captacao(user_id);
CREATE INDEX idx_cap_sit     ON public.captacao(situacao);
CREATE INDEX idx_cap_tel     ON public.captacao(telefone);

-- ============================================================
-- TEMPLATES DE MENSAGEM
-- ============================================================
CREATE TABLE public.templates_mensagem (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       VARCHAR(100) NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'lembrete'
             CHECK (tipo IN ('lembrete_d2','lembrete_d1','lembrete_dia','boas_vindas','retorno','personalizado')),
  canal      TEXT NOT NULL DEFAULT 'whatsapp'
             CHECK (canal IN ('whatsapp','email','sms')),
  conteudo   TEXT NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONFIGURAÇÕES
-- ============================================================
CREATE TABLE public.configuracoes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  alerta_dias_antes    INT[] NOT NULL DEFAULT '{2,1}',
  alerta_hora_envio    TIME NOT NULL DEFAULT '08:00',
  alerta_canal_padrao  TEXT NOT NULL DEFAULT 'whatsapp'
                       CHECK (alerta_canal_padrao IN ('whatsapp','email','sms','todos')),
  webhook_secret       VARCHAR(100),
  webhook_ativo        BOOLEAN NOT NULL DEFAULT FALSE,
  n8n_url              TEXT,
  whatsapp_numero      VARCHAR(20),
  timezone             VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_cli_upd   BEFORE UPDATE ON public.clientes              FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cons_upd  BEFORE UPDATE ON public.consultas             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cap_upd   BEFORE UPDATE ON public.captacao              FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_usr_upd   BEFORE UPDATE ON public.usuarios              FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cfg_upd   BEFORE UPDATE ON public.configuracoes         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.criar_config_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.configuracoes (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_novo_usuario
  AFTER INSERT ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.criar_config_usuario();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captacao           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_mensagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canais             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cli_s" ON public.clientes FOR SELECT  USING (auth.uid()=user_id);
CREATE POLICY "cli_i" ON public.clientes FOR INSERT  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "cli_u" ON public.clientes FOR UPDATE  USING (auth.uid()=user_id);
CREATE POLICY "cli_d" ON public.clientes FOR DELETE  USING (auth.uid()=user_id);

CREATE POLICY "con_s" ON public.consultas FOR SELECT  USING (auth.uid()=user_id);
CREATE POLICY "con_i" ON public.consultas FOR INSERT  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "con_u" ON public.consultas FOR UPDATE  USING (auth.uid()=user_id);
CREATE POLICY "con_d" ON public.consultas FOR DELETE  USING (auth.uid()=user_id);

CREATE POLICY "hist_s" ON public.historico_contatos FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "hist_i" ON public.historico_contatos FOR INSERT WITH CHECK (auth.uid()=user_id);

CREATE POLICY "cap_s" ON public.captacao FOR SELECT  USING (auth.uid()=user_id);
CREATE POLICY "cap_i" ON public.captacao FOR INSERT  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "cap_u" ON public.captacao FOR UPDATE  USING (auth.uid()=user_id);
CREATE POLICY "cap_d" ON public.captacao FOR DELETE  USING (auth.uid()=user_id);

CREATE POLICY "cfg_s" ON public.configuracoes FOR SELECT  USING (auth.uid()=user_id);
CREATE POLICY "cfg_i" ON public.configuracoes FOR INSERT  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "cfg_u" ON public.configuracoes FOR UPDATE  USING (auth.uid()=user_id);

CREATE POLICY "tpl_all" ON public.templates_mensagem FOR ALL USING (auth.uid()=user_id);

CREATE POLICY "usr_s" ON public.usuarios FOR SELECT  USING (auth.uid()=id);
CREATE POLICY "usr_i" ON public.usuarios FOR INSERT  WITH CHECK (auth.uid()=id);
CREATE POLICY "usr_u" ON public.usuarios FOR UPDATE  USING (auth.uid()=id);

CREATE POLICY "lookup_canais"   ON public.canais    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "lookup_grupos"   ON public.grupos    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "lookup_equipes"  ON public.equipes   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "camp_r" ON public.campanhas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "camp_w" ON public.campanhas FOR ALL   USING (auth.uid()=criado_por);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.historico_contatos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.captacao;

-- ============================================================
-- VIEW: agenda com dados do cliente
-- ============================================================
CREATE OR REPLACE VIEW public.v_agenda AS
SELECT
  c.id, c.data_hora, c.tipo, c.modalidade, c.situacao,
  c.alerta_enviado_d1, c.alerta_enviado_d2, c.alerta_enviado_dia,
  c.alerta_canal, c.observacoes, c.local, c.user_id,
  cl.id        AS cliente_id,
  cl.nome      AS cliente_nome,
  cl.telefone1 AS cliente_telefone,
  cl.whatsapp  AS cliente_whatsapp,
  cl.email     AS cliente_email,
  cl.situacao  AS cliente_situacao,
  u.nome       AS consultor_nome
FROM public.consultas c
JOIN public.clientes cl ON cl.id = c.cliente_id
LEFT JOIN public.usuarios u ON u.id = c.consultor_id
WHERE c.situacao NOT IN ('cancelada','realizada');

-- ============================================================
-- VENDEDORES  (baseado em crv_funcionario)
-- ============================================================
CREATE TABLE public.vendedores (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                VARCHAR(100) NOT NULL,
  apelido             VARCHAR(30),
  cpf                 VARCHAR(14),
  rg                  VARCHAR(20),
  email               VARCHAR(100),
  telefone1           VARCHAR(20),
  telefone2           VARCHAR(20),

  cargo               TEXT NOT NULL DEFAULT 'vendedor'
                      CHECK (cargo IN ('vendedor','supervisor','gerente','diretor','outro')),
  turno               TEXT CHECK (turno IN ('manha','tarde','noite','integral','outro')),
  equipe              VARCHAR(50),
  coordenador_id      UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,

  data_admissao       DATE,
  data_desligamento   DATE,
  situacao            BOOLEAN NOT NULL DEFAULT TRUE,

  tipo_comissao       TEXT CHECK (tipo_comissao IN ('venda_total','parcelas')),
  percentual_comissao NUMERIC(5,2) DEFAULT 0,

  observacoes         TEXT,
  foto_url            TEXT,

  endereco            VARCHAR(100),
  cidade              VARCHAR(60),
  estado              CHAR(2),
  cep                 VARCHAR(9),

  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vend_user    ON public.vendedores(user_id);
CREATE INDEX idx_vend_sit     ON public.vendedores(situacao);
CREATE INDEX idx_vend_cargo   ON public.vendedores(cargo);

ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vend_s" ON public.vendedores FOR SELECT  USING (auth.uid()=user_id);
CREATE POLICY "vend_i" ON public.vendedores FOR INSERT  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "vend_u" ON public.vendedores FOR UPDATE  USING (auth.uid()=user_id);
CREATE POLICY "vend_d" ON public.vendedores FOR DELETE  USING (auth.uid()=user_id);

CREATE TRIGGER trg_vend_upd BEFORE UPDATE ON public.vendedores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Adicionar vendedor_id à tabela consultas
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cons_vendedor ON public.consultas(vendedor_id);

-- Índice único para evitar double-booking: mesmo vendedor, mesmo horário
-- Validação a nível de aplicação + índice de busca rápida
CREATE INDEX idx_cons_vendedor_data ON public.consultas(vendedor_id, data_hora)
  WHERE situacao NOT IN ('cancelada','faltou');

-- ============================================================
-- METAS  (baseado em metas + metas_historico)
-- ============================================================
CREATE TABLE public.metas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendedor_id       UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  periodo           DATE NOT NULL,   -- primeiro dia do mês: 2024-01-01 = Jan/2024

  meta_dia          INT NOT NULL DEFAULT 0,
  meta_mes          INT NOT NULL DEFAULT 0,
  meta_valor        NUMERIC(12,2) NOT NULL DEFAULT 0,

  realizado_mes     INT NOT NULL DEFAULT 0,
  realizado_valor   NUMERIC(12,2) NOT NULL DEFAULT 0,

  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (vendedor_id, periodo)
);

CREATE INDEX idx_metas_user       ON public.metas(user_id);
CREATE INDEX idx_metas_vendedor   ON public.metas(vendedor_id);
CREATE INDEX idx_metas_periodo    ON public.metas(periodo DESC);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metas_s" ON public.metas FOR SELECT  USING (auth.uid()=user_id);
CREATE POLICY "metas_i" ON public.metas FOR INSERT  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "metas_u" ON public.metas FOR UPDATE  USING (auth.uid()=user_id);
CREATE POLICY "metas_d" ON public.metas FOR DELETE  USING (auth.uid()=user_id);

CREATE TRIGGER trg_metas_upd BEFORE UPDATE ON public.metas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Adicionar à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendedores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.metas;

-- ============================================================
-- PRODUTOS ESTOQUE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.produtos_estoque (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo          VARCHAR(50),
  nome            VARCHAR(150) NOT NULL,
  descricao       TEXT,
  categoria       VARCHAR(80),
  unidade         TEXT NOT NULL DEFAULT 'un'
                  CHECK (unidade IN ('un','cx','kg','g','l','ml','par','pct')),
  quantidade      NUMERIC(10,2) NOT NULL DEFAULT 0,
  estoque_minimo  NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_custo     NUMERIC(12,2),
  preco_venda     NUMERIC(12,2),
  fornecedor      VARCHAR(100),
  localizacao     VARCHAR(60),
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prod_user   ON public.produtos_estoque(user_id);
CREATE INDEX IF NOT EXISTS idx_prod_ativo  ON public.produtos_estoque(ativo);
ALTER TABLE public.produtos_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_s" ON public.produtos_estoque FOR SELECT  USING (auth.uid()=user_id);
CREATE POLICY "prod_i" ON public.produtos_estoque FOR INSERT  WITH CHECK (auth.uid()=user_id);
CREATE POLICY "prod_u" ON public.produtos_estoque FOR UPDATE  USING (auth.uid()=user_id);
CREATE POLICY "prod_d" ON public.produtos_estoque FOR DELETE  USING (auth.uid()=user_id);
CREATE OR REPLACE TRIGGER trg_prod_upd BEFORE UPDATE ON public.produtos_estoque FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- MOVIMENTOS ESTOQUE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.movimentos_estoque (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id          UUID NOT NULL REFERENCES public.produtos_estoque(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','devolucao')),
  quantidade          NUMERIC(10,2) NOT NULL,
  quantidade_anterior NUMERIC(10,2) NOT NULL,
  quantidade_nova     NUMERIC(10,2) NOT NULL,
  motivo              TEXT,
  referencia          VARCHAR(100),
  usuario_id          UUID REFERENCES auth.users(id),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mov_produto ON public.movimentos_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_user    ON public.movimentos_estoque(user_id);
ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_s" ON public.movimentos_estoque FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "mov_i" ON public.movimentos_estoque FOR INSERT WITH CHECK (auth.uid()=user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos_estoque;

-- ============================================================
-- FUNCIONARIOS (perfis de acesso)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.funcionarios (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  email       VARCHAR(100) NOT NULL,
  telefone    VARCHAR(20),
  role        TEXT NOT NULL DEFAULT 'vendedor'
              CHECK (role IN ('admin','supervisor','vendedor','estoque','visualizador')),
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  owner_id    UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_func_owner  ON public.funcionarios(owner_id);
CREATE INDEX IF NOT EXISTS idx_func_userid ON public.funcionarios(user_id);
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
-- Admin vê todos os funcionários da sua org
CREATE POLICY "func_s" ON public.funcionarios FOR SELECT  USING (auth.uid()=owner_id OR auth.uid()=user_id);
CREATE POLICY "func_i" ON public.funcionarios FOR INSERT  WITH CHECK (auth.uid()=owner_id);
CREATE POLICY "func_u" ON public.funcionarios FOR UPDATE  USING (auth.uid()=owner_id);
CREATE POLICY "func_d" ON public.funcionarios FOR DELETE  USING (auth.uid()=owner_id);
CREATE OR REPLACE TRIGGER trg_func_upd BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
