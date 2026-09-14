import { buildApp } from "./app.js";

const app = await buildApp();
const port = Number(process.env.API_PORT ?? 3333);
await app.listen({ port, host: "0.0.0.0" });
