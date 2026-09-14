'use client';
/* oxlint-disable react/react-compiler, jsx-a11y/prefer-tag-over-role, jsx-a11y/control-has-associated-label, eslint/no-unused-expressions -- async data load, modal fallback semantics, dynamic review selectors, and concise conditional awaits */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  Analysis,
  Product,
  RankedCandidate,
  Supplier,
  UserSettings,
  Catalog,
  CatalogOpportunity,
  CatalogProduct,
  DataSignal,
} from '@easy-seller/types';
import {
  BarChart3,
  Calculator,
  PackageSearch,
  RefreshCw,
  Settings,
  ShieldCheck,
  Truck,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { api, type CalculationResponse, type DashboardData } from '@/lib/api';

type View = 'dashboard' | 'research' | 'products' | 'calculator' | 'suppliers' | 'catalogs';
type ProductDraft = {
  name: string;
  asin: string;
  amazonUrl: string;
  ean: string;
  brand: string;
  category: string;
  researchOrigin: string;
  strategyType: 'BRANDED_RESELL' | 'GENERIC_LISTING';
  status: Product['status'];
  salePrice: number;
  monthlySalesEstimate: number;
  sellerCount: number;
  amazonIsSeller: boolean;
  priceStability: number;
  demandStability: number;
  rating: number;
  reviewCount: number;
  historyAvailable: boolean;
  estimatedTurnoverDays: number;
  observations: string;
  brandApprovalStatus: Product['brandApprovalStatus'];
  amazonApprovalStatus: Product['amazonApprovalStatus'];
  approvalCheckedAt: string;
  approvalNotes: string;
  approvalRequiredQuantity: number;
  approvalDocumentType: string;
  purchaseChecklist: Product['purchaseChecklist'];
  dataOrigin: Product['dataOrigin'];
  supplierId: string;
  supplierSku: string;
  cost: number;
  stock: number;
  minimumQty: number;
};
type SupplierDraft = {
  name: string;
  legalName: string;
  cnpj: string;
  contact: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  city: string;
  state: string;
  notes: string;
  minimumOrder: number;
  issuesInvoice: boolean;
  hasCatalog: boolean;
};
type CalcDraft = {
  productId: string;
  salePrice: number;
  productCost: number;
  inboundShipping: number;
  packaging: number;
  taxRatePercent: number;
  amazonCommission: number;
  amazonLogistics: number;
  advertising: number;
  otherExpenses: number;
  quantity: number;
  monthlySales: number;
  sellerCount: number;
  priceStability: number;
  demandStability: number;
  amazonIsSeller: boolean;
  inventoryRisk: number;
  dataOrigin: Product['dataOrigin'];
};
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const emptyChecklist = {
  checkedAmazonApproval: false,
  hasValidSupplier: false,
  supplierDocumentAccepted: false,
  requiredQuantityViable: false,
  approvalCompletedIfNeeded: false,
};
const emptyProduct: ProductDraft = {
  name: '',
  asin: '',
  amazonUrl: '',
  ean: '',
  brand: '',
  category: '',
  researchOrigin: '',
  strategyType: 'BRANDED_RESELL',
  status: 'CANDIDATE',
  salePrice: 0,
  monthlySalesEstimate: 0,
  sellerCount: 0,
  amazonIsSeller: false,
  priceStability: 50,
  demandStability: 50,
  rating: 0,
  reviewCount: 0,
  historyAvailable: false,
  estimatedTurnoverDays: 30,
  observations: '',
  brandApprovalStatus: 'UNKNOWN',
  amazonApprovalStatus: 'NOT_CHECKED',
  approvalCheckedAt: '',
  approvalNotes: '',
  approvalRequiredQuantity: 1,
  approvalDocumentType: '',
  purchaseChecklist: { ...emptyChecklist },
  dataOrigin: 'INFERRED',
  supplierId: '',
  supplierSku: '',
  cost: 0,
  stock: 0,
  minimumQty: 1,
};
const emptySupplier: SupplierDraft = {
  name: '',
  legalName: '',
  cnpj: '',
  contact: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  city: '',
  state: '',
  notes: '',
  minimumOrder: 0,
  issuesInvoice: false,
  hasCatalog: false,
};
const emptyCalc: CalcDraft = {
  productId: '',
  salePrice: 0,
  productCost: 0,
  inboundShipping: 0,
  packaging: 0,
  taxRatePercent: 0,
  amazonCommission: 0,
  amazonLogistics: 0,
  advertising: 0,
  otherExpenses: 0,
  quantity: 1,
  monthlySales: 0,
  sellerCount: 0,
  priceStability: 50,
  demandStability: 50,
  amazonIsSeller: false,
  inventoryRisk: 50,
  dataOrigin: 'INFERRED',
};
const clean = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      item === '' ? null : item,
    ]),
  );
const cleanCatalogValues = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(clean(value)).map(([key, item]) => [key, typeof item === 'number' && item === 0 ? null : item]));
const productToDraft = (p: Product): ProductDraft => {
  const l = p.suppliers[0];
  return {
    name: p.name,
    asin: p.asin ?? '',
    amazonUrl: p.amazonUrl ?? '',
    ean: p.ean ?? '',
    brand: p.brand ?? '',
    category: p.category,
    researchOrigin: p.researchOrigin ?? '',
    strategyType: p.strategyType,
    status: p.status,
    salePrice: p.salePrice ?? 0,
    monthlySalesEstimate: p.monthlySalesEstimate ?? 0,
    sellerCount: p.sellerCount ?? 0,
    amazonIsSeller: p.amazonIsSeller ?? false,
    priceStability: p.priceStability ?? 50,
    demandStability: p.demandStability ?? 50,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    historyAvailable: p.historyAvailable,
    estimatedTurnoverDays: p.estimatedTurnoverDays ?? 30,
    observations: p.observations ?? '',
    brandApprovalStatus: p.brandApprovalStatus,
    amazonApprovalStatus: p.amazonApprovalStatus,
    approvalCheckedAt: p.approvalCheckedAt ?? '',
    approvalNotes: p.approvalNotes ?? '',
    approvalRequiredQuantity: p.approvalRequiredQuantity ?? 1,
    approvalDocumentType: p.approvalDocumentType ?? '',
    purchaseChecklist: { ...p.purchaseChecklist },
    dataOrigin: p.dataOrigin,
    supplierId: l?.supplierId ?? '',
    supplierSku: l?.supplierSku ?? '',
    cost: l?.cost ?? 0,
    stock: l?.stock ?? 0,
    minimumQty: l?.minimumQty ?? 1,
  };
};

