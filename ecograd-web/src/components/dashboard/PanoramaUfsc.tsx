import { PanoramaAcervo } from './PanoramaAcervo';
import { PanoramaCapes } from './PanoramaCapes';

/**
 * O Panorama UFSC: o acervo que o EcoGrad reúne, e os programas que a CAPES
 * reconhece.
 *
 * São duas leituras da mesma universidade, e de propósito ficam separadas. O
 * acervo vem do repositório e descreve o que foi depositado; o catálogo CAPES
 * vem da Plataforma Sucupira e descreve o que é oficialmente reconhecido. Um não
 * valida o outro, e somá-los seria inventar uma correspondência que não existe.
 *
 * Também falham separado: o acervo sai do arquivo do build e está sempre ali; a
 * CAPES é consulta de rede e pode não responder. Uma seção indisponível não leva
 * a outra junto.
 */
export function PanoramaUfsc({ aoNavegar }: { aoNavegar: () => void }) {
  return (
    <div className="space-y-10">
      <PanoramaAcervo aoNavegar={aoNavegar} />
      <div className="border-t border-eco-border pt-8">
        <PanoramaCapes />
      </div>
    </div>
  );
}
