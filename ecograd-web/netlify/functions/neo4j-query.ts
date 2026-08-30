/**
 * Consultas Cypher seguras ao banco de grafos.
 * Substitui `conectar_neo4j` / `extrair_subgrafo_neo4j` / `gerar_orbita_neo4j`
 * (backend.py:1687-2278). As credenciais ficam apenas no ambiente da função.
 *
 * Segurança: o cliente NÃO envia Cypher. Ele escolhe uma das consultas
 * pré-registradas abaixo e passa parâmetros, que viajam como parâmetros de
 * bind do driver — nunca por interpolação de string.
 */
import neo4j, { type Driver } from 'neo4j-driver';
import { erro, json } from './_shared';

type NomeConsulta = 'subgrafo-programa' | 'orbita-entidade' | 'ping';

const CONSULTAS: Record<NomeConsulta, string> = {
  ping: 'RETURN 1 AS ok',

  // Subgrafo de um programa, limitado a `limite` documentos
  'subgrafo-programa': `
    MATCH (d:Documento)
    WHERE d.programa_origem = $nomePrograma
    WITH d LIMIT $limite
    OPTIONAL MATCH (d)-[r]-(v)
    RETURN d.titulo AS documento, d.ano AS ano, type(r) AS relacao,
           labels(v)[0] AS tipoVizinho,
           coalesce(v.nome, v.titulo, v.termo) AS vizinho
  `,

  // Órbita (ego-graph de 1 salto) de uma entidade, com corte temporal
  'orbita-entidade': `
    MATCH (foco)
    WHERE coalesce(foco.nome, foco.titulo, foco.termo) = $termo
      AND $rotulo IN labels(foco)
    MATCH (foco)-[r]-(viz)
    WHERE coalesce(r.ano, viz.ano, 0) <= $anoLimite
    RETURN coalesce(foco.nome, foco.titulo, foco.termo) AS origem,
           labels(foco)[0] AS tipoOrigem,
           coalesce(viz.nome, viz.titulo, viz.termo) AS destino,
           labels(viz)[0] AS tipoDestino,
           coalesce(r.ano, viz.ano, 0) AS ano
    LIMIT $limite
  `,
};

/** Rótulos aceitos — impede que um valor arbitrário chegue ao Cypher. */
const ROTULOS_VALIDOS = new Set([
  'Documento',
  'Autor',
  'Orientador',
  'CoOrientador',
  'PalavraChave',
  'Macrotema',
]);

interface Payload {
  consulta?: NomeConsulta;
  parametros?: Record<string, unknown>;
}

let driverCache: Driver | null = null;

function obterDriver(): Driver {
  if (driverCache) return driverCache;
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USERNAME;
  const senha = process.env.NEO4J_PASSWORD;
  if (!uri || !user || !senha) {
    throw new Error('Configuração ausente: defina NEO4J_URI, NEO4J_USERNAME e NEO4J_PASSWORD.');
  }
  driverCache = neo4j.driver(uri, neo4j.auth.basic(user, senha), {
    maxConnectionPoolSize: 5,
    connectionAcquisitionTimeout: 15000,
  });
  return driverCache;
}

/** Converte Integer/Node do driver em valores JSON simples. */
function serializar(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (neo4j.isInt(valor)) return valor.toNumber();
  if (Array.isArray(valor)) return valor.map(serializar);
  if (typeof valor === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) out[k] = serializar(v);
    return out;
  }
  return valor;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return erro('Use POST.', 405);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return erro('Corpo da requisição inválido (JSON esperado).', 400);
  }

  const nome = payload.consulta;
  if (!nome || !(nome in CONSULTAS)) {
    return erro(`Consulta desconhecida. Use uma de: ${Object.keys(CONSULTAS).join(', ')}.`, 400);
  }

  const p = payload.parametros ?? {};

  // Saneamento dos parâmetros antes do bind
  const parametros: Record<string, unknown> = {
    limite: neo4j.int(Math.min(Math.max(Number(p.limite ?? 50), 1), 2000)),
    anoLimite: neo4j.int(Math.min(Math.max(Number(p.anoLimite ?? 2100), 0), 2100)),
    nomePrograma: String(p.nomePrograma ?? ''),
    termo: String(p.termo ?? ''),
    rotulo: String(p.rotulo ?? 'Documento'),
  };

  if (nome === 'orbita-entidade' && !ROTULOS_VALIDOS.has(parametros.rotulo as string)) {
    return erro('Rótulo de entidade inválido.', 400);
  }

  let sessao;
  try {
    sessao = obterDriver().session({ defaultAccessMode: neo4j.session.READ });
    const resultado = await sessao.run(CONSULTAS[nome], parametros);
    const linhas = resultado.records.map((r) => serializar(r.toObject()));
    return json({ linhas, total: linhas.length });
  } catch (e) {
    return erro(`Falha na consulta ao Neo4j: ${e instanceof Error ? e.message : String(e)}`, 502);
  } finally {
    await sessao?.close();
  }
};
