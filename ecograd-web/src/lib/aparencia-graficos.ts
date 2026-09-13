/** Adapt drawing styles only. Values, labels, series order, categories and callbacks stay intact. */
export function adaptarGrafico<T>(opcao: T, claro: boolean, reduzir: boolean): T {
  const cores: Record<string, string> = claro ? {
    '#CBD5E1': '#334155', '#E2E8F0': '#1E293B', '#475569': '#64748B',
    '#1E293B': '#CBD5E1', '#161B22': '#FFFFFF', '#26303B': '#6F7E91',
  } : {};
  const visitar = (v: unknown, chave = ''): unknown => {
    if (typeof v === 'string' && ['color', 'backgroundColor', 'borderColor'].includes(chave)) return cores[v.toUpperCase()] ?? v;
    if (reduzir && chave === 'animation') return false;
    if (Array.isArray(v)) return v.map(x => visitar(x, chave));
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k,x]) => [k,visitar(x,k)]));
    return v;
  };
  const resultado = visitar(opcao) as Record<string, unknown>;
  if (resultado && Array.isArray(resultado.series)) resultado.series = resultado.series.map((item: Record<string, unknown>) => {
    if (item.type === 'wordCloud') return { ...item, textStyle: { ...(item.textStyle as object), color: claro ? '#334155' : '#CBD5E1' } };
    if (['scatter', 'bar'].includes(String(item.type))) return { ...item, itemStyle: { borderColor: claro ? '#334155' : '#CBD5E1', borderWidth: 1.5, ...(item.itemStyle as object) } };
    return item;
  });
  return resultado as T;
}
