const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function assertSafeTestEnvironment({ requireApi = false } = {}) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("TEST_GUARD: NODE_ENV precisa ser exatamente 'test'.");
  }
  if (process.env.ALLOW_TEST_DATABASE !== "true") {
    throw new Error("TEST_GUARD: defina ALLOW_TEST_DATABASE=true explicitamente.");
  }
  const rawDatabaseUrl = process.env.DATABASE_URL;
  if (!rawDatabaseUrl) throw new Error("TEST_GUARD: DATABASE_URL é obrigatória.");
  const databaseUrl = new URL(rawDatabaseUrl);
  const database = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
  if (!LOCAL_HOSTS.has(databaseUrl.hostname)) {
    throw new Error("TEST_GUARD: somente PostgreSQL local é permitido pelos smokes do baseline.");
  }
  if (!/(^|[_-])test($|[_-])|milestone0_test/i.test(database)) {
    throw new Error(`TEST_GUARD: o database '${database}' não está claramente identificado como teste.`);
  }
  if (requireApi) {
    if (process.env.ALLOW_LOCAL_IDENTITY !== "true") {
      throw new Error("TEST_GUARD: defina ALLOW_LOCAL_IDENTITY=true explicitamente para a API local.");
    }
    const apiUrl = new URL(process.env.API_URL ?? "http://localhost:3334");
    if (!LOCAL_HOSTS.has(apiUrl.hostname)) {
      throw new Error("TEST_GUARD: smoke HTTP só pode apontar para API local.");
    }
  }
  const storage = process.env.CATALOG_STORAGE_DIR ?? "";
  if (storage && !/test/i.test(storage)) {
    throw new Error("TEST_GUARD: CATALOG_STORAGE_DIR precisa identificar explicitamente um diretório de teste.");
  }
  return { database, host: databaseUrl.hostname };
}
