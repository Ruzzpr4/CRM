import { useState, useEffect, useCallback, useRef } from 'react'
import { estoqueApi } from '../lib/api'
import { ProdutoEstoque, MovimentoEstoque, UNIDADE_LABELS, MOV_TIPO_LABELS, MOV_TIPO_COLORS, EstoqueUnidade, EstoqueMovTipo } from '../types/estoque'
import Modal from '../components/Modal'
import { Plus, Search, Package, AlertTriangle, Upload, TrendingUp, TrendingDown, RefreshCw, Pencil, Trash2, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react'

// ─── Form de Produto ─────────────────────────────────────────
// Definido fora do componente para evitar perda de foco
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  )
}

function ProdutoForm({ item, onSave, onClose }: {
  item?: ProdutoEstoque|null; onSave:(d:Partial<ProdutoEstoque>)=>Promise<void>; onClose:()=>void
}) {
  const blank = { codigo:'', nome:'', descricao:'', categoria:'', unidade:'un' as EstoqueUnidade,
    quantidade:0, estoque_minimo:0, preco_custo:'', preco_venda:'', fornecedor:'', localizacao:'', ativo:true }
  const [f, setF] = useState(blank)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) setF({ codigo:item.codigo??'', nome:item.nome, descricao:item.descricao??'',
      categoria:item.categoria??'', unidade:item.unidade, quantidade:item.quantidade,
      estoque_minimo:item.estoque_minimo, preco_custo:item.preco_custo?.toString()??'',
      preco_venda:item.preco_venda?.toString()??'', fornecedor:item.fornecedor??'',
      localizacao:item.localizacao??'', ativo:item.ativo??true })
  }, [item])

  const set = (k:string,v:unknown) => setF(p=>({...p,[k]:v}))

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault()
    if (!f.nome.trim()) { alert('Nome do produto é obrigatório'); return }
    setSaving(true)
    try {
      await onSave({ ...f, preco_custo: f.preco_custo?Number(f.preco_custo):undefined, preco_venda: f.preco_venda?Number(f.preco_venda):undefined, quantidade:Number(f.quantidade), estoque_minimo:Number(f.estoque_minimo) })
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err?.message ?? 'Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={item ? 'Editar Produto' : 'Novo Produto'} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        <button type="button" onClick={() => { const el = document.getElementById('prod-form') as HTMLFormElement; if(el) el.requestSubmit(); }} disabled={saving} className="btn-primary flex-1 justify-center">
          {saving?'Salvando...':'Salvar Produto'}
        </button>
      </>}>
      <form id="prod-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Código / SKU"><input value={f.codigo} onChange={e=>set('codigo',e.target.value)} placeholder="PROD-001" className="input-field"/></Field>
          <Field label="Nome *"><input required value={f.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome do produto" className="input-field"/></Field>
          <Field label="Categoria"><input value={f.categoria} onChange={e=>set('categoria',e.target.value)} placeholder="Ex: Cosméticos" className="input-field"/></Field>
          <Field label="Unidade">
            <select value={f.unidade} onChange={e=>set('unidade',e.target.value)} className="input-field" style={{appearance:'none'}}>
              {(Object.keys(UNIDADE_LABELS) as EstoqueUnidade[]).map(k=><option key={k} value={k}>{UNIDADE_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="Quantidade Atual"><input type="number" min="0" value={f.quantidade} onChange={e=>set('quantidade',e.target.value)} className="input-field"/></Field>
          <Field label="Estoque Mínimo (alerta)"><input type="number" min="0" value={f.estoque_minimo} onChange={e=>set('estoque_minimo',e.target.value)} className="input-field"/></Field>
          <Field label="Preço de Custo (R$)"><input type="number" min="0" step="0.01" value={f.preco_custo} onChange={e=>set('preco_custo',e.target.value)} placeholder="0,00" className="input-field"/></Field>
          <Field label="Preço de Venda (R$)"><input type="number" min="0" step="0.01" value={f.preco_venda} onChange={e=>set('preco_venda',e.target.value)} placeholder="0,00" className="input-field"/></Field>
          <Field label="Fornecedor"><input value={f.fornecedor} onChange={e=>set('fornecedor',e.target.value)} placeholder="Nome do fornecedor" className="input-field"/></Field>
          <Field label="Localização"><input value={f.localizacao} onChange={e=>set('localizacao',e.target.value)} placeholder="Ex: Prateleira A3" className="input-field"/></Field>
        </div>
        <Field label="Descrição"><textarea value={f.descricao} onChange={e=>set('descricao',e.target.value)} rows={2} className="input-field resize-none" placeholder="Descrição opcional..."/></Field>
      </form>
    </Modal>
  )
}

// ─── Form de Movimento ───────────────────────────────────────
function MovimentoForm({ produto, onSave, onClose }: {
  produto: ProdutoEstoque; onSave:(tipo:EstoqueMovTipo,qtd:number,motivo:string)=>Promise<void>; onClose:()=>void
}) {
  const [tipo, setTipo] = useState<EstoqueMovTipo>('entrada')
  const [qtd, setQtd] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    await onSave(tipo, Number(qtd), motivo)
    setSaving(false)
  }

  const nova = tipo==='entrada'||tipo==='devolucao' ? produto.quantidade+Number(qtd) : Math.max(0,produto.quantidade-Number(qtd))

  return (
    <Modal title={`Movimentar — ${produto.nome}`} onClose={onClose} maxWidth="max-w-md"
      footer={<>
        <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
        <button type="button" onClick={() => { const el = document.getElementById('mov-form') as HTMLFormElement; if(el) el.requestSubmit(); }} disabled={saving} className="btn-primary flex-1 justify-center">
          {saving?'Salvando...':'Registrar'}
        </button>
      </>}>
      <form id="mov-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl" style={{background:'var(--bg-elevated)'}}>
          <span className="text-sm" style={{color:'var(--text-muted)'}}>Estoque atual</span>
          <span className="text-xl font-bold" style={{color:'var(--text-primary)'}}>{produto.quantidade} {UNIDADE_LABELS[produto.unidade]}</span>
        </div>
        <div>
          <label className="block text-xs font-medium mb-2" style={{color:'var(--text-secondary)'}}>Tipo de Movimentação</label>
          <div className="grid grid-cols-2 gap-2">
            {([['entrada','Entrada','#10b981'],['saida','Saída','#f87171'],['ajuste','Ajuste','#f59e0b'],['devolucao','Devolução','#4f56f7']] as [EstoqueMovTipo,string,string][]).map(([v,l,c])=>(
              <button key={v} type="button" onClick={()=>setTipo(v)}
                className="py-2 px-3 rounded-xl text-sm font-medium transition-all"
                style={{background:tipo===v?`${c}20`:'var(--bg-elevated)',color:tipo===v?c:'var(--text-secondary)',border:`1px solid ${tipo===v?`${c}40`:'var(--border)'}`,cursor:'pointer'}}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>Quantidade *</label>
          <input required type="number" min="1" value={qtd} onChange={e=>setQtd(+e.target.value)} className="input-field"/>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>Motivo / Referência</label>
          <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex: Pedido #1234, Ajuste inventário..." className="input-field"/>
        </div>
        <div className="p-3 rounded-xl flex items-center justify-between" style={{background:'rgba(79,86,247,0.06)',border:'1px solid rgba(79,86,247,0.15)'}}>
          <span className="text-sm" style={{color:'var(--text-muted)'}}>Novo estoque será</span>
          <span className="text-xl font-bold" style={{color: nova < produto.estoque_minimo ? '#f87171' : '#10b981'}}>{nova} {UNIDADE_LABELS[produto.unidade]}</span>
        </div>
      </form>
    </Modal>
  )
}

// ─── Upload de Planilha ──────────────────────────────────────
function UploadModal({ onImport, onClose }: { onImport:(rows:Partial<ProdutoEstoque>[])=>Promise<void>; onClose:()=>void }) {
  const [file, setFile] = useState<File|null>(null)
  const [preview, setPreview] = useState<Partial<ProdutoEstoque>[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState<{ok:number;erros:number}|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const parseXlsx = async (f: File) => {
    setLoading(true)
    const { read, utils } = await import('xlsx')
    const buf = await f.arrayBuffer()
    const wb = read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw: Record<string,unknown>[] = utils.sheet_to_json(ws, { defval:'' })

    // Tentar mapear colunas flexivelmente
    const rows: Partial<ProdutoEstoque>[] = raw.map(r => ({
      codigo:         String(r['codigo'] ?? r['Codigo'] ?? r['SKU'] ?? r['sku'] ?? ''),
      nome:           String(r['nome'] ?? r['Nome'] ?? r['produto'] ?? r['Produto'] ?? r['descricao'] ?? ''),
      categoria:      String(r['categoria'] ?? r['Categoria'] ?? ''),
      unidade:        String(r['unidade'] ?? r['Unidade'] ?? 'un') as EstoqueUnidade,
      quantidade:     Number(r['quantidade'] ?? r['Quantidade'] ?? r['qtd'] ?? r['estoque'] ?? 0),
      estoque_minimo: Number(r['estoque_minimo'] ?? r['Minimo'] ?? r['minimo'] ?? r['min'] ?? 0),
      preco_custo:    Number(r['preco_custo'] ?? r['custo'] ?? r['Custo'] ?? r['preco'] ?? 0) || undefined,
      preco_venda:    Number(r['preco_venda'] ?? r['venda'] ?? r['Venda'] ?? r['preco_venda'] ?? 0) || undefined,
      fornecedor:     String(r['fornecedor'] ?? r['Fornecedor'] ?? ''),
      localizacao:    String(r['localizacao'] ?? r['Localizacao'] ?? r['local'] ?? ''),
    })).filter(r => r.nome)

    setPreview(rows.slice(0, 5))
    setLoading(false)
    return rows
  }

  const [allRows, setAllRows] = useState<Partial<ProdutoEstoque>[]>([])

  const handleFile = async (f: File) => {
    setFile(f)
    const rows = await parseXlsx(f)
    setAllRows(rows)
  }

  const handleImport = async () => {
    setImporting(true)
    const res = await onImport(allRows)
    setResultado(res)
    setImporting(false)
  }

  return (
    <Modal title="Importar Planilha de Estoque" onClose={onClose} maxWidth="max-w-xl"
      footer={resultado ? (
        <button onClick={onClose} className="btn-primary flex-1 justify-center">Fechar</button>
      ) : (
        <>
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          {allRows.length > 0 && (
            <button onClick={handleImport} disabled={importing} className="btn-primary flex-1 justify-center">
              {importing ? 'Importando...' : `Importar ${allRows.length} produtos`}
            </button>
          )}
        </>
      )}>
      {resultado ? (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{background:'rgba(16,185,129,0.1)'}}>
            <Package size={32} style={{color:'#10b981'}}/>
          </div>
          <div>
            <p className="text-xl font-bold" style={{color:'var(--text-primary)'}}>Importação concluída!</p>
            <p className="mt-2 text-sm" style={{color:'var(--text-muted)'}}>
              <span style={{color:'#10b981',fontWeight:600}}>{resultado.ok} produtos importados</span>
              {resultado.erros > 0 && <span style={{color:'#f87171'}}> • {resultado.erros} com erro</span>}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Modelo para download */}
          <div className="p-4 rounded-xl" style={{background:'rgba(79,86,247,0.06)',border:'1px solid rgba(79,86,247,0.15)'}}>
            <p className="text-xs font-semibold mb-2" style={{color:'var(--accent)'}}>📋 Colunas aceitas na planilha (.xlsx ou .csv)</p>
            <div className="flex flex-wrap gap-1.5">
              {['nome *','codigo','categoria','unidade','quantidade','estoque_minimo','preco_custo','preco_venda','fornecedor','localizacao'].map(c=>(
                <code key={c} className="text-xs px-2 py-0.5 rounded" style={{background:'var(--bg-elevated)',color:c.includes('*')?'var(--accent)':'var(--text-secondary)'}}>{c}</code>
              ))}
            </div>
            <p className="text-xs mt-2" style={{color:'var(--text-muted)'}}>* obrigatório — A ordem das colunas não importa</p>
          </div>

          {/* Upload area */}
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
            style={{borderColor:'var(--border)'}}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='var(--accent)'}}
            onDragLeave={e=>{e.currentTarget.style.borderColor='var(--border)'}}
            onDrop={async e=>{e.preventDefault();e.currentTarget.style.borderColor='var(--border)';const f=e.dataTransfer.files[0];if(f)handleFile(f)}}>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f)}}/>
            <FileSpreadsheet size={32} className="mx-auto mb-3" style={{color:'var(--text-muted)'}}/>
            {file ? (
              <p className="font-semibold text-sm" style={{color:'var(--accent)'}}>{file.name}</p>
            ) : (
              <>
                <p className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>Clique ou arraste o arquivo aqui</p>
                <p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Suporta .xlsx, .xls e .csv</p>
              </>
            )}
            {loading && <p className="text-xs mt-2" style={{color:'var(--accent)'}}>Lendo planilha...</p>}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{color:'var(--text-secondary)'}}>
                Preview — {allRows.length} produto{allRows.length!==1?'s':''} encontrado{allRows.length!==1?'s':''}
              </p>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'var(--bg-elevated)'}}>
                      {['Nome','Código','Categoria','Qtd','Preço Venda'].map(h=>(
                        <th key={h} style={{padding:'8px 12px',textAlign:'left',color:'var(--text-muted)',fontWeight:600}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r,i)=>(
                      <tr key={i} style={{borderTop:'1px solid var(--border)'}}>
                        <td style={{padding:'8px 12px',color:'var(--text-primary)',fontWeight:500}}>{r.nome}</td>
                        <td style={{padding:'8px 12px',color:'var(--text-muted)'}}>{r.codigo||'—'}</td>
                        <td style={{padding:'8px 12px',color:'var(--text-muted)'}}>{r.categoria||'—'}</td>
                        <td style={{padding:'8px 12px',color:'var(--text-primary)'}}>{r.quantidade}</td>
                        <td style={{padding:'8px 12px',color:'#10b981'}}>{r.preco_venda?`R$ ${Number(r.preco_venda).toFixed(2)}`:'—'}</td>
                      </tr>
                    ))}
                    {allRows.length > 5 && (
                      <tr style={{borderTop:'1px solid var(--border)'}}>
                        <td colSpan={5} style={{padding:'8px 12px',color:'var(--text-muted)',textAlign:'center'}}>
                          ... e mais {allRows.length - 5} produto{allRows.length-5!==1?'s':''}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function Estoque() {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroBaixo, setFiltroBaixo] = useState(false)
  const [modal, setModal] = useState<'novo'|'editar'|'mover'|'upload'|null>(null)
  const [selected, setSelected] = useState<ProdutoEstoque|null>(null)
  const [produtoMover, setProdutoMover] = useState<ProdutoEstoque|null>(null)
  const [expandedId, setExpandedId] = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, m] = await Promise.all([
      estoqueApi.listProdutos({ search: search||undefined, baixoEstoque: filtroBaixo||undefined }),
      estoqueApi.listMovimentos(),
    ])
    setProdutos(p)
    setMovimentos(m)
    setLoading(false)
  }, [search, filtroBaixo])

  useEffect(() => { load() }, [load])

  const baixoEstoque = produtos.filter(p => p.quantidade <= p.estoque_minimo)
  const valorTotal = produtos.reduce((s,p) => s + p.quantidade * (p.preco_custo ?? 0), 0)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'var(--text-muted)'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar produto..." className="input-field" style={{paddingLeft:'2.25rem'}}/>
        </div>
        <button onClick={()=>setFiltroBaixo(!filtroBaixo)} className="btn-ghost"
          style={{color:filtroBaixo?'#f87171':undefined,borderColor:filtroBaixo?'rgba(248,113,113,0.4)':undefined}}>
          <AlertTriangle size={14}/> Baixo estoque {baixoEstoque.length > 0 && `(${baixoEstoque.length})`}
        </button>
        <button onClick={()=>setModal('upload')} className="btn-ghost"><Upload size={14}/> Planilha</button>
        <button onClick={()=>{setSelected(null);setModal('novo')}} className="btn-primary"><Plus size={14}/> Novo Produto</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Total produtos', value:produtos.length, color:'var(--accent)'},
          {label:'Abaixo do mínimo', value:baixoEstoque.length, color:'#f87171'},
          {label:'Valor em estoque', value:`R$ ${valorTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, color:'#10b981'},
          {label:'Movimentos recentes', value:movimentos.length, color:'#f59e0b'},
        ].map(({label,value,color})=>(
          <div key={label} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <p className="text-2xl font-bold" style={{color}}>{value}</p>
            <p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{label}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {baixoEstoque.length > 0 && !filtroBaixo && (
        <div className="p-4 rounded-xl flex items-start gap-3" style={{background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.2)'}}>
          <AlertTriangle size={16} style={{color:'#f87171',flexShrink:0,marginTop:1}}/>
          <div>
            <p className="text-sm font-semibold" style={{color:'#f87171'}}>⚠️ {baixoEstoque.length} produto{baixoEstoque.length!==1?'s':''} com estoque baixo</p>
            <p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{baixoEstoque.map(p=>p.nome).join(', ')}</p>
          </div>
        </div>
      )}

      {/* Lista de produtos */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{borderTopColor:'var(--accent)'}}/>
        </div>
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Package size={28} style={{color:'var(--text-muted)'}}/>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Nenhum produto no estoque</p>
          <div className="flex gap-2">
            <button onClick={()=>setModal('upload')} className="btn-ghost text-sm"><Upload size={13}/> Importar planilha</button>
            <button onClick={()=>{setSelected(null);setModal('novo')}} className="btn-primary text-sm"><Plus size={13}/> Adicionar produto</button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
          {/* Header da tabela */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3" style={{background:'var(--bg-elevated)',borderBottom:'1px solid var(--border)'}}>
            {['Produto','Categoria','Unid.','Estoque','Mín.','Preço Venda','',''].map((h,i)=>(
              <div key={i} className={`text-xs font-semibold ${i>=6?'col-span-1':'col-span-2'}`}
                style={{color:'var(--text-muted)',gridColumn:i===0?'span 3':i===1?'span 2':i===6?'span 2':i===7?'span 1':'span 1'}}>
                {h}
              </div>
            ))}
          </div>

          {/* Linhas */}
          {produtos.map(p => {
            const baixo = p.quantidade <= p.estoque_minimo
            const movsProd = movimentos.filter(m => m.produto_id === p.id).slice(0, 5)
            const expanded = expandedId === p.id

            return (
              <div key={p.id} style={{borderBottom:'1px solid var(--border)'}}>
                <div className="grid gap-2 px-4 py-3 items-center hover:bg-opacity-50 transition-all"
                  style={{gridTemplateColumns:'3fr 2fr 1fr 1fr 1fr 2fr 2fr 1fr',background:baixo?'rgba(248,113,113,0.03)':'transparent'}}>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{color:'var(--text-primary)'}}>{p.nome}</p>
                    {p.codigo&&<p className="text-xs" style={{color:'var(--text-muted)'}}>{p.codigo}</p>}
                    {p.localizacao&&<p className="text-xs" style={{color:'var(--text-muted)'}}>📍 {p.localizacao}</p>}
                  </div>

                  <div><span className="text-xs px-2 py-0.5 rounded-lg" style={{background:'var(--bg-elevated)',color:'var(--text-secondary)'}}>{p.categoria||'—'}</span></div>
                  <div className="text-sm" style={{color:'var(--text-muted)'}}>{UNIDADE_LABELS[p.unidade]}</div>

                  <div>
                    <span className="text-sm font-bold" style={{color:baixo?'#f87171':'var(--text-primary)'}}>{p.quantidade}</span>
                    {baixo&&<AlertTriangle size={12} className="inline ml-1" style={{color:'#f87171'}}/>}
                  </div>

                  <div className="text-sm" style={{color:'var(--text-muted)'}}>{p.estoque_minimo}</div>

                  <div className="text-sm font-medium" style={{color:'#10b981'}}>
                    {p.preco_venda ? `R$ ${p.preco_venda.toFixed(2)}` : '—'}
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={()=>{setProdutoMover(p);setModal('mover')}}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{background:'var(--accent-muted)',color:'var(--accent)',border:'1px solid rgba(79,86,247,0.2)',cursor:'pointer'}}>
                      <RefreshCw size={11}/> Mover
                    </button>
                    <button onClick={()=>{setSelected(p);setModal('editar')}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'4px'}}><Pencil size={13}/></button>
                    <button onClick={async()=>{if(window.confirm("Confirmar?")){await estoqueApi.deleteProduto(p.id);load()}}} style={{background:'none',border:'none',cursor:'pointer',color:'#f87171',padding:'4px'}}><Trash2 size={13}/></button>
                  </div>

                  <button onClick={()=>setExpandedId(expanded?null:p.id)}
                    style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'4px',display:'flex',alignItems:'center'}}>
                    {expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                  </button>
                </div>

                {/* Histórico expandido */}
                {expanded && (
                  <div className="px-4 pb-4 animate-fade-in" style={{borderTop:'1px solid var(--border)'}}>
                    <p className="text-xs font-medium mb-2 mt-3" style={{color:'var(--text-muted)'}}>Últimas movimentações</p>
                    {movsProd.length === 0 ? (
                      <p className="text-xs" style={{color:'var(--text-muted)'}}>Nenhuma movimentação registrada</p>
                    ) : (
                      <div className="space-y-1">
                        {movsProd.map(m=>(
                          <div key={m.id} className="flex items-center gap-3 py-1">
                            <span className={`text-xs font-semibold ${MOV_TIPO_COLORS[m.tipo]}`}>
                              {m.tipo==='entrada'||m.tipo==='devolucao'?'+':'-'}{m.quantidade} {MOV_TIPO_LABELS[m.tipo]}
                            </span>
                            {m.motivo&&<span className="text-xs" style={{color:'var(--text-muted)'}}>{m.motivo}</span>}
                            <span className="text-xs ml-auto" style={{color:'var(--text-muted)'}}>
                              {new Date(m.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modais */}
      {(modal==='novo'||modal==='editar') && (
        <ProdutoForm item={modal==='editar'?selected:null}
          onSave={async d=>{
            if(modal==='editar'&&selected) await estoqueApi.updateProduto(selected.id,d)
            else await estoqueApi.createProduto(d as Omit<ProdutoEstoque,'id'|'created_at'|'updated_at'|'user_id'>)
            setModal(null); load()
          }}
          onClose={()=>setModal(null)}/>
      )}

      {modal==='mover' && produtoMover && (
        <MovimentoForm produto={produtoMover}
          onSave={async(tipo,qtd,motivo)=>{
            await estoqueApi.registrarMovimento(produtoMover.id,tipo,qtd,motivo)
            setModal(null); load()
          }}
          onClose={()=>setModal(null)}/>
      )}

      {modal==='upload' && (
        <UploadModal
          onImport={async rows=>{const r=await estoqueApi.importarPlanilha(rows);load();return r}}
          onClose={()=>setModal(null)}/>
      )}
    </div>
  )
}
