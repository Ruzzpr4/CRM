-- ============================================================
-- MIGRATION — Rodar APENAS se já executou o schema_novo_crm.sql antes
-- Adiciona: vendedores, metas e campo vendedor_id na agenda
-- ============================================================

-- VENDEDORES
CREATE TABLE IF NOT EXISTS public.vendedores (
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

CREATE INDEX IF NOT EXISTS idx_vend_user  ON public.vendedores(user_id);
CREATE INDEX IF NOT EXISTS idx_vend_sit   ON public.vendedores(situacao);
CREATE INDEX IF NOT EXISTS idx_vend_cargo ON public.vendedores(cargo);

ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vend_s" ON public.vendedores;
DROP POLICY IF EXISTS "vend_i" ON public.vendedores;
DROP POLICY IF EXISTS "vend_u" ON public.vendedores;
DROP POLICY IF EXISTS "vend_d" ON public.vendedores;

CREATE POLICY "vend_s" ON public.vendedores FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "vend_i" ON public.vendedores FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vend_u" ON public.vendedores FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "vend_d" ON public.vendedores FOR DELETE  USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_vend_upd
  BEFORE UPDATE ON public.vendedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Campo vendedor_id na tabela consultas
ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cons_vendedor      ON public.consultas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_cons_vendedor_data ON public.consultas(vendedor_id, data_hora)
  WHERE situacao NOT IN ('cancelada','faltou');

-- METAS
CREATE TABLE IF NOT EXISTS public.metas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendedor_id     UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  periodo         DATE NOT NULL,
  meta_dia        INT NOT NULL DEFAULT 0,
  meta_mes        INT NOT NULL DEFAULT 0,
  meta_valor      NUMERIC(12,2) NOT NULL DEFAULT 0,
  realizado_mes   INT NOT NULL DEFAULT 0,
  realizado_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendedor_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_metas_user     ON public.metas(user_id);
CREATE INDEX IF NOT EXISTS idx_metas_vendedor ON public.metas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_metas_periodo  ON public.metas(periodo DESC);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_s" ON public.metas;
DROP POLICY IF EXISTS "metas_i" ON public.metas;
DROP POLICY IF EXISTS "metas_u" ON public.metas;
DROP POLICY IF EXISTS "metas_d" ON public.metas;

CREATE POLICY "metas_s" ON public.metas FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "metas_i" ON public.metas FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "metas_u" ON public.metas FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "metas_d" ON public.metas FOR DELETE  USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_metas_upd
  BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendedores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.metas;
