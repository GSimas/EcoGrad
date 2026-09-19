/**
 * Tokens visuais dos gráficos.
 *
 * Ficam em `lib`, e não no componente do gráfico, porque os construtores de
 * opção também vivem aqui — e são usados tanto pela tela quanto pela montagem
 * do relatório em PDF, que não monta React nenhum. `components/ui/Chart`
 * reexporta os dois nomes, então quem já os importava de lá segue funcionando.
 */

/** Tokens compartilhados por todos os gráficos (tema escuro do EcoGrad). */
export const TEMA_GRAFICO = {
  texto: '#CBD5E1',
  eixo: '#475569',
  grade: '#1E293B',
  fundoTooltip: '#161B22',
  paleta: ['#F39C12', '#3498DB', '#2ECC71', '#E74C3C', '#9B59B6', '#1ABC9C', '#E67E22', '#F1C40F'],
};

/** Cores semânticas dos quadrantes do Radar (idênticas ao Plotly do Streamlit). */
export const CORES_QUADRANTE: Record<string, string> = {
  '↗ Tendência': '#2ECC71',
  '↖ Sinal Fraco': '#F1C40F',
  '↘ Mainstream': '#3498DB',
  '↙ Base/Declínio': '#E74C3C',
};
