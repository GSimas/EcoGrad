/**
 * Copia as bases do repositório Python (raiz do projeto) para `public/data/`,
 * que é o diretório estático servido pelo Vite/Netlify.
 *
 * Os `.json.gz` somam ~62 MB e já são versionados na raiz — duplicá-los no
 * controle de versão seria desperdício, então `public/data/.gitignore` os ignora
 * e este script os sincroniza antes de `dev` e `build`.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');
const destino = join(raizApp, 'public', 'data');

const ARQUIVOS = [
  'programas_ufsc.json',
  'mapa_colecoes_tcc.json',
  'base_consolidada_ufsc.json.gz',
  'base_tcc_ufsc.json.gz',
];

mkdirSync(destino, { recursive: true });

let copiados = 0;
let ausentes = [];

for (const nome of ARQUIVOS) {
  const origem = join(raizRepo, nome);
  if (!existsSync(origem)) {
    ausentes.push(nome);
    continue;
  }
  const alvo = join(destino, nome);
  // Pula quando o arquivo já está sincronizado (mesmo tamanho e mais recente)
  if (existsSync(alvo) && statSync(alvo).size === statSync(origem).size) continue;
  copyFileSync(origem, alvo);
  copiados += 1;
  const mb = (statSync(alvo).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓ ${nome} (${mb} MB)`);
}

if (copiados === 0) console.log('[sync-data] Bases já sincronizadas.');
if (ausentes.length > 0) {
  console.warn(`[sync-data] Não encontrados na raiz do repositório: ${ausentes.join(', ')}`);
  console.warn('[sync-data] A aplicação sobe, mas as coleções correspondentes ficarão vazias.');
}
