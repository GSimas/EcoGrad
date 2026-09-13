import type { CatalogoCapes } from '@/types';

export function FonteCapes({ catalogo }: { catalogo: CatalogoCapes }) {
  return (
    <p className="text-xs leading-relaxed text-slate-400">
      Fonte: <a className="text-eco-accent underline" href={catalogo.fonte.url} target="_blank" rel="noopener noreferrer">CAPES — catálogo oficial consultado</a>.
      {' '}Consulta realizada em <time dateTime={catalogo.fonte.consultadoEm}>{new Date(catalogo.fonte.consultadoEm).toLocaleString('pt-BR')}</time>.
      {' '}Esta é a data da consulta do EcoGrad, não a data de atualização dos registros pela CAPES.
    </p>
  );
}
