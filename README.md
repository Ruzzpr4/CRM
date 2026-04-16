# Projeto CRM

CRM em versão de MVP com caixa de entrada unificada, leads quentes, com futura integração com webhook com n8n / Google Sheets.

---

## Pré-requisitos

- Node.js 18+
- Conta gratuita no [Supabase](https://supabase.com)
- Conta gratuita no [Vercel](https://vercel.com) (para deploy)

---

## Configuração Passo a Passo

### 1. Clonar e instalar

```bash
git clone <seu-repo>
cd crm-prospect
npm install
```

### 2. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → New Project
2. Anote o **Project URL** e **anon key** (Settings → API)

### 3. Criar as tabelas (banco de dados)

1. No painel Supabase → SQL Editor → New Query
2. Cole o conteúdo de `supabase/schema.sql`
3. Clique em **Run**


