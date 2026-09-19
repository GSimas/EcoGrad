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
import { navigatePage, suspenderRestauracaoDeRolagem, useNavigation } from '@/services/navigation';
import { carregarDados } from '@/services/calculos';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { passosDoTour, proximoPasso, rotaDoPasso, type PassoTour } from '@/lib/tour';

/**
 * Quanto esperar o alvo aparecer, por transição e não por passo.
 *
 * Esperar só faz sentido quando a tela ainda vai mudar — troca de página, ou o
 * passo logo depois de uma ação do usuário. Dentro da mesma página o alvo ou
 * está lá, ou não existe naquele recorte: vários blocos são condicionais (a
 * nota de análises ocultas, o mapa por ano, as análises do dossiê). Esperar
 * por eles deixava o tour dois segundos e meio sem resposta antes de pular o
 * passo em silêncio — que foi exatamente o relato: "não consigo avançar, e
 * depois ele pula um passo".
 */
const ESPERA_TELA_MUDANDO = 2500;
const ESPERA_MESMA_TELA = 500;

/**
 * Leva o alvo para a tela e insiste por meio segundo.
 *
 * Nesse intervalo ainda disputam a rolagem o fechamento da gaveta do celular
 * (que devolve o foco ao conteúdo), o layout que cresce quando gráficos e
 * fontes montam, e a própria troca de página. Uma rolagem só, no instante do
 * destaque, é desfeita por qualquer um deles — e o destaque ia parar fora da
 * tela, com o furo do overlay junto.
 */
function garantirVisivel(elemento: Element | undefined) {
  if (!elemento) return;
  // Dois segundos porque alguns blocos montam o gráfico tarde: o alvo entra na
  // tela, o gráfico nasce acima dele e empurra tudo de novo.
  const ate = Date.now() + 2000;
  const tentar = () => {
    const r = elemento.getBoundingClientRect();
    // Basta o topo aparecer na metade de cima: alvos mais altos que a janela
    // nunca caberiam inteiros, e exigir isso seria insistir para sempre.
    if ((r.top >= 0 && r.top < window.innerHeight * 0.6) || Date.now() > ate) return;
    const cabe = r.height < window.innerHeight * 0.7;
    // Sempre instantâneo. Rolagem suave aqui é animação em curso: a conferida
    // seguinte lê uma posição que ainda está mudando, corrige por cima, e as
    // duas somadas passam do alvo.
    elemento.scrollIntoView({ block: cabe ? 'center' : 'nearest', behavior: 'auto' });
    setTimeout(tentar, 120);
  };
  tentar();
}

/**
 * Resolve o alvo preferindo o que está visível.
 *
 * Alguns atalhos existem duas vezes no DOM — no painel lateral do desktop e no
 * cabeçalho do celular —, e só um dos dois está na tela. O Driver.js fica com
 * o primeiro do documento, que no celular é o do painel escondido: recorte de
 * tamanho zero. Nenhum visível devolve nada, e o passo é pulado.
 */
