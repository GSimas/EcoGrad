/**
 * Condução do tour guiado.
 *
 * O Driver.js desenha o recorte, o balão, o foco e o teclado. O que ele não
 * sabe — e é o trabalho de verdade — está aqui: levar o usuário à página certa
 * antes de cada passo e, nos passos de ação, esperar ele agir sem nunca
 * travar. A montagem tardia (abas Radix e blocos `lazy`) é resolvida pelo
 * `waitForElement` da própria biblioteca.
 *
 * A biblioteca e o CSS dela entram por `import()` dinâmico: quem nunca faz o
 * tour não baixa nada.
 */
import type { Driver, DriveStep } from 'driver.js';
import { navigatePage, useNavigation } from '@/services/navigation';
import { carregarDados } from '@/services/calculos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { passosDoTour, type PassoTour } from '@/lib/tour';

/** Quanto esperar um alvo que ainda vai montar. */
const ESPERA_ALVO = 6000;

/** Página em que cada passo acontece. */
function rotaDoPasso(passo: PassoTour): 'inicio' | 'dashboard' | null {
  if (passo.id === 'busca' || passo.id === 'carregar') return 'inicio';
  if (passo.id === 'cobertura' || passo.id === 'tema') return 'dashboard';
  // O dossiê e o histórico chegam pela ação do usuário; navegar por conta
  // própria aqui atropelaria o item que ele acabou de abrir.
  return null;
}

export interface OpcoesTour {
  /** Preferência de movimento reduzido do usuário. */
  reduzir: boolean;
  /** Coleção de exemplo a carregar antes de começar, quando não há análise. */
  colecaoDemo?: { nome: string; tipo: string } | null;
  aoTerminar?: () => void;
}

/**
 * Roda o tour. Devolve uma função que o interrompe, para quem chamou poder
 * desmontar sem deixar o overlay preso na tela.
 */
export async function iniciarTour({ reduzir, colecaoDemo, aoTerminar }: OpcoesTour): Promise<() => void> {
  const [{ driver }] = await Promise.all([
    import('driver.js'),
    import('driver.js/dist/driver.css'),
  ]);

  const tinhaAnalise = useEcoGradStore.getState().dadosCarregados;
  // Sem análise e com exemplo aceito: carrega antes, para o Dashboard existir
  // quando o tour chegar lá. Com análise, nada é tocado — o tour não pode
  // substituir o trabalho de quem está no meio de uma exploração.
  if (!tinhaAnalise && colecaoDemo) {
    const ehPpg = colecaoDemo.tipo === 'ppg';
    carregarDados(ehPpg ? [colecaoDemo.nome] : [], ehPpg ? [] : [colecaoDemo.nome], 'Tour guiado');
  }

  const passos = passosDoTour({ temAnalise: tinhaAnalise || !!colecaoDemo });
  /** Cancela a espera do passo de ação em curso, se houver. */
  let soltarEspera: (() => void) | null = null;

  const irPara = (indice: number) => {
    const rota = passos[indice] && rotaDoPasso(passos[indice]);
    if (rota) navigatePage(rota);
  };

  const guia: Driver = driver({
    animate: !reduzir,
    smoothScroll: !reduzir,
    overlayColor: '#0E1117',
    overlayOpacity: 0.72,
    stagePadding: 8,
    stageRadius: 10,
    allowClose: true,
    showProgress: true,
    progressText: 'Passo {{current}} de {{total}}',
    prevBtnText: 'Anterior',
    popoverClass: 'eco-tour',
    // Nos passos de ação o usuário precisa clicar no alvo; nos narrados, poder
    // clicar também não atrapalha e bloquear seria só frustrante.
    disableActiveInteraction: false,
    onDestroyed: () => { soltarEspera?.(); aoTerminar?.(); },
  });

  const passoDriver = (passo: PassoTour, i: number): DriveStep => ({
    element: passo.alvo,
    waitForElement: ESPERA_ALVO,
    // Alvo que nunca aparece não vira balão apontando para o nada.
    skipMissingElement: true,
    popover: {
      title: passo.titulo,
      description: passo.texto,
      // O botão do passo de ação é a saída de emergência: ele nunca trava.
      nextBtnText: passo.acao ? 'Pular este passo' : i === passos.length - 1 ? 'Concluir' : 'Próximo',
      onNextClick: () => { soltarEspera?.(); irPara(i + 1); guia.moveNext(); },
      onPrevClick: () => { soltarEspera?.(); irPara(i - 1); guia.movePrevious(); },
    },
    onHighlighted: () => {
      if (!passo.acao) return;
      // Passo de ação: o avanço vem do estado, não do botão. A store é a fonte
      // — esperar por um clique no DOM erraria quando a ação acontece por
      // teclado ou por outro caminho que leva ao mesmo lugar.
      //
      // Para "abrir um tema" o sinal é a NAVEGAÇÃO até o dossiê, não o valor de
      // `buscaTermo`. Quem chega ao tour com um dossiê aberto já tem o termo
      // preenchido — e, pior, pode clicar justamente no tema que já estava
      // aberto: o termo não muda, e um teste sobre ele deixaria o tour parado
      // para sempre. Sair do Dashboard para a busca é o que sempre acontece.
      const avancar = () => {
        soltarEspera?.();
        irPara(i + 1);
        guia.moveNext();
      };
      if (passo.acao === 'carregar') {
        if (useEcoGradStore.getState().dadosCarregados) { avancar(); return; }
        const parar = useEcoGradStore.subscribe(() => {
          if (useEcoGradStore.getState().dadosCarregados) avancar();
        });
        soltarEspera = () => { parar(); soltarEspera = null; };
        return;
      }
      const abriuDossie = () => useNavigation.getState().page === 'busca'
        && useEcoGradStore.getState().buscaTermo !== null;
      const parar = useNavigation.subscribe(() => { if (abriuDossie()) avancar(); });
      soltarEspera = () => { parar(); soltarEspera = null; };
    },
    onDeselected: () => { soltarEspera?.(); },
  });

  guia.setSteps(passos.map(passoDriver));
  irPara(0);
  guia.drive(0);

  return () => { if (guia.isActive()) guia.destroy(); };
}
