import { lazy, type ComponentType } from 'react';

/** Um `import()` que falhou por rede tenta de novo antes de desistir. */
async function comRetentativa<T>(importar: () => Promise<T>, tentativas = 2): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await importar();
    } catch (erro) {
      if (i >= tentativas) throw erro;
      await new Promise((ok) => setTimeout(ok, 400 * (i + 1)));
    }
  }
}

/**
 * Componente baixado sob demanda, num pedaço próprio do bundle.
 *
 * Três cuidados que o `React.lazy` puro não tem:
 * - `precarregar` busca o pedaço antes de a tela pedir. Se ele já chegou quando
 *   o componente monta, a tela aparece direto, sem passar pelo fallback do
 *   Suspense — navegar continua instantâneo;
 * - uma falha de rede tenta de novo antes de desistir;
 * - `renovar` descarta um carregamento que falhou, para o "Tentar novamente"
 *   do limite de erro tentar de verdade: o `React.lazy` guarda a falha para
 *   sempre.
 */
export function preguicoso<P extends object>(importar: () => Promise<ComponentType<P>>) {
  let pronto: ComponentType<P> | null = null;
  let carregando: Promise<ComponentType<P>> | null = null;
  const carregar = () => {
    carregando ??= comRetentativa(importar).then((c) => (pronto = c));
    carregando.catch(() => { carregando = null; });
    return carregando;
  };
  const criarLento = () => lazy(() => carregar().then((c) => ({ default: c })));
  let lento = criarLento();

  function Componente(props: P) {
    // O TypeScript não relaciona o `P` genérico com as props do JSX; o tipo de
    // entrada já é garantido pela assinatura de `Componente`.
    const C = (pronto ?? lento) as ComponentType<Record<string, unknown>>;
    return <C {...(props as Record<string, unknown>)} />;
  }
  return {
    Componente,
    precarregar: () => { void carregar().catch(() => { /* a montagem tenta de novo e mostra o erro */ }); },
    renovar: () => { if (!pronto) lento = criarLento(); },
  };
}
