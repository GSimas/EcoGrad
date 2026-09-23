/**
 * Tokens visuais dos gráficos.
 *
 * Ficam em `lib`, e não no componente do gráfico, porque os construtores de
 * opção também vivem aqui — e são usados tanto pela tela quanto pela montagem
 * do relatório em PDF, que não monta React nenhum. `components/ui/Chart`
 * reexporta os dois nomes, então quem já os importava de lá segue funcionando.
 */

/** Tokens compartilhados por todos os gráficos (tema escuro, paleta Scientata). */
export const TEMA_GRAFICO = {
  texto: '#CBD2CE',
  eixo: '#4D5954',
  grade: '#16241F',
  fundoTooltip: '#0D1C17',
  // Abre no limão-sinal da marca; no claro `adaptarGrafico` o troca pelo verde-petróleo.
  paleta: ['#B8FF4A', '#53D7D0', '#E9A13B', '#6A7DFF', '#E56D45', '#8FCF3E', '#55BADC', '#F5BD59'],
};

/** Cores semânticas dos quadrantes do Radar: os matizes do Streamlit, no tom da Scientata. */
export const CORES_QUADRANTE: Record<string, string> = {
  '↗ Tendência': '#8FCF3E',
  '↖ Sinal Fraco': '#F5BD59',
  '↘ Mainstream': '#55BADC',
  '↙ Base/Declínio': '#E56D45',
};
