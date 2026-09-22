import { rotaVisivel, type AbaAvancada } from './navigation';
import type { Rota, TipoBusca } from '../types';
/** Objetivo que leva a página escondida sai da lista: prometer o que não abre é pior que oferecer menos. */
const TODOS: { id: string; titulo: string; descricao: string; orientacao: string; rota: Rota; buscaTipo?: TipoBusca; aba?: AbaAvancada }[] = [
  { id: 'trabalhos', titulo: 'Encontrar trabalhos para ler', descricao: 'Localize títulos, consulte dossiês e abra a fonte original.', orientacao: 'Escolha a área do trabalho. Depois, use a categoria Documentos no Motor de Busca e confirme um título do catálogo.', rota: 'busca', buscaTipo: 'Documento' },
  { id: 'orientadores', titulo: 'Encontrar pesquisadores por tema', descricao: 'Parta de um assunto e explore pessoas e trabalhos relacionados.', orientacao: 'Escolha coleções próximas ao seu tema. Depois, pesquise em Temas e explore os relacionamentos do assunto. Presença na rede não indica disponibilidade para orientar.', rota: 'busca', buscaTipo: 'Palavra-chave' },
  { id: 'panorama', titulo: 'Conhecer a produção das coleções', descricao: 'Veja volumes, temas e pessoas no Dashboard.', orientacao: 'Comece com uma coleção; adicione outras para explorar em conjunto. Confira períodos e tipos antes de comparar volumes.', rota: 'dashboard' },
  { id: 'estrutura', titulo: 'Entender a estrutura da rede', descricao: 'Situe temas, pessoas e conceitos no grafo, em Análise Avançada.', orientacao: 'Prefira coleções com palavras-chave e macrotemas preenchidos. Os índices descrevem a posição na rede deste recorte; não medem qualidade nem impacto.', rota: 'avancada', aba: 'rede' },
  { id: 'tendencias', titulo: 'Investigar mudanças nos temas', descricao: 'Examine a evolução do vocabulário no Radar de Foresight.', orientacao: 'Prefira coleções com anos e palavras-chave preenchidos. Os sinais dependem do recorte e dos parâmetros; não são previsões garantidas.', rota: 'avancada', aba: 'tempo' },
  { id: 'ideias', titulo: 'Explorar conceitos e métodos', descricao: 'Acompanhe ocorrências de conceitos e prepare a ontologia.', orientacao: 'Confira palavras-chave e resumos disponíveis. A extração por IA é opcional e precisa de conferência nas fontes.', rota: 'avancada', aba: 'temas' },
];
export const OBJETIVOS = TODOS.filter((o) => rotaVisivel(o.rota));
export function objetivoPorId(id: unknown) {
  return OBJETIVOS.find((o) => o.id === id) ?? OBJETIVOS.find((o) => o.rota === 'dashboard') ?? OBJETIVOS[0];
}