export default function Home() {
  const [view, setView] = useState<View>('dashboard'),
    [dashboard, setDashboard] = useState<DashboardData | null>(null),
    [products, setProducts] = useState<Product[]>([]),
    [ranked, setRanked] = useState<RankedCandidate[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [analyses, setAnalyses] = useState<Analysis[]>([]),
    [catalogs, setCatalogs] = useState<Catalog[]>([]),
    [catalogOpportunities, setCatalogOpportunities] = useState<CatalogOpportunity[]>([]),
    [settings, setSettings] = useState<UserSettings | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [settingsOpen, setSettingsOpen] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, p, r, s, st, a, c, co] = await Promise.all([
        api.dashboard(),
        api.products(),
        api.researchCandidates(),
        api.suppliers(),
        api.settings(),
        api.analyses(),
        api.catalogs(),
        api.catalogOpportunities(),
      ]);
      setDashboard(d);
      setProducts(p);
      setRanked(r);
      setSuppliers(s);
      setSettings(st);
      setAnalyses(a);
      setCatalogs(c);
      setCatalogOpportunities(co);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const flash = (m: string) => {
    setNotice(m);
    window.setTimeout(() => setNotice(''), 3500);
  };
  const changed = async (m: string) => {
    flash(m);
    await reload();
  };
  const saveSettings = async (next: UserSettings) => {
    try {
      setSettings(await api.updateSettings(next));
      setSettingsOpen(false);
      await changed('Configurações salvas e persistidas.');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Falha ao salvar configurações.',
      );
    }
  };
  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">
          easy<span>seller</span>
          <small>decisões com dados</small>
        </div>
        <nav>
          {(
            [
              ['dashboard', 'Visão geral', BarChart3],
              ['research', 'Pesquisa', ShieldCheck],
              ['products', 'Produtos', PackageSearch],
              ['calculator', 'Calculadora', Calculator],
              ['suppliers', 'Fornecedores', Truck],
              ['catalogs', 'Catálogos', FileSpreadsheet],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              onClick={() => setView(id)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <p className="local-note">Modo local · PostgreSQL</p>
      </aside>
      <div className="workspace">
        <header className="header">
          <div>
            <small>{view === 'catalogs' ? 'FASE 3 · SUPPLIER INTELLIGENCE' : 'FASE 2 · PESQUISA DE PRODUTOS'}</small>
            <h1>
              {
                {
                  dashboard: 'Visão geral',
                  research: 'Pesquisa de produtos',
                  products: 'Produtos',
                  calculator: 'Calculadora',
                  suppliers: 'Fornecedores',
                  catalogs: 'Catálogos e oportunidades',
                }[view]
              }
            </h1>
          </div>
          <div className="header-actions">
            {dashboard?.isDemo && (
              <span className="demo">Dados de demonstração</span>
            )}
            <button
              className="icon"
              aria-label="Recarregar"
              onClick={() => void reload()}
            >
              <RefreshCw size={18} />
            </button>
            <button className="secondary" onClick={() => setSettingsOpen(true)}>
              <Settings size={17} />
              Configurações
            </button>
          </div>
        </header>
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => setError('')}>
              <X size={16} />
            </button>
          </div>
        )}
        {loading ? (
          <div className="loading">
            <RefreshCw className="spin" />
            Carregando dados persistidos…
          </div>
        ) : (
          <main>
            {view === 'dashboard' && (
              <Dashboard
                data={dashboard}
                analyses={analyses}
                onAnalyze={() => setView('research')}
              />
            )}{' '}
            {view === 'research' && (
              <ResearchView
                ranked={ranked}
                settings={settings}
                suppliers={suppliers}
                changed={changed}
              />
            )}{' '}
            {view === 'products' && (
              <Products
                items={products}
                suppliers={suppliers}
                simple={settings?.simpleMode ?? true}
                changed={changed}
              />
            )}{' '}
            {view === 'calculator' && (
              <CalculatorView
                products={products}
                settings={settings}
                changed={changed}
              />
            )}{' '}
            {view === 'suppliers' && (
              <Suppliers items={suppliers} changed={changed} />
            )}
            {view === 'catalogs' && (
              <CatalogsView catalogs={catalogs} opportunities={catalogOpportunities} suppliers={suppliers} products={products} changed={changed} setError={setError} />
            )}
          </main>
        )}
      </div>
      {settingsOpen && settings && (
        <SettingsModal
          value={settings}
          close={() => setSettingsOpen(false)}
          save={saveSettings}
        />
      )}
    </div>
  );
}

