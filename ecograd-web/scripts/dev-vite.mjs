/**
 * Sobe o Vite na porta que o Netlify Dev espera em `targetPort`.
 *
 * Dois motivos para este wrapper existir em vez de um comando direto no
 * `netlify.toml`:
 *
 * 1. O prefixo POSIX `PORT=5176 npm ...` não serve: a CLI executa o comando
 *    pelo shell do sistema e o `cmd.exe` do Windows trataria `PORT=5176` como
 *    nome de executável. Definir a variável aqui, em JS, funciona nos três
 *    sistemas.
 * 2. A CLI desiste se a porta não abrir em poucos segundos. Por isso aqui só
 *    sobe o Vite — o `sync:data` (~11 s) roda antes, no `netlify-dev.mjs`.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Precisa continuar igual a `targetPort` no `netlify.toml`. */
export const PORTA_VITE = '5176';

const raizApp = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Chamar o entrypoint JS do Vite direto evita as camadas de `npm` (e o shim
// `.cmd` do Windows), que somavam segundos à espera da porta.
const filho = spawn(process.execPath, [join(raizApp, 'node_modules', 'vite', 'bin', 'vite.js')], {
  cwd: raizApp,
  stdio: 'inherit',
  // `PORT` e sobrescrito de proposito: o Netlify Dev injeta o seu proprio
  // `PORT` (8888, a porta do proxy) no ambiente do comando. Herda-lo faria o
  // Vite subir em cima do proxy e a CLI esperar para sempre por 5176.
  env: { ...process.env, PORT: PORTA_VITE },
});

filho.on('exit', (codigo, sinal) => {
  if (sinal) process.kill(process.pid, sinal);
  else process.exit(codigo ?? 0);
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => filho.kill(sinal));
}
