import type {
  Analysis,
  Product,
  RankedCandidate,
  Supplier,
  UserSettings,
  Catalog,
  CatalogOpportunity,
  CatalogProduct,
} from '@easy-seller/types';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export interface DashboardData {
  isDemo: boolean;
  capitalTotal: number;
  capitalReserve: number;
  capitalCommitted: number;
  capitalAvailable: number;
  projectedProfit: number | null;
  averageRoi: number | null;
  activeProducts: number;
  testProducts: number;
  recentAnalyses: Analysis[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
      issues?: Array<{ message?: string }>;
    } | null;
    throw new Error(
      body?.message ?? body?.issues?.[0]?.message ??
        (body?.error ? `${body.error} (HTTP ${response.status}).` : `A API respondeu com status ${response.status}.`),
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => request<DashboardData>('/dashboard'),
  products: () => request<Product[]>('/products'),
  researchCandidates: () => request<RankedCandidate[]>('/research/candidates'),
  createProduct: (data: unknown) =>
    request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id: string, data: unknown) =>
    request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: string) =>
    request<void>(`/products/${id}`, { method: 'DELETE' }),
  suppliers: () => request<Supplier[]>('/suppliers'),
  createSupplier: (data: unknown) =>
    request<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSupplier: (id: string, data: unknown) =>
    request<Supplier>(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSupplier: (id: string) =>
    request<void>(`/suppliers/${id}`, { method: 'DELETE' }),
  catalogs: () => request<Catalog[]>('/catalogs'),
  catalog: (id: string) => request<Catalog>(`/catalogs/${id}`),
  uploadCatalog: (data: FormData) => request<Catalog>('/catalogs/upload', { method: 'POST', body: data }),
  createManualCatalog: (data: unknown) => request<Catalog>('/catalogs/manual', { method: 'POST', body: JSON.stringify(data) }),
  createCatalogReference: (data: unknown) => request<Catalog>('/catalogs/reference', { method: 'POST', body: JSON.stringify(data) }),
  reviewCatalogProduct: (id: string, data: unknown) => request<CatalogProduct>(`/catalog-products/${id}/review`, { method: 'PATCH', body: JSON.stringify(data) }),
  catalogOpportunities: () => request<CatalogOpportunity[]>('/catalog-opportunities'),
  settings: () => request<UserSettings>('/settings'),
  updateSettings: (data: UserSettings) =>
    request<UserSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  analyses: () => request<Analysis[]>('/analyses'),
  calculate: (data: unknown) =>
    request<CalculationResponse>('/calculations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  saveAnalysis: (data: unknown) =>
    request<Analysis & CalculationResponse>('/analyses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export interface CalculationResponse {
  revenue: number;
  totalExpensesPerUnit: number;
  netProfitPerUnit: number;
  totalProfit: number;
  netMarginPercent: number;
  roiPercent: number;
  markupPercent: number;
  breakEvenPrice: number;
  minimumSalePrice: number;
  maxPurchasePrice: number;
  requiredCapital: number;
  score: number;
  classification: string;
  positives: string[];
  warnings: string[];
}
