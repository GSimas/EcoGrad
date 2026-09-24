import { useQuery } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { configCortesia, salvarConfigIA, type ConfigSalva } from '@/lib/provedores-ia';
import { cotaCortesia } from '@/services/ufscao-acervo';

/**
 * Oferta de cortesia: as primeiras perguntas por conta do EcoGrad.
 *
 * Vive aqui, e não só na tela inicial, porque quem chega direto ao painel
 * flutuante — sem passar pela apresentação — encontrava apenas o formulário de
 * chave, sem saber que podia experimentar antes de configurar provedor nenhum.
 * A chave de cortesia é a mesma das duas superfícies (`lerConfigIA`), então
 * aceitar aqui vale lá e vice-versa.
 */
export function OfertaDeCortesia({ onAceitar }: { onAceitar: (c: ConfigSalva) => void }) {
  // Consultar a cota não gasta cota; sem resposta da função, a oferta some.
  const cota = useQuery({ queryKey: ['cortesia'], queryFn: ({ signal }) => cotaCortesia(signal), staleTime: 60 * 1000, retry: 0 });
  if (!cota.data?.disponivel || cota.data.restantes <= 0) return null;
  return (
    <div className="info space-y-2">
      <p>
        <strong>Experimente sem chave.</strong> As primeiras {cota.data.total ?? 10} perguntas são por conta do
        EcoGrad, para você conhecer o UFSCão — restam {cota.data.restantes}. Depois delas, configure seu provedor
        abaixo e continue sem limite.
      </p>
      <button type="button" className="btn btn-primary text-xs" onClick={() => {
        const c = { ...configCortesia(), lembrar: false };
        salvarConfigIA(c);
        onAceitar(c);
      }}>
        <Gift size={14} className="shrink-0" aria-hidden /> Conversar agora, sem chave
      </button>
    </div>
  );
}
