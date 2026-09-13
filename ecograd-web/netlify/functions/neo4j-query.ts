/** Endpoint legado desativado. A aplicação atual usa arquivos JSON por coleção. */
export default async (_req: Request): Promise<Response> => new Response(JSON.stringify({
  error: 'A integração Neo4j foi desativada. O EcoGrad utiliza o catálogo em arquivos JSON.',
  code: 'NEO4J_DISABLED',
}), {
  status: 410,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
