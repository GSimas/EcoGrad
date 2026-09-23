import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Compass, Play, X } from 'lucide-react';
import { carregarCobertura } from '@/lib/colecoes';
import { useAparencia } from '@/services/aparencia';
import { iniciarTour } from '@/services/tour';
import { useEcoGradStore } from '@/stores/useEcoGradStore';
import { CHAVE_TOUR, escolherColecaoDemo, tourJaVisto, tamanhoLegivel } from '@/lib/tour';

/** Marca no navegador, não na sessão: o convite não pode voltar a cada aba nova. */
function marcarVisto() {
  try { localStorage.setItem(CHAVE_TOUR, JSON.stringify({ visto: true, em: Date.now() })); } catch { /* armazenamento bloqueado: o convite volta, e só */ }
}
export function esquecerTour() {
  try { localStorage.removeItem(CHAVE_TOUR); } catch { /* idem */ }
}

/**
 * Inicia o tour de qualquer lugar.
 *
 * Quem não tem análise aberta recebe antes a oferta da coleção de exemplo —
 * declarada com registros e tamanho, porque é um download que o tour provoca.
 */
export function useTourGuiado() {
  const { reduzir } = useAparencia();
  const temAnalise = useEcoGradStore((s) => s.dadosCarregados);
  const encerrar = useRef<(() => void) | null>(null);
  const [oferecendo, setOferecendo] = useState(false);

  // O catálogo já é baixado pela busca da apresentação; aqui ele vem do cache.
  const cobertura = useQuery({ queryKey: ['colecoes-cobertura'], queryFn: ({ signal }) => carregarCobertura(signal), staleTime: Infinity, enabled: oferecendo });
  const demo = cobertura.data ? escolherColecaoDemo(cobertura.data.colecoes) : null;

  useEffect(() => () => { encerrar.current?.(); }, []);

  const rodar = useCallback(async (colecaoDemo: { nome: string; tipo: string } | null) => {
    marcarVisto();
    setOferecendo(false);
    encerrar.current?.();
    encerrar.current = await iniciarTour({ reduzir, colecaoDemo, aoTerminar: () => { encerrar.current = null; } });
  }, [reduzir]);

  const comecar = useCallback(() => {
    // Com análise aberta o tour começa direto, sem download e sem tocar nela.
    if (temAnalise) { void rodar(null); return; }
    setOferecendo(true);
  }, [temAnalise, rodar]);

  return { comecar, oferecendo, fecharOferta: () => setOferecendo(false), demo, carregandoDemo: cobertura.isLoading, rodar };
}

/** Diálogo da oferta, montado uma vez ao lado do convite e do tutorial. */
export function OfertaDeExemplo({ tour }: { tour: ReturnType<typeof useTourGuiado> }) {
  if (!tour.oferecendo) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Coleção de exemplo para o tour"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-eco-border bg-eco-bg p-5">
        <h2 className="text-lg font-semibold text-slate-100">Uma coleção para o tour</h2>
        {tour.carregandoDemo && <p className="text-sm text-slate-300" role="status">Consultando o catálogo…</p>}
        {!tour.carregandoDemo && !tour.demo && (
          <p className="text-sm text-slate-300">
            Não encontrei uma coleção de exemplo no catálogo agora. Dá para fazer o tour mesmo assim: ele começa
            pela busca e segue depois que você carregar o que quiser.
          </p>
        )}
        {tour.demo && (
          <p className="text-sm leading-relaxed text-slate-300">
            O tour fica bem mais concreto com dados na tela. Posso carregar <strong>{tour.demo.nome}</strong> como
            exemplo — {tour.demo.total} registros, {tour.demo.inicio}–{tour.demo.fim},{' '}
            {tamanhoLegivel(tour.demo.downloadBytes)} de download. Você troca por outra quando quiser.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {tour.demo && (
            <button type="button" className="btn btn-primary" onClick={() => void tour.rodar({ nome: tour.demo!.nome, tipo: tour.demo!.tipo })}>
              <Play size={15} className="shrink-0" aria-hidden /> Carregar e começar
            </button>
          )}
          <button type="button" className="btn" onClick={() => void tour.rodar(null)}>Começar sem carregar</button>
          <button type="button" className="btn" onClick={tour.fecharOferta}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Convite na apresentação.
 *
 * Não abre nada sozinho: quem já sabe o que quer não tem a tela sequestrada.
 * Some depois de aceito ou dispensado, e volta pelo botão em Configurações.
 */
export function ConviteDoTour({ aoComecar }: { aoComecar: () => void }) {
  const [visivel, setVisivel] = useState(() => !tourJaVisto((k) => localStorage.getItem(k)));
  if (!visivel) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-lg border border-eco-accent/40 bg-eco-accent/10 p-3 text-sm">
      <Compass size={18} className="shrink-0 text-eco-accent" aria-hidden />
      <span className="text-slate-200">Primeira vez aqui? Um tour de 2 minutos mostra o caminho.</span>
      <button type="button" className="btn btn-primary" onClick={() => { setVisivel(false); aoComecar(); }}>Fazer o tour</button>
      <button type="button" className="btn" onClick={() => { marcarVisto(); setVisivel(false); }}>
        <X size={14} className="shrink-0" aria-hidden /> Agora não
      </button>
    </div>
  );
}
