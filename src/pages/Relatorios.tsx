import { useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { FileText, Download, TrendingUp, TrendingDown, Award, Users, Clock, Package, Search, Filter, Calendar, ChevronDown, CheckCircle, Loader } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '../contexts/ToastContext'

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtDate(d: string) { return format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy') }

type RelType = 'vendas' | 'pedidos' | 'comissoes' | 'financeiro' | 'clientes' | 'ponto' | 'estoque'

const RELATORIOS: { id: RelType; label: string; desc: string; icon: any; color: string }[] = [
  { id: 'vendas',     label: 'Vendas',       desc: 'Vendas por período, vendedor e status',           icon: TrendingUp,    color: '#34d399' },
  { id: 'pedidos',    label: 'Pedidos',       desc: 'Pedidos com itens, valores e status',             icon: Package,       color: '#60a5fa' },
  { id: 'comissoes',  label: 'Comissões',     desc: 'Comissões por vendedor, período e status',        icon: Award,         color: '#f59e0b' },
  { id: 'financeiro', label: 'Financeiro',    desc: 'Contas a pagar e receber com saldos',             icon: TrendingDown,  color: '#a78bfa' },
  { id: 'clientes',   label: 'Clientes',      desc: 'Base de clientes com histórico e canal',          icon: Users,         color: '#fb923c' },
  { id: 'ponto',      label: 'Ponto',         desc: 'Banco de horas e registros por funcionário',      icon: Clock,         color: '#38bdf8' },
  { id: 'estoque',    label: 'Estoque',       desc: 'Produtos, saldos e movimentações',                icon: Package,       color: '#4ade80' },
]

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(rows: any[], cols: { key: string; label: string }[], filename: string) {
  const header = cols.map(c => c.label).join(';')
  const body = rows.map(r => cols.map(c => {
    const v = r[c.key] ?? ''
    return typeof v === 'string' && v.includes(';') ? `"${v}"` : v
  }).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ─── PDF Export via print ─────────────────────────────────────────────────────
function exportPDF(title: string, subtitle: string, headers: string[], rows: string[][], totals?: string[]) {
  const html = `
    <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 32px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1a1a1a; }
      .header-left h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
      .header-left p { font-size: 11px; color: #666; margin-top: 3px; }
      .header-right { text-align: right; font-size: 10px; color: #888; }
      .logo { font-size: 14px; font-weight: 800; letter-spacing: -1px; color: #7c3aed; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #0f172a; color: #fff; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; }
      td { padding: 7px 10px; font-size: 10px; border-bottom: 0.5px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f8fafc; }
      tr:last-child td { border-bottom: none; }
      .totals td { background: #f0fdf4 !important; font-weight: 700; border-top: 1.5px solid #16a34a; color: #15803d; }
      .footer { margin-top: 24px; padding-top: 12px; border-top: 0.5px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; }
      @media print { body { padding: 16px; } }
    </style></head><body>
    <div class="header">
      <div class="header-left">
        <div class="logo">ProspectCRM</div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      <div class="header-right">
        <div>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div>
        <div>${rows.length} registros</div>
      </div>
    </div>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
        ${totals ? `<tr class="totals">${totals.map(c => `<td>${c}</td>`).join('')}</tr>` : ''}
      </tbody>
    </table>
    <div class="footer">
      <span>ProspectCRM — Relatório gerado automaticamente</span>
      <span>Página 1</span>
    </div>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
function Filtros({ inicio, fim, onIni, onFim }: { inicio: string; fim: string; onIni:(v:string)=>void; onFim:(v:string)=>void }) {
  const mes = (n: number) => {
    const d = subMonths(new Date(), n)
    onIni(format(startOfMonth(d), 'yyyy-MM-dd'))
    onFim(format(endOfMonth(d), 'yyyy-MM-dd'))
  }
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex gap-1">
        {['Este mês','Mês passado','Últimos 3 meses'].map((l,i)=>(
          <button key={l} onClick={()=>mes(i===2?0:i)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{background:'var(--bg-elevated)',color:'var(--text-muted)',border:'1px solid var(--border)'}}
            onMouseOver={e=>(e.currentTarget.style.color='var(--text-primary)')}
            onMouseOut={e=>(e.currentTarget.style.color='var(--text-muted)')}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="date" value={inicio} onChange={e=>onIni(e.target.value)} className="input-field text-xs w-36"/>
        <span className="text-xs" style={{color:'var(--text-muted)'}}>até</span>
        <input type="date" value={fim} onChange={e=>onFim(e.target.value)} className="input-field text-xs w-36"/>
      </div>
    </div>
  )
}

// ─── Tabela de resultados ─────────────────────────────────────────────────────
function TabelaResultado({ cols, rows, loading }: { cols:{key:string;label:string;align?:string}[]; rows:any[]; loading:boolean }) {
  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader size={20} className="animate-spin" style={{color:'var(--accent)'}}/>
      <span className="ml-3 text-sm" style={{color:'var(--text-muted)'}}>Carregando dados...</span>
    </div>
  )
  if (!rows.length) return (
    <div className="text-center py-16">
      <FileText size={32} style={{color:'var(--text-muted)',margin:'0 auto 8px'}}/>
      <p className="text-sm" style={{color:'var(--text-muted)'}}>Nenhum dado no período selecionado</p>
    </div>
  )
  return (
    <div className="overflow-x-auto rounded-xl" style={{border:'1px solid var(--border)'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead>
          <tr style={{background:'var(--bg-elevated)'}}>
            {cols.map(c=>(
              <th key={c.key} style={{padding:'10px 14px',textAlign:(c.align as any)||'left',fontSize:11,fontWeight:600,
                color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.4px',
                borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} style={{borderBottom:'0.5px solid var(--border)'}}>
              {cols.map(c=>(
                <td key={c.key} style={{padding:'9px 14px',textAlign:(c.align as any)||'left',
                  color:'var(--text-primary)',whiteSpace:'nowrap'}}>
                  {r[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Painel de cards de totais ────────────────────────────────────────────────
function TotaisCards({ items }: { items: {label:string;value:string;color?:string}[] }) {
  return (
    <div className="grid gap-3" style={{gridTemplateColumns:`repeat(${Math.min(items.length,4)},1fr)`}}>
      {items.map((it,i)=>(
        <div key={i} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
          <p className="text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>{it.label}</p>
          <p className="text-xl font-bold" style={{color:it.color||'var(--text-primary)'}}>{it.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Relatorios() {
  const { ownerId, permissions, equipeId } = useAuth()
  const { toast } = useToast()

  const hoje = format(new Date(), 'yyyy-MM-dd')
  const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const [tipo, setTipo] = useState<RelType | null>(null)
  const [inicio, setInicio] = useState(inicioMes)
  const [fim, setFim] = useState(hoje)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [gerado, setGerado] = useState(false)

  const gerar = useCallback(async () => {
    if (!tipo) return
    setLoading(true); setGerado(false); setRows([])
    const uid = ownerId
    const ini = inicio + 'T00:00:00'
    const fimT = fim + 'T23:59:59'

    try {
      if (tipo === 'vendas') {
        // Busca vendas com itens detalhados
        const { data: vendas } = await supabase.from('vendas')
          .select('*, clientes(nome, telefone1, email, cpf), vendedores(nome)')
          .eq('user_id', uid).gte('data_venda', ini).lte('data_venda', fimT)
          .order('data_venda', { ascending: false })
        const { data: itens } = await supabase.from('venda_itens')
          .select('*').in('venda_id', (vendas ?? []).map((v:any) => v.id))
        const itensMap: Record<string, any[]> = {}
        ;(itens ?? []).forEach((it:any) => { if (!itensMap[it.venda_id]) itensMap[it.venda_id] = []; itensMap[it.venda_id].push(it) })
        const result: any[] = []
        ;(vendas ?? []).forEach((v:any) => {
          const vItens = itensMap[v.id] ?? []
          if (vItens.length === 0) {
            result.push({
              data: fmtDate(v.data_venda.substring(0,10)), numero_venda: v.id.slice(-8).toUpperCase(),
              cliente: v.clientes?.nome ?? 'Sem cliente', cpf_cliente: v.clientes?.cpf ?? '—',
              tel_cliente: v.clientes?.telefone1 ?? '—', email_cliente: v.clientes?.email ?? '—',
              vendedor: v.vendedores?.nome ?? '—', canal: v.canal ?? '—', forma: v.forma_pagamento ?? '—',
              status: v.status, produto: '—', qtd: '—', preco_unit: '—', total_item: '—',
              subtotal: fmt(v.subtotal), desconto: fmt(v.desconto || 0), total_venda: fmt(v.total),
            })
          } else {
            vItens.forEach((it:any, idx:number) => {
              result.push({
                data: idx === 0 ? fmtDate(v.data_venda.substring(0,10)) : '',
                numero_venda: idx === 0 ? v.id.slice(-8).toUpperCase() : '',
                cliente: idx === 0 ? (v.clientes?.nome ?? 'Sem cliente') : '',
                cpf_cliente: idx === 0 ? (v.clientes?.cpf ?? '—') : '',
                tel_cliente: idx === 0 ? (v.clientes?.telefone1 ?? '—') : '',
                email_cliente: idx === 0 ? (v.clientes?.email ?? '—') : '',
                vendedor: idx === 0 ? (v.vendedores?.nome ?? '—') : '',
                canal: idx === 0 ? (v.canal ?? '—') : '',
                forma: idx === 0 ? (v.forma_pagamento ?? '—') : '',
                status: idx === 0 ? v.status : '',
                produto: it.descricao, qtd: it.quantidade,
                preco_unit: fmt(it.preco_unit), total_item: fmt(it.total),
                subtotal: idx === 0 ? fmt(v.subtotal) : '',
                desconto: idx === 0 ? fmt(v.desconto || 0) : '',
                total_venda: idx === 0 ? fmt(v.total) : '',
              })
            })
          }
        })
        setRows(result)
      } else if (tipo === 'pedidos') {
        const { data: pedidos } = await supabase.from('pedidos')
          .select('*')
          .eq('user_id', uid).gte('data_pedido', inicio).lte('data_pedido', fim)
          .order('data_pedido', { ascending: false })
        const { data: itens } = await supabase.from('pedidos_itens')
          .select('*').in('pedido_id', (pedidos ?? []).map((p:any) => p.id))
        const itensMap: Record<string, any[]> = {}
        ;(itens ?? []).forEach((it:any) => { if (!itensMap[it.pedido_id]) itensMap[it.pedido_id] = []; itensMap[it.pedido_id].push(it) })
        const result: any[] = []
        ;(pedidos ?? []).forEach((p:any) => {
          const pItens = itensMap[p.id] ?? []
          if (pItens.length === 0) {
            result.push({
              numero: '#' + p.numero, data: fmtDate(p.data_pedido),
              cliente: p.cliente_nome ?? '—', status: p.status,
              forma: p.forma_pagamento ?? '—', produto: '—', qtd: '—',
              preco_unit: '—', desc_item: '—', comissao_item: '—', subtotal_item: '—',
              desconto_geral: fmt(p.valor_desconto), acrescimo: fmt(p.valor_acrescimo), total: fmt(p.valor_total),
            })
          } else {
            pItens.forEach((it:any, idx:number) => {
              result.push({
                numero: idx === 0 ? '#' + p.numero : '',
                data: idx === 0 ? fmtDate(p.data_pedido) : '',
                cliente: idx === 0 ? (p.cliente_nome ?? '—') : '',
                status: idx === 0 ? p.status : '',
                forma: idx === 0 ? (p.forma_pagamento ?? '—') : '',
                produto: it.descricao, qtd: it.quantidade,
                preco_unit: fmt(it.preco_unitario), desc_item: fmt(it.desconto || 0),
                comissao_item: (it.percentual_comissao || 0) + '%', subtotal_item: fmt(it.subtotal),
                desconto_geral: idx === 0 ? fmt(p.valor_desconto) : '',
                acrescimo: idx === 0 ? fmt(p.valor_acrescimo) : '',
                total: idx === 0 ? fmt(p.valor_total) : '',
              })
            })
          }
        })
        setRows(result)
      } else if (tipo === 'comissoes') {
        const { data } = await supabase.from('comissoes')
          .select('*, vendedores(nome, cargo, percentual_comissao)')
          .eq('user_id', uid).gte('created_at', ini).lte('created_at', fimT)
          .order('created_at', { ascending: false })
        setRows((data ?? []).map((c:any) => ({
          data: format(new Date(c.created_at), 'dd/MM/yyyy'),
          periodo_ref: c.periodo_ref ?? '—',
          vendedor: c.vendedores?.nome ?? '—',
          cargo: c.vendedores?.cargo ?? '—',
          descricao: c.descricao,
          tipo_com: c.tipo,
          status: c.status,
          valor_base: fmt(c.valor_base),
          percentual: c.percentual + '%',
          valor_comissao: fmt(c.valor_comissao),
          data_pagamento: c.data_pagamento ? fmtDate(c.data_pagamento) : '—',
          observacao: c.observacao ?? '—',
        })))
      } else if (tipo === 'financeiro') {
        const [rcp, rcr] = await Promise.all([
          supabase.from('contas_pagar').select('*, vendedores(nome)').eq('user_id', uid).gte('data_vencimento', inicio).lte('data_vencimento', fim).order('data_vencimento'),
          supabase.from('contas_receber').select('*').eq('user_id', uid).gte('data_vencimento', inicio).lte('data_vencimento', fim).order('data_vencimento'),
        ])
        const pagar = (rcp.data ?? []).map((c:any) => ({
          tipo_lanc: 'A Pagar', descricao: c.descricao, cliente_forn: c.fornecedor ?? '—',
          categoria: c.categoria ?? '—', emissao: c.data_emissao ? fmtDate(c.data_emissao) : '—',
          vencimento: fmtDate(c.data_vencimento), pagamento: c.data_pagamento ? fmtDate(c.data_pagamento) : '—',
          status: c.status, valor: fmt(c.valor), valor_pago: fmt(c.valor_pago),
          saldo: fmt(c.valor - c.valor_pago), observacao: c.observacao ?? '—',
        }))
        const receber = (rcr.data ?? []).map((c:any) => ({
          tipo_lanc: 'A Receber', descricao: c.descricao, cliente_forn: c.cliente_nome ?? '—',
          categoria: c.categoria ?? '—', emissao: c.data_emissao ? fmtDate(c.data_emissao) : '—',
          vencimento: fmtDate(c.data_vencimento), pagamento: c.data_recebimento ? fmtDate(c.data_recebimento) : '—',
          status: c.status, valor: fmt(c.valor), valor_pago: fmt(c.valor_recebido),
          saldo: fmt(c.valor - c.valor_recebido), observacao: c.observacao ?? '—',
        }))
        setRows([...pagar, ...receber].sort((a,b) => a.vencimento.localeCompare(b.vencimento)))
      } else if (tipo === 'clientes') {
        const { data } = await supabase.from('clientes')
          .select('*').eq('user_id', uid).order('nome')
        setRows((data ?? []).map((c:any) => ({
          nome: c.nome, cpf: c.cpf ?? '—', rg: c.rg ?? '—',
          data_nasc: c.data_nascimento ? fmtDate(c.data_nascimento) : '—',
          telefone1: c.telefone1 ?? '—', telefone2: c.telefone2 ?? '—',
          whatsapp: c.whatsapp ?? '—', email: c.email ?? '—',
          endereco: c.endereco ?? '—', bairro: c.bairro ?? '—',
          cidade: c.cidade ?? '—', estado: c.estado ?? '—', cep: c.cep ?? '—',
          canal_origem: c.canal_origem ?? '—', situacao: c.situacao ?? '—',
          lead_quente: c.lead_quente ? 'Sim' : 'Não',
          observacao: c.observacao ?? '—',
          cadastro: format(new Date(c.created_at), 'dd/MM/yyyy'),
          atualizado: format(new Date(c.updated_at), 'dd/MM/yyyy'),
        })))
      } else if (tipo === 'ponto') {
        const { data } = await supabase.from('ponto_registros')
          .select('*, funcionarios(nome, email, role, cargo)')
          .eq('owner_id', uid).gte('data_hora', ini).lte('data_hora', fimT)
          .order('funcionario_id').order('data_hora')
        setRows((data ?? []).map((p:any) => ({
          funcionario: p.funcionarios?.nome ?? '—',
          email_func: p.funcionarios?.email ?? '—',
          cargo: p.funcionarios?.cargo ?? p.funcionarios?.role ?? '—',
          data: format(new Date(p.data_hora), 'dd/MM/yyyy'),
          hora: format(new Date(p.data_hora), 'HH:mm:ss'),
          dia_semana: format(new Date(p.data_hora), 'EEEE', { locale: ptBR }),
          tipo: p.tipo.replace(/_/g, ' '),
          observacao: p.observacao ?? '—',
        })))
      } else if (tipo === 'estoque') {
        const { data: prods } = await supabase.from('produtos_estoque')
          .select('*').eq('user_id', uid).order('nome')
        const { data: movs } = await supabase.from('movimentos_estoque')
          .select('*, produtos_estoque(nome)').eq('user_id', uid)
          .gte('created_at', ini).lte('created_at', fimT).order('created_at', { ascending: false })
        // Produtos como primeira parte, movimentações como segunda
        const rowsProd = (prods ?? []).map((p:any) => ({
          secao: 'Produtos', codigo: p.codigo ?? '—', nome: p.nome,
          categoria: p.categoria ?? '—', unidade: p.unidade,
          quantidade_atual: p.quantidade, estoque_minimo: p.estoque_minimo,
          preco_custo: fmt(p.preco_custo ?? 0), preco_venda: fmt(p.preco_venda ?? 0),
          fornecedor: p.fornecedor ?? '—', localizacao: p.localizacao ?? '—',
          situacao: p.quantidade <= p.estoque_minimo ? 'Estoque Baixo' : 'Normal',
        }))
        const rowsMov = (movs ?? []).map((m:any) => ({
          secao: 'Movimentação', codigo: '—', nome: m.produtos_estoque?.nome ?? '—',
          categoria: m.tipo, unidade: '—',
          quantidade_atual: m.quantidade_nova, estoque_minimo: m.quantidade_anterior,
          preco_custo: String(m.quantidade), preco_venda: m.motivo ?? '—',
          fornecedor: format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'), localizacao: '—',
          situacao: m.tipo,
        }))
        setRows([...rowsProd, ...rowsMov])
      }
      setGerado(true)
    } catch (e: any) {
      toast.error('Erro ao gerar relatório: ' + e.message)
    }
    setLoading(false)
  }, [tipo, inicio, fim, ownerId])

  // Colunas por tipo
  const COLS: Record<RelType, {key:string;label:string;align?:string}[]> = {
    vendas: [
      {key:'data',label:'Data'},{key:'numero_venda',label:'ID Venda'},{key:'cliente',label:'Cliente'},
      {key:'cpf_cliente',label:'CPF'},{key:'tel_cliente',label:'Telefone'},{key:'email_cliente',label:'E-mail'},
      {key:'vendedor',label:'Vendedor'},{key:'canal',label:'Canal'},{key:'forma',label:'Pagamento'},
      {key:'status',label:'Status'},{key:'produto',label:'Produto'},{key:'qtd',label:'Qtd',align:'right'},
      {key:'preco_unit',label:'Preço Unit.',align:'right'},{key:'total_item',label:'Total Item',align:'right'},
      {key:'subtotal',label:'Subtotal',align:'right'},{key:'desconto',label:'Desconto',align:'right'},
      {key:'total_venda',label:'Total Venda',align:'right'},
    ],
    pedidos: [
      {key:'numero',label:'Nº'},{key:'data',label:'Data'},{key:'cliente',label:'Cliente'},
      {key:'status',label:'Status'},{key:'forma',label:'Pagamento'},{key:'produto',label:'Produto'},
      {key:'qtd',label:'Qtd',align:'right'},{key:'preco_unit',label:'Preço Unit.',align:'right'},
      {key:'desc_item',label:'Desc. Item',align:'right'},{key:'comissao_item',label:'% Com.',align:'right'},
      {key:'subtotal_item',label:'Subtotal Item',align:'right'},{key:'desconto_geral',label:'Desc. Geral',align:'right'},
      {key:'acrescimo',label:'Acréscimo',align:'right'},{key:'total',label:'Total',align:'right'},
    ],
    comissoes: [
      {key:'data',label:'Data'},{key:'periodo_ref',label:'Período'},{key:'vendedor',label:'Vendedor'},
      {key:'cargo',label:'Cargo'},{key:'descricao',label:'Descrição'},{key:'tipo_com',label:'Tipo'},
      {key:'status',label:'Status'},{key:'valor_base',label:'Base',align:'right'},
      {key:'percentual',label:'%',align:'right'},{key:'valor_comissao',label:'Comissão',align:'right'},
      {key:'data_pagamento',label:'Dt. Pagamento'},{key:'observacao',label:'Observação'},
    ],
    financeiro: [
      {key:'tipo_lanc',label:'Tipo'},{key:'descricao',label:'Descrição'},{key:'cliente_forn',label:'Cliente/Fornec.'},
      {key:'categoria',label:'Categoria'},{key:'emissao',label:'Emissão'},{key:'vencimento',label:'Vencimento'},
      {key:'pagamento',label:'Dt. Pag/Rec.'},{key:'status',label:'Status'},{key:'valor',label:'Valor',align:'right'},
      {key:'valor_pago',label:'Pago/Recebido',align:'right'},{key:'saldo',label:'Saldo',align:'right'},
      {key:'observacao',label:'Observação'},
    ],
    clientes: [
      {key:'nome',label:'Nome'},{key:'cpf',label:'CPF'},{key:'rg',label:'RG'},
      {key:'data_nasc',label:'Dt. Nascimento'},{key:'telefone1',label:'Telefone 1'},
      {key:'telefone2',label:'Telefone 2'},{key:'whatsapp',label:'WhatsApp'},
      {key:'email',label:'E-mail'},{key:'endereco',label:'Endereço'},{key:'bairro',label:'Bairro'},
      {key:'cidade',label:'Cidade'},{key:'estado',label:'Estado'},{key:'cep',label:'CEP'},
      {key:'canal_origem',label:'Canal Origem'},{key:'situacao',label:'Situação'},
      {key:'lead_quente',label:'Lead Quente'},{key:'observacao',label:'Observação'},
      {key:'cadastro',label:'Cadastro'},{key:'atualizado',label:'Atualizado'},
    ],
    ponto: [
      {key:'funcionario',label:'Funcionário'},{key:'email_func',label:'E-mail'},
      {key:'cargo',label:'Cargo/Role'},{key:'data',label:'Data'},
      {key:'dia_semana',label:'Dia da Semana'},{key:'hora',label:'Hora'},
      {key:'tipo',label:'Tipo Registro'},{key:'observacao',label:'Observação'},
    ],
    estoque: [
      {key:'secao',label:'Seção'},{key:'codigo',label:'Código'},{key:'nome',label:'Produto/Descrição'},
      {key:'categoria',label:'Categoria/Tipo'},{key:'unidade',label:'Un.'},
      {key:'quantidade_atual',label:'Qtd Atual',align:'right'},{key:'estoque_minimo',label:'Mín/Anterior',align:'right'},
      {key:'preco_custo',label:'Custo/Qtd Mov.',align:'right'},{key:'preco_venda',label:'Venda/Motivo',align:'right'},
      {key:'fornecedor',label:'Fornecedor/Data'},{key:'localizacao',label:'Localização'},
      {key:'situacao',label:'Situação'},
    ],
  }

  // Totais por tipo
  const getTotais = () => {
    if (!tipo || !rows.length) return []
    if (tipo === 'vendas') {
      // Only count rows that have a total_venda (first row of each sale group)
      const vendasRows = rows.filter(r=>r.total_venda && r.total_venda !== '' && r.status && r.status !== 'cancelada')
      const total = vendasRows.length
      const valor = vendasRows.reduce((s:number,r:any)=>{
        const v = r.total_venda ?? ''
        if (!v || typeof v !== 'string') return s
        const n = parseFloat(v.replace(/[^\d,]/g,'').replace(',','.'))
        return s + (isNaN(n)?0:n)
      },0)
      return [{label:'Vendas confirmadas',value:String(total)},{label:'Total em vendas',value:fmt(valor)},{label:'Ticket médio',value:total>0?fmt(valor/total):'—'}]
    }
    if (tipo === 'comissoes') {
      const pend = rows.filter(r=>r.status==='pendente').length
      const pago = rows.filter(r=>r.status==='pago').length
      return [{label:'Pendentes',value:String(pend),color:'#f59e0b'},{label:'Pagas',value:String(pago),color:'#34d399'},{label:'Total registros',value:String(rows.length)}]
    }
    if (tipo === 'financeiro') {
      const pagar = rows.filter(r=>r.tipo==='A Pagar').length
      const receber = rows.filter(r=>r.tipo==='A Receber').length
      return [{label:'Contas a Pagar',value:String(pagar),color:'#f87171'},{label:'Contas a Receber',value:String(receber),color:'#34d399'}]
    }
    if (tipo === 'estoque') {
      const baixo = rows.filter(r=>r.situacao.includes('Baixo')).length
      return [{label:'Total produtos',value:String(rows.length)},{label:'Estoque baixo',value:String(baixo),color:baixo>0?'#f87171':'#34d399'}]
    }
    return [{label:'Total registros',value:String(rows.length)}]
  }

  const handleExportCSV = () => {
    if (!tipo || !rows.length) return
    exportCSV(rows, COLS[tipo], `relatorio_${tipo}_${inicio}_${fim}`)
    toast.success('CSV exportado com sucesso!')
  }

  const handleExportPDF = () => {
    if (!tipo || !rows.length) return
    const rel = RELATORIOS.find(r => r.id === tipo)!
    const headers = COLS[tipo].map(c => c.label)
    const pdfRows = rows.map(r => COLS[tipo].map(c => String(r[c.key] ?? '—')))
    exportPDF(
      `Relatório de ${rel.label}`,
      `Período: ${fmtDate(inicio)} a ${fmtDate(fim)} — ${rows.length} registros`,
      headers, pdfRows
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{color:'var(--text-primary)'}}>Relatórios</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Exporte dados em PDF ou CSV</p>
        </div>
        {gerado && rows.length > 0 && (
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="btn-ghost flex items-center gap-2">
              <Download size={14}/> CSV
            </button>
            <button onClick={handleExportPDF} className="btn-primary flex items-center gap-2">
              <FileText size={14}/> PDF
            </button>
          </div>
        )}
      </div>

      {/* Seleção do tipo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {RELATORIOS.map(r => {
          const Icon = r.icon
          const sel = tipo === r.id
          return (
            <button key={r.id} onClick={()=>{setTipo(r.id);setGerado(false);setRows([])}}
              className="text-left rounded-xl p-4 transition-all"
              style={{background:sel?'var(--bg-card)':'var(--bg-elevated)', border:sel?`2px solid ${r.color}`:'1px solid var(--border)', cursor:'pointer'}}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:r.color+'22'}}>
                  <Icon size={14} style={{color:r.color}}/>
                </div>
                <span className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>{r.label}</span>
                {sel && <CheckCircle size={13} style={{color:r.color,marginLeft:'auto'}}/>}
              </div>
              <p className="text-xs leading-relaxed" style={{color:'var(--text-muted)'}}>{r.desc}</p>
            </button>
          )
        })}
      </div>

      {/* Filtros e geração */}
      {tipo && (
        <div className="rounded-xl p-5 space-y-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
          <div className="flex items-center gap-2 mb-1">
            <Filter size={14} style={{color:'var(--accent)'}}/>
            <p className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>
              Filtros — {RELATORIOS.find(r=>r.id===tipo)?.label}
            </p>
          </div>
          <Filtros inicio={inicio} fim={fim} onIni={setInicio} onFim={setFim}/>
          <button onClick={gerar} disabled={loading}
            className="btn-primary w-full justify-center"
            style={{opacity:loading?0.7:1}}>
            {loading ? <><Loader size={14} className="animate-spin"/> Gerando...</> : <><Search size={14}/> Gerar Relatório</>}
          </button>
        </div>
      )}

      {/* Totais */}
      {gerado && rows.length > 0 && getTotais().length > 0 && (
        <TotaisCards items={getTotais()}/>
      )}

      {/* Tabela */}
      {tipo && (gerado || loading) && (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
          <div className="flex items-center justify-between px-4 py-3" style={{background:'var(--bg-elevated)',borderBottom:'1px solid var(--border)'}}>
            <span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>
              {loading ? 'Carregando...' : `${rows.length} registro${rows.length!==1?'s':''}`}
            </span>
            {gerado && rows.length > 0 && (
              <div className="flex gap-2">
                <button onClick={handleExportCSV} className="btn-ghost text-xs py-1 px-3"><Download size={12}/> CSV</button>
                <button onClick={handleExportPDF} className="btn-ghost text-xs py-1 px-3"><FileText size={12}/> PDF</button>
              </div>
            )}
          </div>
          <TabelaResultado cols={COLS[tipo]} rows={rows} loading={loading}/>
        </div>
      )}

      {/* Estado inicial */}
      {!tipo && (
        <div className="text-center py-16 rounded-xl" style={{border:'2px dashed var(--border)'}}>
          <FileText size={40} style={{color:'var(--text-muted)',margin:'0 auto 12px'}}/>
          <p className="font-medium text-sm" style={{color:'var(--text-primary)'}}>Selecione um tipo de relatório</p>
          <p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Escolha acima o que deseja exportar</p>
        </div>
      )}
    </div>
  )
}