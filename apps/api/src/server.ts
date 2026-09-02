import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { calculateFinancials, calculateOpportunityScore, calculateRecommendedQuantity, generateOpportunitySummary } from "@easy-seller/calculations";
import type { Product, Supplier } from "@easy-seller/types";

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" });

const products: Product[] = [
  { id:"prod-1", name:"Kit organizador modular 6 peças", asin:"B0EASY001BR", ean:"7891000000011", brand:"Casa Clara", category:"Casa", cost:38, amazonPrice:79.9, monthlySalesEstimate:82, sellerCount:4, amazonIsSeller:false, status:"APPROVED" },
  { id:"prod-2", name:"Escova removedora de pelos pet", asin:"B0EASY002BR", ean:null, brand:"PetViva", category:"Pet Shop", cost:24.5, amazonPrice:54.9, monthlySalesEstimate:118, sellerCount:7, amazonIsSeller:false, status:"TEST" },
  { id:"prod-3", name:"Garrafa térmica inox 750ml", asin:"B0EASY003BR", ean:"7891000000035", brand:"Nord", category:"Cozinha", cost:44, amazonPrice:84.9, monthlySalesEstimate:41, sellerCount:11, amazonIsSeller:true, status:"WATCHING" }
];
const suppliers: Supplier[] = [
  { id:"sup-1", name:"Distribuidora Aurora", cnpj:"12.345.678/0001-90", contact:"Marina", phone:"+55 11 99999-1200", email:"marina@aurora.exemplo", city:"São Paulo", state:"SP", minimumOrder:800, issuesInvoice:true, notes:"Entrega em 4 dias úteis." },
  { id:"sup-2", name:"Atacado Sul", cnpj:null, contact:"Carlos", phone:"+55 47 98888-2100", email:null, city:"Blumenau", state:"SC", minimumOrder:1200, issuesInvoice:true, notes:null }
];

const productSchema = z.object({ name:z.string().min(2), asin:z.string().min(10), ean:z.string().nullable().default(null), brand:z.string().nullable().default(null), category:z.string().min(2), cost:z.number().nonnegative(), amazonPrice:z.number().positive(), monthlySalesEstimate:z.number().int().nonnegative(), sellerCount:z.number().int().nonnegative(), amazonIsSeller:z.boolean(), status:z.enum(["TEST","APPROVED","DISCARDED","WATCHING"]) });
const supplierSchema = z.object({ name:z.string().min(2), cnpj:z.string().nullable().default(null), contact:z.string().nullable().default(null), phone:z.string().nullable().default(null), email:z.string().email().nullable().default(null), city:z.string().nullable().default(null), state:z.string().length(2).nullable().default(null), minimumOrder:z.number().nonnegative().nullable().default(null), issuesInvoice:z.boolean().default(false), notes:z.string().nullable().default(null) });

app.get("/health", async () => ({ status:"ok", mode:"mock", timestamp:new Date().toISOString() }));
app.get("/products", async () => products);
app.post("/products", async (request, reply) => { const parsed=productSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:"INVALID_PRODUCT",issues:parsed.error.issues}); const item={id:crypto.randomUUID(),...parsed.data}; products.push(item); return reply.code(201).send(item); });
app.put("/products/:id", async (request, reply) => { const id=(request.params as {id:string}).id; const index=products.findIndex(item=>item.id===id); if(index<0)return reply.code(404).send({error:"NOT_FOUND"}); const parsed=productSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:"INVALID_PRODUCT",issues:parsed.error.issues}); const item={id,...parsed.data}; products[index]=item; return item; });
app.delete("/products/:id", async (request, reply) => { const id=(request.params as {id:string}).id; const index=products.findIndex(item=>item.id===id); if(index<0)return reply.code(404).send({error:"NOT_FOUND"}); products.splice(index,1); return reply.code(204).send(); });
app.get("/suppliers", async () => suppliers);
app.post("/suppliers", async (request, reply) => { const parsed=supplierSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:"INVALID_SUPPLIER",issues:parsed.error.issues}); const item={id:crypto.randomUUID(),...parsed.data}; suppliers.push(item); return reply.code(201).send(item); });
app.put("/suppliers/:id", async (request, reply) => { const id=(request.params as {id:string}).id; const index=suppliers.findIndex(item=>item.id===id); if(index<0)return reply.code(404).send({error:"NOT_FOUND"}); const parsed=supplierSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:"INVALID_SUPPLIER",issues:parsed.error.issues}); const item={id,...parsed.data}; suppliers[index]=item; return item; });
app.delete("/suppliers/:id", async (request, reply) => { const id=(request.params as {id:string}).id; const index=suppliers.findIndex(item=>item.id===id); if(index<0)return reply.code(404).send({error:"NOT_FOUND"}); suppliers.splice(index,1); return reply.code(204).send(); });

app.post("/calculate", async (request, reply) => { const schema=z.object({salePrice:z.number().positive(),productCost:z.number().nonnegative(),inboundShipping:z.number().nonnegative().optional(),packaging:z.number().nonnegative().optional(),taxRate:z.number().min(0).max(1).optional(),amazonCommission:z.number().nonnegative(),amazonLogistics:z.number().nonnegative(),advertising:z.number().nonnegative().optional(),otherExpenses:z.number().nonnegative().optional(),quantity:z.number().int().positive().optional(),targetMarginRate:z.number().min(0).max(1).optional()}); const parsed=schema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:"INVALID_CALCULATION",issues:parsed.error.issues}); return calculateFinancials(parsed.data); });
app.get("/analysis/:asin", async (request, reply) => { const asin=(request.params as {asin:string}).asin; const product=products.find(item=>item.asin===asin) ?? products[0]; if(!product)return reply.code(404).send({error:"NOT_FOUND"}); const financials=calculateFinancials({salePrice:product.amazonPrice,productCost:product.cost,taxRate:.04,amazonCommission:product.amazonPrice*.15,amazonLogistics:8.9}); const scoreData={monthlySales:product.monthlySalesEstimate,netMarginPercent:financials.netMarginPercent,roiPercent:financials.roiPercent,priceStability:88,sellerCount:product.sellerCount,demandStability:82,amazonIsSeller:product.amazonIsSeller,inventoryRisk:25}; const scored=calculateOpportunityScore(scoreData); const recommendedQty=calculateRecommendedQuantity({monthlySalesEstimate:product.monthlySalesEstimate,sellerCount:product.sellerCount,score:scored.score,capitalAvailable:20000,unitCost:product.cost,riskLevel:"LOW"}); return {product,financials,...scored,recommendedQty,summary:generateOpportunitySummary({...scoreData,score:scored.score}),dataOrigin:"ESTIMATED",dataConfidence:"MEDIUM"}; });

app.setErrorHandler((error,_request,reply)=>{app.log.error(error);reply.code(500).send({error:"INTERNAL_ERROR",message:"Não foi possível concluir a operação."});});
const port=Number(process.env.API_PORT ?? 3333);
await app.listen({port,host:"0.0.0.0"});