function Dashboard({
  data,
  analyses,
  onAnalyze,
}: {
  data: DashboardData | null;
  analyses: Analysis[];
  onAnalyze: () => void;
}) {
  if (!data) return <Empty text="Não foi possível obter os indicadores." />;
  const cards = [
    [
      'Capital disponível',
      money.format(data.capitalAvailable),
      `Reserva: ${money.format(data.capitalReserve)}`,
    ],
    [
      'Capital em estoque',
      money.format(data.capitalCommitted),
      `${data.activeProducts} produtos ativos`,
    ],
    [
      'Lucro projetado',
      data.projectedProfit == null
        ? 'Dados insuficientes'
        : money.format(data.projectedProfit),
      'Último cenário salvo de cada produto',
    ],
    [
      'ROI médio',
      data.averageRoi == null
        ? 'Dados insuficientes'
        : `${data.averageRoi.toFixed(2)}%`,
      'Último cenário salvo de cada produto',
    ],
  ];
  return (
    <div className="page">
      <section className="hero">
        <div>
          <span>PAINEL OPERACIONAL</span>
          <h2>Decisões reais, sem indicadores inventados.</h2>
          <p>
            Totais calculados a partir dos cadastros e análises persistidos.
          </p>
        </div>
        <button className="primary" onClick={onAnalyze}>
          Analisar produto
        </button>
      </section>
      <section className="metrics">
        {cards.map(([a, b, c]) => (
          <article className="card metric" key={a}>
            <small>{a}</small>
            <strong>{b}</strong>
            <p>{c}</p>
          </article>
        ))}
      </section>
      <section className="card">
        <Title small="HISTÓRICO" title="Análises recentes" />
        {analyses.length ? (
          <div className="analysis-list">
            {analyses.slice(0, 6).map((a) => (
              <div key={a.id}>
                <div>
                  <strong>{a.productName ?? 'Produto'}</strong>
                  <small>
                    {new Date(a.createdAt).toLocaleString('pt-BR')} ·{' '}
                    {a.dataOrigin}
                  </small>
                </div>
                <span className="score">{a.score}</span>
                <div>
                  <strong>{money.format(a.netProfit)}</strong>
                  <small>
                    {a.margin.toFixed(2)}% margem · {a.roi.toFixed(2)}% ROI
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Dados insuficientes. Salve uma análise para gerar histórico e projeções." />
        )}
      </section>
    </div>
  );
}

function ResearchView({
  ranked,
  settings,
  suppliers,
  changed,
}: {
  ranked: RankedCandidate[];
  settings: UserSettings | null;
  suppliers: Supplier[];
  changed: (m: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProductDraft | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [selected, setSelected] = useState<RankedCandidate | null>(null),
    [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      editing
        ? await api.updateProduct(editing, clean(draft))
        : await api.createProduct(clean(draft));
      setDraft(null);
      setEditing(null);
      await changed(editing ? 'Pesquisa atualizada.' : 'Candidato registrado.');
    } finally {
      setBusy(false);
    }
  };
  const edit = (item: RankedCandidate) => {
    setSelected(null);
    setEditing(item.candidate.id);
    setDraft(productToDraft(item.candidate));
  };
  return (
    <div className="page research-page">
      <section className="research-head">
        <div>
          <span className="eyebrow">EXERCÍCIO DE VALIDAÇÃO</span>
          <h2>{ranked.length}/10 candidatos registrados</h2>
          <p>
            Ranking explicável para priorizar pesquisa e teste — nenhuma compra
            é automatizada.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditing(null);
            setDraft({
              ...emptyProduct,
              purchaseChecklist: { ...emptyChecklist },
            });
          }}
        >
          Adicionar candidato
        </button>
      </section>
      <div className="criteria-strip">
        <span>
          Margem mín. <strong>{settings?.targetMarginMin ?? 15}%</strong>
        </span>
        <span>
          Margem ideal <strong>{settings?.targetMarginIdeal ?? 18}%</strong>
        </span>
        <span>
          ROI mín. <strong>{settings?.targetRoiMin ?? 25}%</strong>
        </span>
        <span>
          Giro máx.{' '}
          <strong>{settings?.preferredMaxTurnoverDays ?? 30} dias</strong>
        </span>
        <span>
          Vendedores máx. <strong>{settings?.maximumSellerCount ?? 5}</strong>
        </span>
        <span>
          Exposição/teste{' '}
          <strong>{settings?.maxTestExposurePercent ?? 5}%</strong>
        </span>
      </div>
      {ranked.length ? (
        <section className="candidate-list">
          {ranked.map((item) => (
            <article className="card candidate" key={item.candidate.id}>
              <div className="rank">
                {item.rank}
                <sup>º</sup>
              </div>
              <div className="candidate-main">
                <div className="candidate-title">
                  <div>
                    <span className="tag">
                      {item.candidate.strategyType === 'BRANDED_RESELL'
                        ? 'Revenda de marca'
                        : 'Anúncio genérico'}
                    </span>
                    <h3>{item.candidate.name}</h3>
                    <small>
                      {item.candidate.asin ?? 'ASIN pendente'} ·{' '}
                      {item.candidate.status}
                    </small>
                  </div>
                  <span
                    className={`recommendation ${item.analysis.recommendation.toLowerCase()}`}
                  >
                    {item.analysis.recommendation}
                  </span>
                </div>
                <div className="candidate-metrics">
                  <Result label="Score" value={`${item.analysis.score}/100`} />
                  <Result
                    label="Margem estimada"
                    value={`${item.analysis.estimatedMarginPercent.toFixed(1)}%`}
                  />
                  <Result
                    label="ROI estimado"
                    value={`${item.analysis.estimatedRoiPercent.toFixed(1)}%`}
                  />
                  <Result
                    label="Capital exposto"
                    value={money.format(item.analysis.estimatedCapitalExposure)}
                  />
                </div>
                <p className="comparison">
                  <strong>Por que está aqui:</strong> {item.comparisonReason}
                </p>
                {item.analysis.restrictions.length > 0 && (
                  <div className="approval-alert">
                    <strong>Restrição de autorização</strong>
                    {item.analysis.restrictions.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                  </div>
                )}
                <div className="candidate-actions">
                  <button onClick={() => setSelected(item)}>
                    Ver explicação
                  </button>
                  <button onClick={() => edit(item)}>Editar pesquisa</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <Empty text="Adicione os candidatos da mentoria para gerar a comparação." />
      )}
      {draft && (
        <ProductModal
          value={draft}
          suppliers={suppliers}
          busy={busy}
          title={editing ? 'Editar pesquisa' : 'Novo candidato'}
          change={setDraft}
          close={() => setDraft(null)}
          submit={() => void submit()}
        />
      )}{' '}
      {selected && (
        <Modal
          title={`${selected.rank}º · ${selected.candidate.name}`}
          close={() => setSelected(null)}
        >
          <div className="research-detail">
            <h3>Motivos financeiros</h3>
            {selected.analysis.reasons.map((x) => (
              <p key={x}>• {x}</p>
            ))}
            <h3>Leitura da estratégia</h3>
            {selected.analysis.strategySignals.map((x) => (
              <p key={x}>• {x}</p>
            ))}
            <h3>Autorização Amazon</h3>
                <p>
                  <strong>{selected.candidate.amazonApprovalStatus}</strong>
                  {selected.candidate.approvalNotes
                    ? ` · ${selected.candidate.approvalNotes}`
                    : ''}
                </p>
                <p>
                  Marca: <strong>{selected.candidate.brandApprovalStatus}</strong>
                </p>
            {selected.analysis.restrictions.map((x) => (
              <p className="restriction" key={x}>
                ⚠ {x}
              </p>
            ))}
            <h3>Checklist humano antes de comprar</h3>
            <ChecklistReadOnly value={selected.candidate.purchaseChecklist} />
            <small>
              O Easy Seller recomenda pesquisa ou teste. A decisão e a compra
              continuam humanas.
            </small>
          </div>
          <div className="modal-actions">
            <button className="primary" onClick={() => edit(selected)}>
              Editar e validar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ChecklistReadOnly({ value }: { value: Product['purchaseChecklist'] }) {
  const rows: [keyof Product['purchaseChecklist'], string][] = [
    ['checkedAmazonApproval', 'Verifiquei autorização na Amazon'],
    ['hasValidSupplier', 'Tenho fornecedor válido'],
    ['supplierDocumentAccepted', 'O fornecedor emite NF/documento aceito'],
    ['requiredQuantityViable', 'Quantidade mínima exigida é viável'],
    ['approvalCompletedIfNeeded', 'Aprovação concluída, se necessária'],
  ];
  return (
    <div className="checklist-read">
      {rows.map(([key, label]) => (
        <p key={key}>
          {value[key] ? '☑' : '☐'} {label}
        </p>
      ))}
    </div>
  );
}

function Products({
  items,
  suppliers,
  simple,
  changed,
}: {
  items: Product[];
  suppliers: Supplier[];
  simple: boolean;
  changed: (m: string) => Promise<void>;
}) {
  const [q, setQ] = useState(''),
    [draft, setDraft] = useState<ProductDraft | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [selected, setSelected] = useState<Product | null>(null),
    [busy, setBusy] = useState(false);
  const visible = items.filter((p) =>
    `${p.name} ${p.asin ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  );
  const edit = (p: Product) => {
    setEditing(p.id);
    setDraft(productToDraft(p));
  };
  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      editing
        ? await api.updateProduct(editing, clean(draft))
        : await api.createProduct(clean(draft));
      setDraft(null);
      setEditing(null);
      await changed(editing ? 'Produto atualizado.' : 'Produto cadastrado.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (p: Product) => {
    if (!confirm(`Excluir “${p.name}” e suas análises?`)) return;
    await api.deleteProduct(p.id);
    setSelected(null);
    await changed('Produto excluído.');
  };
  return (
    <div className="page">
      <div className="toolbar">
        <label className="search">
          Buscar produto ou ASIN
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite para filtrar"
          />
        </label>
        <button
          className="primary"
          onClick={() => {
            setEditing(null);
            setDraft({ ...emptyProduct });
          }}
        >
          Novo produto
        </button>
      </div>
      <section className="card table-wrap">
        {visible.length ? (
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Estratégia</th>
                <th>Preço</th>
                <th>Fornecedor/custo</th>
                {!simple && (
                  <>
                    <th>Vendas</th>
                    <th>Concorrentes</th>
                  </>
                )}
                <th>Última análise</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>
                      {p.asin ?? 'ASIN não informado'} · {p.category}
                    </small>
                  </td>
                  <td>
                    {p.strategyType === 'BRANDED_RESELL'
                      ? 'Revenda'
                      : 'Novo anúncio'}
                  </td>
                  <td>
                    {p.salePrice == null
                      ? 'Não informado'
                      : money.format(p.salePrice)}
                  </td>
                  <td>
                    {p.suppliers[0] ? (
                      <>
                        {p.suppliers[0].supplierName}
                        <small>{money.format(p.suppliers[0].cost)}</small>
                      </>
                    ) : (
                      'Não associado'
                    )}
                  </td>
                  {!simple && (
                    <>
                      <td>{p.monthlySalesEstimate ?? '—'}</td>
                      <td>{p.sellerCount ?? '—'}</td>
                    </>
                  )}
                  <td>
                    {p.latestAnalysis ? (
                      <>
                        <span className="score">{p.latestAnalysis.score}</span>
                        <small>
                          {p.latestAnalysis.margin.toFixed(2)}% margem
                        </small>
                      </>
                    ) : (
                      'Dados insuficientes'
                    )}
                  </td>
                  <td className="actions">
                    <button onClick={() => setSelected(p)}>Detalhes</button>
                    <button onClick={() => edit(p)}>Editar</button>
                    <button
                      className="danger-link"
                      onClick={() => void remove(p)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="Nenhum produto encontrado." />
        )}
      </section>
      {draft && (
        <ProductModal
          value={draft}
          suppliers={suppliers}
          busy={busy}
          title={editing ? 'Editar produto' : 'Novo produto'}
          change={setDraft}
          close={() => setDraft(null)}
          submit={() => void submit()}
        />
      )}{' '}
      {selected && (
        <Modal title={selected.name} close={() => setSelected(null)}>
          <dl className="details">
            <div>
              <dt>ASIN</dt>
              <dd>{selected.asin ?? 'Não informado'}</dd>
            </div>
            <div>
              <dt>Preço atual</dt>
              <dd><AmazonValue signal={selected.amazonIntelligence?.price} format={(value) => value == null ? '—' : money.format(value)} /></dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
            <div>
              <dt>Buy Box</dt>
              <dd><AmazonValue signal={selected.amazonIntelligence?.buyBoxPrice} format={(value) => value == null ? '—' : money.format(value)} /></dd>
            </div>
            <div>
              <dt>Vendedores</dt>
              <dd><AmazonValue signal={selected.amazonIntelligence?.sellerCount} /></dd>
            </div>
            <div>
              <dt>Amazon vende</dt>
              <dd><AmazonValue signal={selected.amazonIntelligence?.amazonIsSeller} format={(value) => value ? 'Sim' : 'Não'} /></dd>
            </div>
            <div>
              <dt>Giro estimado</dt>
              <dd>{selected.estimatedTurnoverDays == null ? '—' : <span title="INFERRED · derivado de Sales Rank">{selected.estimatedTurnoverDays} dias · INFERRED</span>}</dd>
            </div>
            <div>
              <dt>Quantidade sugerida</dt>
              <dd>{selected.recommendedQuantity ?? '—'}</dd>
            </div>
            <div>
              <dt>Preço máximo</dt>
              <dd>{selected.latestAnalysis ? money.format(selected.latestAnalysis.maxPurchasePrice) : '—'}</dd>
            </div>
          </dl>
          {selected.latestAnalysis ? (
            <div className="result">
              <strong>Score {selected.latestAnalysis.score}/100</strong>
              <p>
                Lucro {money.format(selected.latestAnalysis.netProfit)} · Margem{' '}
                {selected.latestAnalysis.margin.toFixed(2)}% · ROI{' '}
                {selected.latestAnalysis.roi.toFixed(2)}%
              </p>
            </div>
          ) : (
            <Empty text="Ainda não há análise salva para este produto." />
          )}
          <div className="modal-actions">
            <button className="danger" onClick={() => void remove(selected)}>
              Excluir
            </button>
            <button
              className="secondary"
              onClick={() => {
                setSelected(null);
                edit(selected);
              }}
            >
              Editar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Suppliers({
  items,
  changed,
}: {
  items: Supplier[];
  changed: (m: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SupplierDraft | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const edit = (s: Supplier) => {
    setEditing(s.id);
    setDraft({
      name: s.name,
      legalName: s.legalName ?? '',
      cnpj: s.cnpj ?? '',
      contact: s.contact ?? '',
      phone: s.phone ?? '',
      whatsapp: s.whatsapp ?? '',
      email: s.email ?? '',
      website: s.website ?? '',
      city: s.city ?? '',
      state: s.state ?? '',
      notes: s.notes ?? '',
      minimumOrder: s.minimumOrder ?? 0,
      issuesInvoice: s.issuesInvoice,
      hasCatalog: s.hasCatalog,
    });
  };
  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      editing
        ? await api.updateSupplier(editing, clean(draft))
        : await api.createSupplier(clean(draft));
      setDraft(null);
      setEditing(null);
      await changed(
        editing ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.',
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async (s: Supplier) => {
    if (!confirm(`Excluir “${s.name}”?`)) return;
    try {
      await api.deleteSupplier(s.id);
      await changed('Fornecedor excluído.');
    } catch {
      alert('O fornecedor possui vínculos que impedem a exclusão.');
    }
  };
  return (
    <div className="page">
      <div className="toolbar">
        <p>Cadastre contatos e condições reais de compra.</p>
        <button
          className="primary"
          onClick={() => {
            setEditing(null);
            setDraft({ ...emptySupplier });
          }}
        >
          Novo fornecedor
        </button>
      </div>
      <section className="supplier-grid">
        {items.map((s) => (
          <article className="card supplier-card" key={s.id}>
            <div>
              <span className="tag">
                {s.issuesInvoice ? 'Emite NF' : 'NF não informada'}
              </span>
              {s.hasCatalog && <span className="tag">Possui catálogo</span>}
            </div>
            <h2>{s.name}</h2>
            <p>
              {[s.city, s.state].filter(Boolean).join(', ') ||
                'Local não informado'}
            </p>
            <dl>
              <div>
                <dt>Contato</dt>
                <dd>{s.contact || 'Não informado'}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{s.whatsapp || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Pedido mínimo</dt>
                <dd>
                  {s.minimumOrder == null
                    ? 'Não informado'
                    : money.format(s.minimumOrder)}
                </dd>
              </div>
              <div>
                <dt>Produtos</dt>
                <dd>{s.productCount ?? 0}</dd>
              </div>
            </dl>
            <div className="actions">
              <button onClick={() => edit(s)}>Editar</button>
              <button className="danger-link" onClick={() => void remove(s)}>
                Excluir
              </button>
            </div>
          </article>
        ))}
        <button
          className="add-card"
          onClick={() => {
            setEditing(null);
            setDraft({ ...emptySupplier });
          }}
        >
          + Adicionar fornecedor
        </button>
      </section>
      {!items.length && <Empty text="Nenhum fornecedor cadastrado." />}
      {draft && (
        <SupplierModal
          title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
          value={draft}
          busy={busy}
          change={setDraft}
          close={() => setDraft(null)}
          submit={() => void submit()}
        />
      )}
    </div>
  );
}

function CalculatorView({
  products,
  settings,
  changed,
}: {
  products: Product[];
  settings: UserSettings | null;
  changed: (m: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CalcDraft>({ ...emptyCalc }),
    [result, setResult] = useState<CalculationResponse | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const select = (id: string) => {
    const p = products.find((x) => x.id === id),
      l = p?.suppliers[0];
    setDraft({
      ...draft,
      productId: id,
      salePrice: p?.salePrice ?? 0,
      productCost: l?.cost ?? 0,
      monthlySales: p?.monthlySalesEstimate ?? 0,
      sellerCount: p?.sellerCount ?? 0,
      priceStability: p?.priceStability ?? 50,
      demandStability: p?.demandStability ?? 50,
      amazonIsSeller: p?.amazonIsSeller ?? false,
      dataOrigin: p?.dataOrigin ?? 'INFERRED',
    });
    setResult(null);
  };
  const payload = () => ({
    productId: draft.productId,
    salePrice: draft.salePrice,
    productCost: draft.productCost,
    inboundShipping: draft.inboundShipping,
    packaging: draft.packaging,
    taxRate: draft.taxRatePercent / 100,
    amazonCommission: draft.amazonCommission,
    amazonLogistics: draft.amazonLogistics,
    advertising: draft.advertising,
    otherExpenses: draft.otherExpenses,
    quantity: draft.quantity,
    targetMarginRate: (settings?.targetMarginMin ?? 15) / 100,
    monthlySales: draft.monthlySales,
    sellerCount: draft.sellerCount,
    priceStability: draft.priceStability,
    demandStability: draft.demandStability,
    amazonIsSeller: draft.amazonIsSeller,
    inventoryRisk: draft.inventoryRisk,
    dataOrigin: draft.dataOrigin,
  });
  const calculate = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await api.calculate(payload()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no cálculo.');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!draft.productId) {
      setError('Selecione um produto antes de salvar.');
      return;
    }
    setBusy(true);
    try {
      await api.saveAnalysis(payload());
      await changed('Análise salva no histórico.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  };
  const fields: [keyof CalcDraft, string][] = [
    ['salePrice', 'Preço de venda'],
    ['productCost', 'Custo do produto'],
    ['inboundShipping', 'Frete de compra'],
    ['packaging', 'Embalagem'],
    ['taxRatePercent', 'Imposto (%)'],
    ['amazonCommission', 'Comissão Amazon'],
    ['amazonLogistics', 'Logística Amazon'],
    ['advertising', 'Publicidade'],
    ['otherExpenses', 'Outras despesas'],
    ['quantity', 'Quantidade'],
    ['monthlySales', 'Vendas/mês'],
    ['sellerCount', 'Vendedores'],
    ['priceStability', 'Estabilidade de preço'],
    ['demandStability', 'Estabilidade da demanda'],
    ['inventoryRisk', 'Risco de estoque'],
  ];
  return (
    <div className="page calc-layout">
      <section className="card form-card">
        <Title small="CENÁRIO" title="Premissas editáveis" />
        <label>
          Produto
          <select
            value={draft.productId}
            onChange={(e) => select(e.target.value)}
          >
            <option value="">Cenário avulso</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft[key] as number}
                onChange={(e) =>
                  setDraft({ ...draft, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.amazonIsSeller}
            onChange={(e) =>
              setDraft({ ...draft, amazonIsSeller: e.target.checked })
            }
          />
          A Amazon também vende este produto
        </label>
        {error && <p className="inline-error">{error}</p>}
        <button
          className="primary wide"
          disabled={busy}
          onClick={() => void calculate()}
        >
          {busy ? 'Calculando…' : 'Calcular cenário'}
        </button>
      </section>
      <section className="card results">
        {result ? (
          <>
            <span className="score-large">
              {result.score}
              <small>/100 · {result.classification}</small>
            </span>
            <div className="result-grid">
              <Result
                label="Lucro líquido/un."
                value={money.format(result.netProfitPerUnit)}
              />
              <Result
                label="Despesas/un."
                value={money.format(result.totalExpensesPerUnit)}
              />
              <Result
                label="Margem"
                value={`${result.netMarginPercent.toFixed(2)}%`}
              />
              <Result label="ROI" value={`${result.roiPercent.toFixed(2)}%`} />
              <Result
                label="Markup"
                value={`${result.markupPercent.toFixed(2)}%`}
              />
              <Result
                label="Ponto de equilíbrio"
                value={money.format(result.breakEvenPrice)}
              />
              <Result
                label="Preço máx. compra"
                value={money.format(result.maxPurchasePrice)}
              />
              <Result
                label="Capital necessário"
                value={money.format(result.requiredCapital)}
              />
            </div>
            {result.positives.length > 0 && (
              <div className="signals good">
                <strong>Pontos positivos</strong>
                {result.positives.map((x) => (
                  <p key={x}>✓ {x}</p>
                ))}
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="signals warning">
                <strong>Alertas</strong>
                {result.warnings.map((x) => (
                  <p key={x}>• {x}</p>
                ))}
              </div>
            )}
            <button
              className="primary wide"
              disabled={busy || !draft.productId}
              onClick={() => void save()}
            >
              Salvar análise
            </button>
            {!draft.productId && (
              <small>Selecione um produto para persistir este cenário.</small>
            )}
          </>
        ) : (
          <Empty text="Preencha as premissas e calcule. Nenhum resultado é presumido." />
        )}
      </section>
    </div>
  );
}

function CatalogsView({
  catalogs,
  opportunities,
  suppliers,
  products,
  changed,
  setError,
}: {
  catalogs: Catalog[];
  opportunities: CatalogOpportunity[];
  suppliers: Supplier[];
  products: Product[];
  changed: (message: string) => Promise<void>;
  setError: (message: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(catalogs[0]?.id ?? '');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [catalogName, setCatalogName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [manual, setManual] = useState({ supplierSku: '', ean: '', name: '', brand: '', model: '', variant: '', unitPrice: 0, unitsPerBox: 0, minimumUnits: 0, availability: '' });
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const selected = catalogs.find((catalog) => catalog.id === selectedId) ?? catalogs[0];
  const run = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true); setError('');
    try { await operation(); await changed(message); }
    catch (error) { setError(error instanceof Error ? error.message : 'Falha na operação do catálogo.'); }
    finally { setBusy(false); }
  };
  const upload = () => run(async () => {
    if (!supplierId || !catalogName || !file) throw new Error('Informe fornecedor, nome e arquivo.');
    const data = new FormData(); data.set('supplierId', supplierId); data.set('name', catalogName); data.set('file', file);
    await api.uploadCatalog(data);
  }, 'Arquivo original preservado e importação enviada ao worker.');
  const reference = () => run(() => api.createCatalogReference({ supplierId, name: catalogName, sourceUrl: url }), 'URL registrada como referência, sem presumir conteúdo.');
  const createManual = () => run(() => api.createManualCatalog({ supplierId, name: catalogName, products: [cleanCatalogValues(manual)] }), 'Catálogo manual enviado para validação.');
  const review = (id: string, action: 'CONFIRM' | 'IGNORE' | 'MERGE', mergeProductId?: string) => run(() => api.reviewCatalogProduct(id, { action, mergeProductId }), `Item ${action === 'CONFIRM' ? 'confirmado' : action === 'IGNORE' ? 'ignorado' : 'mesclado'} e pipeline atualizado.`);
  return (
    <div className="page">
      <section className="hero">
        <div><span>INGESTÃO VERSIONADA</span><h2>Do catálogo à shortlist</h2><p>CSV, XLSX, PDF, entrada manual e URL de referência. Sem consulta automática à Amazon.</p></div>
        <span className="tag">{opportunities.length} oportunidades validadas</span>
      </section>
      <section className="catalog-import-grid">
        <article className="card">
          <h3>Novo catálogo</h3>
          <label>Fornecedor<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Selecione</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <label>Nome<input value={catalogName} onChange={(event) => setCatalogName(event.target.value)} placeholder="Tabela setembro 2026" /></label>
          <label>Arquivo CSV, XLSX ou PDF<input type="file" accept=".csv,.xlsx,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          <button className="primary wide" disabled={busy} onClick={() => void upload()}>Enviar e processar</button>
        </article>
        <article className="card">
          <h3>URL como referência</h3>
          <p className="muted">A URL é armazenada; o conteúdo não é importado nem inferido automaticamente.</p>
          <label>URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://fornecedor.exemplo/catalogo" /></label>
          <button className="secondary wide" disabled={busy} onClick={() => void reference()}>Registrar referência</button>
        </article>
        <article className="card">
          <h3>Catálogo manual</h3>
          <div className="form-grid compact">
            <Text label="SKU fornecedor" value={manual.supplierSku} change={(supplierSku) => setManual({ ...manual, supplierSku })} />
            <Text label="EAN/GTIN" value={manual.ean} change={(ean) => setManual({ ...manual, ean })} />
            <Text label="Nome" value={manual.name} change={(name) => setManual({ ...manual, name })} />
            <Text label="Marca" value={manual.brand} change={(brand) => setManual({ ...manual, brand })} />
            <Num label="Preço" value={manual.unitPrice} change={(unitPrice) => setManual({ ...manual, unitPrice })} />
            <Num label="Unidades/caixa" value={manual.unitsPerBox} change={(unitsPerBox) => setManual({ ...manual, unitsPerBox })} />
            <Num label="Pedido mínimo" value={manual.minimumUnits} change={(minimumUnits) => setManual({ ...manual, minimumUnits })} />
            <Text label="Disponibilidade" value={manual.availability} change={(availability) => setManual({ ...manual, availability })} />
          </div>
          <button className="secondary wide" disabled={busy} onClick={() => void createManual()}>Criar versão manual</button>
        </article>
      </section>
      <section className="card">
        <div className="research-head"><div><small>VERSÕES IMUTÁVEIS</small><h2>Catálogos</h2></div><select className="catalog-select" value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>{catalogs.map((catalog) => <option key={catalog.id} value={catalog.id}>{catalog.supplierName} · {catalog.name} · v{catalog.version}</option>)}</select></div>
        {!selected ? <Empty text="Nenhum catálogo importado." /> : <>
          <div className="catalog-summary"><span className={`status-pill ${selected.status.toLowerCase()}`}>{selected.status}</span><strong>{selected.import?.progressPercent ?? 0}%</strong><span>{selected.totalDetectedProducts} detectados</span><span>{selected.totalValidatedProducts} validados</span><span>{selected.changes.length} alterações</span></div>
          {selected.import?.error && <p className="inline-error">{selected.import.error}</p>}
          {selected.import?.progressPercent === 100 && selected.products.length === 0 && <Empty text="Nenhum produto foi detectado automaticamente neste catálogo. O arquivo original foi preservado para revisão manual." />}
          <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Preço / caixa</th><th>Investimento</th><th>Confiança</th><th>Status</th><th>Revisão</th></tr></thead><tbody>
            {selected.products.map((item) => <tr key={item.id}><td><strong>{item.name ?? 'Nome ausente'}</strong><small>{item.supplierSku ?? 'Sem SKU'} · {item.ean ?? item.gtin ?? 'Sem GTIN'}</small></td><td>{item.unitPrice == null ? '—' : money.format(item.unitPrice)}<small>{item.unitsPerBox == null ? 'Caixa não informada' : `${item.unitsPerBox} un./caixa`}</small></td><td>{item.minimumInvestment == null ? '—' : money.format(item.minimumInvestment)}<small>{item.capitalExposurePercentage == null ? 'Exposição não calculável' : `${item.capitalExposurePercentage.toFixed(2)}% do capital`}</small></td><td><strong>{Math.round(item.overallConfidence * 100)}%</strong><small>{Object.keys(item.fieldConfidence).length} campos com evidência</small></td><td><span className={`status-pill ${item.status.toLowerCase()}`}>{item.status}</span></td><td><div className="review-actions"><button onClick={() => void review(item.id, 'CONFIRM')}>CONFIRMAR</button><button onClick={() => setEditing(item)}>EDITAR</button><button onClick={() => void review(item.id, 'IGNORE')}>IGNORAR</button><select value={mergeTargets[item.id] ?? ''} onChange={(event) => setMergeTargets({ ...mergeTargets, [item.id]: event.target.value })}><option value="">Mesclar com…</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><button disabled={!mergeTargets[item.id]} onClick={() => void review(item.id, 'MERGE', mergeTargets[item.id])}>MESCLAR</button></div></td></tr>)}
          </tbody></table></div>
          {selected.changes.length > 0 && <div className="changes"><h3>Comparação com a versão anterior</h3>{selected.changes.map((change) => <span className="tag" key={change.id}>{change.changeType.replaceAll('_', ' ')} · {change.productKey}</span>)}</div>}
        </>}
      </section>
      <section className="card"><Title small="PIPELINE PÓS-VALIDAÇÃO" title="Shortlist de oportunidades" />
        {opportunities.length === 0 ? <Empty text="Confirme itens do catálogo para alimentar a shortlist." /> : <div className="table-wrap"><table><thead><tr><th>#</th><th>Produto</th><th>Fornecedor</th><th>Investimento</th><th>Critério</th><th>Amazon</th></tr></thead><tbody>{opportunities.map((item) => <tr key={item.catalogProduct.id}><td><strong>{item.rank}</strong></td><td>{item.catalogProduct.name}</td><td>{item.supplierName}<small>Catálogo v{item.catalogVersion}</small></td><td>{item.catalogProduct.minimumInvestment == null ? '—' : money.format(item.catalogProduct.minimumInvestment)}</td><td>{item.shortlistReason}</td><td><span className="status-pill pending">NÃO CONSULTADO</span></td></tr>)}</tbody></table></div>}
      </section>
      {editing && <CatalogProductEdit item={editing} close={() => setEditing(null)} save={(values) => run(async () => { await api.reviewCatalogProduct(editing.id, { action: 'EDIT', values }); setEditing(null); }, 'Item editado, confirmado e enviado ao pipeline.')} />}
    </div>
  );
}

function CatalogProductEdit({ item, close, save }: { item: CatalogProduct; close: () => void; save: (values: Record<string, unknown>) => Promise<void> }) {
  const [value, setValue] = useState({ supplierSku: item.supplierSku ?? '', ean: item.ean ?? item.gtin ?? '', name: item.name ?? '', brand: item.brand ?? '', model: item.model ?? '', variant: item.variant ?? '', unitPrice: item.unitPrice ?? 0, unitsPerBox: item.unitsPerBox ?? 0, minimumBoxes: item.minimumBoxes ?? 0, minimumUnits: item.minimumUnits ?? 0, availability: item.availability ?? '' });
  return <Modal title="Editar produto extraído" close={close}><div className="form-grid"><Text label="SKU fornecedor" value={value.supplierSku} change={(supplierSku) => setValue({ ...value, supplierSku })} /><Text label="EAN/GTIN" value={value.ean} change={(ean) => setValue({ ...value, ean })} /><Text label="Nome" value={value.name} change={(name) => setValue({ ...value, name })} /><Text label="Marca" value={value.brand} change={(brand) => setValue({ ...value, brand })} /><Text label="Modelo" value={value.model} change={(model) => setValue({ ...value, model })} /><Text label="Variante" value={value.variant} change={(variant) => setValue({ ...value, variant })} /><Num label="Preço unitário" value={value.unitPrice} change={(unitPrice) => setValue({ ...value, unitPrice })} /><Num label="Unidades por caixa" value={value.unitsPerBox} change={(unitsPerBox) => setValue({ ...value, unitsPerBox })} /><Num label="Caixas mínimas" value={value.minimumBoxes} change={(minimumBoxes) => setValue({ ...value, minimumBoxes })} /><Num label="Pedido mínimo (un.)" value={value.minimumUnits} change={(minimumUnits) => setValue({ ...value, minimumUnits })} /><Text label="Disponibilidade" value={value.availability} change={(availability) => setValue({ ...value, availability })} /></div><div className="modal-actions"><button className="secondary" onClick={close}>Cancelar</button><button className="primary" onClick={() => void save(cleanCatalogValues(value))}>Salvar e confirmar</button></div></Modal>;
}

function ProductModal({
  value,
  suppliers,
  busy,
  title,
  change,
  close,
  submit,
}: {
  value: ProductDraft;
  suppliers: Supplier[];
  busy: boolean;
  title: string;
  change: (v: ProductDraft) => void;
  close: () => void;
  submit: () => void;
}) {
  const readyToBuyAllowed =
    Object.values(value.purchaseChecklist).every(Boolean) &&
    (value.strategyType !== 'BRANDED_RESELL' ||
      (['OPEN', 'APPROVED'].includes(value.amazonApprovalStatus) &&
        ['NOT_REQUIRED', 'APPROVED'].includes(value.brandApprovalStatus)));
  return (
    <Modal title={title} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="form-grid">
          <Text
            label="Nome"
            value={value.name}
            required
            change={(name) => change({ ...value, name })}
          />
          <Text
            label="Categoria"
            value={value.category}
            required
            change={(category) => change({ ...value, category })}
          />
          <Text
            label="ASIN"
            value={value.asin}
            change={(asin) => change({ ...value, asin })}
          />
          <Text
            label="URL Amazon"
            type="url"
            value={value.amazonUrl}
            change={(amazonUrl) => change({ ...value, amazonUrl })}
          />
          <Text
            label="Origem da oportunidade"
            value={value.researchOrigin}
            change={(researchOrigin) => change({ ...value, researchOrigin })}
          />
          <Text
            label="EAN"
            value={value.ean}
            change={(ean) => change({ ...value, ean })}
          />
          <Text
            label="Marca"
            value={value.brand}
            change={(brand) => change({ ...value, brand })}
          />
          <label>
            Estratégia
            <select
              value={value.strategyType}
              onChange={(e) =>
                change({
                  ...value,
                  strategyType: e.target.value as ProductDraft['strategyType'],
                })
              }
            >
              <option value="BRANDED_RESELL">Revenda de marca</option>
              <option value="GENERIC_LISTING">Novo anúncio/genérico</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={value.status}
              onChange={(e) =>
                change({
                  ...value,
                  status: e.target.value as Product['status'],
                })
              }
            >
              <option value="CANDIDATE">Candidato</option>
              <option value="RESEARCH">Em pesquisa</option>
              <option value="VALIDATION">Em validação</option>
              <option value="RESEARCHING">Pesquisando (legado)</option>
              <option value="TEST">Em teste</option>
              <option value="READY_TO_BUY" disabled={!readyToBuyAllowed}>
                Pronto para comprar
              </option>
              <option value="APPROVED">Aprovado</option>
              <option value="WATCHING">Monitorar</option>
              <option value="DISCARDED">Descartado</option>
            </select>
          </label>
          <Num
            label="Preço de venda"
            value={value.salePrice}
            change={(salePrice) => change({ ...value, salePrice })}
          />
          <Num
            label="Vendas/mês"
            value={value.monthlySalesEstimate}
            change={(monthlySalesEstimate) =>
              change({ ...value, monthlySalesEstimate })
            }
          />
          <Num
            label="Vendedores"
            value={value.sellerCount}
            change={(sellerCount) => change({ ...value, sellerCount })}
          />
          <Num
            label="Avaliação (0 a 5)"
            value={value.rating}
            change={(rating) => change({ ...value, rating })}
          />
          <Num
            label="Quantidade de avaliações"
            value={value.reviewCount}
            change={(reviewCount) => change({ ...value, reviewCount })}
          />
          <Num
            label="Giro estimado (dias)"
            value={value.estimatedTurnoverDays}
            change={(estimatedTurnoverDays) =>
              change({ ...value, estimatedTurnoverDays })
            }
          />
          <Num
            label="Estabilidade preço"
            value={value.priceStability}
            change={(priceStability) => change({ ...value, priceStability })}
          />
          <Num
            label="Estabilidade demanda"
            value={value.demandStability}
            change={(demandStability) => change({ ...value, demandStability })}
          />
          <label>
            Origem
            <select
              value={value.dataOrigin}
              onChange={(e) =>
                change({
                  ...value,
                  dataOrigin: e.target.value as Product['dataOrigin'],
                })
              }
            >
              <option value="REAL">Real</option>
              <option value="ESTIMATED">Estimado</option>
              <option value="INFERRED">Inferido</option>
            </select>
          </label>
          <label>
            Fornecedor
            <select
              value={value.supplierId}
              onChange={(e) => change({ ...value, supplierId: e.target.value })}
            >
              <option value="">Sem fornecedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Text
            label="SKU fornecedor"
            value={value.supplierSku}
            change={(supplierSku) => change({ ...value, supplierSku })}
          />
          <Num
            label="Custo"
            value={value.cost}
            change={(cost) => change({ ...value, cost })}
          />
          <Num
            label="Estoque"
            value={value.stock}
            change={(stock) => change({ ...value, stock })}
          />
          <Num
            label="Qtd. mínima"
            value={value.minimumQty}
            change={(minimumQty) => change({ ...value, minimumQty })}
          />
          <label>
            Autorização da marca
            <select
              value={value.brandApprovalStatus}
              onChange={(e) =>
                change({
                  ...value,
                  brandApprovalStatus: e.target.value as Product['brandApprovalStatus'],
                })
              }
            >
              {['UNKNOWN', 'NOT_REQUIRED', 'REQUIRED', 'APPROVED', 'REJECTED'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Autorização na Amazon
            <select
              value={value.amazonApprovalStatus}
              onChange={(e) =>
                change({
                  ...value,
                  amazonApprovalStatus: e.target.value as Product['amazonApprovalStatus'],
                })
              }
            >
              {['NOT_CHECKED', 'OPEN', 'REQUIRES_INVOICE', 'REQUIRES_10_UNITS', 'REQUIRES_LOA', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'UNAVAILABLE'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <Text
            label="Autorização verificada em"
            type="datetime-local"
            value={value.approvalCheckedAt.slice(0, 16)}
            change={(approvalCheckedAt) => change({ ...value, approvalCheckedAt })}
          />
          <Text
            label="Documento exigido"
            value={value.approvalDocumentType}
            change={(approvalDocumentType) => change({ ...value, approvalDocumentType })}
          />
          <Num
            label="Quantidade exigida"
            value={value.approvalRequiredQuantity}
            change={(approvalRequiredQuantity) => change({ ...value, approvalRequiredQuantity })}
          />
        </div>
        <label>
          Observações da pesquisa
          <textarea value={value.observations} onChange={(e) => change({ ...value, observations: e.target.value })} />
        </label>
        <label>
          Observações da exigência Amazon
          <textarea value={value.approvalNotes} onChange={(e) => change({ ...value, approvalNotes: e.target.value })} />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={value.amazonIsSeller}
            onChange={(e) =>
              change({ ...value, amazonIsSeller: e.target.checked })
            }
          />
          Amazon é vendedora
        </label>
        <label className="check">
          <input type="checkbox" checked={value.historyAvailable} onChange={(e) => change({ ...value, historyAvailable: e.target.checked })} />
          Histórico disponível
        </label>
        <fieldset className="purchase-checklist">
          <legend>Checklist humano antes de comprar</legend>
          {([['checkedAmazonApproval','Verifiquei autorização na Amazon'],['hasValidSupplier','Tenho fornecedor válido'],['supplierDocumentAccepted','O fornecedor emite NF/documento aceito'],['requiredQuantityViable','Quantidade mínima exigida para aprovação é viável'],['approvalCompletedIfNeeded','Aprovação concluída, se necessária']] as [keyof Product['purchaseChecklist'],string][]).map(([key,label])=><label className="check" key={key}><input type="checkbox" checked={value.purchaseChecklist[key]} onChange={(e)=>change({...value,purchaseChecklist:{...value.purchaseChecklist,[key]:e.target.checked}})}/>{label}</label>)}
          {value.status === 'READY_TO_BUY' && !Object.values(value.purchaseChecklist).every(Boolean) && <p className="inline-error">Conclua os requisitos obrigatórios antes de salvar como READY_TO_BUY.</p>}
        </fieldset>
        <Actions busy={busy} close={close} />
      </form>
    </Modal>
  );
}
function SupplierModal({
  value,
  busy,
  title,
  change,
  close,
  submit,
}: {
  value: SupplierDraft;
  busy: boolean;
  title: string;
  change: (v: SupplierDraft) => void;
  close: () => void;
  submit: () => void;
}) {
  return (
    <Modal title={title} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="form-grid">
          <Text
            label="Nome"
            value={value.name}
            required
            change={(name) => change({ ...value, name })}
          />
          <Text
            label="Razão social"
            value={value.legalName}
            change={(legalName) => change({ ...value, legalName })}
          />
          <Text
            label="CNPJ"
            value={value.cnpj}
            change={(cnpj) => change({ ...value, cnpj })}
          />
          <Text
            label="Contato"
            value={value.contact}
            change={(contact) => change({ ...value, contact })}
          />
          <Text
            label="Telefone"
            value={value.phone}
            change={(phone) => change({ ...value, phone })}
          />
          <Text
            label="WhatsApp"
            value={value.whatsapp}
            change={(whatsapp) => change({ ...value, whatsapp })}
          />
          <Text
            label="E-mail"
            type="email"
            value={value.email}
            change={(email) => change({ ...value, email })}
          />
          <Text
            label="Website"
            value={value.website}
            change={(website) => change({ ...value, website })}
          />
          <Text
            label="Cidade"
            value={value.city}
            change={(city) => change({ ...value, city })}
          />
          <Text
            label="UF"
            value={value.state}
            change={(state) =>
              change({ ...value, state: state.toUpperCase().slice(0, 2) })
            }
          />
          <Num
            label="Pedido mínimo"
            value={value.minimumOrder}
            change={(minimumOrder) => change({ ...value, minimumOrder })}
          />
        </div>
        <label>
          Observações
          <textarea
            value={value.notes}
            onChange={(e) => change({ ...value, notes: e.target.value })}
          />
        </label>
        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={value.issuesInvoice}
              onChange={(e) =>
                change({ ...value, issuesInvoice: e.target.checked })
              }
            />
            Emite nota fiscal
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={value.hasCatalog}
              onChange={(e) =>
                change({ ...value, hasCatalog: e.target.checked })
              }
            />
            Possui catálogo
          </label>
        </div>
        <Actions busy={busy} close={close} />
      </form>
    </Modal>
  );
}
function SettingsModal({
  value,
  close,
  save,
}: {
  value: UserSettings;
  close: () => void;
  save: (v: UserSettings) => Promise<void>;
}) {
  const [d, setD] = useState(value),
    [busy, setBusy] = useState(false);
  const fields: [keyof UserSettings, string][] = [
    ['capitalTotal', 'Capital total'],
    ['capitalReserve', 'Reserva de capital'],
    ['targetMarginMin', 'Margem mínima (%)'],
    ['targetMarginIdeal', 'Margem ideal (%)'],
    ['targetRoiMin', 'ROI mínimo (%)'],
    ['maxTestExposurePercent', 'Exposição máx. por teste (%)'],
    ['preferredMaxTurnoverDays', 'Giro máximo (dias)'],
    ['maximumSellerCount', 'Máximo de vendedores'],
  ];
  return (
    <Modal title="Configurações operacionais" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save(d);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {fields.map(([key, label]) => (
            <Num
              key={key}
              label={label}
              value={d[key] as number}
              change={(n) => setD({ ...d, [key]: n })}
            />
          ))}
          <label>
            Perfil estratégico
            <select
              value={d.strategyProfile}
              onChange={(e) =>
                setD({
                  ...d,
                  strategyProfile: e.target
                    .value as UserSettings['strategyProfile'],
                })
              }
            >
              <option value="FAST_CASH">Giro rápido</option>
              <option value="BALANCED">Equilibrado</option>
              <option value="HIGH_MARGIN">Margem alta</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={d.simpleMode}
            onChange={(e) => setD({ ...d, simpleMode: e.target.checked })}
          />
          Usar modo simples
        </label>
        <Actions busy={busy} close={close} />
      </form>
    </Modal>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" onClick={close} aria-label="Fechar">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Actions({ busy, close }: { busy: boolean; close: () => void }) {
  return (
    <div className="modal-actions">
      <button type="button" className="secondary" onClick={close}>
        Cancelar
      </button>
      <button className="primary" disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  );
}
function Text({
  label,
  value,
  change,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
}
function Num({
  label,
  value,
  change,
}: {
  label: string;
  value: number;
  change: (v: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => change(Number(e.target.value))}
      />
    </label>
  );
}
function Title({ small, title }: { small: string; title: string }) {
  return (
    <div className="section-title">
      <small>{small}</small>
      <h2>{title}</h2>
    </div>
  );
}
function Result({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function AmazonValue<T>({ signal, format }: { signal?: DataSignal<T> | null; format?: (value: T) => ReactNode }) {
  if (!signal) return <>—</>;
  const title = `${signal.origin} · confiança ${signal.confidence} · fonte ${signal.source} · ${new Date(signal.observedAt).toLocaleString('pt-BR')}`;
  return <span title={title}>{format ? format(signal.value) : String(signal.value)} <small>{signal.origin} · {signal.confidence}</small></span>;
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
