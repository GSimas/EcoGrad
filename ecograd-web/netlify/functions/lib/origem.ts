/**
 * Chamada vinda do próprio site.
 *
 * As funções que gastam a chave do projeto (`embedding-consulta`,
 * `ia-cortesia`) não são API pública: só respondem a quem abriu o EcoGrad. Não
 * é autenticação — cabeçalho `Origin` se forja fora do navegador — mas corta o
 * uso casual do endpoint por outro site, que é o caso comum.
 */
export function origemAceita(req: Request): boolean {
  // O navegador não manda `Origin` em GET do mesmo site — só em POST e em
  // requisição cruzada. `Sec-Fetch-Site` ele manda sempre, e o próprio navegador
  // o preenche: é o equivalente para quem só está lendo um contador.
  if (req.headers.get('sec-fetch-site') === 'same-origin') return true;
  const origem = req.headers.get('origin');
  if (!origem) return false;
  let host: string;
  try { host = new URL(origem).host; } catch { return false; }
  const extras = `${process.env.ORIGENS_EXTRAS ?? ''},${process.env.EMBEDDING_ORIGENS ?? ''}`
    .split(',').map((o) => o.trim()).filter(Boolean);
  return host === new URL(req.url).host || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || extras.includes(origem);
}