const alvoVisivel = (seletor: string) => () =>
  [...document.querySelectorAll(seletor)].find((e) => e.getClientRects().length > 0) as Element;


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

  const passos = passosDoTour({
    temAnalise: tinhaAnalise || !!colecaoDemo,
    // Mesmo limiar do `lg:` do Tailwind, que é onde o painel lateral vira gaveta.
    estreito: window.innerWidth < 1024,
  });
  /** Cancela a espera do passo de ação em curso, se houver. */
  let soltarEspera: (() => void) | null = null;

  /** Navega para a página do passo. Devolve se a página de fato mudou. */
  const irPara = (indice: number): boolean => {
    const rota = passos[indice] && rotaDoPasso(passos[indice]);
    if (!rota || useNavigation.getState().page === rota) return false;
    navigatePage(rota);
    return true;
  };

  /**
   * Destaca o passo `indice`, esperando a troca de página quando houver uma.
   *
   * No mesmo tique da navegação o DOM ainda é o da página anterior — e vários
   * blocos (a cobertura, por exemplo) existem nas duas. O Driver.js encontrava
   * o alvo da página velha, destacava, e o React desmontava aquele nó em
   * seguida: sobrava um recorte de tamanho zero e uma tela toda escura. Dois
   * quadros depois a página nova já está montada, e o alvo encontrado é o que
   * vai continuar existindo.
   */
  const destacar = (indice: number, telaVaiMudar: boolean) => {
    // A espera é escolhida agora, e não quando o passo foi montado: só quem
    // chama sabe se a tela está prestes a trocar. O Driver.js relê este campo
    // do array a cada salto, então mexer nele aqui é o bastante.
    const passo = passosDriver[indice];
    if (passo) passo.waitForElement = telaVaiMudar ? ESPERA_TELA_MUDANDO : ESPERA_MESMA_TELA;
    const mover = () => { if (indice === 0) guia.drive(0); else guia.moveTo(indice); };
    if (!telaVaiMudar) { mover(); return; }
    requestAnimationFrame(() => requestAnimationFrame(mover));
  };

  /**
   * Sai do passo `i`. `pulou` distingue quem cumpriu a ação de quem desistiu
   * dela: só o segundo precisa descartar os passos que dependiam do resultado.
   */
  const avancar = (i: number, { pulou }: { pulou: boolean }) => {
    soltarEspera?.();
    const destino = proximoPasso(passos, i, { pulou });
    // Ação cumprida troca a página pelas mãos do usuário, sem passar por
    // `irPara`: o destino ainda está montando, e precisa da espera longa.
    const telaVaiMudar = irPara(destino) || (!pulou && !!passos[i].acao);
    destacar(destino, telaVaiMudar);
  };

  const guia: Driver = driver({
    animate: !reduzir,
    // Quem leva o alvo à tela é `garantirVisivel`, instantâneo: duas rolagens
    // animadas ao mesmo tempo brigam e passam do ponto.
    smoothScroll: false,
    // Preto, e não o fundo do tema: um véu da mesma cor da página não escurece
    // nada, e o recorte do passo fica invisível justamente no tema escuro.
    overlayColor: '#000000',
    overlayOpacity: 0.75,
    stagePadding: 8,
    stageRadius: 10,
    allowClose: true,
    // Clique no véu não encerra: durante um passo de ação é fácil errar o alvo
    // por alguns pixels, e perder o tour inteiro por causa disso é castigo
    // demais. Para sair há o × e o Esc.
    overlayClickBehavior: () => {},
    showProgress: true,
    progressText: 'Passo {{current}} de {{total}}',
    prevBtnText: 'Anterior',
    popoverClass: 'eco-tour',
    // Nos passos de ação o usuário precisa clicar no alvo; nos narrados, poder
    // clicar também não atrapalha e bloquear seria só frustrante.
    disableActiveInteraction: false,
    onDestroyed: () => { soltarEspera?.(); desligar(); aoTerminar?.(); },
  });

  const passoDriver = (passo: PassoTour, i: number): DriveStep => ({
    element: alvoVisivel(passo.alvo),
    // Substituído a cada salto por `destacar`; este é só o valor de partida.
    waitForElement: ESPERA_TELA_MUDANDO,
    // Alvo que nunca aparece não vira balão apontando para o nada.
    skipMissingElement: true,
    popover: {
      title: passo.titulo,
      description: passo.texto,
      // O botão do passo de ação é a saída de emergência: ele nunca trava.
      nextBtnText: passo.acao ? 'Pular este passo' : i === passos.length - 1 ? 'Concluir' : 'Próximo',
      onNextClick: () => { avancar(i, { pulou: true }); },
      onPrevClick: () => { soltarEspera?.(); destacar(i - 1, irPara(i - 1)); },
    },
    onHighlighted: (elemento) => {
      // O Driver.js rola até o alvo quando começa a destacá-lo, mas aqui quem
      // manda na rolagem é o app: ao abrir uma página nova ele devolve
      // `#conteudo-principal` ao topo — depois. O alvo ficava fora da tela com
      // o furo do overlay junto, e sobrava uma tela inteira escura e sem
      // clique. Rolar no fim do destaque é o que sobrevive a esse reset.
      garantirVisivel(elemento);
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
      const feito = () => avancar(i, { pulou: false });
      if (passo.acao === 'carregar') {
        if (useEcoGradStore.getState().dadosCarregados) { feito(); return; }
        const parar = useEcoGradStore.subscribe(() => {
          if (useEcoGradStore.getState().dadosCarregados) feito();
        });
        soltarEspera = () => { parar(); soltarEspera = null; };
        return;
      }
      const abriuDossie = () => useNavigation.getState().page === 'busca'
        && useEcoGradStore.getState().buscaTermo !== null;
      const parar = useNavigation.subscribe(() => { if (abriuDossie()) feito(); });
      soltarEspera = () => { parar(); soltarEspera = null; };
    },
    onDeselected: () => { soltarEspera?.(); },
  });

  // O conteúdo do EcoGrad rola dentro de `#conteudo-principal`, não na janela.
  // O Driver.js só escuta `scroll` em `window` — e evento de rolagem não
  // borbulha, então ele nunca fica sabendo. O recorte congelava na posição de
  // antes da rolagem: o furo do overlay ia parar fora da tela, a página inteira
  // ficava coberta e o alvo, impossível de clicar. Na fase de captura o evento
  // chega de qualquer elemento que role.
  const aoRolar = () => { if (guia.isActive()) guia.refresh(); };
  document.addEventListener('scroll', aoRolar, true);
  // Enquanto o tour conduz, quem decide a rolagem é ele (ver
  // `suspenderRestauracaoDeRolagem`).
  const restabelecerRolagem = suspenderRestauracaoDeRolagem();
  const desligar = () => { document.removeEventListener('scroll', aoRolar, true); restabelecerRolagem(); };

  const passosDriver = passos.map(passoDriver);
  guia.setSteps(passosDriver);
  // O primeiro destaque sempre espera: a página pode estar montando, seja
  // porque o tour navegou até ela, seja porque a coleção de exemplo acabou de
  // ser carregada.
  irPara(0);
  destacar(0, true);

  return () => { desligar(); if (guia.isActive()) guia.destroy(); };
}
