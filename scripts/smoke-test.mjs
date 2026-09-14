import { assertSafeTestEnvironment } from './test-environment-guard.mjs';

assertSafeTestEnvironment({ requireApi: true });
const baseUrl = process.env.API_URL ?? 'http://localhost:3333';
const stamp = Date.now();
let supplierId;
let productId;

async function call(method, path, body, expected = [200]) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path}: esperado ${expected.join('/')}, recebido ${response.status}: ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

const step = async (name, run) => {
  const value = await run();
  console.log(`PASS ${name}`);
  return value;
};

try {
  const health = await step('GET /health conecta ao PostgreSQL', () => call('GET', '/health'));
  if (health.database !== 'connected') throw new Error('Health não confirmou o banco.');
  await step('GET /settings preserva contrato atual', async () => {
    const settings = await call('GET', '/settings');
    for (const key of ['capitalTotal', 'capitalReserve', 'targetMarginMin', 'strategyProfile', 'simpleMode']) {
      if (!(key in settings)) throw new Error(`Campo de settings ausente: ${key}`);
    }
  });

  const supplier = await step('POST /suppliers cria fornecedor', () => call('POST', '/suppliers', {
    name: `Smoke Supplier ${stamp}`, legalName: null, cnpj: null, contact: 'Smoke', phone: null,
    whatsapp: null, email: null, website: null, city: 'São Paulo', state: 'SP', notes: 'Teste removível',
    minimumOrder: 100, issuesInvoice: true, hasCatalog: false,
  }, [201]));
  supplierId = supplier.id;
  await step('GET /suppliers/:id lê fornecedor persistido', async () => {
    const found = await call('GET', `/suppliers/${supplierId}`);
    if (found.name !== supplier.name) throw new Error('Fornecedor persistido divergiu.');
  });

  const product = await step('POST /products cria produto associado', () => call('POST', '/products', {
    name: `Smoke Product ${stamp}`, asin: `B${String(stamp).slice(-9)}`, ean: null, brand: 'Smoke', category: 'Teste',
    strategyType: 'BRANDED_RESELL', status: 'TEST', salePrice: 47.98, monthlySalesEstimate: 60,
    sellerCount: 4, amazonIsSeller: false, priceStability: 80, demandStability: 75, dataOrigin: 'ESTIMATED',
    supplierId, supplierSku: `SKU-${stamp}`, cost: 25, stock: 3, minimumQty: 1,
  }, [201]));
  productId = product.id;
  await step('GET /products/:id confirma associação', async () => {
    const found = await call('GET', `/products/${productId}`);
    if (found.suppliers[0]?.supplierId !== supplierId) throw new Error('Associação produto-fornecedor ausente.');
  });
  await step('GET /research/candidates gera ranking explicável', async () => {
    const rows = await call('GET', '/research/candidates');
    const ranked = rows.find((row) => row.candidate.id === productId);
    if (!ranked || !ranked.rank || !ranked.analysis?.recommendation || !ranked.comparisonReason) {
      throw new Error('Ranking de pesquisa incompleto.');
    }
    if (!ranked.analysis.restrictions.some((reason) => reason.includes('Verificar autorização'))) {
      throw new Error('Alerta explícito de autorização ausente.');
    }
  });

  await step('READY_TO_BUY é bloqueado com checklist pendente', () => call('PUT', `/products/${productId}`, {
    name: `Smoke Product ${stamp}`, asin: product.asin, ean: null, brand: 'Smoke', category: 'Teste',
    strategyType: 'BRANDED_RESELL', status: 'READY_TO_BUY', salePrice: 47.98, monthlySalesEstimate: 60,
    sellerCount: 4, amazonIsSeller: false, priceStability: 80, demandStability: 75, dataOrigin: 'ESTIMATED',
    supplierId, supplierSku: `SKU-${stamp}`, cost: 25, stock: 3, minimumQty: 1,
  }, [409]));

  const scenario = { salePrice:47.98, productCost:25, inboundShipping:0, packaging:0, taxRate:0.04,
    amazonCommission:5.85, amazonLogistics:7.2, advertising:0, otherExpenses:0, quantity:3,
    targetMarginRate:0.15, monthlySales:60, sellerCount:4, priceStability:80, demandStability:75,
    amazonIsSeller:false, inventoryRisk:30 };
  const calculated = await step('POST /calculations executa motor compartilhado', () => call('POST', '/calculations', scenario));
  if (calculated.netProfitPerUnit !== 8.01 || calculated.netMarginPercent !== 16.69 || calculated.roiPercent !== 32.04) {
    throw new Error(`Resultado financeiro inesperado: ${JSON.stringify(calculated)}`);
  }
  const analysis = await step('POST /analyses salva snapshot', () => call('POST', '/analyses', {
    ...scenario, productId, dataOrigin: 'ESTIMATED',
  }, [201]));
  await step('GET /analyses confirma snapshot persistido', async () => {
    const rows = await call('GET', '/analyses');
    if (!rows.some((row) => row.id === analysis.id)) throw new Error('Snapshot não foi recuperado.');
  });
  await step('POST /extension/analyses preserva contrato do cliente fino', async () => {
    const extensionAnalysis = await call('POST', '/extension/analyses', {
      ...scenario, asin: product.asin, productName: product.name, dataOrigin: 'ESTIMATED',
    }, [201]);
    if (extensionAnalysis.productId !== productId || typeof extensionAnalysis.score !== 'number') {
      throw new Error('Contrato da extensão divergiu.');
    }
  });

  await step('PUT /products/:id atualiza produto', () => call('PUT', `/products/${productId}`, {
    name: `Smoke Product Updated ${stamp}`, asin: product.asin, ean: null, brand: 'Smoke', category: 'Teste',
    strategyType: 'BRANDED_RESELL', status: 'APPROVED', salePrice: 47.98, monthlySalesEstimate: 60,
    sellerCount: 4, amazonIsSeller: false, priceStability: 80, demandStability: 75, dataOrigin: 'ESTIMATED',
    supplierId, supplierSku: `SKU-${stamp}`, cost: 25, stock: 3, minimumQty: 1,
  }));
  await step('GET /dashboard agrega dados reais', async () => {
    const dashboard = await call('GET', '/dashboard');
    if (typeof dashboard.capitalAvailable !== 'number') throw new Error('Dashboard inválido.');
  });
  await step('DELETE /products/:id remove produto', () => call('DELETE', `/products/${productId}`, undefined, [204]));
  productId = undefined;
  await step('GET removido retorna 404', () => call('GET', `/products/${product.id}`, undefined, [404]));
  await step('DELETE /suppliers/:id remove fornecedor', () => call('DELETE', `/suppliers/${supplierId}`, undefined, [204]));
  supplierId = undefined;
  console.log('SMOKE TEST PASS');
} catch (error) {
  console.error('SMOKE TEST FAIL', error);
  process.exitCode = 1;
} finally {
  if (productId) await call('DELETE', `/products/${productId}`, undefined, [204, 404]).catch(() => undefined);
  if (supplierId) await call('DELETE', `/suppliers/${supplierId}`, undefined, [204, 404]).catch(() => undefined);
}
