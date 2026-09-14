/**
 * Sobe o Netlify Dev (frontend + funções) a partir da RAIZ do repositório.
 *
 * A CLI da Netlify resolve `base`, o diretório de funções e o `.env` sempre
 * relativos à raiz do repositório git — e o `netlify.toml` está lá, com
 * `base = "ecograd-web"`. Rodar `netlify dev` de dentro de `ecograd-web/`
 * faria a CLI procurar as funções e o `.env` no lugar errado (e falhar em
 * silêncio, devolvendo 404 nas funções).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const raizRepo = resolve(raizApp, '..');

// No Windows o shim do npm e `netlify.cmd`; o arquivo sem extensao e o
// script sh, que o `spawn` nao sabe executar (ENOENT).
const nomeBinario = process.platform === 'win32' ? 'netlify.cmd' : 'netlify';
const binario = join(raizApp, 'node_modules', '.bin', nomeBinario);
if (!existsSync(binario)) {
  console.error('[netlify-dev] netlify-cli não encontrado. Rode `npm install` em ecograd-web/.');
  process.exit(1);
}

if (!existsSync(join(raizApp, '.env'))) {
  console.warn(
    '[netlify-dev] Sem ecograd-web/.env — as funções do Gemini e do Neo4j vão responder\n' +
      '              como "chave não configurada". Copie .env.example e preencha.',
  );
}

// O `sync:data` leva ~11 s e roda aqui, e nao dentro do comando de dev do
// `netlify.toml`: a CLI desiste se a porta do Vite nao abrir em poucos
// segundos, e a sincronizacao dentro daquela janela causava
// `Timed out waiting for port '5176' to be open`.
const sync = spawnSync(process.execPath, [join(aqui, 'sync-data.mjs')], {
  cwd: raizApp,
  stdio: 'inherit',
});
if (sync.status !== 0) {
  console.error('[netlify-dev] sync:data falhou; abortando.');
  process.exit(sync.status ?? 1);
}

const filho = spawn(binario, ['dev', ...process.argv.slice(2)], {
  cwd: raizRepo,
  stdio: 'inherit',
  // O `.cmd` so roda atraves do interpretador de comandos do Windows.
  shell: process.platform === 'win32',
});

filho.on('exit', (codigo, sinal) => {
  if (sinal) process.kill(process.pid, sinal);
  else process.exit(codigo ?? 0);
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => filho.kill(sinal));
}
