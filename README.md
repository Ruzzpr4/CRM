# 🚀 ProspectCRM

CRM profissional com caixa de entrada unificada, leads quentes, pipeline kanban e integração via webhook com n8n / Google Sheets.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + Vite + TypeScript |
| Estilo | Tailwind CSS |
| Auth + DB | Supabase (PostgreSQL + RLS + Auth) |
| Realtime | Supabase Realtime |
| Webhook | Supabase Edge Functions (Deno) |
| Deploy Frontend | Vercel |
| Deploy Backend | Supabase (incluso) |

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

Isso cria automaticamente:
- Tabela `contacts` com todos os campos do CRM
- Tabela `messages` para histórico
- Tabela `activities` para log
- **Row Level Security** em todas as tabelas (cada usuário vê só seus dados)
- Índices de performance
- Realtime habilitado

### 4. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_WEBHOOK_SECRET=gere-uma-senha-forte-aqui-ex-abc123xyz789
```

> 💡 Para gerar um secret seguro: `openssl rand -hex 32`

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:5173

### 6. Deploy da Edge Function (webhook)

Instale o CLI do Supabase:

```bash
npm install -g supabase
```

Faça login e link ao projeto:

```bash
supabase login
supabase link --project-ref seu-project-ref
```

Defina os secrets da function:

```bash
supabase secrets set WEBHOOK_SECRET=sua-senha-do-webhook
supabase secrets set DEFAULT_USER_ID=uuid-do-usuario-admin
```

> O `DEFAULT_USER_ID` é o UUID do usuário que vai receber os leads.
> Você pode ver o UUID após criar a conta no CRM em: Supabase → Authentication → Users

Deploy da function:

```bash
supabase functions deploy webhook-crm
```

A URL do webhook será:
```
https://xxxxxxxxxxxx.supabase.co/functions/v1/webhook-crm
```

### 7. Deploy do frontend no Vercel

```bash
npm run build
```

No Vercel:
1. Importe o repositório
2. Configure as variáveis de ambiente (as mesmas do `.env`)
3. Deploy automático!

---

## Integração com n8n

### Configuração no Google Sheets

1. No Google Sheets com os leads, vá em Extensões → Apps Script
2. Cole este código:

```javascript
function onEdit(e) {
  const sheet = e.source.getActiveSheet()
  const row = e.range.getRow()
  if (row <= 1) return // ignora cabeçalho

  const nome    = sheet.getRange(row, 1).getValue()
  const empresa = sheet.getRange(row, 2).getValue()
  const email   = sheet.getRange(row, 6).getValue()
  const tel     = sheet.getRange(row, 7).getValue()

  const payload = {
    secret: "SEU_WEBHOOK_SECRET",
    canal: "linkedin", // ajuste conforme a planilha
    nome: nome,
    empresa: empresa,
    email: email,
    telefone: tel,
    etapa: "mensagem_respondida"
  }

  UrlFetchApp.fetch("URL_DO_WEBHOOK", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  })
}
```

### Configuração no n8n

1. Crie um fluxo n8n
2. Node: **Google Sheets Trigger** (evento: Row Added)
3. Node: **HTTP Request**
   - Method: POST
   - URL: `https://xxxxxxxxxxxx.supabase.co/functions/v1/webhook-crm`
   - Body (JSON):
   ```json
   {
     "secret": "{{ $env.WEBHOOK_CRM_SECRET }}",
     "canal": "{{ $json.canal }}",
     "nome": "{{ $json.nome }}",
     "empresa": "{{ $json.empresa }}",
     "email": "{{ $json.email }}",
     "telefone": "{{ $json.telefone }}",
     "etapa": "mensagem_respondida"
   }
   ```

---

## Funcionalidades

| Feature | Status |
|---------|--------|
| Login / Cadastro | ✅ |
| Dashboard com métricas | ✅ |
| Caixa unificada por canal | ✅ |
| Lista de contatos com filtros | ✅ |
| Leads quentes com ranking | ✅ |
| Pipeline Kanban (drag & drop) | ✅ |
| Criar / editar / deletar contatos | ✅ |
| Realtime (atualização instantânea) | ✅ |
| Webhook para n8n | ✅ |
| Row Level Security | ✅ |
| Deduplicação por e-mail | ✅ |

---

## Segurança

- **RLS** ativo em todas as tabelas — impossível vazar dados entre usuários
- **JWT** com expiração automática via Supabase Auth
- **Webhook secret** validado server-side na Edge Function
- **Service Role Key** nunca exposta no frontend
- Todas as variáveis sensíveis em `.env` (nunca commitadas)

---

## Estrutura de Arquivos

```
crm-prospect/
├── src/
│   ├── pages/
│   │   ├── Login.tsx          # Tela de login/cadastro
│   │   ├── Dashboard.tsx      # Métricas gerais
│   │   ├── Inbox.tsx          # Caixa unificada por canal
│   │   ├── Contacts.tsx       # Lista completa de contatos
│   │   ├── HotLeads.tsx       # Leads quentes / ranking
│   │   ├── Pipeline.tsx       # Kanban drag & drop
│   │   └── Settings.tsx       # Webhook config + segurança
│   ├── components/
│   │   ├── Layout.tsx         # Sidebar + topbar
│   │   ├── ContactCard.tsx    # Card de contato
│   │   └── ContactModal.tsx   # Modal criar/editar
│   ├── hooks/
│   │   └── useContacts.ts     # CRUD + realtime
│   ├── contexts/
│   │   └── AuthContext.tsx    # Auth state global
│   ├── lib/
│   │   └── supabase.ts        # Cliente Supabase
│   └── types/
│       └── index.ts           # Tipos TypeScript
├── supabase/
│   ├── schema.sql             # Banco + RLS + índices
│   └── functions/
│       └── webhook-crm/
│           └── index.ts       # Edge Function webhook
└── .env.example
```
