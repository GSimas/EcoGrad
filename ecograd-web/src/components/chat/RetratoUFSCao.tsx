import { useState } from 'react';
import { Dog } from 'lucide-react';
import { Janela } from '@/components/layout/Janela';

/**
 * Retrato do UFSCão. A ilustração vive em `public/`; se ela faltar, o ícone de
 * cachorro assume — o chat não pode quebrar por causa de uma imagem.
 *
 * São dois arquivos de propósito: o avatar aparece em cada resposta, com 24 a
 * 32 px, e baixar 1,4 MB para isso pesaria em toda página com o chat aberto. A
 * arte em tamanho cheio fica para a ampliação, que é sob clique.
 */
const RETRATO = '/ufscao.png';
const RETRATO_AVATAR = '/ufscao-256.png';
export function RetratoUFSCao({ tamanho, className }: { tamanho: number; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) return <Dog size={tamanho} className={className} aria-hidden />;
  return <img src={RETRATO_AVATAR} alt="" aria-hidden width={tamanho} height={tamanho}
    className={`shrink-0 rounded-full object-cover ${className ?? ''}`} style={{ width: tamanho, height: tamanho }}
    onError={() => setFalhou(true)} />;
}

/**
 * Ampliação do retrato, com a descrição do mascote.
 *
 * O mesmo diálogo serve o painel flutuante e a conversa da tela inicial: a arte
 * em tamanho cheio e o texto que a explica ficam num lugar só, em vez de duas
 * cópias que divergem quando uma delas muda.
 */
export function JanelaRetratoUFSCao({ aberta, onOpenChange }: { aberta: boolean; onOpenChange: (v: boolean) => void }) {
  return <Janela aberta={aberta} onOpenChange={onOpenChange} titulo="UFSCão"
    descricao="O mascote do consultor de IA do EcoGrad, em homenagem aos cães que circulam pelos campi da UFSC.">
    <img src={RETRATO} alt="Ilustração do UFSCão: um cão caramelo sorridente, de coleira e bandana azuis da UFSC, com medalha do brasão da universidade." className="mx-auto max-h-[60dvh] w-auto object-contain" />
  </Janela>;
}
